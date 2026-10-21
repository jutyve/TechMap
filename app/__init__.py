"""TechMap Maroc — FastAPI application package.

Layout
------
app/main.py             application factory, middleware and static mount
app/api/                HTTP layer (routers, one module per feature)
app/services/           data access, AI providers, extraction, rendering
"""

__all__ = ["__version__"]

__version__ = "1.0.0"
