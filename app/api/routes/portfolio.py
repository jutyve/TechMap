"""Owner-managed portfolios with a public, script-free page."""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from ..deps import get_current_user, require_same_origin
from ...services.db import connection
from ...services.portfolio import Portfolio, PortfolioSave, render_portfolio

router = APIRouter(tags=['portfolio'])
PAGE_HEADERS = {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
}


def record(row):
    if row is None:
        return None
    return {**Portfolio.model_validate_json(row['content']).model_dump(),
            'slug': row['slug'], 'published': bool(row['published'])}


@router.get('/api/portfolio', response_model=PortfolioSave | None)
def get_portfolio(user=Depends(get_current_user)):
    with connection() as conn:
        return record(conn.execute('SELECT * FROM portfolios WHERE user_id = ?', (user['id'],)).fetchone())


@router.put('/api/portfolio', dependencies=[Depends(require_same_origin)])
def save_portfolio(payload: PortfolioSave, user=Depends(get_current_user)):
    if payload.published and not payload.name:
        raise HTTPException(422, 'Enter a display name before publishing.')
    try:
        with connection() as conn:
            conn.execute('''INSERT INTO portfolios (user_id, slug, content, published) VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET slug=excluded.slug, content=excluded.content,
                published=excluded.published''', (user['id'], payload.slug,
                    payload.model_dump_json(exclude={'slug', 'published'}), payload.published))
    except sqlite3.IntegrityError as exc:
        if str(exc) != 'UNIQUE constraint failed: portfolios.slug':
            raise
        raise HTTPException(409, 'That username is already taken. Try another one.') from exc
    return payload


@router.post('/api/portfolio/unpublish', dependencies=[Depends(require_same_origin)])
def unpublish_portfolio(user=Depends(get_current_user)):
    with connection() as conn:
        conn.execute('UPDATE portfolios SET published = 0 WHERE user_id = ?', (user['id'],))
    return {'published': False}


@router.post('/api/portfolio/preview', response_class=HTMLResponse)
def preview_portfolio(payload: Portfolio):
    return HTMLResponse(render_portfolio(payload), headers=PAGE_HEADERS)


@router.get('/portfolio/{username}', response_class=HTMLResponse)
def public_portfolio(username: str):
    with connection() as conn:
        row = conn.execute('SELECT content FROM portfolios WHERE slug = ? AND published = 1', (username,)).fetchone()
    if row is None:
        return HTMLResponse('''<!doctype html><html lang="en"><meta charset="utf-8">
<title>Portfolio not found</title><h1>Portfolio not found</h1>
<p>This portfolio may be unpublished or the address may have changed.</p><a href="/">Back to TechMap</a></html>''',
                            status_code=404, headers=PAGE_HEADERS)
    return HTMLResponse(render_portfolio(Portfolio.model_validate_json(row['content'])), headers=PAGE_HEADERS)
