"""Validated portfolio content and the shared preview/public renderer."""

from html import escape
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from .photos import Photo

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


class Project(Entry):
    cover: Photo = ''


class Portfolio(BaseModel):
    photo_mode: Literal['account', 'custom', 'none'] = 'account'
    portrait: Photo = ''
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
    projects: list[Project] = Field(default_factory=list, max_length=12)
    experience: list[Entry] = Field(default_factory=list, max_length=12)
    education: list[Entry] = Field(default_factory=list, max_length=12)
    certificates: list[Entry] = Field(default_factory=list, max_length=12)
    validate_urls = field_validator('github', 'linkedin', 'website', 'resume')(safe_link)


class PortfolioSave(Portfolio):
    slug: Slug
    published: bool = False


SECTIONS = (('projects', 'Projects'), ('experience', 'Experience'),
            ('education', 'Education'), ('certificates', 'Certifications'))


def render_portfolio(p: Portfolio, account_photo: str = '') -> str:
    def text(tag, value, cls=''):
        return f'<{tag} class="{cls}">{escape(value)}</{tag}>' if value else ''

    def link(url, label, cls='', context=''):
        if not url:
            return ''
        aria = f' aria-label="{escape(label + ": " + context, quote=True)}"' if context else ''
        return (f'<a class="{cls}" href="{escape(url, quote=True)}"{aria}>'
                f'{escape(label)} <span aria-hidden="true">↗</span></a>')

    portrait = {'account': account_photo, 'custom': p.portrait, 'none': ''}[p.photo_mode]
    portrait_image = (f'<img class="portfolio-portrait" src="{escape(portrait, quote=True)}" alt="">'
                      if portrait else '')
    portrait_class = ' has-portrait' if portrait else ''
    name = p.name or 'Your name'
    initials = ''.join(word[0].upper() for word in name.split()[:2])
    links = ''.join(link(url, label) for url, label in (
        (p.github, 'GitHub'), (p.linkedin, 'LinkedIn'), (p.website, 'Website'),
        (p.resume, 'Résumé'), ('mailto:' + p.email if p.email else '', 'Email me')))
    sections = []
    anchors = []

    def section(key, label, body):
        index = len(sections) + 1
        anchors.append(f'<a href="#{key}">{label}</a>')
        sections.append(f'<section id="{key}" class="section {key}" aria-labelledby="heading-{key}">'
                        f'<div class="section-heading"><span aria-hidden="true">{index:02}</span>'
                        f'<h2 id="heading-{key}">{label}</h2></div>{body}</section>')

    for key, label in SECTIONS:
        if key == 'experience':
            tags = ''.join(text('li', skill.strip()) for skill in p.skills.split(',')[:40])
            if tags:
                section('skills', 'Skills', f'<ul>{tags}</ul>')
        entries = getattr(p, key)
        if not entries:
            continue
        cards = []
        for index, entry in enumerate(entries, 1):
            visual = (f'<div class="project-cover" aria-hidden="true"><span>PROJECT / {index:02}</span>'
                      f'<i></i><b>{index:02}</b></div>') if key == 'projects' else ''
            if key == 'projects' and entry.cover:
                visual = (f'<div class="project-cover uploaded-cover"><img src="{escape(entry.cover, quote=True)}" '
                          'alt="" loading="lazy" decoding="async"></div>')
            action = {'projects': 'View project', 'certificates': 'View credential'}.get(key, 'Learn more')
            cards.append(f'<article>{visual}<div class="entry-copy">' + text('p', entry.period, 'period')
                         + text('h3', entry.title) + text('p', entry.subtitle, 'subtitle')
                         + text('p', entry.description, 'description')
                         + link(entry.url, action, 'entry-link', entry.title) + '</div></article>')
        section(key, 'Selected projects' if key == 'projects' else label,
                '<div class="entries">' + ''.join(cards) + '</div>')

    profile = f'<nav class="profile-links" aria-label="Profile links">{links}</nav>' if links else ''
    index = f'<nav class="index-links" aria-label="Page sections">{"".join(anchors)}</nav>' if anchors else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{escape((p.headline or name + ' — Portfolio')[:140], quote=True)}">
<title>{escape(name)} — Portfolio</title><link rel="stylesheet" href="/css/portfolio-public.css?v=3"></head>
<body class="{p.template}">
<div class="site" id="top"><div class="site-bar"><a class="wordmark" href="#top" aria-label="Back to top">{escape(initials)}</a>{index}</div>
<main class="composition"><header class="identity{portrait_class}">{portrait_image}<div class="identity-copy">
<p class="location"><span aria-hidden="true"></span>{escape(p.location or 'Portfolio')}</p>
<h1>{escape(name)}</h1>{text('p', p.headline, 'headline')}{text('p', p.bio, 'bio')}{profile}</div>
<div class="identity-art" aria-hidden="true"><div class="art-orbit"></div><span>{escape(initials)}</span></div>
</header><div class="content">{''.join(sections)}</div></main>
<footer><span>{escape(name)}</span><a href="/?studio=portfolio">Made with TechMap</a></footer></div>
</body></html>'''
