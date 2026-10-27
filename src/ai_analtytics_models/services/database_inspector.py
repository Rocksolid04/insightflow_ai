from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


# Retrieve all visible tables/views and their columns in one round trip.
# Do not impose a table-count limit: the agent must be able to discover the
# complete accessible schema, including large databases.
_SCHEMA_QUERY = text(
    """
    SELECT
        tables.table_schema,
        tables.table_name,
        tables.table_type,
        columns.column_name,
        columns.data_type,
        columns.is_nullable,
        columns.ordinal_position
    FROM information_schema.tables AS tables
    LEFT JOIN information_schema.columns AS columns
        ON columns.table_schema = tables.table_schema
       AND columns.table_name = tables.table_name
    WHERE tables.table_schema NOT IN (
        'information_schema',
        'pg_catalog'
    )
      AND tables.table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY
        tables.table_schema,
        tables.table_name,
        columns.ordinal_position
    """
)


async def inspect_database(engine: AsyncEngine) -> dict[str, Any]:
    """Return metadata for every visible PostgreSQL table and view.

    All tables and views visible through information_schema are included.
    Metadata is retrieved in one query to avoid one additional round trip per
    table. Results retain the response shape used by the database agent.
    """
    tables_by_key: dict[tuple[str, str], dict[str, Any]] = {}

    async with engine.connect() as connection:
        result = await connection.execute(_SCHEMA_QUERY)

        for row in result.mappings():
            schema_name = row["table_schema"]
            table_name = row["table_name"]
            key = (schema_name, table_name)

            if key not in tables_by_key:
                tables_by_key[key] = {
                    "schema": schema_name,
                    "name": table_name,
                    "type": row["table_type"],
                    "columns": [],
                }

            # LEFT JOIN also preserves a table/view if column metadata is
            # unavailable or absent, rather than dropping the table.
            if row["column_name"] is not None:
                tables_by_key[key]["columns"].append(
                    {
                        "name": row["column_name"],
                        "data_type": row["data_type"],
                        "nullable": row["is_nullable"] == "YES",
                        "ordinal_position": row["ordinal_position"],
                    }
                )

    tables = list(tables_by_key.values())

    return {
        "table_count": len(tables),
        "tables": tables,
    }
