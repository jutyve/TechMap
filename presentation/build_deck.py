"""Build the TechMap Maroc backend presentation.

Run with the dedicated deck environment:
    /tmp/deckvenv/bin/python presentation/build_deck.py
"""

from pathlib import Path
import math

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.oxml.ns import qn
from lxml import etree

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "TechMap-Marrakech-Backend.pptx"

# ---------- palette ----------
DARK = RGBColor(0x0D, 0x10, 0x22)
DARK_2 = RGBColor(0x13, 0x17, 0x2D)
CARD_D = RGBColor(0x18, 0x1D, 0x38)
CARD_D2 = RGBColor(0x1E, 0x24, 0x43)
LINE_D = RGBColor(0x2B, 0x31, 0x52)
CREAM = RGBColor(0xF7, 0xF4, 0xEC)
CREAM_2 = RGBColor(0xEF, 0xEA, 0xDF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK = RGBColor(0x16, 0x1A, 0x2B)
INK_SOFT = RGBColor(0x35, 0x3A, 0x50)
MUTED_D = RGBColor(0xA9, 0xAF, 0xC9)
MUTED_L = RGBColor(0x6C, 0x72, 0x86)
VIOLET = RGBColor(0x6C, 0x5C, 0xE7)
VIOLET_DEEP = RGBColor(0x49, 0x39, 0xBF)
VIOLET_PALE = RGBColor(0xD9, 0xD2, 0xFF)
VIOLET_WASH = RGBColor(0xEE, 0xEB, 0xFF)
MINT = RGBColor(0x63, 0xE2, 0xC2)
MINT_DEEP = RGBColor(0x17, 0x7A, 0x63)
MINT_WASH = RGBColor(0xE2, 0xF8, 0xF1)
AMBER = RGBColor(0xF2, 0xC1, 0x4E)
AMBER_DEEP = RGBColor(0x8A, 0x63, 0x0B)
AMBER_WASH = RGBColor(0xFB, 0xF2, 0xD9)
CORAL = RGBColor(0xFF, 0x8A, 0x7A)
CORAL_WASH = RGBColor(0xFF, 0xE9, 0xE4)
LINE_L = RGBColor(0xE2, 0xDC, 0xCF)

SERIF = "Georgia"
BODY = "Arial"
MONO = "Courier New"

SW, SH = 13.333, 7.5
TOTAL = 16

prs = Presentation()
prs.slide_width = Inches(SW)
prs.slide_height = Inches(SH)
BLANK = prs.slide_layouts[6]


# ---------- primitives ----------
def _no_shadow(shape):
    try:
        shape.shadow.inherit = False
    except Exception:
        pass


def rect(slide, x, y, w, h, fill, line=None, line_w=1, radius=None, rotation=0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius is not None else MSO_SHAPE.RECTANGLE
    shp = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius is not None:
        try:
            shp.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(line_w)
    if rotation:
        shp.rotation = rotation
    _no_shadow(shp)
    return shp


def circle(slide, x, y, d, fill, line=None, line_w=1):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(line_w)
    _no_shadow(shp)
    return shp


def line(slide, x1, y1, x2, y2, color, width=1.0, dash=None):
    conn = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2)
    )
    conn.line.color.rgb = color
    conn.line.width = Pt(width)
    if dash:
        conn.line.dash_style = dash
    return conn


def arrow(slide, x1, y1, x2, y2, color, width=1.15, dash=None):
    conn = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2)
    )
    conn.line.color.rgb = color
    conn.line.width = Pt(width)
    if dash:
        conn.line.dash_style = dash
    ln = conn.line._get_or_add_ln()
    tail = etree.SubElement(ln, qn("a:tailEnd"))
    tail.set("type", "triangle")
    tail.set("w", "med")
    tail.set("len", "med")
    return conn


