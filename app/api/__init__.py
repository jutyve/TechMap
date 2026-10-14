"""HTTP API layer.

`api_router` aggregates every feature router; `app.main` mounts it once.
"""

from fastapi import APIRouter

from .routes import chat, companies, letters, resume

api_router = APIRouter()
api_router.include_router(companies.router)
api_router.include_router(resume.router)
api_router.include_router(letters.router)
api_router.include_router(chat.router)

__all__ = ["api_router"]
