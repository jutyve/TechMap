"""FastAPI application for TechMap Maroc.

Run it with `python run.py`, `python -m app` or:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import api_router
from .services.config import STATIC_DIR

app = FastAPI(title="TechMap Maroc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Mounted last so every /api route is matched before the static file handler.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
