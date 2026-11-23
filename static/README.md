# Frontend (`static/`)

Plain HTML, CSS, and JavaScript — no build step, no framework, no CDN.
FastAPI serves this folder at `/` (see `app/main.py`), and the page talks to
the backend through relative `/api` URLs. Don't open `index.html` directly
from disk; run `python run.py` and visit <http://127.0.0.1:8000>.

## Layout

```text
static/
├── index.html              The workspace page: markup + asset tags
├── login.html              Sign-in / create-account / account page (same assets)
├── README.md               This file
├── assets/
│   ├── fonts/              Self-hosted woff2 subsets, one folder for all three
│   │                       families (Fraunces, Inter, IBM Plex Mono) + OFL
│   │                       licences. Declared with @font-face in base.css.
│   └── icons/
│       └── mark.svg        Brand mark (favicon, nav brand, hero art)
├── css/                    Loaded in cascade order — see below
│   ├── base.css            @font-face declarations and the design tokens
│   │                       (light by default, optional dark mode),
│   │                       reset, typography, shared components
│   ├── workspace.css       Shell: sidebar, header, hero, directory, insights,
│   │                       responsive rules (overrides base)
│   ├── studio.css          Resume Studio UI, the four resume documents and
│   │                       print rules (overrides both)
│   ├── projects.css        Project library grid, filters and brief dialog
│   └── auth.css            Login/account page + the sidebar account widget
│                           (loaded last on index.html, after base on login.html)
├── js/
│   ├── core/               Shared boot/data scripts (loaded before features)
│   │   └── projects-data.js  Curated project-idea library (static data)
│   └── features/           Loaded at the end of <body>, in this order
│       ├── app.js          Directory data, favorites, detail panel,
│       │                   analyzer, cover-letter/Apply flows, dashboard, chat
│       ├── auth.js         Account widget + sync of the saved localStorage
│       │                   keys to /api/me/state when signed in (index only)
│       ├── auth-page.js    Sign-in / registration / reset forms (login.html only)
│       ├── projects.js     Project library: specialty/level/time filters,
│       │                   saved/building/shipped state, briefs and hand-off
│       │                   to Portfolio Studio / Resume Studio
│       ├── workspace.js    Shell behaviour: help, filters,
│       │                   grid/list views, comparison, private notes
│       ├── quick-actions.js  Ctrl/Cmd + K launcher
│       └── studio.js       Resume Studio: local preview, photo processing,
│                           accents/templates, entrance/favourite motion
└── (nothing else)          Add new files to the folders above, not the root
                            (index.html and login.html are the two page files)
```

## Visual language

White and cool gray surfaces, slate text, and violet accents. Shared colors,
radii, elevation, and easing live in the `:root` tokens in `base.css`. Inter
is used for both display and body text, with IBM Plex Mono for labels and
figures. Entrance and interaction effects respect `prefers-reduced-motion`.

The four resume documents (`studio.css`, `.rdoc-*`) deliberately use system
font stacks rather than the bundled webfonts: what someone sees in the preview
is what a recruiter sees in the printed or exported file on any machine.

## Rules that keep this tidy

- **Load order is part of the design.** In `<head>`, the CSS cascade is
  `base.css` → `workspace.css` → `studio.css` → `auth.css` (later files
  override earlier ones). At the end of `<body>`, `features/app.js` loads
  first because the other feature scripts use the globals it defines
  (`state`, `buildResumeHtml`, helpers); `features/auth.js` loads right
  after it so its localStorage sync hook is installed before the remaining
  features save anything. Don't reorder these tags casually.
- **Project ideas are data, not markup.** `js/core/projects-data.js` exposes
  `window.techmapProjectIdeas`; `js/features/projects.js` renders it. Add or
  edit an idea there (keep IDs unique) and the tab, filters and counts update.
- **Cache-busting:** every asset tag in `index.html` and `login.html` carries a `?v=N` query.
  Bump `N` (same value everywhere) whenever an asset's URL or contents change
  in a release.
- **Where new files go:** icons/images → `assets/` (icons in `assets/icons/`),
  fonts → `assets/fonts/`, styles → `css/` (mind the cascade), page behaviour →
  `js/features/`.
- **Fonts:** add the `.woff2` subset to `assets/fonts/`, declare it with
  `@font-face` in `base.css`, and keep the OFL licence text beside it. Prefer
  the Latin and Latin-Extended subsets so the bundle stays small.
- **Renaming/moving a stylesheet?** `js/features/studio.js` fetches
  `css/base.css` + `css/studio.css` by path to build the standalone resume
  HTML used by Apply — update those paths too.

## Interface languages

The workspace and sign-in pages offer English, French, and Arabic. The picker
remembers the language in this browser. `js/core/language.js` sets `lang` and
`dir` before paint, `js/core/locales.js` holds the interface strings, and
`css/language.css` mirrors the Arabic layout. Use `techmapLanguage.t()` for
strings built in JavaScript and keep company data, authored content, and form
values separate from translated labels. Public portfolio text uses its own
writing direction rather than the visitor’s workspace preference.

## Company map and appearance

The Company map loads the full, lightweight directory from `/api/companies/map`.
`company-map.js` renders switchable **Street**, **Satellite**, and **Hybrid**
base layers through the locally bundled Leaflet library. Street uses the Esri
World Street Map; Satellite and Hybrid use Esri World Imagery, with Esri
boundaries-and-places labels added for Hybrid. The tiles come from Esri, not
the public OpenStreetMap tile servers. City markers link to the city
directory; office markers are shown only for verified CSV coordinates.
Directions open separately in Google Maps. The layer choice is saved in
`localStorage` (`techmap_map_layer`). Base map tiles need a browser internet
connection but do not need a Google Maps key.

`js/core/appearance.js` applies the saved appearance before paint. Light mode
is the default; the workspace and sign-in page share the optional dark theme.
Published portfolios and résumé documents retain their own designs.
