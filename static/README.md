# Frontend (`static/`)

Plain HTML, CSS, and JavaScript — no build step, no framework, no CDN.
FastAPI serves this folder at `/` (see `app/main.py`), and the page talks to
the backend through relative `/api` URLs. Don't open `index.html` directly
from disk; run `python run.py` and visit <http://127.0.0.1:8000>.

## Layout

```text
static/
├── index.html              The only file at the root: page markup + asset tags
├── README.md               This file
├── assets/
│   └── icons/
│       └── mark.svg        Brand mark (favicon, nav brand, hero art)
├── css/                    Loaded in cascade order — see below
│   ├── base.css            Foundation: layout primitives, components,
│   │                       resume-document templates, modals, chat, print
│   ├── workspace.css       Workspace redesign: design tokens, light/dark
│   │                       themes, responsive shell (overrides base)
│   └── studio.css          Resume Studio UI + printable resume (overrides both)
├── js/
│   ├── core/
│   │   └── theme.js        Runs in <head> before first paint; sets the
│   │                       saved/system light–dark theme on <html>
│   ├── features/           Loaded at the end of <body>, in this order
│   │   ├── app.js          Directory data, favorites, detail panel,
│   │   │                   analyzer, cover-letter/Apply flows, dashboard, chat
│   │   ├── workspace.js    Shell behaviour: theme toggle, help, filters,
│   │   │                   grid/list views, comparison, private notes
│   │   ├── quick-actions.js  Ctrl/Cmd + K launcher
│   │   └── studio.js       Resume Studio: local preview, photo processing,
│   │                       accents/templates, entrance/favourite motion
│   └── legacy/
│       └── pipeline-model.js  Retained for reference — NOT loaded by the site
└── (nothing else)          Add new files to the folders above, not the root
```

## Rules that keep this tidy

- **Load order is part of the design.** In `<head>`, `js/core/theme.js` must
  run before the stylesheets paint, and the CSS cascade is
  `base.css` → `workspace.css` → `studio.css` (later files override earlier
  ones). At the end of `<body>`, `features/app.js` loads first because the
  other feature scripts use the globals it defines (`state`,
  `buildResumeHtml`, helpers). Don't reorder these tags casually.
- **Cache-busting:** every asset tag in `index.html` carries a `?v=N` query.
  Bump `N` (same value everywhere) whenever an asset's URL or contents change
  in a release.
- **Where new files go:** icons/images → `assets/` (icons in `assets/icons/`),
  styles → `css/` (mind the cascade), page behaviour → `js/features/`, and
  only scripts that must run before first paint → `js/core/`.
- **Renaming/moving a stylesheet?** `js/features/studio.js` fetches
  `css/base.css` + `css/studio.css` by path to build the standalone resume
  HTML used by Apply — update those paths too.
- **Legacy code** stays in `js/legacy/`, unloaded. Delete it there rather
  than reviving it from a feature script.