def text(
    slide,
    x,
    y,
    w,
    h,
    content,
    size=11,
    color=INK,
    font=BODY,
    bold=False,
    italic=False,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    line_spacing=1.0,
    space_after=0,
    margins=(0, 0, 0, 0),
    wrap=True,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = Inches(margins[0])
    tf.margin_right = Inches(margins[1])
    tf.margin_top = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    lines = str(content).split("\n")
    for i, value in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        p.space_before = Pt(0)
        p.space_after = Pt(space_after)
        run = p.add_run()
        run.text = value
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.font.bold = bold
        run.font.italic = italic
    return box


def rich(
    slide,
    x,
    y,
    w,
    h,
    runs,
    size=12,
    color=INK,
    font=BODY,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    line_spacing=1.0,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = line_spacing
    for item in runs:
        r = p.add_run()
        r.text = item["text"]
        r.font.name = item.get("font", font)
        r.font.size = Pt(item.get("size", size))
        r.font.color.rgb = item.get("color", color)
        r.font.bold = item.get("bold", False)
        r.font.italic = item.get("italic", False)
    return box


def chip(slide, x, y, w, h, label, fill, color, size=8.2, font=MONO, bold=False, line_color=None):
    shp = rect(slide, x, y, w, h, fill, line=line_color, line_w=0.8, radius=0.5)
    tf = shp.text_frame
    tf.clear()
    tf.word_wrap = False
    tf.margin_left = Inches(0.07)
    tf.margin_right = Inches(0.07)
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.name = font
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.font.bold = bold
    return shp


def add_picture(slide, name, x, y, w, h, descr=""):
    path = ASSETS / name
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    if descr:
        pic._element.nvPicPr.cNvPr.set("descr", descr)
    return pic


def logo(slide, x, y, s, face=VIOLET):
    rect(slide, x, y, s, s, face, radius=0.28)
    sq = rect(slide, x + s * 0.32, y + s * 0.32, s * 0.36, s * 0.36, None, line=WHITE, line_w=1.4)
    sq2 = rect(slide, x + s * 0.32, y + s * 0.32, s * 0.36, s * 0.36, None, line=WHITE, line_w=1.4)
    sq2.rotation = 45
    circle(slide, x + s * 0.47, y + s * 0.47, s * 0.06, VIOLET_PALE)


def background(slide, theme):
    rect(slide, 0, 0, SW, SH, DARK if theme == "dark" else CREAM)
    add_picture(slide, "contours-dark.png" if theme == "dark" else "contours-light.png", 0, 0, SW, SH)


def chrome(slide, theme, eyebrow, title, subtitle=None, page=0):
    background(slide, theme)
    is_dark = theme == "dark"
    line(slide, 0.68, 0.50, 1.03, 0.50, VIOLET if is_dark else VIOLET_DEEP, 2.2)
    text(
        slide, 1.13, 0.38, 9.8, 0.24, eyebrow.upper(),
        8.6, MUTED_D if is_dark else VIOLET_DEEP, MONO, bold=True
    )
    text(
        slide, 0.66, 0.66, 11.9, 0.66, title,
        30.5 if len(title) < 38 else 27.5,
        WHITE if is_dark else INK, SERIF, bold=True, line_spacing=0.94
    )
    if subtitle:
        text(
            slide, 0.68, 1.36, 11.5, 0.42, subtitle,
            11.4, MUTED_D if is_dark else MUTED_L, BODY, line_spacing=1.05
        )
    # footer
    line(slide, 0.68, 7.13, 12.65, 7.13, LINE_D if is_dark else LINE_L, 0.8)
    text(slide, 0.68, 7.18, 6.0, 0.18, "TECHMAP MAROC  /  BACKEND WALKTHROUGH",
         7.0, MUTED_D if is_dark else MUTED_L, MONO)
    text(slide, 11.15, 7.18, 1.5, 0.18, f"{page:02d} / {TOTAL:02d}",
         7.0, MUTED_D if is_dark else MUTED_L, MONO, align=PP_ALIGN.RIGHT)
    return slide


def notes(slide, value):
    slide.notes_slide.notes_text_frame.text = value.strip()


def card(slide, x, y, w, h, theme="dark", accent=None, fill=None, border=True):
    if fill is None:
        fill = CARD_D if theme == "dark" else WHITE
    if border:
        edge = LINE_D if theme == "dark" else LINE_L
    else:
        edge = None
    rect(slide, x, y, w, h, fill, line=edge, line_w=0.9, radius=0.055)
    if accent:
        rect(slide, x + 0.18, y, w - 0.36, 0.035, accent)


def bullet_lines(items, color, size):
    return [
        {"text": "  •  " + item, "size": size, "color": color}
        for item in items
    ]


# =====================================================================
# 01 — COVER
# =====================================================================
s = prs.slides.add_slide(BLANK)
background(s, "dark")
add_picture(s, "glow-violet.png", 8.15, -1.45, 6.7, 6.7)
add_picture(s, "dotgrid.png", 8.7, 1.1, 4.15, 4.15)
logo(s, 0.80, 0.58, 0.58)

text(s, 1.56, 0.67, 4.8, 0.22, "BACKEND WALKTHROUGH  ·  2026", 8.8, MUTED_D, MONO, bold=True)
text(s, 0.80, 1.45, 7.9, 0.9, "TechMap Maroc", 55, WHITE, SERIF, bold=True, line_spacing=0.9)
text(
    s, 0.83, 2.52, 7.25, 1.05,
    "How one Python backend turns a 387-company CSV into a live, account-aware career workspace.",
    16.2, RGBColor(0xD6, 0xD2, 0xEC), BODY, line_spacing=1.15
)

# tech chips
chips = [("FastAPI", 1.18), ("SQLite", 0.92), ("pandas", 0.98), ("OpenAI-compatible AI", 1.93)]
cx = 0.83
for label, width in chips:
    chip(s, cx, 4.38, width, 0.36, label, CARD_D2, VIOLET_PALE, 8.4, MONO, line_color=LINE_D)
    cx += width + 0.16

line(s, 0.83, 5.22, 7.9, 5.22, LINE_D, 0.8)
text(s, 0.83, 5.45, 2.0, 0.2, "SOURCE", 7.3, MUTED_D, MONO, bold=True)
text(s, 0.83, 5.70, 6.8, 0.55, "github.com/jutyve/TechMap\nwww.techmap-maroc.mytunnel.org", 9.4, WHITE, MONO, line_spacing=1.4)
text(s, 0.83, 6.62, 7.4, 0.25, "MIT licensed  ·  34 API endpoints  ·  one self-hostable process", 8.2, MUTED_D, BODY)

# stack illustration
stack = [
    ("01", "Browser", "HTML · CSS · JS · Leaflet", MINT),
    ("02", "FastAPI", "routes · validation · static", VIOLET),
    ("03", "Services", "data · accounts · AI · mail", AMBER),
    ("04", "SQLite + CSV", "state · directory cache", VIOLET_PALE),
]
bx, by = 8.75, 1.62
for i, (num, title, sub, accent) in enumerate(stack):
    y = by + i * 1.02
    x = bx + i * 0.18
    rect(s, x, y, 3.55, 0.84, CARD_D, line=LINE_D, line_w=0.9, radius=0.07)
    rect(s, x, y, 0.055, 0.84, accent)
    text(s, x + 0.19, y + 0.13, 0.35, 0.18, num, 7.4, accent, MONO, bold=True)
    text(s, x + 0.57, y + 0.11, 2.65, 0.24, title, 12.2, WHITE, BODY, bold=True)
    text(s, x + 0.57, y + 0.43, 2.7, 0.22, sub, 7.8, MUTED_D, MONO)
    if i < 3:
        arrow(s, x + 3.55, y + 0.42, x + 3.73, y + 0.82, VIOLET, 1.2)

text(s, 10.35, 6.03, 2.2, 0.5, "ONE PROCESS\nNO BUILD CHAIN", 7.2, MUTED_D, MONO, align=PP_ALIGN.RIGHT, line_spacing=1.4)
notes(s, """
TechMap Maroc is a self-hostable career workspace for Morocco's tech ecosystem. Today I will stay on the backend: what runs, how a request moves, how the directory and accounts are stored, how the optional AI layer works, and how the whole thing is deployed. I will finish with a live demo, so the last slide has QR codes for the repository and the public site.
""")

# =====================================================================
# 02 — ONE BACKEND, FIVE JOBS
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "01 · What the backend does",
    "One backend, five jobs.",
    "The API is the single source of truth for discovery, identity, AI, publishing and operations.",
    2,
)
cards = [
    ("01", "Directory", "Search, filter and sort 387 companies across 35 cities and 6 specialties. Stats and map views share the same API.", "/api/companies", VIOLET),
    ("02", "Accounts", "Optional email-verified accounts. Guests keep the full workspace; signing in adds identity and cross-device storage.", "/api/auth/*", MINT_DEEP),
    ("03", "Workspace sync", "11 localStorage keys — favorites, notes, resume, photo, layout, projects — mirrored with a 600 ms debounce.", "/api/me/state", AMBER_DEEP),
    ("04", "AI tools", "Resume review and generation, cover letters, application drafts and a career assistant through one provider adapter.", "/api/analyze · /api/chat", VIOLET_DEEP),
    ("05", "Publishing", "Server-rendered portfolios with eight templates, strict validation and a script-free public page.", "/portfolio/{slug}", MINT_DEEP),
]
x = 0.68
for num, title, body_text, route, accent in cards:
    card(s, x, 1.93, 2.25, 3.28, "light", accent=accent)
    circle(s, x + 0.19, 2.15, 0.44, accent)
    text(s, x + 0.19, 2.25, 0.44, 0.18, num, 7.8, WHITE, MONO, bold=True, align=PP_ALIGN.CENTER)
    text(s, x + 0.19, 2.73, 1.9, 0.48, title, 13.2, INK, SERIF, bold=True, line_spacing=0.95)
    text(s, x + 0.19, 3.27, 1.9, 1.22, body_text, 8.75, MUTED_L, BODY, line_spacing=1.16)
    text(s, x + 0.19, 4.75, 1.9, 0.3, route, 7.1, accent, MONO, bold=True)
    x += 2.42

# stats band
rect(s, 0.68, 5.55, 11.97, 1.12, CREAM_2, line=LINE_L, line_w=0.8, radius=0.05)
stats = [("387", "companies"), ("35", "cities"), ("34", "API endpoints"), ("9", "runtime dependencies")]
sx = 0.96
for i, (value, label) in enumerate(stats):
    text(s, sx, 5.72, 1.9, 0.42, value, 22, VIOLET_DEEP, SERIF, bold=True)
    text(s, sx, 6.18, 2.2, 0.2, label, 8.2, MUTED_L, MONO)
    if i < 3:
        line(s, sx + 2.45, 5.75, sx + 2.45, 6.4, LINE_L, 0.8)
    sx += 2.85
text(s, 0.68, 6.82, 11.5, 0.18, "Counts from database/data/morocco_tech_companies_clean.csv and the current routers, November 2026.",
     7.2, MUTED_L, BODY, italic=True)
notes(s, """
Everything the product does sits behind one API. Five responsibilities: the directory, optional identity, the local-first workspace mirror, AI career tools, and portfolio publishing. The important product decision is that guests get the complete workspace; accounts, AI and publishing are additions, not gates.
""")

# =====================================================================
# 03 — ARCHITECTURE
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "02 · The system",
    "The whole system on one page.",
    "A static client talks to one FastAPI process; services fan out to a CSV cache, SQLite, and two optional external services.",
    3,
)
cols = [
    ("CLIENT", "Browser", ["HTML · CSS · JS", "localStorage", "Leaflet + Esri tiles", "fetch('/api/…')"], MINT, 0.62, 2.42),
    ("HTTP LAYER", "FastAPI", ["CORS middleware", "8 routers / 34 endpoints", "session + origin guards", "StaticFiles mounted last"], VIOLET, 3.44, 2.55),
    ("LOGIC", "Services", ["data.py · pandas", "accounts · security", "ai_* · letters", "portfolio · mail"], AMBER, 6.39, 2.55),
    ("STATE & INTEGRATIONS", "What it touches", ["CSV + mtime cache", "SQLite (WAL)", "AI gateway", "SMTP / outbox"], VIOLET_PALE, 9.34, 3.32),
]
for label, title, rows_value, accent, x, w in cols:
    text(s, x, 1.86, w, 0.2, label, 7.4, accent, MONO, bold=True)
    card(s, x, 2.12, w, 3.78, "dark", accent=accent)
    circle(s, x + 0.18, 2.34, 0.42, accent)
    text(s, x + 0.18, 2.44, 0.42, 0.18, title[:1], 8.5, DARK if accent in (MINT, AMBER, VIOLET_PALE) else WHITE, MONO, bold=True, align=PP_ALIGN.CENTER)
    text(s, x + 0.71, 2.37, w - 0.85, 0.34, title, 13.0, WHITE, SERIF, bold=True)
    ry = 2.95
    for n, row in enumerate(rows_value, 1):
        rect(s, x + 0.18, ry, w - 0.36, 0.51, CARD_D2, line=LINE_D, line_w=0.6, radius=0.06)
        text(s, x + 0.31, ry + 0.15, w - 0.55, 0.22, row, 8.2, RGBColor(0xD9, 0xDC, 0xEE), MONO)
        ry += 0.62
for x in (3.08, 6.02, 8.97):
    arrow(s, x, 3.96, x + 0.31, 3.96, VIOLET, 1.4)

