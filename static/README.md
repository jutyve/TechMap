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
│   ├── fonts/              Self-hosted woff2 subsets, one folder for all three
│   │                       families (Fraunces, Inter, IBM Plex Mono) + OFL
│   │                       licences. Declared with @font-face in base.css.
│   └── icons/
│       └── mark.svg        Brand mark (favicon, nav brand, hero art)
├── css/                    Loaded in cascade order — see below
│   ├── base.css            @font-face declarations and the design tokens
│   │                       (light "ivory atelier" + dark "midnight cedar"),
│   │                       reset, typography, shared components
│   ├── workspace.css       Shell: sidebar, header, hero, directory, insights,
│   │                       responsive rules (overrides base)
│   └── studio.css          Resume Studio UI, the four resume documents and
│                           print rules (overrides both)
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

## Visual language

Warm paper neutrals, a zellige-green brand, and saffron/terracotta accents.
Every colour, radius, shadow and easing lives in the `:root` custom properties
at the top of `base.css`; the dark theme is the same list re-declared under
`html[data-theme="dark"]`, so a new component only has to use tokens to work in
both themes. Display type is Fraunces (a soft serif), body copy is Inter, and
mono labels/figures are IBM Plex Mono. The subtle paper grain over the whole
app is a `body::after` layer driven by `--grain-opacity`.

The four resume documents (`studio.css`, `.rdoc-*`) deliberately use system
font stacks rather than the bundled webfonts: what someone sees in the preview
is what a recruiter sees in the printed or exported file on any machine.

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
  fonts → `assets/fonts/`, styles → `css/` (mind the cascade), page behaviour →
  `js/features/`, and only scripts that must run before first paint → `js/core/`.
- **Fonts:** add the `.woff2` subset to `assets/fonts/`, declare it with
  `@font-face` in `base.css`, and keep the OFL licence text beside it. Prefer
  the Latin and Latin-Extended subsets so the bundle stays small.
- **Renaming/moving a stylesheet?** `js/features/studio.js` fetches
  `css/base.css` + `css/studio.css` by path to build the standalone resume
  HTML used by Apply — update those paths too.
- **Legacy code** stays in `js/legacy/`, unloaded. Delete it there rather
  than reviving it from a feature script.
