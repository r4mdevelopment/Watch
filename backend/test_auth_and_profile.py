
from backend import models, main, database

from sqlalchemy.orm import Session


def _get_user_by_username(db: Session, username: str) -> models.User | None:
    return db.query(models.User).filter(models.User.username == username).first()


def test_register_creates_user_and_returns_token(client, db_session):
    payload = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "StrongPass123!",
        "confirm_password": "StrongPass123!",
    }

    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["username"] == "testuser"
    assert data["user"]["email"] == "test@example.com"

    # Пользователь действительно появился в базе
    user_in_db = _get_user_by_username(db_session, "testuser")
    assert user_in_db is not None
    assert user_in_db.email == "test@example.com"
    # Пароль хранится в виде хеша
    assert user_in_db.hashed_password != "StrongPass123!"


def test_register_duplicate_username_and_email(client, db_session):
    # Первый пользователь
    payload = {
        "username": "dupuser",
        "email": "dup1@example.com",
        "password": "Pass123!",
        "confirm_password": "Pass123!",
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 200

    # Дубликат username
    payload2 = {
        "username": "dupuser",         # тот же username
        "email": "dup2@example.com",
        "password": "Pass123!",
        "confirm_password": "Pass123!",
    }
    r2 = client.post("/api/auth/register", json=payload2)
    assert r2.status_code == 400
    assert r2.json()["detail"] == "Username already registered"

    # Дубликат email
    payload3 = {
        "username": "otheruser",
        "email": "dup1@example.com",   # тот же email
        "password": "Pass123!",
        "confirm_password": "Pass123!",
    }
    r3 = client.post("/api/auth/register", json=payload3)
    assert r3.status_code == 400
    assert r3.json()["detail"] == "Email already registered"


def test_login_and_me_endpoint(client):
    # Сначала регистрация
    reg = {
        "username": "loginuser",
        "email": "login@example.com",
        "password": "LoginPass123!",
        "confirm_password": "LoginPass123!",
    }
    r = client.post("/api/auth/register", json=reg)
    assert r.status_code == 200

    # Логин
    login_payload = {
        "username": "loginuser",
        "password": "LoginPass123!",
    }
    resp = client.post("/api/auth/login", json=login_payload)
    assert resp.status_code == 200
    data = resp.json()
    token = data["access_token"]

    # /api/auth/me с токеном
    resp_me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_me.status_code == 200
    me = resp_me.json()
    assert me["username"] == "loginuser"
    assert me["email"] == "login@example.com"


def test_update_profile_display_name_and_password(client, db_session):
    # Регистрация
    reg = {
        "username": "profileuser",
        "email": "profile@example.com",
        "password": "OldPass123!",
        "confirm_password": "OldPass123!",
    }
    r = client.post("/api/auth/register", json=reg)
    assert r.status_code == 200
    token = r.json()["access_token"]

    # Обновление профиля: меняем display_name и пароль
    update_payload = {
        "display_name": "New Display Name",
        "password": "NewPass456!",
    }
    r_upd = client.put(
        "/api/auth/update",
        json=update_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_upd.status_code == 200
    updated = r_upd.json()
    assert updated["display_name"] == "New Display Name"

    # Логинимся уже новым паролем
    login_payload = {
        "username": "profileuser",
        "password": "NewPass456!",
    }
    r_login = client.post("/api/auth/login", json=login_payload)
    assert r_login.status_code == 200
    data = r_login.json()
    assert data["user"]["display_name"] == "New Display Name"


def test_password_hash_and_verify_helpers():
    plain = "MySecretPass!"
    hashed = main.get_password_hash(plain)
    assert hashed != plain
    assert main.verify_password(plain, hashed) is True
    assert main.verify_password("wrongpass", hashed) is False
