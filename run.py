"""
TechMap Maroc - Server Launcher

Compatible with:
- bot-hosting.cloud
- Local development
- Other hosting providers
"""

import os
import uvicorn

# Hosting provider port takes priority
PORT = int(
    os.environ.get("SERVER_PORT")
    or os.environ.get("PORT")
    or "8000"
)

# Listen on all network interfaces
HOST = "0.0.0.0"

# Enable reload only when explicitly requested
RELOAD = os.environ.get("RELOAD", "").lower() in {
    "1",
    "true",
    "yes"
}

if __name__ == "__main__":

    print("=" * 50)
    print("🚀 TechMap Maroc - Starting Server")
    print(f"🌐 Host: {HOST}")
    print(f"🔌 Port: {PORT}")
    print(f"🌍 Public URL: http://de1.bot-hosting.cloud:{PORT}")
    print("=" * 50)

    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        log_level="info"
    )
