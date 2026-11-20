"""FastAPI application for TechMap Maroc.

Run it with `python run.py`, `python -m app` or:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import api_router
from .services.config import SMTP_HOST, STATIC_DIR
from .services.db import init_db

# Create the accounts database (data/techmap.db) on first run.
init_db()
if not SMTP_HOST:
    print(
        "[techmap] No SMTP server configured: account emails are printed to "
        "this console and saved in data/outbox/ (see .env.example to send "
        "real email).",
        flush=True,
    )

app = FastAPI(title="TechMap Maroc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Mounted last so API and public portfolio routes precede the static handler.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
