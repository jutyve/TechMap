import os

from dotenv import load_dotenv

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # app/
BASE_DIR = os.path.dirname(APP_DIR)                                     # project root

# Load local development settings from the .env file in the project root.
# Existing system/platform environment variables take precedence.
load_dotenv(os.path.join(BASE_DIR, ".env"))

CSV_PATH = os.path.join(BASE_DIR, "database", "data", "morocco_tech_companies_clean.csv")
STATIC_DIR = os.path.join(BASE_DIR, "static")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_RESUME_EXT = {".pdf", ".docx", ".txt", ".md", ".odt"}
MAX_RESUME_CHARS = 12000

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