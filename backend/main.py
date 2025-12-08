from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models
import html

USE_TMDB_CACHE = str(os.getenv("USE_TMDB_CACHE", "")).lower() in ("1", "true", "yes")
from backend.tmdb_cache import load_cache

load_dotenv()

# models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Watch Cinema API",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60  # 1 day

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

if not TMDB_API_KEY:
    raise ValueError(
        "TMDB_API_KEY not found in environment variables. "
        "Please create a .env file with your TMDB API key. "
        "Get your API key from https://www.themoviedb.org/settings/api"
    )
TMDB_BASE_URL = "https://api.themoviedb.org/3"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator('username')
    def username_alphanumeric(cls, v):
        if not v.isalnum() and '_' not in v:
            raise ValueError('Username must be alphanumeric')
        if len(v) < 3 or len(v) > 20:
            raise ValueError('Username must be between 3 and 20 characters')
        return v

    @field_validator('password')
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class ReviewCreate(BaseModel):
    movie_id: int
    rating: int
    comment: str

    @field_validator('rating')
    def rating_range(cls, v):
        if v < 1 or v > 10:
            raise ValueError('Rating must be between 1 and 10')
        return v

    @field_validator('comment')
    def sanitize_comment(cls, v):
        return html.escape(v.strip())


class FavoriteCreate(BaseModel):
    movie_id: int


class WatchHistoryCreate(BaseModel):
    movie_id: int


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None


def verify_password(plain_password, hashed_password):
    password_bytes = plain_password.encode('utf-8')[:72]
    return pwd_context.verify(password_bytes, hashed_password)


def get_password_hash(password):
    password_bytes = password.encode('utf-8')[:72]
    return pwd_context.hash(password_bytes)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""

    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    user = models.User(
        username=user_data.username,
        display_name=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "avatar_url": user.avatar_url
        }
    }


@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Вход пользователя"""
    user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if not user.display_name:
        user.display_name = user.username
        db.commit()

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.display_name if user.display_name else user.username,
            "display_name": user.display_name,
            "email": user.email,
            "avatar_url": user.avatar_url
        }
    }


@app.get("/api/auth/me")
async def get_me(current_user: models.User = Depends(get_current_user)):
    """Получить текущего пользователя"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url
    }


