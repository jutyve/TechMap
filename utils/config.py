import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "DataBase", "morocco_tech_companies_clean.csv")
STATIC_DIR = os.path.join(BASE_DIR, "static")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_RESUME_EXT = {".pdf", ".docx", ".txt", ".md", ".odt"}
MAX_RESUME_CHARS = 12000

AI_BASE_URL = os.environ.get("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
AI_API_KEY = os.environ.get("OMNIROUTE_API_KEY", "")
AI_MODEL = os.environ.get("OMNIROUTE_MODEL", "ddgw/gpt-5.6-luna")
AI_TIMEOUT_SECONDS = 120

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").strip().lower() != "false"

# --- Google OAuth (send applications through the user's own Gmail) ---
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://127.0.0.1:8000")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-secret-change-me")
GOOGLE_TOKENS_PATH = os.path.join(BASE_DIR, "DataBase", "google_tokens.json")

COLUMNS = [
    "company_name",
    "city",
    "specialties",
    "description",
    "website",
    "apply_email",
    "phone",
    "apply_link",
    "apply_via",
    "careers_url",
    "contact_url",
    "all_emails",
    "source",
]