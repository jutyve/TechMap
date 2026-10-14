# TechMap Maroc

A redesigned, self-hostable workspace for discovering Morocco’s tech companies and preparing your next career move. Built with FastAPI, a real included company dataset, and plain HTML/CSS/JavaScript. **No Node.js, frontend build, CDN, or paid service is needed to browse the directory.**

## Take the files and run them

Use your local checkout, or generate `TechMap-source.zip` with `scripts/package.py` (see below), extract it, and open a terminal **inside the extracted `TechMap` folder**. You can also copy this repository folder directly. Keep `run.py`, `app/`, `static/`, and `database/` together — they are one application.

Install Python **3.10 or newer** from python.org if needed.

### Windows (PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe run.py
```

If Windows uses `py` rather than `python`, use `py -m venv .venv` for the first command. These commands do not need script activation or a PowerShell execution-policy change.

### macOS / Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

On Debian/Ubuntu, install `python3-venv` if Python reports that venv is unavailable.

Open **http://127.0.0.1:8000**. Keep the terminal open while using the app; press Ctrl+C to stop. Do **not** double-click `static/index.html`: the frontend needs the Python API.

Installing dependencies needs an internet connection. After installation, the directory, insights, and browser-saved features work locally without internet. External company links and configured remote AI services need network access.

## What’s included

- A responsive sage-and-ivory workspace, forest dark theme, and remembered light/dark preference.
- Searchable company directory with city/specialty/contact filters, sorting, favorites, comparison, and private company notes.
- **Resume Studio** with Classic, Modern, Bold, and the new Editorial template, plus four accent colors.
- **Preview my details**: a local, non-AI preview that uses only the words you enter. Put each experience, education, or project entry on a new line. AI polishing is optional.
- Optional JPG, PNG, or WebP profile photo, up to 5 MB and 25 megapixels. Images are center-cropped into a 512 px square JPEG in the browser. Upload a pre-cropped portrait if you want different framing. Replace/remove it at any time.
- Photos appear in all four templates, printed/PDF resumes, and the Studio HTML attachment prepared through Apply. Photo-free resumes remain fully supported and are often preferable for ATS submissions.
- Automatic local form saving, remembered style/photo, and live updates to a locally previewed resume. AI-generated resumes update only when you explicitly preview your own details or polish again.
- Resume analysis, AI-assisted cover letters, application-email drafts, and a career assistant using the existing provider APIs.
- Searchable **Ctrl/Cmd + K** quick actions and `/` directory search.
- Brief entrance, template, and favorite-button animations. Reduced-motion preferences disable the effects.

The manual application pipeline, company CSV export, workspace backup/restore controls, and website source-download links have been removed. Existing browser application records are left untouched, not erased. Resume printing and text copying remain available. The legacy pipeline model is retained at `static/js/legacy/pipeline-model.js` but is no longer loaded by the website.

## Optional AI setup

**AI tools need a provider. They are not simulated, and no provider credentials are shipped.** All non-AI directory features work without this step.

Copy `.env.example` to `.env` in the project root and configure an OpenAI-compatible service:

```dotenv
OMNIROUTE_BASE_URL=https://your-provider.example/v1
OMNIROUTE_API_KEY=your-own-api-key
OMNIROUTE_MODEL=your-provider-model-id
```

Use your provider’s actual base URL and supported model ID. The variable names retain `OMNIROUTE_` for compatibility, but any compatible gateway can be used. A local OmniRoute gateway can use `http://localhost:20128/v1`. Restart the Python server after changes. Keys remain on the backend; `.env` is ignored by Git and excluded from source downloads. Provider usage may incur charges.

Without a configured/reachable gateway, AI requests show an error. Scanned/image-only resumes require OCR first. Supported uploads: PDF, DOCX, TXT, MD, ODT, up to 10 MB.

## Your data and privacy

Favorites, company notes, resume details, style preferences, and the processed photo are stored in **this browser’s localStorage**, not a cloud account. Other devices, browser profiles, ports, and hosts have separate storage. Clearing site data removes these saved details. There is no backup/restore interface.

**Studio photo processing is local.** Neither the original image nor the processed photo is included in the AI request or uploaded to the backend by Studio. Only resume text fields are sent when you choose **Polish with AI**. The photo is embedded in your printed/PDF resume and the locally prepared Studio HTML attachment, so anyone you send those documents to can see it. Do not add a photo if the employer requests a photo-free resume. Copy-as-text naturally excludes images.

