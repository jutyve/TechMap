"""HTTP API layer.

`api_router` aggregates every feature router; `app.main` mounts it once.
"""

from fastapi import APIRouter

from .routes import account, auth, chat, companies, letters, portfolio, resume

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(companies.router)
api_router.include_router(resume.router)
api_router.include_router(letters.router)
api_router.include_router(chat.router)
api_router.include_router(portfolio.router)

__all__ = ["api_router"]