rect(s, 0.68, 6.12, 11.97, 0.58, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
text(s, 0.92, 6.28, 11.5, 0.22, "ONE DEPLOYABLE   ·   python run.py   ·   one Uvicorn process   ·   no Redis   ·   no message queue   ·   no container required",
     8.0, MUTED_D, MONO, bold=True)
notes(s, """
This is the shape of the backend. The browser uses plain fetch calls and keeps guest data in localStorage. Uvicorn hosts FastAPI, which contains the routers, validation and guards, and also mounts the static site last. The routers call services. The services read the cached CSV, open SQLite per request, or call the optional AI and mail providers. There is no separate frontend server, Redis, worker, or queue.
""")

# =====================================================================
# 04 — STACK
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "02 · What is used",
    "Nine dependencies. No build chain.",
    "Each library has a narrow job. Everything else is the Python standard library or plain browser JavaScript.",
    4,
)
# table header
header_y = 1.92
text(s, 0.72, header_y, 1.5, 0.2, "LAYER", 7.3, MUTED_L, MONO, bold=True)
text(s, 2.22, header_y, 2.8, 0.2, "TECHNOLOGY", 7.3, MUTED_L, MONO, bold=True)
text(s, 5.28, header_y, 3.8, 0.2, "HOW IT IS USED", 7.3, MUTED_L, MONO, bold=True)
line(s, 0.68, 2.18, 8.95, 2.18, LINE_L, 0.8)
rows = [
    ("Serving", "Uvicorn + FastAPI", "ASGI server, routing, dependency injection, OpenAPI docs"),
    ("Validation", "Pydantic", "Typed JSON bodies, enum query params, length and size caps"),
    ("Directory", "pandas + CSV", "Normalise, search, filter, sort and aggregate in memory"),
    ("Accounts", "sqlite3 (stdlib)", "Users, sessions, email tokens, synced state, portfolios"),
    ("Documents", "pypdf + python-docx", "Extract text from PDF and DOCX resumes"),
    ("Media", "Pillow", "Decode and bound JPEG photo data URLs"),
    ("AI", "openai SDK", "Any OpenAI-compatible gateway; one adapter for every feature"),
    ("Delivery", "FastAPI StaticFiles", "65 static files / 1.9 MB served by the same process"),
]
ry = 2.31
for i, (layer, tech, used) in enumerate(rows):
    if i % 2 == 0:
        rect(s, 0.68, ry - 0.06, 8.3, 0.46, CREAM_2 if i % 4 == 0 else WHITE, radius=0.03)
    text(s, 0.74, ry, 1.35, 0.22, layer, 8.7, INK, BODY, bold=True)
    text(s, 2.22, ry, 3.0, 0.22, tech, 8.9, VIOLET_DEEP, MONO, bold=True)
    text(s, 5.28, ry, 3.7, 0.3, used, 8.4, MUTED_L, BODY)
    line(s, 0.68, ry + 0.36, 8.98, ry + 0.36, LINE_L, 0.55)
    ry += 0.47

# right omissions panel
card(s, 9.32, 1.93, 3.33, 4.38, "light", accent=AMBER)
text(s, 9.55, 2.12, 2.9, 0.25, "DELIBERATE OMISSIONS", 7.5, AMBER_DEEP, MONO, bold=True)
text(s, 9.55, 2.46, 2.85, 0.5, "What the backend does not need", 12.5, INK, SERIF, bold=True, line_spacing=0.95)
omissions = ["Node.js or a frontend bundle", "An external database server", "Redis, a queue or a worker", "A CDN for the core interface", "Docker to run the application"]
oy = 3.08
for item in omissions:
    circle(s, 9.56, oy + 0.06, 0.09, VIOLET)
    text(s, 9.76, oy, 2.62, 0.34, item, 8.6, MUTED_L, BODY)
    oy += 0.43
line(s, 9.55, 5.35, 12.4, 5.35, LINE_L, 0.8)
text(s, 9.55, 5.50, 2.9, 0.55, "requirements.txt\n9 runtime packages", 8.2, MUTED_L, MONO, line_spacing=1.35)

text(s, 0.68, 6.5, 8.2, 0.35, "The frontend is still intentional: self-hosted fonts, inline SVG icons and plain ES modules.", 8.4, MUTED_L, BODY, italic=True)
notes(s, """
Only nine runtime packages. FastAPI and Uvicorn serve the app and generate the OpenAPI docs. Pydantic defines the request contracts. pandas handles the 387-row CSV. SQLite comes from the standard library. pypdf and python-docx extract resume text. Pillow validates photos. The openai SDK is just a client for any compatible gateway. StaticFiles ships the frontend from the same process, so there is no Node build step.
""")

# =====================================================================
# 05 — REQUEST FLOW
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "03 · How it is used",
    "A request, end to end.",
    "A public directory call goes through five stages — and never touches the accounts database.",
    5,
)
code = "GET /api/companies?city=Marrakech&specialties=AI%20%26%20Data%20Science&limit=12"
rect(s, 0.68, 1.88, 11.97, 0.52, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
text(s, 0.9, 2.04, 11.5, 0.22, code, 8.5, MINT, MONO)
steps = [
    ("01", "Uvicorn receives", "The ASGI server accepts the HTTP request on 0.0.0.0:$PORT.", MINT),
    ("02", "FastAPI matches", "Route and dependency graph. Public routes skip the sign-in dependency.", VIOLET),
    ("03", "Query is validated", "limit is 1–200; sort and contact are enums. Bad input returns 422.", AMBER),
    ("04", "DataFrame is read", "load_data() returns the mtime-cached pandas frame.", VIOLET_PALE),
    ("05", "JSON is serialized", "Filter, sort and page; public_company() strips private fields.", MINT),
]
x = 0.68
for num, title, body_text, accent in steps:
    card(s, x, 2.62, 2.23, 2.55, "dark", accent=accent)
    text(s, x + 0.18, 2.79, 0.4, 0.2, num, 7.5, accent, MONO, bold=True)
    text(s, x + 0.18, 3.04, 1.86, 0.52, title, 11.4, WHITE, BODY, bold=True, line_spacing=0.98)
    text(s, x + 0.18, 3.63, 1.86, 1.0, body_text, 8.3, MUTED_D, BODY, line_spacing=1.15)
    signal = ["ASGI", "@router.get", "Pydantic", "pandas", "public_company()"][int(num) - 1]
    text(s, x + 0.18, 4.76, 1.86, 0.2, signal, 6.8, accent, MONO, bold=True)
    x += 2.41
for x in (2.91, 5.32, 7.73, 10.14):
    arrow(s, x, 3.89, x + 0.18, 3.89, VIOLET, 1.1)

card(s, 0.68, 5.43, 7.05, 1.35, "dark", accent=MINT)
text(s, 0.92, 5.58, 6.6, 0.2, "RESPONSE SHAPE", 7.1, MINT, MONO, bold=True)
text(s, 0.92, 5.82, 6.55, 0.7,
     '{ "total": 12, "items": [ { "id": 42, "company_name": "…", "city": "Marrakech" } ] }',
     8.9, RGBColor(0xD9, 0xDC, 0xEE), MONO, line_spacing=1.25)

card(s, 8.0, 5.43, 4.65, 1.35, "dark", accent=VIOLET)
text(s, 8.24, 5.58, 4.15, 0.2, "WHY IT MATTERS", 7.1, VIOLET_PALE, MONO, bold=True)
text(s, 8.24, 5.83, 4.08, 0.75,
     "No SQL on this path. The directory is read-only and served from memory; accounts live in a separate store.",
     8.5, RGBColor(0xE1, 0xE3, 0xF0), BODY, line_spacing=1.15)
notes(s, """
Take one real call: the directory filtered to Marrakech and AI & Data Science. Uvicorn passes it to FastAPI; the route validates the query parameters; load_data returns a cached DataFrame; the service filters, sorts and pages it; public_company builds the response and removes fields the public should not see. The key architectural point is that this path never queries SQLite.
""")

# =====================================================================
# 06 — DATA PIPELINE
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "03 · Data",
    "From CSV to API, in memory.",
    "The directory is a file, not a database: load once, normalise, index, then answer every public route from the cached frame.",
    6,
)
stages = [
    ("01", "Raw CSV", "387 rows · 164 KB · UTF-8 BOM. One file remains the directory source.", VIOLET),
    ("02", "Normalise", "Accent/case-insensitive city keys, split specialties, safe URLs, coordinate bounds.", MINT_DEEP),
    ("03", "Index", "Search haystack, lowercase specialty sets, completeness score, stable row IDs.", AMBER_DEEP),
    ("04", "Serve", "Listings, by-IDs, map, cities, specialties and stats from the same frame.", VIOLET_DEEP),
]
x = 0.68
for num, title, body_text, accent in stages:
    card(s, x, 1.92, 2.78, 2.18, "light", accent=accent)
    text(s, x + 0.19, 2.09, 0.4, 0.2, num, 7.5, accent, MONO, bold=True)
    text(s, x + 0.19, 2.36, 2.35, 0.3, title, 12.6, INK, SERIF, bold=True)
    text(s, x + 0.19, 2.78, 2.36, 1.12, body_text, 8.5, MUTED_L, BODY, line_spacing=1.14)
    x += 2.99