For other AI actions, resume text and submitted prompts are sent to your configured provider; review its privacy terms. Applications are **never sent by the server**: review drafts and choose whether to send them through your own mail client. Review all AI output for accuracy.

The CSV is the repository’s existing dataset, not a live vacancies feed or an endorsement. A “Careers page” badge only means a link is present. Verify company and contact details before applying. Company IDs currently follow CSV row order; preserve that order if you depend on existing favorites.

## Development

```bash
# After creating a venv; Windows can use .venv\Scripts\python.exe instead
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/python run.py                 # http://127.0.0.1:8000
RELOAD=1 HOST=0.0.0.0 .venv/bin/python run.py   # auto-reload, shared on the LAN
```

`run.py` is a thin launcher around `app.main:app`; the equivalent raw command is `.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`. `python -m app` works too.

The frontend calls relative `/api` URLs, so there is no browser-facing localhost dependency. `0.0.0.0` is suitable for an accessible preview. The default `run.py` binds to loopback for local use; set `HOST`/`PORT` if needed. This is a personal workspace, not a hardened public multi-user service; add authentication, rate limiting, and provider usage controls before public hosting.

### Make your own downloadable source

```bash
.venv/bin/python scripts/package.py
# or choose a destination:
.venv/bin/python scripts/package.py /path/to/TechMap-source.zip
```

The generated archive has a single `TechMap/` folder, includes the cleaned company dataset, and runs independently of the checkout — extract it and run `python run.py`. Packaging rules omit `.git`, `.venv`, `.env`, caches, logs, generated ZIPs, and private uploads. There is no website source-download endpoint. Generated archives are git-ignored and intentionally not committed.

## Structure

```text
run.py                              Local launcher (python run.py, python -m app)
requirements.txt                    Runtime dependencies
requirements-dev.txt                Adds pytest + httpx for the test suite
.env.example                        Template for the optional AI provider settings
LICENSE

app/                                Application package
├── main.py                         FastAPI app: middleware, routers, static mount
├── __main__.py                     `python -m app` entry point
├── api/                            HTTP layer
│   ├── deps.py                     Shared route helpers
│   └── routes/                     One router per feature
│       ├── companies.py            Directory, cities, specialties, stats
│       ├── resume.py               Resume analyzer + Studio generation
│       ├── letters.py              Cover letters + Apply drafts
│       └── chat.py                 Career assistant
└── services/                       Data access, AI providers, rendering
    ├── config.py                   Paths, limits, environment settings
    ├── data.py                     CSV loading, filtering, serialization
    ├── text_extraction.py          PDF / DOCX / TXT / MD / ODT extraction
    ├── ai_client.py                OpenAI-compatible provider wrapper
    ├── ai_analysis.py              Resume scoring and feedback
    ├── resume_ai.py                Resume generation
    ├── resume_render.py            Resume HTML rendering
    ├── letters_ai.py               Cover letters and application emails
    └── chat_ai.py                  Career-assistant conversation handling

static/                            Everything the browser loads
├── index.html                     Workspace and existing tool forms
├── css/
│   ├── style.css                   Tool and resume-template foundation
│   ├── workspace.css               Responsive redesign and design tokens
│   └── studio.css                  Studio interface and printable resume styles
├── js/
│   ├── theme.js                    Early system/saved theme initialization
│   ├── app.js                      Company, AI, resume, application behavior
│   ├── workspace.js                Themes, filters, comparison, notes
│   ├── studio.js                   Local preview, photo processing, styling, motion
│   ├── quick-actions.js            Searchable keyboard launcher
│   └── legacy/pipeline-model.js    Retained, no longer loaded
└── assets/
    └── mark.svg                    Local brand asset

database/
├── data/
│   ├── morocco_tech_companies.csv        Raw collector output
│   └── morocco_tech_companies_clean.csv  Dataset served by the API
└── scripts/
    └── CompanyCollector.py         Optional dataset collector

scripts/package.py                  Reproducible source packaging workflow
tests/                              API, layout and packaging smoke tests
```

The API documentation is available at `/docs` when the server is running. Main routes: `/api/companies`, `/api/companies/by-ids`, `/api/cities`, `/api/specialties`, `/api/stats`, `/api/analyze`, `/api/resume/generate`, `/api/companies/{id}/cover-letter`, `/api/companies/{id}/prepare-application`, `/api/chat`.

## License

MIT. See [LICENSE](LICENSE).
