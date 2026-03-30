import os
from typing import Generator

from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine

from . import models as _models

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in env")

SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"
engine = create_engine(
    DATABASE_URL,
    echo=SQL_ECHO,
    pool_pre_ping=True,
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
