"""Account, session, email-token and synced-state storage operations.

Timestamps are stored as Unix seconds to keep expiry checks trivial.
"""

import json
import sqlite3
import time

from .config import SESSION_TTL_DAYS
from .db import connection
from .security import hash_token, new_token


def _now() -> int:
    return int(time.time())


def public_user(row) -> dict:
    """The user shape the API is allowed to expose (never the hash)."""
    return {
        "id": int(row["id"]),
        "email": row["email"],
        "name": row["name"] or "",
        "is_verified": bool(row["is_verified"]),
        "created_at": int(row["created_at"]),
    }


# --- Users -----------------------------------------------------------------


def create_user(name: str, email: str, password_hash: str):
    """Insert a user; return the row, or None if the email is taken."""
    try:
        with connection() as conn:
            cursor = conn.execute(
                "INSERT INTO users (email, name, password_hash, created_at)"
                " VALUES (?, ?, ?, ?)",
                (email, name, password_hash, _now()),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    return get_user_by_id(user_id)


def get_user_by_email(email: str):
    with connection() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()


def get_user_by_id(user_id: int):
    with connection() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (int(user_id),)
        ).fetchone()


def mark_verified(user_id: int) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE users SET is_verified = 1, verified_at = ?"
            " WHERE id = ? AND is_verified = 0",
            (_now(), int(user_id)),
        )


def set_password(user_id: int, password_hash: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, int(user_id)),
        )


def update_name(user_id: int, name: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE users SET name = ? WHERE id = ?", (name, int(user_id))
        )


def delete_user(user_id: int) -> None:
    with connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (int(user_id),))


# --- Sessions --------------------------------------------------------------


def create_session(user_id: int) -> str:
    """Create a session and return the raw token for the cookie."""
    token = new_token()
    now = _now()
    with connection() as conn:
        conn.execute(
            "INSERT INTO sessions (user_id, token_hash, created_at, expires_at)"
            " VALUES (?, ?, ?, ?)",
            (int(user_id), hash_token(token), now, now + SESSION_TTL_DAYS * 86400),
        )
    return token


def get_session_user(token: str):
    """Return the user row for a live session token, else None."""
    if not token:
        return None
    with connection() as conn:
        row = conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id"
            " WHERE s.token_hash = ? AND s.expires_at > ?",
            (hash_token(token), _now()),
        ).fetchone()
        if row is None:
            # Opportunistically clear out expired sessions.
            conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (_now(),))
        return row


def delete_session(token: str) -> None:
    if not token:
        return
    with connection() as conn:
        conn.execute(
            "DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),)
        )


def delete_user_sessions(user_id: int) -> None:
    with connection() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (int(user_id),))


# --- Email tokens (verification + password reset) --------------------------


def create_email_token(user_id: int, purpose: str, ttl_hours: int) -> str:
    """Create a single-use token, invalidating earlier unused ones."""
    token = new_token()
    now = _now()
    with connection() as conn:
        conn.execute(
            "UPDATE email_tokens SET used_at = ?"
            " WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
            (now, int(user_id), purpose),
        )
        conn.execute(
            "INSERT INTO email_tokens (user_id, purpose, token_hash, created_at, expires_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (int(user_id), purpose, hash_token(token), now, now + ttl_hours * 3600),
        )
    return token


def consume_email_token(token: str, purpose: str):
    """Validate and burn a token; return the owning user id or None."""
    if not token:
        return None
    now = _now()
    with connection() as conn:
        row = conn.execute(
            "SELECT * FROM email_tokens"
            " WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?",
            (hash_token(token), purpose, now),
        ).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE email_tokens SET used_at = ? WHERE id = ?", (now, row["id"])
        )
        return int(row["user_id"])


# --- Synced per-user state ---------------------------------------------------


def get_state(user_id: int) -> dict:
    with connection() as conn:
        rows = conn.execute(
            "SELECT key, value FROM user_state WHERE user_id = ?", (int(user_id),)
        ).fetchall()
    state = {}
    for row in rows:
        try:
            state[row["key"]] = json.loads(row["value"])
        except (TypeError, ValueError):
            state[row["key"]] = row["value"]
    return state


def set_state_values(user_id: int, values: dict) -> None:
    """Upsert a batch of key -> JSON-able values (None deletes the key)."""
    now = _now()
    with connection() as conn:
        for key, value in values.items():
            if value is None:
                conn.execute(
                    "DELETE FROM user_state WHERE user_id = ? AND key = ?",
                    (int(user_id), key),
                )
            else:
                conn.execute(
                    "INSERT INTO user_state (user_id, key, value, updated_at)"
                    " VALUES (?, ?, ?, ?)"
                    " ON CONFLICT(user_id, key)"
                    " DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    (int(user_id), key, json.dumps(value), now),
                )


def delete_state_value(user_id: int, key: str) -> None:
    with connection() as conn:
        conn.execute(
            "DELETE FROM user_state WHERE user_id = ? AND key = ?",
            (int(user_id), key),
        )
