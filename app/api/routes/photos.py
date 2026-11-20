"""The account photo is private unless deliberately used by a public portfolio."""

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from ..deps import get_current_user, require_same_origin
from ...services.db import connection
from ...services.photos import Photo

router = APIRouter(prefix='/api/account/photo', tags=['account'])


class AccountPhoto(BaseModel):
    photo: Photo = ''


@router.get('')
def get_photo(response: Response, user=Depends(get_current_user)):
    response.headers['Cache-Control'] = 'no-store'
    with connection() as conn:
        row = conn.execute('SELECT photo FROM account_photos WHERE user_id = ?', (user['id'],)).fetchone()
    return {'photo': row['photo'] if row else ''}


@router.put('', dependencies=[Depends(require_same_origin)])
def set_photo(payload: AccountPhoto, user=Depends(get_current_user)):
    with connection() as conn:
        if payload.photo:
            conn.execute('''INSERT INTO account_photos (user_id, photo) VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET photo = excluded.photo''', (user['id'], payload.photo))
        else:
            conn.execute('DELETE FROM account_photos WHERE user_id = ?', (user['id'],))
    return {'ok': True}
