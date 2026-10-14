"""Run TechMap locally: python run.py. No Node or frontend build required."""
import os
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    print("TechMap is starting. Open http://127.0.0.1:8000 in your browser.")
    uvicorn.run("main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
