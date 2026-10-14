"""Cross-platform local launcher.

    python run.py

Set HOST / PORT (and optionally RELOAD=1) to override the defaults.
"""

import os

import uvicorn

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000") or "8000")
RELOAD = os.environ.get("RELOAD", "").strip().lower() in {"1", "true", "yes"}

if __name__ == "__main__":
    print(f"TechMap Maroc running on http://{HOST}:{PORT} - press Ctrl+C to stop.")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=RELOAD)
