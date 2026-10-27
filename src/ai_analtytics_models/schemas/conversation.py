from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ConversationCreate(BaseModel):
    title: str = Field(default="New analysis", min_length=1, max_length=200)
    source_type: Literal["dataset", "database"] = "dataset"
    dataset_id: int | None = None
    connection_id: int | None = None

    @model_validator(mode="after")
    def validate_source(self):
        if self.source_type == "dataset" and self.connection_id is not None:
            raise ValueError("A dataset conversation cannot reference a database connection.")
        if self.source_type == "database" and self.dataset_id is not None:
            raise ValueError("A database conversation cannot reference a dataset.")
        if self.source_type == "dataset" and self.dataset_id is None:
            raise ValueError("A dataset conversation requires a dataset_id.")
        if self.source_type == "database" and self.connection_id is None:
            raise ValueError("A database conversation requires a connection_id.")
        return self


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ConversationMessageCreate(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)
    chart: dict[str, Any] | None = None
    report: dict[str, Any] | None = None
    tool_calls: list[Any] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConversationResponse(BaseModel):
    id: int
    title: str
    source_type: str
    dataset_id: int | None
    connection_id: int | None
    messages: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
