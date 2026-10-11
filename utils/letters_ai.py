import json as _json

from .ai_client import AIError, chat, chat_json

LETTER_SYSTEM_PROMPT = (
    "You write short, honest, tailored cover / motivation letters for tech job or internship "
    "applications in Morocco. Use only the facts given about the applicant and the company. "
    "Never invent experience, skills or facts about the company that were not supplied. "
    "Write in the language the applicant used in their notes (default to French if unclear and the "
    "company is in Morocco, otherwise English). Keep it to 180-260 words, no placeholders like [Company Name]."
)


def build_letter_prompt(applicant: dict, company: dict, tone: str) -> str:
    return f"""Write a cover letter for this application.

Applicant:
{_json.dumps(applicant, ensure_ascii=False)}

Company:
{_json.dumps(company, ensure_ascii=False)}

Requested tone: {tone or "professional and motivated"}

Rules:
- Address the company by name.
- Mention 1-2 of the company's real specialties/description if provided, to show genuine interest.
- Reference only the applicant's real background (skills, highlights, target role) given above.
- End with a polite call to action and the applicant's name as sign-off.
- Output plain text only (no markdown, no subject line, no JSON)."""


def generate_cover_letter(applicant: dict, company: dict, tone: str) -> str:
    if not str(applicant.get("full_name", "")).strip():
        raise AIError(422, "Full name is required.")

    text = chat(LETTER_SYSTEM_PROMPT, build_letter_prompt(applicant, company, tone)).strip()

    if not text:
        raise AIError(502, "The AI did not return a letter. Please try again.")

    return text[:4000]


EMAIL_SYSTEM_PROMPT = (
    "You write short, polite application emails (not full cover letters) for tech job or internship "
    "applications in Morocco, to be sent by the applicant directly to a company. Use only the given facts, "
    "never invent anything. Reply with ONE JSON object and nothing else."
)


def build_email_prompt(applicant: dict, company: dict, note: str) -> str:
    return f"""Write a short application email.

Applicant:
{_json.dumps(applicant, ensure_ascii=False)}

Company:
{_json.dumps(company, ensure_ascii=False)}

Extra note from the applicant (optional, may be empty): {note or "(none)"}

Return exactly this JSON shape:
{{
  "subject": "short subject line, under 80 chars, mention the role if known",
  "body": "4-8 short sentences, plain text, polite, mentions that the resume is attached, ends with a sign-off using the applicant's name"
}}"""


def generate_application_email(applicant: dict, company: dict, note: str) -> dict:
    data = chat_json(EMAIL_SYSTEM_PROMPT, build_email_prompt(applicant, company, note))

    subject = str(data.get("subject") or f"Application - {applicant.get('full_name', '')}").strip()[:150]
    body = str(data.get("body") or "").strip()[:3000]

    if not body:
        raise AIError(502, "The AI did not return an email body. Please try again.")

    return {"subject": subject, "body": body}
