"""Resume analyzer and AI Resume Studio generation."""

import os

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ...services.ai_analysis import run_ai_analysis
from ...services.ai_client import AIError
from ...services.config import ALLOWED_RESUME_EXT, MAX_UPLOAD_BYTES
from ...services.data import known_specialties
from ...services.resume_ai import generate_resume
from ...services.text_extraction import extract_text

router = APIRouter(prefix="/api", tags=["resume"])


@router.post("/analyze")
async def analyze_resume(file: UploadFile = File(...)):
    filename = os.path.basename(file.filename or "resume")
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".doc":
        raise HTTPException(415, "Old .doc files are not supported. Save the file as .docx or PDF and upload it again.")
    if ext not in ALLOWED_RESUME_EXT:
        raise HTTPException(415, "Unsupported file type. Upload a PDF, Word (.docx), TXT, Markdown, or ODT file.")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is too large (10 MB maximum).")
    if not data:
        raise HTTPException(400, "The file is empty.")

    text = extract_text(filename, data)
    if len(text) < 80:
        raise HTTPException(
            422,
            "Not enough readable text was found in this resume. Images and other non-text content "
            "are ignored. If the resume is scanned or image-only, export it with selectable text or "
            "use OCR before uploading.",
        )

    try:
        result = await run_in_threadpool(run_ai_analysis, text, filename, known_specialties())
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)

    return {
        "status": "analyzed",
        "filename": filename,
        "size_kb": round(len(data) / 1024, 1),
        **result,
    }


class ResumeForm(BaseModel):
    full_name: str
    email: str = ""
    phone: str = ""
    city: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    target_role: str = ""
    years_experience: str = ""
    summary_hint: str = ""
    education: str = ""
    experience: str = ""
    projects: str = ""
    skills: str = ""
    languages: str = ""
    certifications: str = ""


@router.post("/resume/generate")
async def resume_generate(form: ResumeForm):
    try:
        resume = await run_in_threadpool(generate_resume, form.model_dump())
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)
    return resume
