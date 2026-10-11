import html


def render_resume_html(resume: dict) -> str:
    def esc(s):
        return html.escape(str(s or ""))

    contact = resume.get("contact", {}) or {}
    contact_bits = [
        esc(contact.get("email")),
        esc(contact.get("phone")),
        esc(contact.get("city")),
        esc(contact.get("linkedin")),
        esc(contact.get("github")),
        esc(contact.get("portfolio")),
    ]
    contact_line = " &middot; ".join(b for b in contact_bits if b)

    def section(title, body):
        return f"<h2>{esc(title)}</h2>{body}" if body else ""

    exp_html = "".join(
        f"""<div class="item">
            <div class="item-head"><strong>{esc(e.get('title'))}</strong>{' — ' + esc(e.get('company')) if e.get('company') else ''}
            <span class="dates">{esc(e.get('dates'))}</span></div>
            <ul>{''.join(f'<li>{esc(b)}</li>' for b in e.get('bullets', []))}</ul>
        </div>"""
        for e in resume.get("experience", [])
    )

    edu_html = "".join(
        f"""<div class="item">
            <div class="item-head"><strong>{esc(ed.get('degree'))}</strong>{' — ' + esc(ed.get('school')) if ed.get('school') else ''}
            <span class="dates">{esc(ed.get('dates'))}</span></div>
        </div>"""
        for ed in resume.get("education", [])
    )

    proj_html = "".join(
        f"<div class='item'><strong>{esc(p.get('name'))}</strong> — {esc(p.get('description'))}</div>"
        for p in resume.get("projects", [])
    )

    skills_html = ", ".join(esc(s) for s in resume.get("skills", []))
    lang_html = ", ".join(esc(s) for s in resume.get("languages", []))
    cert_html = ", ".join(esc(s) for s in resume.get("certifications", []))

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{esc(resume.get('full_name'))} - Resume</title>
<style>
body {{ font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; max-width: 760px; margin: 30px auto; line-height: 1.5; }}
h1 {{ margin-bottom: 2px; }}
.title {{ color: #555; margin-bottom: 6px; }}
.contact {{ color: #555; font-size: 0.9em; margin-bottom: 18px; }}
h2 {{ font-size: 1em; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }}
.item {{ margin: 10px 0; }}
.item-head {{ display: flex; justify-content: space-between; gap: 10px; }}
.dates {{ color: #777; font-size: 0.85em; white-space: nowrap; }}
ul {{ margin: 6px 0 0 18px; padding: 0; }}
li {{ margin-bottom: 3px; }}
</style></head>
<body>
<h1>{esc(resume.get('full_name'))}</h1>
<div class="title">{esc(resume.get('title'))}</div>
<div class="contact">{contact_line}</div>
{section('Summary', f"<p>{esc(resume.get('summary'))}</p>") if resume.get('summary') else ''}
{section('Experience', exp_html) if exp_html else ''}
{section('Projects', proj_html) if proj_html else ''}
{section('Education', edu_html) if edu_html else ''}
{section('Skills', f"<p>{skills_html}</p>") if skills_html else ''}
{section('Languages', f"<p>{lang_html}</p>") if lang_html else ''}
{section('Certifications', f"<p>{cert_html}</p>") if cert_html else ''}
</body></html>"""