for x in (3.45, 6.44, 9.43):
    arrow(s, x, 3.01, x + 0.15, 3.01, VIOLET_DEEP, 1.1)

# chart
card(s, 0.68, 4.35, 7.2, 2.05, "light", accent=VIOLET)
text(s, 0.9, 4.5, 6.6, 0.2, "WHERE THE DIRECTORY IS CONCENTRATED", 7.2, VIOLET_DEEP, MONO, bold=True)
cities = [("Casablanca", 157), ("Rabat", 41), ("Marrakech", 38), ("Tangier", 27), ("Agadir", 21)]
max_value = 157
by = 4.86
for city_name, value in cities:
    text(s, 0.9, by - 0.02, 1.18, 0.18, city_name, 7.4, MUTED_L, BODY, bold=True)
    bar_w = 3.75 * value / max_value
    rect(s, 2.12, by, 4.35, 0.17, CREAM_2, radius=0.5)
    rect(s, 2.12, by, max(0.06, bar_w), 0.17, VIOLET if value == max_value else VIOLET_PALE, radius=0.5)
    text(s, 6.55, by - 0.02, 0.7, 0.18, str(value), 7.4, INK, MONO, bold=True)
    by += 0.29

# coverage
card(s, 8.13, 4.35, 4.52, 2.05, "light", accent=MINT_DEEP)
text(s, 8.36, 4.5, 4.0, 0.2, "PROFILE COVERAGE", 7.2, MINT_DEEP, MONO, bold=True)
coverage = [("361", "with a website"), ("336", "with an email"), ("343", "with a phone")]
cy = 4.86
for value, label in coverage:
    text(s, 8.36, cy - 0.05, 0.82, 0.34, value, 17, MINT_DEEP, SERIF, bold=True)
    text(s, 9.20, cy + 0.03, 2.9, 0.2, label, 8.2, MUTED_L, BODY)
    cy += 0.44
text(s, 8.36, 6.06, 4.0, 0.2, "0 verified coordinates today → city-level map.", 7.5, MUTED_L, BODY, italic=True)

text(s, 0.68, 6.54, 11.9, 0.3, "Cache key = CSV modification time. Edit the file and the next request reloads it; otherwise every request reuses the frame.",
     8.1, MUTED_L, BODY, italic=True)
notes(s, """
The directory has no database table. At startup or first request, pandas reads the CSV. A preparation step canonicalises city spellings, splits specialties, validates URLs and coordinates, and computes a completeness score. The cache key is the file modification time, so editing the CSV invalidates it automatically. A bar chart of the top cities and coverage counts are all computed from that frame.
""")

# =====================================================================
# 07 — ACCOUNTS + SYNC
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "04 · Identity",
    "Accounts are optional. Sync is local-first.",
    "The browser remains the working copy; the account makes that copy portable.",
    7,
)
# guest
card(s, 0.68, 1.94, 3.42, 3.72, "dark", accent=MINT)
text(s, 0.93, 2.12, 2.9, 0.2, "GUEST", 7.5, MINT, MONO, bold=True)
text(s, 0.93, 2.41, 2.85, 0.3, "Full workspace, no sign-in.", 13.2, WHITE, SERIF, bold=True)
guest_items = ["localStorage only", "no server write", "works offline after load", "clearing site data clears work"]
gy = 2.96
for item in guest_items:
    circle(s, 0.96, gy + 0.06, 0.08, MINT)
    text(s, 1.16, gy, 2.62, 0.34, item, 8.8, RGBColor(0xD9, 0xDC, 0xEE), BODY)
    gy += 0.53
text(s, 0.93, 5.06, 2.8, 0.35, "Everything is available\nwithout an account.", 8.2, MUTED_D, BODY, italic=True, line_spacing=1.2)

# sign in sequence
card(s, 4.36, 1.94, 3.65, 3.72, "dark", accent=VIOLET)
text(s, 4.60, 2.12, 3.15, 0.2, "ON SIGN-IN", 7.5, VIOLET_PALE, MONO, bold=True)
text(s, 4.60, 2.41, 3.15, 0.3, "Four steps, one reload.", 13.2, WHITE, SERIF, bold=True)
seq = [
    ("1", "Verify email", "24-hour, single-use link"),
    ("2", "Set session", "HttpOnly cookie, 30 days"),
    ("3", "Pull state", "Apply server copy to localStorage"),
    ("4", "Merge", "Favorites + notes, then upload guest work"),
]
sy = 2.96
for num, title, sub in seq:
    circle(s, 4.60, sy, 0.29, VIOLET)
    text(s, 4.60, sy + 0.055, 0.29, 0.18, num, 7.4, WHITE, MONO, bold=True, align=PP_ALIGN.CENTER)
    text(s, 5.01, sy - 0.03, 2.85, 0.2, title, 8.9, WHITE, BODY, bold=True)
    text(s, 5.01, sy + 0.21, 2.82, 0.2, sub, 7.4, MUTED_D, BODY)
    sy += 0.64

# account mirror
card(s, 8.28, 1.94, 4.37, 3.72, "dark", accent=AMBER)
text(s, 8.52, 2.12, 3.8, 0.2, "SIGNED IN", 7.5, AMBER, MONO, bold=True)
text(s, 8.52, 2.41, 3.75, 0.3, "The server is a mirror.", 13.2, WHITE, SERIF, bold=True)
mirror_items = ["11 whitelisted keys", "600 ms debounced PUT", "2 MB maximum per value", "different account wipes old local copy", "last write wins; 401 keeps local data"]
my = 2.96
for item in mirror_items:
    circle(s, 8.55, my + 0.06, 0.08, AMBER)
    text(s, 8.75, my, 3.55, 0.34, item, 8.4, RGBColor(0xD9, 0xDC, 0xEE), BODY)
    my += 0.49

rect(s, 0.68, 5.91, 11.97, 0.72, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
chips = ["11 SYNC KEYS", "600 MS DEBOUNCE", "2 MB / VALUE", "LOCAL-FIRST"]
cx = 0.95
widths = [1.45, 1.85, 1.45, 1.45]
for label, width in zip(chips, widths):
    chip(s, cx, 6.08, width, 0.36, label, CARD_D2, VIOLET_PALE, 7.8, MONO, line_color=LINE_D)
    cx += width + 0.18
text(s, 8.2, 6.12, 4.25, 0.22, "Server state is applied once, then writes flow up.", 7.6, MUTED_D, BODY, italic=True)
notes(s, """
Accounts are deliberately optional. Guests get the full workspace in localStorage. When someone signs in, the app verifies email, creates an HttpOnly session, downloads the server state, applies it locally and reloads once so every feature re-reads it. Guest favorites and notes are merged. After that, writes are watched, batched for 600 ms and uploaded. The server is a mirror, not the live working copy, so a failed sync never loses local work.
""")

# =====================================================================
# 08 — SECURITY
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "04 · Security",
    "Security is built from primitives.",
    "No third-party identity provider: passwords, sessions and email tokens use standard-library cryptography with narrow, testable rules.",
    8,
)
security = [
    ("01", "Password storage", "PBKDF2-HMAC-SHA256 · 600,000 iterations · 16-byte random salt · constant-time comparison. Unknown emails still pay the hash cost.",
     "pbkdf2_sha256$600000$<salt>$<digest>", VIOLET),
    ("02", "Sessions", "32-byte URL-safe token in an HttpOnly, SameSite=Lax cookie. Only the SHA-256 digest is stored server-side. 30-day TTL; Secure on HTTPS.",
     "Set-Cookie: techmap_session=…; HttpOnly; SameSite=Lax", MINT_DEEP),
    ("03", "Email tokens", "Verification links last 24 hours; password resets last 1 hour. Single-use and hashed at rest. Resending invalidates earlier unused tokens.",
     "verify 24 h  ·  reset 1 h  ·  used_at ≠ NULL", AMBER_DEEP),
    ("04", "Request hardening", "Same-origin guard on cookie-authenticated writes. Per-IP/email rate limits. Verified email required. Generic login errors.",
     "Origin == Host  ·  429 on abuse  ·  401 / 403", VIOLET_DEEP),
]
positions = [(0.68, 1.94), (6.88, 1.94), (0.68, 4.02), (6.88, 4.02)]
for (num, title, body_text, code_text, accent), (x, y) in zip(security, positions):
    card(s, x, y, 5.78, 1.86, "light", accent=accent)
    text(s, x + 0.22, y + 0.17, 0.4, 0.2, num, 7.5, accent, MONO, bold=True)
    text(s, x + 0.70, y + 0.14, 4.85, 0.26, title, 13.2, INK, SERIF, bold=True)
    text(s, x + 0.22, y + 0.54, 5.25, 0.66, body_text, 9.0, MUTED_L, BODY, line_spacing=1.17)
    rect(s, x + 0.22, y + 1.34, 5.34, 0.36, CREAM_2, radius=0.05)
    text(s, x + 0.34, y + 1.43, 5.05, 0.2, code_text, 6.7, INK_SOFT, MONO)

