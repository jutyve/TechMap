"""Outgoing email for account verification and password resets.

When an SMTP server is configured (see ``SMTP_*`` in config / .env.example)
mail is sent for real. Otherwise — the local-development default — messages
are written to ``data/outbox/`` and printed to the server console so the
verification flow still works end to end without a mail provider.
"""

import html
import os
import smtplib
import time
from email.message import EmailMessage
from email.utils import formataddr

from .config import (
    OUTBOX_DIR,
    SMTP_FROM,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
)


def mail_configured() -> bool:
    return bool(SMTP_HOST)


def send_email(to: str, subject: str, text_body: str, html_body: str = "") -> bool:
    """Send one message. Returns True only if a real server accepted it."""
    if not mail_configured():
        _write_to_outbox(to, subject, text_body)
        return False

    message = EmailMessage()
    message["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM or SMTP_USERNAME))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        if SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
        with server:
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                server.starttls()
            if SMTP_USERNAME:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception as error:  # SMTP errors must not crash signup
        print(f"[techmap mail] Could not send email to {to}: {error}", flush=True)
        _write_to_outbox(to, subject, f"(SMTP delivery failed: {error})\n\n{text_body}")
        return False


def _write_to_outbox(to: str, subject: str, text_body: str) -> None:
    print(
        "\n".join(
            [
                "",
                "=" * 64,
                "[techmap mail] No SMTP server configured — email kept locally.",
                f"To: {to}",
                f"Subject: {subject}",
                "-" * 64,
                text_body,
                "=" * 64,
                "",
            ]
        ),
        flush=True,
    )
    try:
        os.makedirs(OUTBOX_DIR, exist_ok=True)
        safe_to = "".join(c if c.isalnum() or c in "._-@" else "_" for c in to)
        path = os.path.join(OUTBOX_DIR, f"{int(time.time())}-{safe_to}.txt")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(f"To: {to}\nSubject: {subject}\n\n{text_body}\n")
    except OSError:
        pass


def _html_shell(heading: str, intro: str, url: str, button_label: str, outro: str) -> str:
    safe_url = html.escape(url, quote=True)
    return f"""<!doctype html>
<html><body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#16211c">
  <div style="max-width:560px;margin:0 auto;padding:36px 20px">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#1d5b45;margin:0 0 10px">TechMap Maroc</p>
    <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 14px">{html.escape(heading)}</h1>
    <p style="line-height:1.6;color:#4d5b54">{html.escape(intro)}</p>
    <p style="margin:26px 0">
      <a href="{safe_url}" style="background:#1d5b45;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:999px;display:inline-block;font-weight:600">{html.escape(button_label)}</a>
    </p>
    <p style="line-height:1.6;color:#4d5b54;font-size:14px">Or paste this link into your browser:<br>
      <a href="{safe_url}" style="color:#1d5b45;word-break:break-all">{safe_url}</a>
    </p>
    <p style="line-height:1.6;color:#8a988f;font-size:13px">{html.escape(outro)}</p>
  </div>
</body></html>"""


def send_verification_email(email: str, name: str, url: str, ttl_hours: int) -> bool:
    greeting = f"Hi {name}," if name else "Hi,"
    text = (
        f"{greeting}\n\n"
        "Welcome to TechMap Maroc! Please verify your email address to "
        "activate your account — your favorite companies, notes and resume "
        "will then be saved to it automatically.\n\n"
        f"Verify your email:\n{url}\n\n"
        f"This link expires in {ttl_hours} hours and can be used once. "
        "If you didn't create a TechMap account, you can ignore this email.\n"
    )
    html_body = _html_shell(
        "Verify your email",
        "Welcome to TechMap Maroc! Verify your email address to activate your "
        "account — your favorite companies, notes and resume will then be "
        "saved to it automatically.",
        url,
        "Verify my email",
        f"This link expires in {ttl_hours} hours and can be used once. "
        "If you didn't create a TechMap account, you can ignore this email.",
    )
    return send_email(email, "Verify your TechMap Maroc account", text, html_body)


def send_password_reset_email(email: str, name: str, url: str, ttl_hours: int) -> bool:
    greeting = f"Hi {name}," if name else "Hi,"
    text = (
        f"{greeting}\n\n"
        "We received a request to reset your TechMap Maroc password.\n\n"
        f"Choose a new password:\n{url}\n\n"
        f"This link expires in {ttl_hours} hour(s) and can be used once. "
        "If you didn't ask for a reset, ignore this email — your password "
        "stays the same.\n"
    )
    html_body = _html_shell(
        "Reset your password",
        "We received a request to reset your TechMap Maroc password.",
        url,
        "Choose a new password",
        f"This link expires in {ttl_hours} hour(s) and can be used once. "
        "If you didn't ask for a reset, ignore this email — your password "
        "stays the same.",
    )
    return send_email(email, "Reset your TechMap Maroc password", text, html_body)
