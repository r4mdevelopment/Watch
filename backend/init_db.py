from backend.database import engine
from backend import models

print("Initializing database...")
models.Base.metadata.create_all(bind=engine)
print("OK")