rect(s, 0.68, 6.16, 11.97, 0.6, CREAM_2, line=LINE_L, line_w=0.8, radius=0.05)
text(s, 0.92, 6.31, 11.45, 0.22,
     "Deleting an account cascades to sessions, email tokens, synced state, photo and portfolio.  ·  No OAuth, no third-party identity provider.",
     8.1, INK_SOFT, BODY)
notes(s, """
Security is intentionally built from primitives. Passwords use PBKDF2 with 600,000 iterations and a random salt. Login runs a dummy hash for unknown emails so timing does not reveal whether an account exists. Session tokens and email tokens are random, and only their SHA-256 digests are stored. Cookies are HttpOnly and SameSite=Lax. Every cookie-authenticated write passes an origin check, and the auth endpoints have small in-memory rate limits. Deleting a user cascades through all related tables.
""")

# =====================================================================
# 09 — SCHEMA
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "04 · Storage",
    "Six tables. One SQLite file.",
    "Accounts, sessions, tokens, synced workspace state and portfolios all live in data/techmap.db.",
    9,
)
# users root
card(s, 0.68, 1.94, 3.05, 3.55, "dark", accent=VIOLET)
text(s, 0.92, 2.12, 2.55, 0.22, "ROOT TABLE", 7.2, VIOLET_PALE, MONO, bold=True)
text(s, 0.92, 2.38, 2.55, 0.28, "users", 15.5, WHITE, MONO, bold=True)
line(s, 0.92, 2.78, 3.48, 2.78, LINE_D, 0.8)
user_cols = ["id  INTEGER PK", "email  TEXT UNIQUE", "name  TEXT", "password_hash  TEXT", "is_verified  INTEGER", "created_at  INTEGER", "verified_at  INTEGER"]
uy = 2.92
for col in user_cols:
    text(s, 0.92, uy, 2.6, 0.2, col, 8.1, RGBColor(0xD9, 0xDC, 0xEE), MONO)
    uy += 0.31
text(s, 0.92, 5.05, 2.5, 0.2, "Everything below cites user_id.", 7.6, MUTED_D, BODY, italic=True)

# tables grid
tables_left = [
    ("sessions", ["id  INTEGER PK", "user_id  → users.id", "token_hash  TEXT UNIQUE", "created_at  /  expires_at"], VIOLET),
    ("email_tokens", ["id  INTEGER PK", "user_id  → users.id", "purpose  verify | reset", "token_hash  ·  used_at"], MINT),
    ("user_state", ["user_id + key  PK", "value  TEXT (JSON)", "updated_at  INTEGER"], AMBER),
]
tables_right = [
    ("account_photos", ["user_id  PK → users.id", "photo  TEXT (JPEG data URL)"], VIOLET_PALE),
    ("portfolios", ["user_id  PK → users.id", "slug  TEXT UNIQUE", "content  TEXT (JSON)", "published  INTEGER 0|1"], MINT),
]
def table_card(x, y, w, h, name, rows_value, accent):
    card(s, x, y, w, h, "dark", accent=accent)
    text(s, x + 0.18, y + 0.13, w - 0.3, 0.22, name, 10.8, WHITE, MONO, bold=True)
    line(s, x + 0.18, y + 0.40, x + w - 0.18, y + 0.40, LINE_D, 0.6)
    yy = y + 0.47
    for row in rows_value:
        text(s, x + 0.18, yy, w - 0.3, 0.18, row, 7.4, RGBColor(0xD9, 0xDC, 0xEE), MONO)
        yy += 0.21

ty = 1.94
for name, rows_value, accent in tables_left:
    table_card(4.10, ty, 4.05, 1.17, name, rows_value, accent)
    ty += 1.30
ty = 1.94
for name, rows_value, accent in tables_right:
    table_card(8.52, ty, 4.13, 1.17, name, rows_value, accent)
    ty += 1.30

# note card
card(s, 8.52, 4.55, 4.13, 0.95, "dark", accent=MINT)
text(s, 8.72, 4.68, 3.7, 0.2, "ONE FILE", 7.2, MINT, MONO, bold=True)
text(s, 8.72, 4.90, 3.7, 0.45, "Backup = copy data/techmap.db\n(+ WAL files while running)", 7.8, RGBColor(0xD9, 0xDC, 0xEE), MONO, line_spacing=1.3)

rect(s, 0.68, 5.77, 11.97, 0.62, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
text(s, 0.92, 5.93, 11.45, 0.22,
     "WAL mode  ·  foreign_keys=ON  ·  one connection per request  ·  ON DELETE CASCADE  ·  indices on sessions and email tokens",
     8.0, MUTED_D, MONO, bold=True)
notes(s, """
There are six tables. users is the root. sessions and email_tokens hang off it, user_state stores the whitelisted JSON values keyed by user and key, account_photos stores one JPEG data URL per user, and portfolios stores the public page content. SQLite runs in WAL mode so reads and writes from FastAPI's threadpool do not block each other. Every connection enables foreign keys, and deleting a user cascades through all child tables.
""")

# =====================================================================
# 10 — AI LAYER
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "05 · AI",
    "One AI adapter, four products.",
    "The backend never talks to a specific vendor: it calls any OpenAI-compatible gateway and validates every response.",
    10,
)
flow = ["Route", "run_in_threadpool", "ai_client", "Gateway", "Strict JSON", "Clean + cap"]
x = 0.68
widths = [1.35, 2.22, 1.55, 1.55, 1.55, 1.55]
for i, label in enumerate(flow):
    chip(s, x, 1.88, widths[i], 0.46, label, VIOLET_WASH if i < 3 else MINT_WASH, VIOLET_DEEP if i < 3 else MINT_DEEP, 7.5, MONO, bold=True, line_color=LINE_L)
    if i < len(flow) - 1:
        arrow(s, x + widths[i] + 0.03, 2.11, x + widths[i] + 0.20, 2.11, VIOLET_DEEP, 1.0)
    x += widths[i] + 0.23

features = [
    ("Resume review", "/api/analyze", ["0–100 rubric + strengths", "canonical specialties", "lists capped + sanitized"], VIOLET),
    ("Resume builder", "/api/resume/generate", ["strict JSON resume", "no invented facts", "max 8 roles / 6 projects"], MINT_DEEP),
    ("Letters & Apply", "/api/companies/{id}/cover-letter\n/prepare-application", ["draft letter + email", "optional HTML resume", "server never sends"], AMBER_DEEP),
    ("Career assistant", "/api/chat", ["canonical city + specialty", "fuzzy fallback matching", "top 5 real companies"], VIOLET_DEEP),
]
x = 0.68
outputs = ["score + gaps", "resume JSON", "to / subject / body", "reply + companies"]
for idx, (title, route, bullets, accent) in enumerate(features):
    card(s, x, 2.68, 2.96, 2.65, "light", accent=accent)
    text(s, x + 0.19, 2.84, 2.55, 0.28, title, 12.2, INK, SERIF, bold=True)
    text(s, x + 0.19, 3.20, 2.58, 0.44, route, 6.8, accent, MONO, bold=True, line_spacing=1.2)
    by = 3.80
    for item in bullets:
        circle(s, x + 0.20, by + 0.055, 0.075, accent)
        text(s, x + 0.36, by, 2.35, 0.22, item, 7.9, MUTED_L, BODY)
        by += 0.37
    text(s, x + 0.19, 4.90, 2.55, 0.2, "→ " + outputs[idx], 6.8, accent, MONO, bold=True)
    x += 3.13

card(s, 0.68, 5.62, 7.6, 1.15, "light", accent=MINT_DEEP)
text(s, 0.92, 5.76, 7.1, 0.2, "PROVIDER CONFIGURATION", 7.1, MINT_DEEP, MONO, bold=True)
text(s, 0.92, 5.99, 7.1, 0.55,
     "OMNIROUTE_BASE_URL  ·  OMNIROUTE_API_KEY  ·  OMNIROUTE_MODEL  ·  120 s timeout",
     8.0, INK_SOFT, MONO, line_spacing=1.25)
text(s, 0.92, 6.38, 7.1, 0.2, "Any compatible gateway works; keys stay on the backend.", 7.8, MUTED_L, BODY, italic=True)
card(s, 8.48, 5.62, 4.17, 1.15, "light", accent=AMBER)
text(s, 8.72, 5.76, 3.8, 0.2, "OPTIONAL BY DESIGN", 7.1, AMBER_DEEP, MONO, bold=True)
text(s, 8.72, 5.99, 3.72, 0.62, "No gateway → AI routes return a clear 502/503. Directory and local previews keep working.",
     8.1, MUTED_L, BODY, line_spacing=1.15)