@app.put("/api/auth/update")
async def update_profile(
        update_data: UserUpdate,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Обновить профиль пользователя"""
    if update_data.display_name:
        if len(update_data.display_name) < 3 or len(update_data.display_name) > 50:
            raise HTTPException(status_code=400, detail="Display name must be between 3 and 50 characters")
        current_user.display_name = update_data.display_name

    if update_data.password:
        if len(update_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        current_user.hashed_password = get_password_hash(update_data.password)

    db.commit()
    db.refresh(current_user)

    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url
    }


@app.get("/api/favorites")
async def get_favorites(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить избранные фильмы пользователя"""
    favorites = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
    return [{"movie_id": fav.movie_id, "added_at": fav.added_at} for fav in favorites]


@app.post("/api/favorites")
async def add_favorite(favorite: FavoriteCreate, current_user: models.User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Добавить фильм в избранное"""
    existing = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.movie_id == favorite.movie_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Movie already in favorites")

    new_favorite = models.Favorite(user_id=current_user.id, movie_id=favorite.movie_id)
    db.add(new_favorite)
    db.commit()
    return {"message": "Added to favorites"}


@app.delete("/api/favorites/{movie_id}")
async def remove_favorite(movie_id: int, current_user: models.User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    """Удалить фильм из избранного"""
    favorite = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.movie_id == movie_id
    ).first()

    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    db.delete(favorite)
    db.commit()
    return {"message": "Removed from favorites"}


@app.get("/api/history")
async def get_watch_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить историю просмотров"""
    history = db.query(models.WatchHistory).filter(
        models.WatchHistory.user_id == current_user.id
    ).order_by(models.WatchHistory.watched_at.desc()).all()
    return [{"movie_id": h.movie_id, "watched_at": h.watched_at} for h in history]


@app.post("/api/history")
async def add_to_history(history: WatchHistoryCreate, current_user: models.User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """Добавить фильм в историю просмотров"""
    existing = db.query(models.WatchHistory).filter(
        models.WatchHistory.user_id == current_user.id,
        models.WatchHistory.movie_id == history.movie_id
    ).first()

    if existing:
        existing.watched_at = datetime.utcnow()
        db.commit()
        return {"message": "Updated watch history"}

    new_history = models.WatchHistory(user_id=current_user.id, movie_id=history.movie_id)
    db.add(new_history)

    all_history = db.query(models.WatchHistory).filter(
        models.WatchHistory.user_id == current_user.id
    ).order_by(models.WatchHistory.watched_at.desc()).all()

    if len(all_history) >= 5:
        for old_entry in all_history[4:]:
            db.delete(old_entry)

    db.commit()
    return {"message": "Added to watch history"}


@app.delete("/api/reviews/{review_id}")
async def delete_review(review_id: int, current_user: models.User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """Удалить отзыв пользователя"""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")

    db.delete(review)
    db.commit()
    return {"message": "Review deleted successfully"}


@app.get("/api/reviews/{movie_id}")
async def get_movie_reviews(movie_id: int, db: Session = Depends(get_db)):
    """Получить отзывы о фильме"""
    reviews = db.query(models.Review).filter(models.Review.movie_id == movie_id).order_by(
        models.Review.created_at.desc()
    ).all()

    result = []
    for review in reviews:
        user = db.query(models.User).filter(models.User.id == review.user_id).first()
        result.append({
            "id": review.id,
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at.isoformat(),
            "user": {
                "id": user.id,
                "username": user.display_name if user.display_name else user.username,
                "avatar_url": user.avatar_url
            }
        })
    return result


@app.post("/api/reviews")
async def create_review(review: ReviewCreate, current_user: models.User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """Создать отзыв о фильме"""

    existing = db.query(models.Review).filter(
        models.Review.user_id == current_user.id,
        models.Review.movie_id == review.movie_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this movie")

    new_review = models.Review(
        user_id=current_user.id,
        movie_id=review.movie_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return {
        "id": new_review.id,
        "rating": new_review.rating,
        "comment": new_review.comment,
        "created_at": new_review.created_at.isoformat(),
        "user": {
            "id": current_user.id,
            "username": current_user.display_name if current_user.display_name else current_user.username,
            "avatar_url": current_user.avatar_url
        }
    }


@app.get("/api/users/{user_id}/reviews")
async def get_user_reviews(user_id: int, db: Session = Depends(get_db)):
    """Получить все отзывы пользователя"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reviews = db.query(models.Review).filter(models.Review.user_id == user_id).order_by(
        models.Review.created_at.desc()
    ).all()

    return [{
        "id": review.id,
        "movie_id": review.movie_id,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at.isoformat()
    } for review in reviews]


@app.get("/")
async def root():
    return {"message": "Watch Cinema API"}


@app.get("/api/movies/popular")
async def get_popular_movies(page: int = 1):
    """Получить популярные фильмы"""

    # -- если тестовый режим > json из кэша
    if USE_TMDB_CACHE:
        return load_cache(f"popular_page_{page}.json")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TMDB_BASE_URL}/movie/popular",
                params={"api_key": TMDB_API_KEY, "language": "ru-RU", "page": page},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error fetching movies: {str(e)}")


@app.get("/api/movies/search")
async def search_movies(query: str, page: int = 1):
    """Поиск фильмов по названию"""

    # -- если тестовый режим > json из кэша
    if USE_TMDB_CACHE:
        return load_cache("search_avatar.json")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TMDB_BASE_URL}/search/movie",
                params={"api_key": TMDB_API_KEY, "language": "ru-RU", "query": query, "page": page},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error searching movies: {str(e)}")


@app.get("/api/movies/genre/{genre_id}")
async def get_movies_by_genre(genre_id: int, page: int = 1):
    """Получить фильмы по жанру"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TMDB_BASE_URL}/discover/movie",
                params={
                    "api_key": TMDB_API_KEY,
                    "language": "ru-RU",
                    "page": page,
                    "with_genres": genre_id,
                    "sort_by": "popularity.desc"
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error fetching movies by genre: {str(e)}")


@app.get("/api/movies/{movie_id}")
async def get_movie_details(movie_id: int):
    """Получить детали фильма"""

    # -- если тестовый режим > json из кэша
    if USE_TMDB_CACHE:
        return load_cache(f"movie_{movie_id}.json") or {"error": "not found"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TMDB_BASE_URL}/movie/{movie_id}",
                params={"api_key": TMDB_API_KEY, "language": "ru-RU"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=404, detail=f"Movie not found: {str(e)}")


@app.get("/api/movies/{movie_id}/videos")
async def get_movie_videos(movie_id: int):
    """Получить трейлеры и видео фильма"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TMDB_BASE_URL}/movie/{movie_id}/videos",
                params={"api_key": TMDB_API_KEY, "language": "ru-RU"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=404, detail=f"Videos not found: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
