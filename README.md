# TechMap Maroc

A redesigned, self-hostable workspace for discovering Morocco’s tech companies and preparing your next career move. Built with FastAPI, a real included company dataset, and plain HTML/CSS/JavaScript. **No Node.js, frontend build, CDN, or paid service is needed to browse the directory.**

## Take the files and run them

Download `TechMap-source.zip` from the app’s **Download source** link (or the attached delivery), extract it, and open a terminal **inside the extracted `TechMap` folder**. You can also copy this repository folder directly. Keep `main.py`, `utils/`, `Static/`, and `DataBase/` together. The capital S in `Static` matters on Linux.

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

Open **http://127.0.0.1:8000**. Keep the terminal open while using the app; press Ctrl+C to stop. Do **not** double-click `Static/index.html`: the frontend needs the Python API.

Installing dependencies needs an internet connection. After installation, the directory, insights, and browser-saved features work locally without internet. External company links and configured remote AI services need network access.

## What’s included

- A new sage-and-ivory workspace with responsive sidebar/navigation and an original CSS illustration.
- Searchable company directory; city and specialty filters with any/all matching.
- Grid/list layouts, company details, safe external links, and saved companies.
- CSV export of **all matching results**, or your saved companies when on the Saved tab. Spreadsheet formula prefixes are escaped.
- Live dataset counts and ecosystem charts, not invented hiring metrics.
- Resume analysis, three-template Resume Studio, cover letters, application-email drafts, and a career assistant using the existing AI APIs.
- Local application draft history. A draft is not evidence an application was sent.
- Source ZIP download; browser workspace JSON export/import under the **?** help button.
- Keyboard navigation, dialog focus handling, reduced-motion support, and mobile layouts.

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

Favorites, resume form data, generated resumes, and application drafts are stored in **this browser’s localStorage**, not a cloud account. Other browsers, ports, or hosts have separate storage. Use **? → Export my workspace backup** to move your work, then restore that JSON on the other device. Restoration replaces the saved workspace after confirmation. Treat backups as personal documents; they can contain resume details and application drafts. Source ZIPs do not contain browser data.

For AI actions, resume text and submitted prompts are sent to your configured provider. Review its privacy terms. Applications are **never sent by the server**: you review drafts and choose whether to send them through your own mail client. Review AI output for accuracy.

The CSV is the repository’s existing dataset, not a live vacancies feed or an endorsement. A “Careers page” badge only means a link is present. Verify company and contact details before applying. Company IDs currently follow CSV row order; preserve that order if you depend on existing favorites.

## Development

```bash
# After creating a venv; Windows can use .venv\Scripts\python.exe instead
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The frontend calls relative `/api` URLs, so there is no browser-facing localhost dependency. `0.0.0.0` is suitable for an accessible preview. The default `run.py` binds to loopback for local use; set `HOST`/`PORT` if needed. This is a personal workspace, not a hardened public multi-user service; add authentication, rate limiting, and provider usage controls before public hosting.

### Make your own downloadable source

```bash
.venv/bin/python scripts/package.py
# or choose a destination:
.venv/bin/python scripts/package.py /path/to/TechMap-source.zip
```

The generated archive has a single `TechMap/` folder, includes the cleaned company dataset, and runs independently of the checkout. Explicit packaging rules omit `.git`, `.venv`, `.env`, caches, logs, generated ZIPs, and private uploads. The app’s `/api/download/source` uses the same packager. Generated delivery archives are intentionally not committed.

## Structure

```text
main.py                         FastAPI routes + static serving
run.py                          Cross-platform local launcher
Static/index.html               Workspace and existing tool forms
Static/style.css                Tool and resume-template foundation
Static/workspace.css            Responsive redesign and design tokens
Static/app.js                   Company, AI, resume, application behavior
Static/workspace.js             Export, layouts, help, portable backups
Static/mark.svg                 Local brand asset
DataBase/morocco_tech_companies_clean.csv
utils/                          Data loading, AI, extraction, packaging
scripts/package.py              Reproducible source packaging workflow
tests/                          API and delivery smoke tests
```

The API documentation is available at `/docs` when the server is running. Main routes: `/api/companies`, `/api/companies/by-ids`, `/api/cities`, `/api/specialties`, `/api/stats`, `/api/analyze`, `/api/resume/generate`, `/api/companies/{id}/cover-letter`, `/api/companies/{id}/prepare-application`, `/api/chat`, `/api/download/source`.

## License

MIT. See [LICENSE](LICENSE).
