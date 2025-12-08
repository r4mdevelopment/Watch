import json
from fastapi.testclient import TestClient

# Импорт приложения и зависимостей
from backend.main import app, get_db
from backend.database import SessionLocal
from backend import models


# Хелпер для красивого логирования шагов
def step(name: str):
    print(f"\n=== {name} ===")


# Переопределяем зависимость get_db -> SQLite session
def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides = {}


# === ИНТЕГРАЦИОННЫЙ ТЕСТ ПОЛНОГО ПОЛЬЗОВАТЕЛЬСКОГО СЦЕНАРИЯ ===

def test_full_integration_scenario():
    """
    Полный интеграционный тест системы.
    Сценарий:
    1. Регистрация пользователя
    2. Авторизация
    3. Получение популярных фильмов
    4. Добавление фильма в избранное
    5. Получение списка избранного
    6. Добавление просмотра в историю
    7. Получение истории просмотров
    8. Создание отзыва
    9. Получение отзывов по фильму
    """

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Регистрация пользователя
    step("1. Регистрация пользователя")
    r = client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "123456"
    })
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200

    # 2. Авторизация
    step("2. Авторизация")
    r = client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "123456"
    })
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Получение популярных фильмов
    step("3. Получение популярных фильмов")
    r = client.get("/api/movies/popular?page=1")
    print("Status:", r.status_code)
    json_data = r.json()
    print("Response:", json.dumps(json_data, indent=2)[:500], "...")
    assert r.status_code == 200

    # 4. Добавление фильма в избранное
    step("4. Добавление фильма в избранное")
    r = client.post("/api/favorites", json={"movie_id": 19995}, headers=headers)
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200

    # 5. Получение списка избранного
    step("5. Получение списка избранного")
    r = client.get("/api/favorites", headers=headers)
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 6. Добавление просмотра в историю
    step("6. Добавление просмотра в историю")
    r = client.post("/api/history", json={"movie_id": 19995}, headers=headers)
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200

    # 7. Получение истории просмотров
    step("7. Получение истории просмотров")
    r = client.get("/api/history", headers=headers)
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 8. Создание отзыва
    step("8. Создание отзыва")
    r = client.post("/api/reviews", json={
        "movie_id": 19995,
        "rating": 8,
        "comment": "Great movie!"
    }, headers=headers)

    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200

    # 9. Получение отзывов по фильму
    step("9. Получение отзывов по фильму")
    r = client.get("/api/reviews/19995")
    print("Status:", r.status_code)
    print("Response:", r.json())
    assert r.status_code == 200
    assert len(r.json()) == 1

