from datetime import datetime
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Index, Integer, String, Text, TIMESTAMP, func, text


class UserRole:
    VIEWER = "viewer"
    OPERATOR = "operator"
    AUDITOR = "auditor"
    ADMIN = "admin"
    ALL = {VIEWER, OPERATOR, AUDITOR, ADMIN}


class Users(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(sa_column=Column(String(150), unique=True, nullable=False))
    email: str = Field(sa_column=Column(String(250), unique=True, nullable=False))
    password_hash: str = Field(sa_column=Column(String(255), nullable=False))
    role: str = Field(
        default=UserRole.VIEWER,
        sa_column=Column(String(20), nullable=False, index=True),
    )

class Branch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(150), unique=True, nullable=False))


class UserBranchAccess(SQLModel, table=True):
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        )
    )
    branch_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("branch.id", ondelete="CASCADE"),
            primary_key=True,
        )
    )


class DeviceConfig(SQLModel, table=True):
    __table_args__ = (
        Index(
            "uq_deviceconfig_branch_name_active",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND name IS NOT NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    branch_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("branch.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    device_type: str | None = Field(default=None, sa_column=Column(String(100)))
    name: str | None = Field(default=None, sa_column=Column(String(150)))
    config_text: str = Field(sa_column=Column(Text, nullable=False))
    deleted_at: datetime | None = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
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
    config_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("deviceconfig.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    action: str = Field(sa_column=Column(String(20), nullable=False))
    user_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    event_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            "timestamp",
            TIMESTAMP(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    description: str | None = Field(sa_column=Column(Text))
