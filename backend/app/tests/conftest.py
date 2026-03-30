import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine

TEST_DB_FILE = Path(__file__).resolve().parents[2] / "test_app.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = "test-secret"
os.environ["COOKIE_SAMESITE"] = "lax"

db = importlib.import_module("app.db")

db.engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db_file():
    if TEST_DB_FILE.exists():
        TEST_DB_FILE.unlink()
    yield
    if TEST_DB_FILE.exists():
        TEST_DB_FILE.unlink()


@pytest.fixture(autouse=True)
def reset_database():
    SQLModel.metadata.drop_all(db.engine)
    SQLModel.metadata.create_all(db.engine)
    yield


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
