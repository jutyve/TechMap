# TechMap Maroc

A self-hostable workspace for discovering Morocco's tech companies and preparing your next career move. Built with FastAPI, a real included company dataset, and plain HTML/CSS/JavaScript. **No Node.js, frontend build, CDN, or paid service is needed to browse the directory.**

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

## What's included

- A light-by-default workspace with optional dark mode, slate typography, violet accents, and motion that respects reduced-motion preferences.
- Typography is self-hosted: **Fraunces** for display, **Inter** for the interface, and **IBM Plex Mono** for labels and figures (all SIL Open Font License, bundled in `static/assets/fonts/`). No webfont download is needed, so the app looks the same offline.
- Searchable company directory with city/specialty/contact filters, sorting, grid/list views, favorites, comparison of up to three companies, and private company notes.
- **Ecosystem insights** dashboard: company/website/email/phone totals plus top specialties, top cities, and how-to-apply breakdowns, all from the included dataset.
- **Resume Studio** with Classic, Modern, Bold, and Editorial templates, plus four accent colors (forest, navy, terracotta, charcoal).
- **Preview my details**: a local, non-AI preview that uses only the words you enter. Put each experience, education, or project entry on a new line. AI polishing is optional.
- Optional JPG, PNG, or WebP profile photo, up to 5 MB and 25 megapixels. Images are center-cropped into a 512 px square JPEG in the browser. Upload a pre-cropped portrait if you want different framing. Replace/remove it at any time.
- Photos appear in all four templates, printed/PDF resumes, and the Studio HTML attachment prepared through Apply. Photo-free resumes remain fully supported and are often preferable for ATS submissions.
- Automatic local form saving, remembered style/photo, and live updates to a locally previewed resume. AI-generated resumes update only when you explicitly preview your own details or polish again.
- **Optional accounts** (`/login.html`): create an account with email verification and everything above — favorites, company notes, Resume Studio details/resume/photo/style, profile and layout — is saved to your account automatically and follows you across browsers and devices. Guests keep the original browser-only behaviour; work you did as a guest is migrated into your account the first time you sign in on that browser. See [Accounts & email](#accounts--email-verification).
- Resume analysis (score, strengths, improvements, keyword matches, and detected specialties you can jump to in the directory), AI-assisted cover letters, application-email drafts, and a career assistant using the provider APIs configured below.
- Application drafts open in Gmail or your mail app for you to review and send yourself; the server never sends mail.
- Searchable **Ctrl/Cmd + K** quick actions, `/` directory search, and a built-in help dialog.
- Brief entrance, template, and favorite-button animations. Reduced-motion preferences disable the effects.
- Interface icons are drawn inline as SVG, so the workspace does not depend on an emoji font being installed.

Resume printing and copy-as-text remain available. Existing browser application records are left untouched, not erased.

## Optional AI setup

**AI tools need a provider. They are not simulated, and no provider credentials are shipped.** All non-AI directory features work without this step. The AI-powered features are resume analysis, **Polish with AI**, cover letters, application-email drafts, and the career assistant.

Copy `.env.example` to `.env` in the project root and configure an OpenAI-compatible service:

```dotenv
OMNIROUTE_BASE_URL=https://your-provider.example/v1
OMNIROUTE_API_KEY=your-own-api-key
OMNIROUTE_MODEL=your-provider-model-id
```

Use your provider's actual base URL and supported model ID. The variable names retain `OMNIROUTE_` for compatibility, but any compatible gateway can be used. A local OmniRoute gateway can use `http://localhost:20128/v1`. Restart the Python server after changes. Keys remain on the backend; `.env` is ignored by Git and excluded from source archives (the `.env.example` template is included). Provider usage may incur charges.

Without a configured/reachable gateway, AI requests show an error. Scanned/image-only resumes require OCR first. Supported uploads: PDF, DOCX, TXT, MD, ODT, up to 10 MB.

## Accounts & email verification

Accounts are **optional** — the whole workspace works as a guest. Creating one (sidebar **Sign in**, or `/login.html`) makes your favorites, company notes, Resume Studio work, profile and preferences save to the server and follow you across devices.

Registration asks for a name, email and password, then sends a **verification link** (valid 24 hours, single-use). Until the link is clicked the account cannot sign in; clicking it verifies the address and signs you in. The login page can resend the link, and a forgot-password flow emails a 1-hour reset link. Passwords are stored as salted PBKDF2 hashes, sessions are random-token cookies (HttpOnly, 30 days) whose hashes live server-side, and auth endpoints are rate-limited. Everything is standard-library Python + SQLite (`data/techmap.db`, created on first run) — no new dependencies.

**Sending real email.** With no mail settings, verification/reset messages are printed to the server console and saved under `data/outbox/`, and the login page shows the link directly in a clearly marked *Dev mode* box — so the full flow works locally with zero setup. To deliver real email (e.g. Gmail with an App Password, or any SMTP service), set in `.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=you@gmail.com
APP_BASE_URL=https://your-public-host.example   # used for links in emails
```

See `.env.example` for all knobs (`SMTP_USE_SSL`, token lifetimes, `AUTH_REQUIRE_VERIFICATION=0` to make verification optional, …). As soon as `SMTP_HOST` is set, dev-mode links disappear from the UI automatically. Restart the server after changing `.env`.

## Your data and privacy

As a guest, favorites, company notes, resume details, style and layout preferences, and the processed photo are stored in **this browser's localStorage** only. Other devices, browser profiles, ports, and hosts have separate storage, and clearing site data removes them.

When you **sign in**, those same items are additionally mirrored to your account in the server-side SQLite database (`data/techmap.db`) so they survive cleared site data and follow you to other browsers/devices. The browser copy remains the working copy; signing out stops the mirroring but leaves the local copy in place. Deleting your account (on the account page) permanently deletes the server copy. There is still no separate backup/restore interface — back up `data/techmap.db` if you self-host for others.

**Studio photo processing is local.** Neither the original image nor the processed photo is ever included in an AI request. As a guest the processed photo is not uploaded anywhere; when you are signed in it is stored with your account (like the rest of your synced workspace) so your resume looks the same on your other devices. Only resume text fields are sent when you choose **Polish with AI**. The photo is embedded in your printed/PDF resume and the locally prepared Studio HTML attachment, so anyone you send those documents to can see it. Do not add a photo if the employer requests a photo-free resume. Copy-as-text naturally excludes images.

For other AI actions, resume text and submitted prompts are sent to your configured provider; review its privacy terms. Applications are **never sent by the server**: review drafts and choose whether to send them through your own mail client. Review all AI output for accuracy.

The CSV is the repository's existing dataset, not a live vacancies feed or an endorsement. A "Careers page" badge only means a link is present. Verify company and contact details before applying. Company IDs currently follow CSV row order; preserve that order if you depend on existing favorites.

Spelling variants in the dataset are normalised when it is loaded, not in the file: cities that appear as `Marrakech`, `marrakech` and `kénitra`/`Kenitra` are grouped case- and accent-insensitively, and the most common spelling is used for display, filters and statistics. Edit `app/services/data.py` if you would rather keep raw values.

## Running the server

```bash
# After creating a venv; Windows can use .venv\Scripts\python.exe instead
.venv/bin/python run.py                 # http://127.0.0.1:8000
RELOAD=1 HOST=0.0.0.0 .venv/bin/python run.py   # auto-reload, shared on the LAN
```

`run.py` is a thin launcher around `app.main:app`; the equivalent raw command is `.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`. `python -m app` works too.

The frontend calls relative `/api` URLs, so there is no browser-facing localhost dependency. `0.0.0.0` is suitable for an accessible preview. The default `run.py` binds to loopback for local use; set `HOST`/`PORT` if needed. Accounts, hashed passwords, session cookies and basic rate limiting are included, but this is still a personal workspace rather than a hardened public service: before public hosting, serve it over HTTPS, set `APP_BASE_URL`, and add provider usage controls for the AI endpoints (which remain available to guests).

### Make your own downloadable source

```bash
.venv/bin/python scripts/package.py
# or choose a destination:
.venv/bin/python scripts/package.py /path/to/TechMap-source.zip
```

The generated archive has a single `TechMap/` folder — application, frontend, docs, both company datasets, and the `.env.example` template — and runs independently of the checkout: extract it and run `python run.py`. Packaging omits `.git`, virtual environments, real `.env` files, caches, logs, generated ZIPs, and the `data/` folder (account database and dev mail outbox). Generated archives are git-ignored and intentionally not committed.

## Structure

```text
run.py                              Local launcher (python run.py, python -m app)
requirements.txt                    Runtime dependencies
.env.example                        Template for the optional AI provider settings
.gitignore
LICENSE
README.md

app/                                Application package
├── main.py                         FastAPI app: middleware, routers, static mount
├── __main__.py                     `python -m app` entry point
├── api/                            HTTP layer
│   ├── deps.py                     Shared route helpers
│   └── routes/                     One router per feature
│       ├── auth.py                 Register/verify/login/sessions, password reset
│       ├── account.py              Per-user synced workspace state (/api/me/state)
│       ├── companies.py            Directory, cities, specialties, stats
│       ├── resume.py               Resume analyzer + Studio generation
│       ├── letters.py              Cover letters + Apply drafts
│       └── chat.py                 Career assistant
└── services/                       Data access, AI providers, rendering
    ├── config.py                   Paths, limits, environment settings
    ├── db.py                       SQLite schema/connections (accounts database)
    ├── accounts.py                 Users, sessions, email tokens, synced state
    ├── security.py                 Password hashing + token helpers (stdlib)
    ├── mail.py                     SMTP sending + local outbox fallback
    ├── data.py                     CSV loading, filtering, serialization
    ├── text_extraction.py          PDF / DOCX / TXT / MD / ODT extraction
    ├── ai_client.py                OpenAI-compatible provider wrapper
    ├── ai_analysis.py              Resume scoring and feedback
    ├── resume_ai.py                Resume generation
    ├── resume_render.py            Resume HTML rendering
    ├── letters_ai.py               Cover letters and application emails
    └── chat_ai.py                  Career-assistant conversation handling

static/                             Everything the browser loads — see static/README.md
├── index.html                      Workspace page markup and asset tags
├── login.html                      Sign-in / create-account / account page
├── README.md                       Frontend layout, cascade, and load-order guide
├── assets/
│   ├── fonts/                      Self-hosted woff2 subsets + OFL licences
│   │   ├── fraunces-*.woff2        Bundled legacy serif (variable)
│   │   ├── inter-*.woff2           Interface sans (variable)
│   │   ├── ibm-plex-mono-*.woff2   Labels and figures
│   │   └── LICENSE-*.txt           Fraunces / Inter / IBM Plex Mono (OFL)
│   └── icons/
│       └── mark.svg                Brand mark (favicon, nav, hero)
├── css/                            Cascade order: base → workspace → studio
│   ├── base.css                    Fonts, tokens, components, shared surfaces
│   ├── workspace.css               Shell, directory, insights, responsive rules
│   ├── studio.css                  Resume Studio UI + resume documents + print
│   └── auth.css                    Login/account page + sidebar account widget
└── js/
    └── features/                   Loaded in order at the end of <body>
        ├── app.js                  Directory, favorites, analyzer, letters/Apply, chat
        ├── auth.js                 Account widget + localStorage→account sync
        ├── auth-page.js            Sign-in/registration/reset forms (login.html)
        ├── workspace.js            Help, views, comparison, notes
        ├── quick-actions.js        Searchable Ctrl/Cmd + K launcher
        └── studio.js               Local preview, photo processing, styling, motion

database/
├── data/
│   ├── morocco_tech_companies.csv        Raw collector output
│   └── morocco_tech_companies_clean.csv  Dataset served by the API
└── scripts/
    └── CompanyCollector.py         Optional dataset collector (extra deps listed
                                    in its docstring and commented in requirements.txt)

data/                               Created at runtime, git-ignored: techmap.db
                                    (accounts + synced state) and outbox/ (dev mail)

scripts/package.py                  Reproducible source packaging workflow
```

`__init__.py` package markers exist under `app/`, `app/api/`, `app/api/routes/`, and `app/services/` but are omitted from the tree above for brevity.

The API documentation is available at `/docs` when the server is running. Main routes: `/api/companies`, `/api/companies/by-ids`, `/api/cities`, `/api/specialties`, `/api/stats`, `/api/analyze`, `/api/resume/generate`, `/api/companies/{id}/cover-letter`, `/api/companies/{id}/prepare-application`, `/api/chat`, plus accounts: `/api/auth/register`, `/api/auth/verify`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and synced workspace state at `/api/me/state`.

## License

MIT. See [LICENSE](LICENSE).

### Portfolio Studio

Open **Portfolio studio** from the workspace to choose one of eight designs and
preview a site with your bio, skills, social links, projects, experience,
education, and certifications. Sign in to save a private draft or publish.
Each account can manage one portfolio at `/portfolio/<username>`. Anyone can
visit a published page without an account. Changing the username replaces the
old URL; unpublishing takes it offline without deleting the saved content.
Published data lives in the same SQLite database as accounts, so keep that
file on persistent storage when deploying TechMap. The link is internet-facing
only if the TechMap server itself is publicly accessible.

Run the portfolio lifecycle tests with `python -m unittest discover -s tests`
(after installing the optional test dependency `httpx`).

Set or remove your account photo in **Account settings**. In Portfolio Studio,
choose **Use account photo** to keep it in sync with your public portfolio,
**Use a separate portfolio photo** for an independent upload, or **Don't show a
photo** to keep your account photo off the site. Each project can have its own
cover. The editor accepts JPG, PNG, or WebP up to 10 MB and resizes them before
saving. Changes to portfolio-specific photos go live only when you publish.
