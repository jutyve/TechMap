import json as _json

from .ai_client import AIError, chat_json, str_list

RESUME_SYSTEM_PROMPT = (
    "You are a senior resume writer and career coach for the tech industry in Morocco and "
    "internationally. You write concise, achievement-oriented, ATS-friendly resumes that read "
    "like they were written by a human professional, not a template. "
    "Use ONLY information given by the user; never invent employers, dates, degrees, "
    "certifications, numbers, or skills. You MAY rephrase, tighten wording, merge duplicate "
    "bullets, infer a sensible job title from the experience given, and write a short, punchy "
    "professional summary based only on the supplied facts. "
    "Every experience bullet must start with a strong past-tense action verb (Built, Led, Designed, "
    "Automated, Reduced, Shipped...), stay under 18 words, and include a number or concrete outcome "
    "whenever the user's notes contain one — but never fabricate a number that wasn't given. "
    "Avoid generic filler like 'responsible for' or 'worked on'. "
    "Reply with ONE JSON object and nothing else, without markdown or code fences."
)


def _lines(value: str) -> list[str]:
    return [line.strip() for line in str(value or "").splitlines() if line.strip()]


def _csv(value: str) -> list[str]:
    return [p.strip() for p in str(value or "").split(",") if p.strip()]


def build_resume_prompt(form: dict) -> str:
    contact = {
        "full_name": form.get("full_name", ""),
        "email": form.get("email", ""),
        "phone": form.get("phone", ""),
        "city": form.get("city", ""),
        "linkedin": form.get("linkedin", ""),
        "github": form.get("github", ""),
        "portfolio": form.get("portfolio", ""),
    }

    return f"""Build a polished, professional resume from the raw facts below. Do not invent anything not supplied.

Contact info (use exactly as given, do not alter values):
{_json.dumps(contact, ensure_ascii=False)}

Target role / headline (optional): {form.get("target_role", "") or "not specified, infer a sensible title from the experience/skills given"}

Years of experience (optional, as stated by the user): {form.get("years_experience", "") or "not specified"}

Raw summary notes (optional, turn into one sharp 2-3 sentence professional summary with a hook — do not add unstated facts):
{form.get("summary_hint", "") or "(none provided, write a short honest summary based only on the other sections, or leave summary empty if there is truly nothing to summarize)"}

Education (one entry per line, format may vary):
{chr(10).join(_lines(form.get("education", ""))) or "(none provided)"}

Experience (free text, may contain multiple jobs with loose bullet points):
{form.get("experience", "") or "(none provided)"}

Projects (free text, optional):
{form.get("projects", "") or "(none provided)"}

Skills (comma separated, optional): {", ".join(_csv(form.get("skills", ""))) or "(none provided)"}
Languages (comma separated, optional): {", ".join(_csv(form.get("languages", ""))) or "(none provided)"}
Certifications (comma separated, optional): {", ".join(_csv(form.get("certifications", ""))) or "(none provided)"}

Return exactly this JSON shape:
{{
  "full_name": "{form.get("full_name", "")}",
  "title": "a short, specific professional headline, max 55 chars, no buzzword soup",
  "contact": {{"email": "", "phone": "", "city": "", "linkedin": "", "github": "", "portfolio": ""}},
  "summary": "2-3 sentences, punchy, specific, no cliches like 'hard-working team player'",
  "skills": ["normalized, specific skill names, most relevant first, max 14"],
  "experience": [
    {{"title": "", "company": "", "dates": "", "bullets": ["max 18 words, starts with an action verb, max 4 bullets per role"]}}
  ],
  "education": [
    {{"degree": "", "school": "", "dates": ""}}
  ],
  "projects": [
    {{"name": "", "description": "one sharp sentence, what it does + what you used, max 22 words"}}
  ],
  "languages": ["as given, max 6"],
  "certifications": ["as given, max 8"]
}}

Rules:
- If a whole section has no real data, return an empty list for it. Never invent entries to fill space.
- Order experience and education from most to least recent if dates make that clear.
- Keep the contact object identical to the supplied contact info (only light reformatting of the phone is allowed, never invent missing fields)."""


def _str_field(value, max_len):
    return str(value or "").strip()[:max_len]


def clean_resume(data: dict, form: dict) -> dict:
    contact_in = data.get("contact") if isinstance(data.get("contact"), dict) else {}

    def c(key):
        return _str_field(contact_in.get(key) or form.get(key), 200)

    experience = []
    for item in (data.get("experience") or [])[:8]:
        if not isinstance(item, dict):
            continue
        experience.append({
            "title": _str_field(item.get("title"), 120),
            "company": _str_field(item.get("company"), 120),
            "dates": _str_field(item.get("dates"), 60),
            "bullets": str_list(item.get("bullets"), 5, 170),
        })

    education = []
    for item in (data.get("education") or [])[:6]:
        if not isinstance(item, dict):
            continue
        education.append({
            "degree": _str_field(item.get("degree"), 150),
            "school": _str_field(item.get("school"), 150),
            "dates": _str_field(item.get("dates"), 60),
        })

    projects = []
    for item in (data.get("projects") or [])[:6]:
        if not isinstance(item, dict):
            continue
        projects.append({
            "name": _str_field(item.get("name"), 120),
            "description": _str_field(item.get("description"), 220),
        })

    return {
        "full_name": _str_field(data.get("full_name") or form.get("full_name"), 120),
        "title": _str_field(data.get("title"), 80),
        "contact": {
            "email": c("email"),
            "phone": c("phone"),
            "city": c("city"),
            "linkedin": c("linkedin"),
            "github": c("github"),
            "portfolio": c("portfolio"),
        },
        "summary": _str_field(data.get("summary"), 500),
        "skills": str_list(data.get("skills"), 14, 50),
        "experience": experience,
        "education": education,
        "projects": projects,
        "languages": str_list(data.get("languages"), 6, 40),
        "certifications": str_list(data.get("certifications"), 8, 120),
    }


def generate_resume(form: dict) -> dict:
    full_name = str(form.get("full_name", "")).strip()
    if not full_name:
        raise AIError(422, "Full name is required.")

    prompt = build_resume_prompt(form)
    data = chat_json(RESUME_SYSTEM_PROMPT, prompt)
    return clean_resume(data, form)