notes(s, """
AI is an optional layer, not a dependency of the directory. Every feature goes through one adapter: the route calls a blocking SDK inside a threadpool, the adapter talks to an OpenAI-compatible gateway, and the response must parse as one JSON object. The result is then sanitized and capped against a schema. Resume review, resume generation, letters and application drafts, and the career assistant all share that path. If the gateway is unavailable, the API returns a clear 502 or 503 while the rest of the product stays up.
""")

# =====================================================================
# 11 — DOCUMENT + PHOTO PIPELINE
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "05 · Inputs",
    "Every upload is bounded.",
    "Documents and photos are validated before they reach AI or storage; limits are enforced server-side, not just in the browser.",
    11,
)
# left pipeline
card(s, 0.68, 1.92, 5.85, 3.6, "dark", accent=VIOLET)
text(s, 0.92, 2.08, 5.2, 0.22, "RESUME → TEXT → AI", 7.2, VIOLET_PALE, MONO, bold=True)
text(s, 0.92, 2.34, 5.2, 0.28, "Five checks before a model sees it", 12.2, WHITE, SERIF, bold=True)
doc_steps = [
    ("1", "File type", ".pdf  .docx  .txt  .md  .odt  ·  max 10 MB  ·  .doc rejected"),
    ("2", "Extract", "pypdf for PDF, python-docx for DOCX, zip + XML for ODT"),
    ("3", "Normalize", "strip control characters, collapse whitespace, unify newlines"),
    ("4", "Floor", "fewer than 80 readable characters → 422"),
    ("5", "Cap", "12,000 characters maximum sent to the AI provider"),
]
sy = 2.84
for num, title, sub in doc_steps:
    circle(s, 0.93, sy, 0.28, VIOLET)
    text(s, 0.93, sy + 0.052, 0.28, 0.18, num, 7.2, WHITE, MONO, bold=True, align=PP_ALIGN.CENTER)
    text(s, 1.31, sy - 0.02, 1.1, 0.2, title, 8.8, WHITE, BODY, bold=True)
    text(s, 2.32, sy - 0.02, 3.95, 0.3, sub, 7.6, MUTED_D, BODY)
    if num != "5":
        line(s, 1.07, sy + 0.28, 1.07, sy + 0.50, LINE_D, 0.9)
    sy += 0.52

# right pipeline
card(s, 6.78, 1.92, 5.87, 3.6, "dark", accent=MINT)
text(s, 7.02, 2.08, 5.2, 0.22, "PHOTO → JPEG → STORAGE", 7.2, MINT, MONO, bold=True)
text(s, 7.02, 2.34, 5.2, 0.28, "Pillow checks what the browser sends", 12.2, WHITE, SERIF, bold=True)
photo_steps = [
    ("1", "Crop", "center-cropped 512 px square JPEG in the browser"),
    ("2", "Decode", "must be a data:image/jpeg;base64, URL"),
    ("3", "Validate", "Pillow opens it · max 1,280 px · ≈180 KB data URL"),
    ("4", "Store", "account photo in SQLite; guest photo in localStorage"),
]
sy = 2.84
for num, title, sub in photo_steps:
    circle(s, 7.03, sy, 0.28, MINT)
    text(s, 7.03, sy + 0.052, 0.28, 0.18, num, 7.2, DARK, MONO, bold=True, align=PP_ALIGN.CENTER)
    text(s, 7.41, sy - 0.02, 1.1, 0.2, title, 8.8, WHITE, BODY, bold=True)
    text(s, 8.42, sy - 0.02, 3.95, 0.3, sub, 7.6, MUTED_D, BODY)
    if num != "4":
        line(s, 7.17, sy + 0.28, 7.17, sy + 0.46, LINE_D, 0.9)
    sy += 0.55
text(s, 7.02, 5.04, 5.2, 0.3, "Photos never enter an AI prompt — not even the processed image.",
     8.0, MINT, BODY, italic=True)
text(s, 0.92, 5.23, 5.25, 0.22, "No OCR: image-only resumes must be exported with selectable text first.",
     7.5, MUTED_D, BODY, italic=True)

# bottom error strip
rect(s, 0.68, 5.78, 11.97, 0.72, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
error_texts = [("415", "wrong file type"), ("413", "over 10 MB"), ("422", "unreadable / invalid")]
ex = 0.95
for code, label in error_texts:
    text(s, ex, 5.93, 0.6, 0.24, code, 13.5, CORAL, MONO, bold=True)
    text(s, ex + 0.62, 5.97, 1.8, 0.2, label, 7.8, MUTED_D, BODY)
    ex += 2.45
text(s, 8.05, 5.97, 4.35, 0.22, "Fail closed, with a precise message — never a stack trace.", 7.8, MUTED_D, BODY, italic=True)
notes(s, """
Uploads are a classic attack surface, so the server enforces every limit. Resume files must be one of five extensions and under 10 MB. Text extraction is format-specific, then whitespace and control characters are normalised. Fewer than 80 readable characters is rejected; at most 12,000 characters reach the model. Photos must be JPEG data URLs, are decoded by Pillow, and are capped at 1,280 pixels. The photo is never included in any AI request.
""")

# =====================================================================
# 12 — PORTFOLIO
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "05 · Publishing",
    "Portfolios are data, not scripts.",
    "A typed content model is rendered server-side into escaped HTML with a strict content-security policy.",
    12,
)
# mock browser
rect(s, 0.68, 1.92, 5.08, 4.18, DARK, line=LINE_D, line_w=1, radius=0.045)
rect(s, 0.68, 1.92, 5.08, 0.38, CARD_D2, radius=0.045)
for i, c in enumerate([CORAL, AMBER, MINT]):
    circle(s, 0.86 + i * 0.18, 2.04, 0.09, c)
rect(s, 1.55, 2.00, 3.95, 0.22, CARD_D, radius=0.3)
text(s, 1.68, 2.035, 3.7, 0.16, "techmap-maroc.mytunnel.org/portfolio/aya", 5.7, MUTED_D, MONO)
# mini page
rect(s, 0.88, 2.48, 4.68, 3.38, RGBColor(0x11, 0x0D, 0x2B), radius=0.03)
rect(s, 0.88, 2.48, 4.68, 0.05, VIOLET)
circle(s, 1.10, 2.72, 0.56, VIOLET)
text(s, 1.10, 2.86, 0.56, 0.22, "AY", 10.5, WHITE, MONO, bold=True, align=PP_ALIGN.CENTER)
text(s, 1.82, 2.72, 3.3, 0.25, "Aya Benali", 13.2, WHITE, SERIF, bold=True)
text(s, 1.82, 3.02, 3.3, 0.2, "Data analyst  ·  Casablanca", 6.8, MUTED_D, BODY)
rect(s, 1.10, 3.50, 4.2, 0.01, LINE_D)
text(s, 1.10, 3.66, 2.0, 0.18, "SELECTED PROJECTS", 5.8, VIOLET_PALE, MONO, bold=True)
for i in range(2):
    y = 3.92 + i * 0.70
    rect(s, 1.10, y, 1.35, 0.50, CARD_D2, radius=0.03)
    text(s, 1.18, y + 0.12, 1.2, 0.22, f"PROJECT / 0{i+1}", 5.6, MUTED_D, MONO)
    rect(s, 2.60, y + 0.02, 2.30, 0.09, RGBColor(0xCF, 0xC7, 0xFF), radius=0.5)
    rect(s, 2.60, y + 0.20, 1.75, 0.06, RGBColor(0x4A, 0x4F, 0x70), radius=0.5)
    rect(s, 2.60, y + 0.35, 1.10, 0.06, RGBColor(0x4A, 0x4F, 0x70), radius=0.5)
text(s, 0.90, 5.67, 4.6, 0.16, "Script-free HTML  ·  one CSS file  ·  escaped content", 6.5, MUTED_D, MONO, align=PP_ALIGN.CENTER)

# right flow
text(s, 6.15, 1.91, 1.1, 0.2, "01", 7.5, VIOLET_DEEP, MONO, bold=True)
text(s, 6.55, 1.87, 5.9, 0.25, "Validate", 11.2, INK, BODY, bold=True)
text(s, 6.55, 2.14, 5.95, 0.5, "Pydantic: 8 templates, 12 entries per section, safe HTTP(S) links, 140/2,400-char caps.", 8.2, MUTED_L, BODY, line_spacing=1.12)
text(s, 6.15, 2.72, 1.1, 0.2, "02", 7.5, VIOLET_DEEP, MONO, bold=True)
text(s, 6.55, 2.68, 5.9, 0.25, "Store", 11.2, INK, BODY, bold=True)
text(s, 6.55, 2.95, 5.95, 0.35, "One portfolios row: slug, JSON content, published flag.", 8.2, MUTED_L, BODY)
text(s, 6.15, 3.43, 1.1, 0.2, "03", 7.5, VIOLET_DEEP, MONO, bold=True)
text(s, 6.55, 3.39, 5.9, 0.25, "Render", 11.2, INK, BODY, bold=True)
text(s, 6.55, 3.66, 5.95, 0.35, "GET /portfolio/{slug} returns escaped HTML + one CSS file.", 8.2, MUTED_L, BODY)

