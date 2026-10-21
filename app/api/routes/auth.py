"""Accounts: registration with email verification, sessions, password reset.

Accounts are optional — every public feature keeps working for guests, whose
data stays in their browser. Signing in additionally mirrors that data to
the server (see routes/account.py) so it follows the user across devices.
"""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from ...services import accounts, mail
from ...services.config import (
    APP_BASE_URL,
    AUTH_DEV_EXPOSE_LINKS,
    AUTH_REQUIRE_EMAIL_VERIFICATION,
    COOKIE_SECURE,
    RESET_TOKEN_TTL_HOURS,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    VERIFY_TOKEN_TTL_HOURS,
)
from ...services.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    is_valid_email,
    normalize_email,
    verify_password,
)
from ..deps import get_current_user, require_same_origin

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 128


class RegisterIn(BaseModel):
    name: str = ""
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class EmailIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str
    password: str


class UpdateProfileIn(BaseModel):
    name: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountIn(BaseModel):
    password: str


# --- Small in-memory rate limiter ------------------------------------------
# Good enough for a self-hosted single-process app: slows credential
# stuffing and verification-mail spam without external infrastructure.
_attempts: dict[str, list[float]] = defaultdict(list)


def _rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    bucket = [t for t in _attempts[key] if now - t < window_seconds]
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a few minutes and try again.",
        )
    bucket.append(now)
    _attempts[key] = bucket


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Helpers -----------------------------------------------------------------


def _base_url(request: Request) -> str:
    if APP_BASE_URL:
        return APP_BASE_URL
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    proto = proto.split(",")[0].strip() or "http"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "127.0.0.1:8000"
    return f"{proto}://{host.split(',')[0].strip()}"


def _check_password(password: str) -> str:
    if not (MIN_PASSWORD_LEN <= len(password or "") <= MAX_PASSWORD_LEN):
        raise HTTPException(
            status_code=422,
            detail=f"Password must be between {MIN_PASSWORD_LEN} and {MAX_PASSWORD_LEN} characters.",
        )
    return password


def _clean_name(name: str) -> str:
    return " ".join((name or "").split())[:80]


def _set_session_cookie(response, request: Request, token: str) -> None:
    secure = COOKIE_SECURE
    if secure is None:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        secure = proto.split(",")[0].strip() == "https"
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 86400,
        path="/",
        httponly=True,
        samesite="lax",
        secure=bool(secure),
    )


def _start_session(response, request: Request, user_id: int) -> None:
    _set_session_cookie(response, request, accounts.create_session(user_id))


def _send_verification(request: Request, user) -> dict:
    token = accounts.create_email_token(user["id"], "verify", VERIFY_TOKEN_TTL_HOURS)
    url = f"{_base_url(request)}/api/auth/verify?token={token}"
    sent = mail.send_verification_email(
        user["email"], user["name"] or "", url, VERIFY_TOKEN_TTL_HOURS
    )
    result = {"mail_sent": sent, "mail_configured": mail.mail_configured()}
    if AUTH_DEV_EXPOSE_LINKS:
        result["dev_verification_url"] = url
    return result


# --- Registration + verification ---------------------------------------------


@router.post("/register", dependencies=[Depends(require_same_origin)])
def register(payload: RegisterIn, request: Request):
    email = normalize_email(payload.email)
    _rate_limit(f"register:{_client_ip(request)}", 10, 3600)
    if not is_valid_email(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")
    _check_password(payload.password)
    name = _clean_name(payload.name)

    existing = accounts.get_user_by_email(email)
    if existing is not None:
        if existing["is_verified"]:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Try signing in.",
            )
        # Unverified account: the first email may have been lost — send a
        # fresh verification link rather than dead-ending the user.
        info = _send_verification(request, existing)
        return {
            "ok": True,
            "needs_verification": True,
            "email": email,
            "message": "This email is registered but not verified yet. We sent a new verification link.",
            **info,
        }

    user = accounts.create_user(name, email, hash_password(payload.password))
    if user is None:  # lost a race with a concurrent registration
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Try signing in.",
        )

    if not AUTH_REQUIRE_EMAIL_VERIFICATION:
        accounts.mark_verified(user["id"])
        user = accounts.get_user_by_id(user["id"])
        # Register is called via fetch: return the user, the page navigates.
        response = JSONResponse(
            {"ok": True, "needs_verification": False, "user": accounts.public_user(user)}
        )
        _start_session(response, request, user["id"])
        return response

    info = _send_verification(request, user)
    return {
        "ok": True,
        "needs_verification": True,
        "email": email,
        "message": "Account created. Check your inbox to verify your email.",
        **info,
    }


