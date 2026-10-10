# 🗺️ TechMap Maroc

A directory of tech companies across Morocco, built to help students and job seekers discover real companies, analyze their resumes, generate tailored application materials, and get AI-powered career guidance — all in one place.

> 🚧 Not deployed yet — currently runs locally. Live demo link will go here once it's shipped.

![build](https://img.shields.io/badge/status-in%20development-yellow)
![python](https://img.shields.io/badge/python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)

---

## ✨ Features

### 🏢 Company Directory
- Browse and search tech companies across Morocco
- Filter by city and by specialty (with "match any" / "match all" modes)
- Detailed company profiles: contact info, website, careers page, specialties, and more
- ⭐ Save companies to a personal **Favorites** list (stored locally)

### 📊 Dashboard
- Live stats on the company database (total companies, contact coverage, etc.)
- Animated "bar race" charts for top specialties and top cities
- Breakdown of how companies prefer to be contacted

### 🧠 Job Application Analyzer
- Upload a resume (PDF, DOCX, TXT, MD, or ODT)
- Get an AI-generated score (0–100) based on clarity, relevant skills, measurable impact, and ATS-friendliness
- Strengths, actionable improvements, and keyword gap analysis
- Auto-detects your best-fit specialties and links straight to matching companies

### 🧾 AI Resume Studio
- Fill in a simple form (most fields optional) and generate a polished, ATS-friendly resume
- Three switchable visual templates: Classic, Modern, Bold
- Print-to-PDF, or copy as plain text
- Never fabricates experience — only rewrites and organizes what you actually provide

### ✉️ Apply with AI
- Generate a tailored cover letter for any company in the directory
- Or let AI draft a full application email (subject + body) using your resume
- Opens pre-filled in Gmail or your default mail app — sent from **your own** email address, nothing is sent server-side

### 🤖 AI Career Assistant
- Chat naturally about what kind of role/field/city you're interested in
- Recommends real companies from the live database — never hallucinated ones
- Politely declines to recommend companies when you're just asking general questions (so asking "what's the speed of sound" won't randomly suggest a startup)

### 📋 Applications Tracker
- Local history of every cover letter and application you've drafted, with status tags

---

## 🛠️ Tech Stack

**Backend:** FastAPI (Python), Pandas for the company dataset, `pypdf` / `python-docx` for resume text extraction, OpenAI-compatible client for all AI features (model-agnostic — works with OpenAI, Groq, OpenRouter, or any compatible gateway).

**Frontend:** Vanilla HTML/CSS/JS (no framework, no build step), [anime.js](https://animejs.com/) for motion.

**Data:** A CSV of Moroccan tech companies (`DataBase/morocco_tech_companies_clean.csv`), loaded and cached in-memory, auto-reloaded when the file changes.

---

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/yourusername/techmap-maroc.git
cd techmap-maroc
pip install -r requirements.txt
npm install -g omniroute
```

### 2. Add your dataset

Make sure your CSV lives at:
```
DataBase/morocco_tech_companies_clean.csv
```
with at least these columns: `company_name, city, specialties, description, website, apply_email, phone, apply_link, apply_via, careers_url, contact_url, all_emails, source`.

### 3. Run it
```bash
omniroute
```
and in an other instance run:

```bash
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000** — the backend serves the frontend directly, no separate dev server needed.

---

## 📁 Project Structure

```
.
├── main.py                  # FastAPI app & all API routes
├── requirements.txt
├── DataBase/
│   └── morocco_tech_companies_clean.csv
├── static/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── utils/
    ├── config.py             # env vars, paths, constants
    ├── data.py                # CSV loading, filtering, stats
    ├── ai_client.py           # OpenAI-compatible client wrapper
    ├── ai_analysis.py         # resume scoring logic
    ├── resume_ai.py           # AI resume generation
    ├── resume_render.py       # server-side resume HTML renderer
    ├── letters_ai.py          # cover letters & application emails
    ├── chat_ai.py             # AI career assistant / chatbot
    └── text_extraction.py     # PDF/DOCX/ODT/TXT text extraction
```

---

## 🔌 API Overview

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/companies` | GET | Paginated, filterable company list |
| `/api/companies/by-ids` | GET | Fetch specific companies (used for Favorites) |
| `/api/specialties` | GET | List of specialties with counts |
| `/api/cities` | GET | List of cities |
| `/api/stats` | GET | Dashboard statistics |
| `/api/analyze` | POST | Upload & score a resume |
| `/api/resume/generate` | POST | Generate a resume from form data |
| `/api/companies/{id}/cover-letter` | POST | Generate a tailored cover letter |
| `/api/companies/{id}/prepare-application` | POST | Draft an application email + resume |
| `/api/chat` | POST | AI career assistant turn |

---

## ⚠️ Notes & Limitations

- Applications are **never sent server-side** — the app only drafts content and hands off to your own Gmail/mail client, so nothing is sent without your explicit click.
- The AI never invents company data or fabricates resume experience — prompts are written to strictly ground output in real, user-supplied, or database-sourced facts.
- Resume text extraction skips images/scans — if a resume is a scanned image with no selectable text, it won't be readable. Export with real text or OCR it first.

---