# security panel
card(s, 6.15, 4.18, 6.5, 1.98, "light", accent=MINT_DEEP)
text(s, 6.38, 4.32, 5.9, 0.2, "PUBLIC-PAGE HARDENING", 7.2, MINT_DEEP, MONO, bold=True)
sec_items = [
    "No <script>: all content is escaped; page is script-free",
    "CSP: default-src 'none'; style/font-src 'self'; img-src data:; base/form locked",
    "Cache-Control: no-store · Referrer-Policy: no-referrer",
    "Unpublished or unknown slug → 404",
]
sy = 4.58
for item in sec_items:
    circle(s, 6.39, sy + 0.055, 0.075, MINT_DEEP)
    text(s, 6.55, sy, 5.95, 0.22, item, 7.8, INK_SOFT, BODY)
    sy += 0.32
text(s, 6.15, 6.40, 6.5, 0.2, "Preview reuses the same renderer; account photo only when photo_mode = account.", 7.4, MUTED_L, BODY, italic=True)
notes(s, """
Portfolio Studio sends a typed model, not HTML. Pydantic limits templates, entry counts, text lengths and link schemes. The content is stored as JSON in SQLite. The public route re-renders it server-side with every field escaped, serves one CSS file and sends a strict CSP that allows no scripts at all. Preview uses the same renderer, so what the owner sees is what the public gets. Unpublished slugs return a 404.
""")

# =====================================================================
# 13 — INFRASTRUCTURE
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "06 · Infrastructure",
    "One process behind HTTPS.",
    "The deployment is intentionally small: a single Python service, local disk and two optional outbound integrations.",
    13,
)
boxes = [
    ("Browser", "HTTPS requests · relative /api URLs", MINT),
    ("HTTPS edge / tunnel", "www.techmap-maroc.mytunnel.org", VIOLET),
    ("Uvicorn", "0.0.0.0 : $PORT  ·  run.py", AMBER),
    ("FastAPI", "routers · services · StaticFiles", VIOLET_PALE),
    ("Local disk", "data/techmap.db  ·  data/outbox/", MINT),
]
by = 1.90
for i, (title, sub, accent) in enumerate(boxes):
    rect(s, 0.88, by, 5.55, 0.62, CARD_D, line=LINE_D, line_w=0.9, radius=0.06)
    rect(s, 0.88, by, 0.06, 0.62, accent)
    text(s, 1.10, by + 0.11, 1.75, 0.22, title, 9.4, WHITE, BODY, bold=True)
    text(s, 2.88, by + 0.13, 3.35, 0.22, sub, 7.3, MUTED_D, MONO)
    if i < len(boxes) - 1:
        arrow(s, 3.65, by + 0.63, 3.65, by + 0.86, VIOLET, 1.1)
    by += 0.86
# external box
rect(s, 7.05, 1.90, 5.6, 0.78, CARD_D, line=LINE_D, line_w=0.9, radius=0.06)
text(s, 7.28, 2.02, 2.0, 0.22, "EXTERNAL (OPTIONAL)", 7.0, AMBER, MONO, bold=True)
text(s, 7.28, 2.28, 5.1, 0.22, "AI gateway  ·  SMTP provider", 9.2, WHITE, BODY, bold=True)
arrow(s, 6.43, 3.05, 7.05, 2.57, AMBER, 1.0, dash=True)
text(s, 6.45, 2.62, 0.55, 0.18, "out", 6.2, AMBER, MONO)

# facts panel
card(s, 7.05, 3.08, 5.6, 3.02, "dark", accent=MINT)
text(s, 7.28, 3.22, 5.1, 0.2, "DEPLOYMENT FACTS", 7.2, MINT, MONO, bold=True)
facts = [
    ("1 process", "Uvicorn + FastAPI"),
    ("1 SQLite file", "WAL mode; local disk"),
    ("65 static files", "1.9 MB served by the app"),
    ("9 packages", "requirements.txt"),
    ("Env config", "PORT · APP_BASE_URL · AI_* · SMTP_*"),
    ("Backup", "copy data/techmap.db + outbox"),
]
fy = 3.54
for value, label in facts:
    text(s, 7.28, fy, 1.55, 0.2, value, 8.5, WHITE, BODY, bold=True)
    text(s, 8.86, fy, 3.55, 0.2, label, 7.7, MUTED_D, BODY)
    line(s, 7.28, fy + 0.28, 12.38, fy + 0.28, LINE_D, 0.45)
    fy += 0.37

rect(s, 0.68, 6.20, 11.97, 0.58, CARD_D, line=LINE_D, line_w=0.8, radius=0.05)
text(s, 0.92, 6.36, 11.45, 0.22,
     "No Docker required  ·  one host  ·  backups are a directory copy  ·  scale-out would need shared state and a process manager",
     8.0, MUTED_D, MONO, bold=True)
notes(s, """
The public site is a single Python process behind an HTTPS edge or tunnel. run.py reads SERVER_PORT or PORT, binds 0.0.0.0, and starts Uvicorn. FastAPI serves both the API and the static frontend. The only persistent local state is the data directory: the SQLite database and the development mail outbox. AI and SMTP are optional outbound integrations. That makes deployment and backup simple, but it also defines the scaling limits I will cover next.
""")

# =====================================================================
# 14 — FAILURE + LIMITS
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "light", "06 · Operations",
    "Fail small. Know the limits.",
    "Expected failures become specific HTTP responses; local work is never sacrificed for a server error.",
    14,
)
# table
text(s, 0.72, 1.92, 2.5, 0.2, "FAILURE", 7.3, MUTED_L, MONO, bold=True)
text(s, 3.25, 1.92, 4.9, 0.2, "BEHAVIOUR", 7.3, MUTED_L, MONO, bold=True)
line(s, 0.68, 2.18, 7.85, 2.18, LINE_L, 0.8)
failures = [
    ("AI gateway down", "Clear 502/503. Directory and local previews stay online."),
    ("No SMTP configured", "Email is written to data/outbox/ and a dev link is exposed."),
    ("Bad upload", "413 / 415 / 422 before any AI call or storage write."),
    ("CSV missing", "Warning in the log; the API returns an empty dataset."),
    ("Session expired", "401. The browser copy of the workspace remains."),
    ("Sync write fails", "Local copy kept; retried on the next change."),
]
fy = 2.34
for i, (failure, behavior) in enumerate(failures):
    if i % 2 == 0:
        rect(s, 0.68, fy - 0.06, 7.2, 0.56, CREAM_2 if i % 4 == 0 else WHITE, radius=0.03)
    text(s, 0.76, fy, 2.35, 0.25, failure, 8.9, INK, BODY, bold=True)
    text(s, 3.25, fy, 4.45, 0.38, behavior, 8.1, MUTED_L, BODY, line_spacing=1.08)
    line(s, 0.68, fy + 0.48, 7.88, fy + 0.48, LINE_L, 0.5)
    fy += 0.56

# limits panel
card(s, 8.18, 1.93, 4.47, 4.12, "light", accent=CORAL)
text(s, 8.42, 2.09, 4.0, 0.2, "HONEST LIMITS", 7.2, RGBColor(0xB4, 0x3A, 0x2E), MONO, bold=True)
limits = [
    "Rate limits are in-memory and per process.",
    "SQLite fits one host, not multi-writer scale.",
    "One Uvicorn process; no queue or workers.",
    "AI endpoints are open to guests — add quotas.",
    "CORS is permissive; pin origins for production.",
    "Backups are manual.",
]
ly = 2.42
for item in limits:
    circle(s, 8.43, ly + 0.06, 0.075, CORAL)
    text(s, 8.60, ly, 3.82, 0.3, item, 8.2, INK_SOFT, BODY, line_spacing=1.08)
    ly += 0.47
text(s, 8.42, 5.36, 4.0, 0.2, "IF THIS GREW", 7.0, MUTED_L, MONO, bold=True)
grow = [("Postgres", 1.05), ("Redis", 0.72), ("Queue", 0.78), ("Metrics", 0.92)]
gx = 8.42
for label, width in grow:
    chip(s, gx, 5.58, width, 0.30, label, CREAM_2, INK_SOFT, 6.7, MONO, line_color=LINE_L)
    gx += width + 0.10

text(s, 0.68, 6.15, 7.3, 0.5, "The pattern: degrade the feature, not the workspace. Every server-side failure leaves the browser copy intact.",
     8.9, VIOLET_DEEP, BODY, bold=True, line_spacing=1.15)
