"""Validated portfolio content and the shared preview/public renderer."""

from html import escape
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Template = Literal['minimal', 'editorial', 'terminal', 'gallery', 'executive', 'bento', 'atlas', 'monograph']
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=140)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2400)]
Link = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Slug = Annotated[str, StringConstraints(pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$', min_length=3, max_length=40)]


def safe_link(value: str) -> str:
    if not value:
        return value
    try:
        parsed = urlsplit(value)
        if (parsed.scheme in {'http', 'https'} and parsed.hostname and not parsed.username
                and not parsed.password and not any(c.isspace() or ord(c) < 32 or c == '\\' for c in value)):
            return value
    except ValueError:
        pass
    raise ValueError('Links must be complete HTTP or HTTPS URLs.')


class Entry(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: Annotated[Short, Field(min_length=1)]
    subtitle: Short = ''
    period: Short = ''
    description: Body = ''
    url: Link = ''
    validate_url = field_validator('url')(safe_link)


class Portfolio(BaseModel):
    name: Short = ''
    headline: Short = ''
    location: Short = ''
    bio: Body = ''
    skills: Body = ''
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254,
        pattern=r'^([^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+)?$')] = ''
    github: Link = ''
    linkedin: Link = ''
    website: Link = ''
    resume: Link = ''
    template: Template = 'minimal'
    projects: list[Entry] = Field(default_factory=list, max_length=12)
    experience: list[Entry] = Field(default_factory=list, max_length=12)
    education: list[Entry] = Field(default_factory=list, max_length=12)
    certificates: list[Entry] = Field(default_factory=list, max_length=12)
    validate_urls = field_validator('github', 'linkedin', 'website', 'resume')(safe_link)


class PortfolioSave(Portfolio):
    slug: Slug
    published: bool = False


SECTIONS = (('projects', 'Projects'), ('experience', 'Experience'),
            ('education', 'Education'), ('certificates', 'Certifications'))


def render_portfolio(p: Portfolio) -> str:
    def text(tag, value, cls=''):
        return f'<{tag} class="{cls}">{escape(value)}</{tag}>' if value else ''

    def link(url, label):
        return f'<a href="{escape(url, quote=True)}">{escape(label)}</a>' if url else ''

    name = p.name or 'Your name'
    initials = ''.join(word[0].upper() for word in name.split()[:2])
    links = ''.join(link(url, label) for url, label in (
        (p.github, 'GitHub'), (p.linkedin, 'LinkedIn'), (p.website, 'Website'),
        (p.resume, 'Résumé'), ('mailto:' + p.email if p.email else '', 'Email me')))
    sections = []
    for key, label in SECTIONS:
        entries = getattr(p, key)
        if not entries:
            continue
        cards = ''.join(
            '<article>' + text('p', entry.period, 'period') + text('h3', entry.title)
            + text('p', entry.subtitle, 'subtitle') + text('p', entry.description, 'description')
            + link(entry.url, 'View details ↗') + '</article>' for entry in entries
        )
        sections.append(f'<section class="section {key}"><h2>{label}</h2><div class="entries">{cards}</div></section>')
    tags = ''.join(text('li', skill.strip()) for skill in p.skills.split(',')[:40])
    if tags:
        sections.insert(1, f'<section class="section skills"><h2>Skills</h2><ul>{tags}</ul></section>')
    nav = f'<nav aria-label="Profile links">{links}</nav>' if links else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{escape((p.headline or name + ' — Portfolio')[:140], quote=True)}">
<title>{escape(name)} — Portfolio</title><link rel="stylesheet" href="/css/portfolio-public.css?v=1"></head>
<body class="{p.template}"><main class="site">
<header class="identity"><span class="initials" aria-hidden="true">{escape(initials)}</span>
{text('p', p.location, 'location')}<h1>{escape(name)}</h1>{text('p', p.headline, 'headline')}
{text('p', p.bio, 'bio')}{nav}</header><div class="content">{''.join(sections)}</div>
<footer><a href="/?studio=portfolio">Made with TechMap Portfolio Studio</a></footer>
</main></body></html>'''
