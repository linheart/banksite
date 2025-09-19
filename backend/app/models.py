from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, Text, TIMESTAMP, func

class Users(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(sa_column=Column(String(150), unique=True, nullable=False))
    email: str = Field(sa_column=Column(String(254), unique=True, nullable=False))
    password_hash: str = Field(sa_column=Column(String(255), nullable=False))

class Branch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(150), unique=True, nullable=False))

class DeviceConfig(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    branch_id: int = Field(nullable=False)
    device_type: str | None = Field(default=None, sa_column=Column(String(100)))
    name: str | None = Field(default=None, sa_column=Column(String(150)))
    config_text: str = Field(sa_column=Column(Text, nullable=False))
    last_modified: datetime | None = Field(
        default=None,
        sa_column=Column(
            TIMESTAMP(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )

class AuditLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    config_id: int = Field(nullable=False)
    action: str = Field(sa_column=Column(String(20), nullable=False))
    user_id: int | None = Field(default=None)
    timestamp: datetime | None = Field(
        default=None,
        sa_column=Column(
            TIMESTAMP(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    description: str | None = Field(sa_column=Column(Text))
