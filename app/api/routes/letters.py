"""Cover / recommendation letters and the "Apply with AI" drafts.

The server never sends an application: it returns an email draft plus an
optional resume document and lets the browser open the user's own mail client.
"""

import json
import re

from fastapi import APIRouter, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ...services.ai_client import AIError
from ...services.letters_ai import generate_application_email, generate_cover_letter
from ...services.resume_ai import generate_resume
from ...services.resume_render import render_resume_html
from ..deps import get_company_or_404

router = APIRouter(prefix="/api/companies/{company_id}", tags=["letters"])


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value or "resume").strip("-").lower()
    return value or "resume"


class CoverLetterRequest(BaseModel):
    full_name: str
    target_role: str = ""
    highlights: str = ""
    tone: str = "professional and motivated"


@router.post("/cover-letter")
async def company_cover_letter(company_id: int, req: CoverLetterRequest):
    company = get_company_or_404(company_id)

    applicant = {
        "full_name": req.full_name.strip(),
        "target_role": req.target_role.strip(),
        "highlights": req.highlights.strip(),
    }

    try:
        letter = await run_in_threadpool(generate_cover_letter, applicant, company, req.tone)
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)

    return {"letter": letter, "company_name": company["name"]}


@router.post("/prepare-application")
async def prepare_application(
    company_id: int,
    full_name: str = Form(...),
    email: str = Form(""),
    phone: str = Form(""),
    target_role: str = Form(""),
    note: str = Form(""),
    resume_source: str = Form("quick"),  # "studio" | "file" | "quick"
    resume_json: str = Form(""),
):
    company = get_company_or_404(company_id)
    apply_email = company["apply_email"]

    if not apply_email:
        raise HTTPException(
            422,
            "This company has no email on file to apply to. Try their website or careers page instead.",
        )

    full_name = full_name.strip()
    if not full_name:
        raise HTTPException(422, "Full name is required.")

    applicant = {
        "full_name": full_name,
        "email": email.strip(),
        "phone": phone.strip(),
        "target_role": target_role.strip(),
    }

    resume_html = None
    resume_filename = None

    if resume_source == "studio":
        if not resume_json:
            raise HTTPException(
                422,
                "No Resume Studio resume was found. Generate one first or pick another option.",
            )
        try:
            resume_data = json.loads(resume_json)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid resume data.")

        resume_html = render_resume_html(resume_data)
        resume_filename = f"{slugify(full_name)}-resume.html"

    elif resume_source == "quick":
        try:
            resume_data = await run_in_threadpool(
                generate_resume,
                {
                    "full_name": full_name,
                    "email": email,
                    "phone": phone,
                    "target_role": target_role,
                    "summary_hint": note,
                },
            )
        except AIError as exc:
            raise HTTPException(status_code=exc.status, detail=exc.message)

        resume_html = render_resume_html(resume_data)
        resume_filename = f"{slugify(full_name)}-resume.html"

    # resume_source == "file": the applicant already has their own file locally,
    # nothing to generate — they'll attach it themselves.

    try:
        email_content = await run_in_threadpool(generate_application_email, applicant, company, note)
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)

    return {
        "to": apply_email,
        "subject": email_content["subject"],
        "body": email_content["body"],
        "resume_html": resume_html,
        "resume_filename": resume_filename,
    }
