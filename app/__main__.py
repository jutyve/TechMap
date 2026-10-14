"""Allow `python -m app` as a shortcut for the local launcher."""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000") or "8000"),
        reload=os.environ.get("RELOAD", "").strip().lower() in {"1", "true", "yes"},
    )
