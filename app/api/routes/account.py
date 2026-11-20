"""Per-user synced workspace state.

The frontend keeps working from localStorage exactly as it does for guests;
when a user is signed in, the whitelisted keys (favorites, company notes,
Resume Studio form/data/photo/style, profile, layout) are mirrored
here so the workspace follows them across browsers and devices.
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...services import accounts
from ...services.config import MAX_STATE_VALUE_BYTES, SYNCED_STATE_KEYS
from ..deps import get_current_user, require_same_origin

router = APIRouter(prefix="/api/me", tags=["account"])


class StateValueIn(BaseModel):
    value: Any = None


class StateBatchIn(BaseModel):
    values: dict[str, Any]


def _check_key(key: str) -> str:
    if key not in SYNCED_STATE_KEYS:
        raise HTTPException(status_code=422, detail=f"Unknown state key: {key}")
    return key


def _check_values(values: dict) -> dict:
    checked = {}
    for key, value in values.items():
        _check_key(key)
        if value is not None and len(json.dumps(value).encode("utf-8")) > MAX_STATE_VALUE_BYTES:
            raise HTTPException(
                status_code=413, detail=f"Saved value for {key} is too large."
            )
        checked[key] = value
    return checked


@router.get("/state")
def read_state(user=Depends(get_current_user)):
    return {"state": accounts.get_state(user["id"])}


@router.put("/state", dependencies=[Depends(require_same_origin)])
def write_state_batch(payload: StateBatchIn, user=Depends(get_current_user)):
    accounts.set_state_values(user["id"], _check_values(payload.values))
    return {"ok": True}


@router.put("/state/{key}", dependencies=[Depends(require_same_origin)])
def write_state_value(key: str, payload: StateValueIn, user=Depends(get_current_user)):
    accounts.set_state_values(user["id"], _check_values({key: payload.value}))
    return {"ok": True}


@router.delete("/state/{key}", dependencies=[Depends(require_same_origin)])
def delete_state_value(key: str, user=Depends(get_current_user)):
    _check_key(key)
    accounts.delete_state_value(user["id"], key)
    return {"ok": True}
