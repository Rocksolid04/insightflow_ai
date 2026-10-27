
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    field_validator,
)


class DatabaseConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=5432, ge=1, le=65535)
    database_name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: SecretStr

    @field_validator("name", "host", "database_name", "username")
    @classmethod
    def strip_required_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value():
            raise ValueError("Password cannot be empty.")
        return value


class DatabaseConnectionResponse(BaseModel):
    id: int
    name: str
    database_type: str
    host: str
    port: int
    database_name: str
    username: str
    is_active: bool
    last_tested_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatabaseConnectionTestResponse(BaseModel):
    connection_id: int
    success: bool
    message: str
    tested_at: datetime


class DatabaseQueryRequest(BaseModel):
    # Used by the natural-language ask endpoint and the direct SQL endpoint.
    query: str = Field(min_length=1, max_length=20_000)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Query or question cannot be empty.")
        return value


class DatabaseSQLExportRequest(BaseModel):
    sql_query: str = Field(min_length=1, max_length=20_000)

    @field_validator("sql_query")
    @classmethod
    def validate_sql_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("SQL query cannot be empty.")
        return value


class DatabaseToolCall(BaseModel):
    tool: str
    result: Any = None

    model_config = ConfigDict(extra="allow")


class DatabaseChartResponse(BaseModel):
    chart_type: str
    title: str
    x_column: str
    y_column: str | None = None
    data: list[dict[str, Any]]
    row_count: int = Field(ge=0)
    skipped_rows: int = Field(default=0, ge=0)
    truncated: bool = False

    model_config = ConfigDict(extra="allow")


class DatabaseAnalysisResponse(BaseModel):
    connection_id: int
    question: str
    answer: str
    tool_calls: list[DatabaseToolCall] = Field(default_factory=list)
    chart: DatabaseChartResponse | None = None

    # Structured report shape is defined by the reporting service.
    # Keep it flexible so the API does not discard valid report fields.
    report: dict[str, Any] | None = None
    report_error: str | None = None
    report_evidence_truncated: bool = False

    model_config = ConfigDict(extra="allow")
