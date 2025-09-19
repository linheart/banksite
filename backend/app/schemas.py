from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str

    model_config = {"from_attributes": True}

class LoginPayload(BaseModel):
    username: str
    password: str

class DeviceConfigCreate(BaseModel):
    branch_id: int
    device_type: str | None = None
    name: str | None = None
    config_text: str

class DeviceConfigUpdate(BaseModel):
    branch_id: int | None = None
    device_type: str | None = None
    name: str | None = None
    config_text: str | None = None

class DeviceConfigOut(BaseModel):
    id: int
    branch_id: int
    device_type: str | None
    name: str | None
    config_text: str
    last_modified: datetime | None = None

    model_config = {"from_attributes": True}

class AuditOut(BaseModel):
    id: int
    config_id: int
    action: str
    user_id: int | None = None
    timestamp: datetime | None = None
    description: str | None = None

    model_config = {"from_attributes": True}
