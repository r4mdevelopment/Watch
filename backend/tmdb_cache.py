import json
from pathlib import Path

CACHE_DIR = Path(__file__).parent / "cache" / "tmdb"

def load_cache(name: str):
    file_path = CACHE_DIR / name
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None
