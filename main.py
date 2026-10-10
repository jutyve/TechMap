import json
import os
import re
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from utils.ai_analysis import run_ai_analysis
from utils.ai_client import AIError
from utils.chat_ai import run_chat_turn
from utils.config import ALLOWED_RESUME_EXT, MAX_UPLOAD_BYTES, STATIC_DIR
from utils.data import (
    compute_stats,
    filter_companies,
    get_cities_list,
    get_specialty_counts,
    known_specialties,
    load_data,
    public_company,
)
from utils.letters_ai import generate_application_email, generate_cover_letter
from utils.resume_ai import generate_resume
from utils.resume_render import render_resume_html
from utils.text_extraction import extract_text

app = FastAPI(title="TechMap Maroc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_company_or_404(company_id: int) -> dict:
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


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value or "resume").strip("-").lower()
    return value or "resume"


# --------------------------------------------------------------------------
# Companies / stats
# --------------------------------------------------------------------------

@app.get("/api/companies")
def get_companies(
    specialties: str = "",
    match: str = Query("any", pattern="^(any|all)$"),
    city: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    df = load_data()
    wanted = [s.strip().lower() for s in specialties.split("|") if s.strip()]

    df = filter_companies(df, wanted, match, city, search)
    df = df.sort_values(by=["_score", "_name"], ascending=[False, True])
    page = df.iloc[offset:offset + limit]

    return {
        "total": int(len(df)),
        "items": [public_company(row) for row in page.to_dict(orient="records")],
    }


@app.get("/api/companies/by-ids")
def get_companies_by_ids(ids: str = ""):
    wanted_ids = {int(i) for i in ids.split(",") if i.strip().isdigit()}
    if not wanted_ids:
        return {"items": []}

    df = load_data()
    matches = df[df["_id"].isin(wanted_ids)]
    matches = matches.sort_values(by=["_score", "_name"], ascending=[False, True])

    return {"items": [public_company(row) for row in matches.to_dict(orient="records")]}


@app.get("/api/specialties")
def get_specialties():
    df = load_data()
    counts = get_specialty_counts(df)
    return [{"name": name, "count": count} for name, count in counts.most_common()]


@app.get("/api/cities")
def get_cities():
    return get_cities_list(load_data())


@app.get("/api/stats")
def get_stats():
    return compute_stats(load_data())


# --------------------------------------------------------------------------
# Resume analyzer
# --------------------------------------------------------------------------

@app.post("/api/analyze")
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


# --------------------------------------------------------------------------
# AI Resume Studio
# --------------------------------------------------------------------------

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


@app.post("/api/resume/generate")
async def resume_generate(form: ResumeForm):
    try:
        resume = await run_in_threadpool(generate_resume, form.model_dump())
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)
    return resume


# --------------------------------------------------------------------------
# AI cover / recommendation letter per company
# --------------------------------------------------------------------------

class CoverLetterRequest(BaseModel):
    full_name: str
    target_role: str = ""
    highlights: str = ""
    tone: str = "professional and motivated"


@app.post("/api/companies/{company_id}/cover-letter")
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


# --------------------------------------------------------------------------
# Apply with AI — drafts an email + (optionally) a resume, but NEVER sends it
# from the server. The browser opens the user's own Gmail/email client so the
# application is sent from the applicant's own address.
# --------------------------------------------------------------------------

@app.post("/api/companies/{company_id}/prepare-application")
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


# --------------------------------------------------------------------------
# AI career assistant (chat) — recommends real companies from the directory
# ONLY when the user is actually looking for a job / company. Filters are
# relaxed step by step so a spelling mismatch never results in an empty reply.
# --------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@app.post("/api/chat")
async def chat_turn(req: ChatRequest):
    df = load_data()
    specialties = known_specialties()
    cities = get_cities_list(df)
    history = [m.model_dump() for m in req.history]

    try:
        result = await run_in_threadpool(run_chat_turn, req.message, history, specialties, cities)
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)

    companies = []

    if result["ready_to_recommend"]:
        wanted = [s.lower() for s in result["specialties"]]
        city = result["city"] or None

        attempt = filter_companies(df, wanted, "any", city, None)
        if attempt.empty and wanted and city:
            attempt = filter_companies(df, [], "any", city, None)
        if attempt.empty and wanted:
            attempt = filter_companies(df, wanted, "any", None, None)
        if attempt.empty:
            attempt = df

        attempt = attempt.sort_values(by=["_score", "_name"], ascending=[False, True])
        companies = [public_company(row) for row in attempt.head(5).to_dict(orient="records")]

    return {**result, "companies": companies}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")