@router.get("/verify")
def verify_email(request: Request, token: str = ""):
    user_id = accounts.consume_email_token(token, "verify")
    if user_id is None:
        return RedirectResponse(url="/login.html?error=invalid_token", status_code=303)
    accounts.mark_verified(user_id)
    response = RedirectResponse(url="/?verified=1", status_code=303)
    _start_session(response, request, user_id)
    return response


@router.post("/verify/resend", dependencies=[Depends(require_same_origin)])
def resend_verification(payload: EmailIn, request: Request):
    email = normalize_email(payload.email)
    _rate_limit(f"resend:{_client_ip(request)}:{email}", 5, 3600)
    result = {
        "ok": True,
        "message": "If that email has an unverified account, a new verification link is on its way.",
    }
    user = accounts.get_user_by_email(email) if is_valid_email(email) else None
    if user is not None and not user["is_verified"]:
        result.update(_send_verification(request, user))
    return result


# --- Sign in / out -------------------------------------------------------------


@router.post("/login", dependencies=[Depends(require_same_origin)])
def login(payload: LoginIn, request: Request):
    email = normalize_email(payload.email)
    _rate_limit(f"login:{_client_ip(request)}:{email}", 10, 900)

    user = accounts.get_user_by_email(email) if is_valid_email(email) else None
    stored_hash = user["password_hash"] if user is not None else DUMMY_PASSWORD_HASH
    password_ok = verify_password(payload.password, stored_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if AUTH_REQUIRE_EMAIL_VERIFICATION and not user["is_verified"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "email_not_verified",
                "message": "Please verify your email first — check your inbox for the verification link.",
            },
        )

    response = JSONResponse({"ok": True, "user": accounts.public_user(user)})
    _start_session(response, request, user["id"])
    return response


@router.post("/logout", dependencies=[Depends(require_same_origin)])
def logout(request: Request):
    accounts.delete_session(request.cookies.get(SESSION_COOKIE, ""))
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"user": accounts.public_user(user)}


@router.patch("/me", dependencies=[Depends(require_same_origin)])
def update_profile(payload: UpdateProfileIn, user=Depends(get_current_user)):
    accounts.update_name(user["id"], _clean_name(payload.name))
    return {"user": accounts.public_user(accounts.get_user_by_id(user["id"]))}


@router.post("/change-password", dependencies=[Depends(require_same_origin)])
def change_password(
    payload: ChangePasswordIn, request: Request, user=Depends(get_current_user)
):
    _rate_limit(f"change-pw:{user['id']}", 5, 900)
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Your current password is incorrect.")
    _check_password(payload.new_password)
    accounts.set_password(user["id"], hash_password(payload.new_password))
    # Keep this browser signed in; sign out everywhere else.
    accounts.delete_user_sessions(user["id"])
    response = JSONResponse({"ok": True})
    _start_session(response, request, user["id"])
    return response


@router.post("/delete-account", dependencies=[Depends(require_same_origin)])
def delete_account(payload: DeleteAccountIn, user=Depends(get_current_user)):
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Your password is incorrect.")
    accounts.delete_user(user["id"])  # cascades to sessions, tokens and state
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


# --- Password reset ------------------------------------------------------------


@router.post("/forgot-password", dependencies=[Depends(require_same_origin)])
def forgot_password(payload: EmailIn, request: Request):
    email = normalize_email(payload.email)
    _rate_limit(f"forgot:{_client_ip(request)}:{email}", 5, 3600)
    result = {
        "ok": True,
        "message": "If an account exists for that email, a password-reset link is on its way.",
    }
    user = accounts.get_user_by_email(email) if is_valid_email(email) else None
    if user is not None:
        token = accounts.create_email_token(user["id"], "reset", RESET_TOKEN_TTL_HOURS)
        url = f"{_base_url(request)}/login.html?reset_token={token}"
        sent = mail.send_password_reset_email(
            user["email"], user["name"] or "", url, RESET_TOKEN_TTL_HOURS
        )
        result["mail_sent"] = sent
        result["mail_configured"] = mail.mail_configured()
        if AUTH_DEV_EXPOSE_LINKS:
            result["dev_reset_url"] = url
    return result


@router.post("/reset-password", dependencies=[Depends(require_same_origin)])
def reset_password(payload: ResetIn, request: Request):
    _rate_limit(f"reset:{_client_ip(request)}", 10, 900)
    _check_password(payload.password)
    user_id = accounts.consume_email_token(payload.token, "reset")
    if user_id is None:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )
    accounts.set_password(user_id, hash_password(payload.password))
    accounts.mark_verified(user_id)  # clicking the emailed link proves ownership
    accounts.delete_user_sessions(user_id)
    user = accounts.get_user_by_id(user_id)
    response = JSONResponse({"ok": True, "user": accounts.public_user(user)})
    _start_session(response, request, user_id)
    return response