notes(s, """
This slide is deliberately honest. Expected failures are handled explicitly: no AI gateway means a clear 502 or 503; no SMTP means the message is written to the outbox and the dev link is shown; bad uploads are rejected before AI; a missing CSV produces a warning and an empty dataset; an expired session returns 401 but the local workspace remains. The limits are real too: in-memory rate limiting, single-host SQLite, one process, open guest AI endpoints, permissive CORS, and manual backups.
""")

# =====================================================================
# 15 — API SURFACE
# =====================================================================
s = chrome(
    prs.slides.add_slide(BLANK), "dark", "06 · Contract",
    "34 endpoints, one contract.",
    "Five route families cover discovery, identity, sync, AI and publishing. FastAPI generates the schema automatically.",
    15,
)
rows = [
    ("DIRECTORY · 7", "GET /api/companies · /companies/map · /companies/by-ids · /cities · /specialties · /stats · /maps/config", MINT),
    ("IDENTITY · 11", "register · verify · resend · login · logout · me (GET/PATCH) · change-password · forgot-password · reset-password · delete-account", VIOLET),
    ("WORKSPACE · 4", "GET/PUT /api/me/state  ·  PUT/DELETE /api/me/state/{key}", AMBER),
    ("AI · 5", "POST /api/analyze · /api/resume/generate · /api/chat · /api/companies/{id}/cover-letter · /prepare-application", VIOLET_PALE),
    ("PUBLISHING + PHOTO · 6", "GET/PUT /api/portfolio · unpublish · preview · GET /portfolio/{slug} · GET/PUT /api/account/photo", MINT),
]
ry = 1.93
for label, methods, accent in rows:
    card(s, 0.68, ry, 8.12, 0.74, "dark", accent=accent)
    text(s, 0.92, ry, 1.72, 0.74, label, 7.1, accent, MONO, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 2.64, ry, 5.92, 0.74, methods, 7.6, RGBColor(0xD9, 0xDC, 0xEE), MONO, line_spacing=1.18, anchor=MSO_ANCHOR.MIDDLE)
    ry += 0.86

# numbers panel
card(s, 9.04, 1.93, 3.61, 4.30, "dark", accent=VIOLET)
text(s, 9.27, 2.09, 3.1, 0.2, "BY THE NUMBERS", 7.0, VIOLET_PALE, MONO, bold=True)
numbers = [("34", "endpoints"), ("8", "routers"), ("6", "SQLite tables"), ("11", "sync keys"), ("9", "packages"), ("1", "process")]
ny = 2.43
for value, label in numbers:
    text(s, 9.27, ny - 0.02, 0.72, 0.32, value, 17, WHITE, SERIF, bold=True)
    text(s, 10.05, ny + 0.05, 2.3, 0.2, label, 7.7, MUTED_D, BODY)
    line(s, 9.27, ny + 0.35, 12.35, ny + 0.35, LINE_D, 0.45)
    ny += 0.52
text(s, 9.27, 5.64, 3.1, 0.5, "OpenAPI docs at /docs\nfor every route.", 7.2, MUTED_D, MONO, line_spacing=1.3)

rect(s, 0.68, 6.43, 11.97, 0.42, CARD_D2, line=LINE_D, line_w=0.7, radius=0.05)
text(s, 0.90, 6.54, 11.4, 0.2, "Response models are Pydantic; request bodies never reach a service unvalidated.  ·  FastAPI generates /docs.",
     7.6, MUTED_D, BODY, italic=True)
notes(s, """
This is the API surface in five families. The exact count is 34 endpoints across eight routers. Directory routes are public and read-only. Identity routes handle registration, verification, login, profile changes, password reset and deletion. Workspace routes read and write the whitelisted sync state. AI routes wrap the four products. Publishing and photo routes complete the account surface. FastAPI exposes all of this as interactive OpenAPI documentation at /docs, which is a good thing to keep open during the demo.
""")

# =====================================================================
# 16 — LIVE DEMO
# =====================================================================
s = prs.slides.add_slide(BLANK)
background(s, "dark")
add_picture(s, "glow-violet.png", 8.3, 1.6, 5.8, 5.8)
logo(s, 0.80, 0.55, 0.48)
text(s, 1.40, 0.63, 5.0, 0.2, "THE LAST SLIDE IS YOURS", 8.2, MUTED_D, MONO, bold=True)
line(s, 0.82, 1.22, 1.17, 1.22, VIOLET, 2.2)
text(s, 0.80, 1.38, 6.0, 0.9, "Live demo", 47, WHITE, SERIF, bold=True, line_spacing=0.9)
text(s, 0.83, 2.38, 5.55, 0.7, "The backend is easiest to believe when you watch the network tab.", 12.4, RGBColor(0xD6, 0xD2, 0xEC), BODY, line_spacing=1.15)

demo_steps = [
    ("01", "Directory", "Filter Casablanca + AI & Data Science; open a company."),
    ("02", "Map", "Switch Street → Satellite → Hybrid; click a city."),
    ("03", "Workspace", "Save a company and a project; show the sync status."),
    ("04", "Studio", "Run a local resume preview — no AI required."),
    ("05", "Publish", "Open a public portfolio page."),
]
dy = 3.28
for num, title, sub in demo_steps:
    text(s, 0.85, dy, 0.42, 0.2, num, 7.3, VIOLET_PALE, MONO, bold=True)
    text(s, 1.28, dy - 0.03, 1.15, 0.22, title, 8.9, WHITE, BODY, bold=True)
    text(s, 2.48, dy - 0.03, 3.95, 0.34, sub, 8.0, MUTED_D, BODY)
    dy += 0.56
rect(s, 0.83, 6.23, 5.55, 0.54, CARD_D, line=LINE_D, line_w=0.7, radius=0.05)
text(s, 1.02, 6.36, 5.2, 0.22, "Tip: keep /docs open in a second tab to show the same calls.", 7.7, MUTED_D, BODY, italic=True)

# QR cards
qr_cards = [
    (6.62, "GITHUB REPO", "github.com/jutyve/TechMap", "qr-github.png", "Open source · MIT", "QR code for the TechMap GitHub repository"),
    (9.65, "LIVE WEBSITE", "www.techmap-maroc.mytunnel.org", "qr-website.png", "Live directory · Morocco", "QR code for the TechMap live website"),
]
for x, label, url, image, tagline, descr in qr_cards:
    rect(s, x, 1.55, 2.72, 4.55, WHITE, line=VIOLET_PALE, line_w=1.2, radius=0.055)
    text(s, x + 0.20, 1.76, 2.32, 0.2, label, 7.2, VIOLET_DEEP, MONO, bold=True, align=PP_ALIGN.CENTER)
    pic = add_picture(s, image, x + 0.16, 2.04, 2.40, 2.40, descr)
    pic.click_action.hyperlink.address = "https://" + url
    line(s, x + 0.38, 4.63, x + 2.34, 4.63, LINE_L, 0.8)
    text(s, x + 0.16, 4.81, 2.40, 0.5, url, 7.2, INK_SOFT, MONO, align=PP_ALIGN.CENTER, line_spacing=1.3)
    text(s, x + 0.16, 5.40, 2.40, 0.2, "SCAN TO OPEN", 6.4, MUTED_L, MONO, align=PP_ALIGN.CENTER)
    text(s, x + 0.16, 5.72, 2.40, 0.2, tagline, 6.2, MUTED_L, BODY, align=PP_ALIGN.CENTER)

# footer
line(s, 0.68, 7.13, 12.65, 7.13, LINE_D, 0.8)
text(s, 0.68, 7.18, 6.0, 0.18, "TECHMAP MAROC  /  BACKEND WALKTHROUGH", 7.0, MUTED_D, MONO)
text(s, 9.55, 7.18, 3.1, 0.18, "16 / 16  ·  MIT LICENSED", 7.0, MUTED_D, MONO, align=PP_ALIGN.RIGHT)

notes(s, """
Now the live demo. I suggest five stops, each showing a different backend family. First the directory: filter Casablanca and AI & Data Science, then open a company so the detail endpoint is visible. Second, the map: switch between Street, Satellite and Hybrid; the tiles are external, but the marker data comes from the API. Third, save a company and a project so the sync status appears. Fourth, run a local resume preview, which proves the Studio works without AI. Fifth, open a published portfolio to show the server-rendered public page. Keep /docs open in another tab if you want to show the exact request and response schema. The QR codes go to the repository and the live site.
""")

# ---------- metadata ----------
prs.core_properties.title = "TechMap Maroc — Backend Walkthrough"
prs.core_properties.subject = "Backend architecture, data, accounts, AI and infrastructure"
prs.core_properties.author = "TechMap Maroc"
prs.core_properties.keywords = "FastAPI, SQLite, pandas, Python, backend, TechMap Maroc"
prs.core_properties.comments = "Built from the repository code and the 387-company dataset, November 2026."

# ---------- save ----------
prs.save(OUT)
print(f"Saved {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB, {len(prs.slides)} slides)")
