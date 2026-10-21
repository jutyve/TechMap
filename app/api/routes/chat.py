"""AI career assistant.

Recommends real companies from the directory ONLY when the user is actually
looking for a job / company. Filters are relaxed step by step so a spelling
mismatch never results in an empty reply.
"""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ...services.ai_client import AIError
from ...services.chat_ai import run_chat_turn
from ...services.data import filter_companies, get_cities_list, known_specialties, load_data, public_company

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@router.post("/chat")
async def chat_turn(req: ChatRequest):
    df = load_data()
    specialties = known_specialties()
    cities = get_cities_list(df)
    history = [m.model_dump() for m in req.history]

    try:
        result = await run_in_threadpool(run_chat_turn, req.message, history, specialties, cities)
    except AIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)

    companies = []

    if result["ready_to_recommend"]:
        wanted = [s.lower() for s in result["specialties"]]
        city = result["city"] or None

        attempt = filter_companies(df, wanted, "any", city, None)
        if attempt.empty and wanted and city:
            attempt = filter_companies(df, [], "any", city, None)
        if attempt.empty and wanted:
            attempt = filter_companies(df, wanted, "any", None, None)
        if attempt.empty:
            attempt = df

        attempt = attempt.sort_values(by=["_score", "_name"], ascending=[False, True])
        companies = [public_company(row) for row in attempt.head(5).to_dict(orient="records")]

    return {**result, "companies": companies}
