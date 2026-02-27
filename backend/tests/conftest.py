import sys
from pathlib import Path
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.api.v1.deps import public_rate_limiter
from app.services import insights as insights_service
from app.services import reporting as reporting_service


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)
    Base.metadata.create_all(bind=engine)
    original_session_local = insights_service.SessionLocal
    original_reporting_session_local = reporting_service.SessionLocal
    insights_service.SessionLocal = TestingSessionLocal
    reporting_service.SessionLocal = TestingSessionLocal
    public_rate_limiter.reset()

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    insights_service.SessionLocal = original_session_local
    reporting_service.SessionLocal = original_reporting_session_local
    public_rate_limiter.reset()
