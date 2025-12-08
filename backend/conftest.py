
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

# Перед импортом backend-модулей задаём тестовые переменные окружения
os.environ["DATABASE_URL"] = "sqlite:///./test_watch.db"
os.environ["TMDB_API_KEY"] = "test-tmdb-key"
# os.environ["USE_TMDB_CACHE"] = "1"

from backend import models
from backend.database import engine
from backend.main import get_db, app


TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    """
    На старте тестовой сессии пересоздаём таблицы в тестовой SQLite.
    """
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    yield
    models.Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """
    Отдельная сессия БД на каждый тест.
    """
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """
    TestClient FastAPI с переопределённым get_db, чтобы всё шло в SQLite.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
