"""Shared helpers for the route modules."""

from urllib.parse import urlsplit

from fastapi import HTTPException, Request

from ..services import accounts
from ..services.config import APP_BASE_URL, SESSION_COOKIE
from ..services.data import load_data


def get_company_or_404(company_id: int) -> dict:
    """Return the full record for `company_id` or raise HTTP 404."""
    df = load_data()
    matches = df[df["_id"] == company_id]

    if matches.empty:
        raise HTTPException(status_code=404, detail="Company not found.")

    row = matches.iloc[0]
    return {
        "id": int(row["_id"]),
        "name": row["company_name"],
        "city": row["city"],
        "description": row["description"],
        "specialties": row["_specs"],
        "apply_email": str(row["apply_email"]).strip(),
    }


def get_optional_user(request: Request):
    """Return the signed-in user row for the session cookie, or None."""
    return accounts.get_session_user(request.cookies.get(SESSION_COOKIE, ""))


def get_current_user(request: Request):
    """Dependency: require a signed-in user (HTTP 401 otherwise)."""
    user = get_optional_user(request)
    if user is None:
        raise HTTPException(
            status_code=401, detail="Please sign in to use your account."
        )
    return user


def require_same_origin(request: Request) -> None:
    """Dependency: lightweight CSRF guard for cookie-authenticated writes.

    Browsers always send an Origin header on cross-site POSTs; if one is
    present it must match this app's own host. Requests without an Origin
    (curl, same-origin top-level navigation) are allowed through.
    """
    origin = request.headers.get("origin")
    if not origin:
        return
    origin_host = urlsplit(origin).netloc
    allowed = {request.headers.get("host", "")}
    if APP_BASE_URL:
        allowed.add(urlsplit(APP_BASE_URL).netloc)
    forwarded_host = request.headers.get("x-forwarded-host", "")
    if forwarded_host:
        allowed.add(forwarded_host.split(",")[0].strip())
    if origin_host not in allowed:
        raise HTTPException(status_code=403, detail="Cross-site request blocked.")
