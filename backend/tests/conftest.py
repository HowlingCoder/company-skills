from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from alembic import command
from skill_management.db import engine, get_session
from skill_management.main import app

ALEMBIC_INI = Path(__file__).parent.parent / "alembic.ini"


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    """Build the schema through the migrations, so the tests cover them too."""
    command.upgrade(Config(ALEMBIC_INI), "head")


@pytest.fixture
def session() -> Iterator[Session]:
    """Session inside a transaction that is rolled back after the test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    """API client whose requests use the test session, so they are rolled back."""
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()
