import os

from dotenv import load_dotenv

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # app/
BASE_DIR = os.path.dirname(APP_DIR)                                     # project root

# Load local development settings from the .env file in the project root.
# Existing system/platform environment variables take precedence.
load_dotenv(os.path.join(BASE_DIR, ".env"))

CSV_PATH = os.path.join(BASE_DIR, "database", "data", "morocco_tech_companies_clean.csv")
STATIC_DIR = os.path.join(BASE_DIR, "static")

GOOGLE_MAPS_BROWSER_KEY = os.environ.get("GOOGLE_MAPS_BROWSER_KEY", "").strip()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_RESUME_EXT = {".pdf", ".docx", ".txt", ".md", ".odt"}
MAX_RESUME_CHARS = 12000

def _env_flag(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name, default):
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


# --- Accounts, sessions and per-user synced state -------------------------
# The account database and the development mail outbox live in a single
# `data/` folder at the project root so backups are one directory copy.
DATA_DIR = os.environ.get("TECHMAP_DATA_DIR", os.path.join(BASE_DIR, "data"))
DB_PATH = os.environ.get("TECHMAP_DB_PATH", os.path.join(DATA_DIR, "techmap.db"))
OUTBOX_DIR = os.path.join(DATA_DIR, "outbox")

# Public address used to build links in emails (e.g. https://techmap.example).
# When empty, links are built from the incoming request's host — set this
# explicitly for any public deployment so links cannot be spoofed.
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")

SESSION_COOKIE = "techmap_session"
SESSION_TTL_DAYS = max(1, _env_int("SESSION_TTL_DAYS", 30))
# None means "auto": mark cookies Secure when the request arrived over HTTPS.
COOKIE_SECURE = (
    _env_flag("COOKIE_SECURE") if os.environ.get("COOKIE_SECURE") is not None else None
)
# Accounts must click the emailed verification link before they can sign in.
AUTH_REQUIRE_EMAIL_VERIFICATION = _env_flag("AUTH_REQUIRE_VERIFICATION", True)
VERIFY_TOKEN_TTL_HOURS = max(1, _env_int("VERIFY_TOKEN_TTL_HOURS", 24))
RESET_TOKEN_TTL_HOURS = max(1, _env_int("RESET_TOKEN_TTL_HOURS", 1))

# --- Outgoing email (SMTP) -------------------------------------------------
# Configure these to send real verification / password-reset email. With no
# SMTP host configured, messages are printed to the server console and saved
# under data/outbox/, and the login page shows the link directly so the flow
# can still be used and tested locally.
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = _env_int("SMTP_PORT", 587)
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "").strip() or SMTP_USERNAME
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "TechMap Maroc").strip()
SMTP_USE_TLS = _env_flag("SMTP_USE_TLS", True)      # STARTTLS (usual for 587)
SMTP_USE_SSL = _env_flag("SMTP_USE_SSL", False)     # implicit TLS (usual for 465)

# Show verification/reset links in API responses (never do this in public
# production). Defaults to on only when no mail server is configured.
AUTH_DEV_EXPOSE_LINKS = (
    _env_flag("AUTH_DEV_EXPOSE_LINKS")
    if os.environ.get("AUTH_DEV_EXPOSE_LINKS") is not None
    else not SMTP_HOST
)

# localStorage keys that are mirrored to the signed-in user's account. The
# browser keeps working exactly as before for guests; these are simply the
# keys the sync layer is allowed to send to /api/me/state.
SYNCED_STATE_KEYS = {
    "techmap_favorites",
    "techmap_company_notes",
    "techmap_profile",
    "techmap_resume_form",
    "techmap_resume_data",
    "techmap_resume_template",
    "techmap_resume_accent",
    "techmap_resume_origin",
    "techmap_resume_photo",
    "techmap_layout",
}
# The processed Studio photo is a data URL of up to ~800 KB; allow headroom.
MAX_STATE_VALUE_BYTES = 2 * 1024 * 1024

AI_BASE_URL = os.environ.get("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
AI_API_KEY = os.environ.get("OMNIROUTE_API_KEY", "")
AI_MODEL = os.environ.get("OMNIROUTE_MODEL", "ddgw/gpt-5.6-luna")
AI_TIMEOUT_SECONDS = 120

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