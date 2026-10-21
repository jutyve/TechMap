"""Password hashing, token generation and email validation.

Everything here is standard library only. Passwords are hashed with
PBKDF2-HMAC-SHA256 (600k iterations, per-password random salt) and compared
in constant time. Session and email tokens are random URL-safe strings;
only their SHA-256 digests are stored, so a leaked database does not leak
usable tokens.
"""

import base64
import hashlib
import hmac
import re
import secrets

_PBKDF2_ITERATIONS = 600_000
_SALT_BYTES = 16

_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def is_valid_email(email: str) -> bool:
    email = normalize_email(email)
    return len(email) <= 254 and bool(_EMAIL_RE.match(email))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        _PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = (stored or "").split("$")
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", (password or "").encode("utf-8"), salt, int(iterations)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, expected)


# A throwaway hash so login attempts for unknown emails cost the same time
# as attempts for real accounts (avoids leaking which emails exist).
DUMMY_PASSWORD_HASH = hash_password(secrets.token_hex(16))


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()
