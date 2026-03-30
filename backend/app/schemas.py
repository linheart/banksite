from datetime import datetime
from typing import Annotated, Any, Literal, TypeAlias

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, model_validator


def _strip_required(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("Field must not be empty")
    return value

def _normalize_email(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().lower()
    return value

CleanStr: TypeAlias = Annotated[str, BeforeValidator(_strip_required)]
CleanEmail: TypeAlias = Annotated[EmailStr, BeforeValidator(_normalize_email)]
UserRole: TypeAlias = Literal["viewer", "operator", "auditor", "admin"]

class UserCreate(BaseModel):
    username: CleanStr = Field(min_length=3, max_length=150)
    email: CleanEmail
    password: str = Field(min_length=8, max_length=255)

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    branch_ids: list[int] = Field(default_factory=list)

class LoginPayload(BaseModel):
    username: CleanStr
    password: str

class BranchCreate(BaseModel):
    name: CleanStr = Field(min_length=1, max_length=150)


class BranchUpdate(BaseModel):
    name: CleanStr = Field(min_length=1, max_length=150)


class BranchOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserAccessUpdate(BaseModel):
    role: UserRole
    branch_ids: list[int] = Field(default_factory=list)


class UserAccessOut(BaseModel):
    user_id: int
    username: str
    role: UserRole
    branch_ids: list[int]

class DeviceConfigCreate(BaseModel):
    branch_id: int = Field(gt=0)
    device_type: str | None = None
    name: str | None = None
    config_text: CleanStr = Field(min_length=1)

class DeviceConfigUpdate(BaseModel):
    branch_id: int | None = Field(default=None, gt=0)
    device_type: str | None = None
    name: str | None = None
    config_text: str | None = None

    @model_validator(mode="after")
    def validate_not_empty_patch(self) -> "DeviceConfigUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "config_text" in self.model_fields_set and self.config_text is None:
            raise ValueError("config_text must not be empty")
        return self

class DeviceConfigOut(BaseModel):
    id: int
    branch_id: int
    device_type: str | None
    name: str | None
    config_text: str
    last_modified: datetime | None = None

    model_config = {"from_attributes": True}

class DeviceConfigListOut(BaseModel):
    items: list[DeviceConfigOut]
    total: int
    limit: int
    offset: int

class AuditOut(BaseModel):
    id: int
    config_id: int
    action: str
    user_id: int | None = None
    event_at: datetime | None = None
    description: str | None = None

    model_config = {"from_attributes": True}
