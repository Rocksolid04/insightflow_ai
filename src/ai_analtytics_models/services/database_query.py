from __future__ import annotations

import base64
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError
from sqlalchemy.ext.asyncio import AsyncEngine

MAX_ROWS = 500
MAX_QUERY_LENGTH = 50_000
QUERY_TIMEOUT_MS = 5_000

# These expression names are checked wherever they appear in the parsed tree,
# not only at the root. The root allow-list below is the primary boundary.
FORBIDDEN_EXPRESSION_NAMES = (
    "Insert",
    "Update",
    "Delete",
    "Merge",
    "Create",
    "Alter",
    "Drop",
    "TruncateTable",
    "Command",
    "Copy",
    "Grant",
    "Revoke",
    "Set",
    "SetItem",
    "Use",
    "Transaction",
    "Commit",
    "Rollback",
    "Execute",
    "Declare",
    "Pragma",
    "Attach",
    "Detach",
    "Into",
    "Lock",
    "Analyze",
    "Cache",
    "Uncache",
    "LoadData",
    "Export",
    "Import",
)

# This is defense in depth, not a complete security boundary. The PostgreSQL
# role used by the application must also be least-privileged.
FORBIDDEN_FUNCTIONS = {
    "PG_SLEEP",
    "PG_SLEEP_FOR",
    "PG_SLEEP_UNTIL",
    "SET_CONFIG",
    "NEXTVAL",
    "SETVAL",
    "PG_SEQUENCE_LAST_VALUE",
    "PG_READ_FILE",
    "PG_READ_BINARY_FILE",
    "PG_WRITE_FILE",
    "PG_WRITE_BINARY_FILE",
    "PG_LS_DIR",
    "PG_STAT_FILE",
    "LO_IMPORT",
    "LO_EXPORT",
    "DBLINK_EXEC",
    "DBLINK_SEND_QUERY",
    "DBLINK_GET_RESULT",
    "PG_CANCEL_BACKEND",
    "PG_TERMINATE_BACKEND",
    "PG_RELOAD_CONF",
    "PG_ROTATE_LOGFILE",
    "PG_LOG_BACKEND_MEMORY_CONTEXTS",
    "PG_NOTIFY",
    "PG_ADVISORY_LOCK",
    "PG_ADVISORY_LOCK_SHARED",
    "PG_TRY_ADVISORY_LOCK",
    "PG_TRY_ADVISORY_LOCK_SHARED",
    "PG_ADVISORY_XACT_LOCK",
    "PG_ADVISORY_XACT_LOCK_SHARED",
}

_REQUIRED_FORBIDDEN_TYPES = (
    "Insert",
    "Update",
    "Delete",
    "Create",
    "Alter",
    "Drop",
    "Command",
)


def _forbidden_expression_types() -> tuple[type, ...]:
    """Resolve SQLGlot expression types, failing closed for core types."""
    expression_types: list[type] = []
    missing_required: list[str] = []

    for name in FORBIDDEN_EXPRESSION_NAMES:
        expression_type = getattr(exp, name, None)
        if isinstance(expression_type, type):
            expression_types.append(expression_type)
        elif name in _REQUIRED_FORBIDDEN_TYPES:
            missing_required.append(name)

    if missing_required:
        raise RuntimeError(
            "Installed SQLGlot version is missing required expression types: "
            + ", ".join(missing_required)
        )

    return tuple(expression_types)


def _validate_functions(expression: exp.Expression) -> None:
    """Reject known side-effecting or dangerous SQL functions."""
    for node in expression.walk():
        if not isinstance(node, exp.Func):
            continue

        try:
            function_name = node.sql_name().upper()
        except (AttributeError, TypeError):
            function_name = ""

        if isinstance(node, exp.Anonymous):
            function_name = node.name.upper()

        if function_name in FORBIDDEN_FUNCTIONS:
            raise ValueError(
                f"The SQL query uses a forbidden function: {function_name}."
            )


def validate_read_only_query(query: str) -> str:
    """Validate a single read-only SELECT, CTE, or set-operation query."""
    if not isinstance(query, str) or not query.strip():
        raise ValueError("SQL query cannot be empty.")

    cleaned = query.strip()
    if len(cleaned) > MAX_QUERY_LENGTH:
        raise ValueError(
            f"SQL query exceeds the {MAX_QUERY_LENGTH}-character limit."
        )

    try:
        expressions = sqlglot.parse(cleaned, read="postgres")
    except ParseError as exc:
        raise ValueError("The SQL query could not be parsed safely.") from exc

    expressions = [expression for expression in expressions if expression is not None]
    if len(expressions) != 1:
        raise ValueError("Only one SQL statement is allowed.")

    expression = expressions[0]
    allowed_roots = (exp.Select, exp.Union, exp.Intersect, exp.Except)
    if not isinstance(expression, allowed_roots):
        raise ValueError(
            "Only SELECT queries, read-only CTEs, and read-only set "
            "operations are allowed."
        )

    forbidden_types = _forbidden_expression_types()
    for node in expression.walk():
        if forbidden_types and isinstance(node, forbidden_types):
            raise ValueError("The SQL query contains a forbidden operation.")

        if isinstance(node, exp.Select) and node.args.get("into") is not None:
            raise ValueError("SELECT INTO is not allowed.")

    _validate_functions(expression)

    # Strip only a final semicolon; don't re-render the parsed AST.
    if cleaned.endswith(";"):
        cleaned = cleaned[:-1].rstrip()

    return cleaned


def _json_safe_value(value: Any) -> Any:
    """Normalize common PostgreSQL values for JSON/tool-call responses."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        # Preserve numeric precision rather than silently rounding to float.
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(value)).decode("ascii")
    if isinstance(value, dict):
        return {str(key): _json_safe_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe_value(item) for item in value]
    # Unknown driver-specific types are returned as strings rather than
    # allowing a serialization failure to break the entire response.
    return str(value)


async def execute_read_only_query(
    engine: AsyncEngine,
    query: str,
) -> dict[str, Any]:
    """Execute one validated query in a read-only transaction with limits."""
    safe_query = validate_read_only_query(query)

    async with engine.connect() as connection:
        async with connection.begin():
            # Must be the first command in the transaction.
            await connection.exec_driver_sql("SET TRANSACTION READ ONLY")

            # Use a bind parameter for the timeout value instead of SQL
            # interpolation. set_config(..., true) applies it transaction-locally.
            from sqlalchemy import text

            await connection.execute(
                text("SELECT set_config('statement_timeout', :timeout, true)"),
                {"timeout": f"{QUERY_TIMEOUT_MS}ms"},
            )

            result = await connection.exec_driver_sql(safe_query)
            columns = list(result.keys())
            rows = result.mappings().fetchmany(MAX_ROWS + 1)

            truncated = len(rows) > MAX_ROWS
            rows = rows[:MAX_ROWS]
            returned_rows = [
                {str(key): _json_safe_value(value) for key, value in row.items()}
                for row in rows
            ]

            return {
                "columns": columns,
                "rows": returned_rows,
                "row_count": len(returned_rows),
                "truncated": truncated,
                "max_rows": MAX_ROWS,
                "summary": {
                    "returned_rows": len(returned_rows),
                    "returned_columns": len(columns),
                    "truncated": truncated,
                },
            }
