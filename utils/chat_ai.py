import json as _json
from difflib import get_close_matches
from typing import Optional

from .ai_client import chat_json, str_list

CHAT_SYSTEM_PROMPT = (
    "You are TechMap Maroc's friendly career assistant. Your job is to help users find tech "
    "companies, jobs, and internships in Morocco that fit them. You do NOT know real companies "
    "yourself - the app looks up real matches from its own database using the specialties and "
    "city you detect, so NEVER invent or name specific companies yourself. Keep replies short "
    "(2-5 sentences), warm, and in the same language the user writes in. "
    "You may chat casually about tech and careers, but only set ready_to_recommend to true when "
    "the user is actually looking for a job, internship, role, or company - not for general "
    "knowledge or trivia questions. "
    "Reply with ONE JSON object and nothing else, no markdown, no code fences."
)


def build_chat_prompt(message: str, history: list[dict], specialties: list[str], cities: list[str]) -> str:
    history_text = "\n".join(f"{t.get('role', 'user')}: {t.get('content', '')}" for t in history[-8:])

    return f"""Conversation so far:
{history_text or "(no previous messages)"}

New user message: {_json.dumps(message, ensure_ascii=False)}

Specialties available in our database (if relevant, pick 0-3 of the closest matches and copy them EXACTLY as written here):
{_json.dumps(specialties, ensure_ascii=False)}

Cities available in our database (if the user names a city, copy the matching one EXACTLY as written here, even if they spelled it differently or in another language, e.g. "Marrakesh" or "مراكش" both mean the same city as whatever spelling appears in this list):
{_json.dumps(cities, ensure_ascii=False)}

Return exactly this JSON shape:
{{
  "reply": "conversational reply, 2-5 sentences",
  "specialties": ["0 to 3 values copied exactly from the specialties list above"],
  "city": "exact city name copied from the cities list above, or empty string",
  "ready_to_recommend": true
}}

Rules:
- Set "ready_to_recommend" to true whenever the user describes a role, field, or career goal they
  want, asks for job/internship/company recommendations, or names a city they want to work in.
  This includes messages like "I want to be a data analyst, find me internships in Marrakech".
- Set "ready_to_recommend" to false only for clearly unrelated messages: general knowledge, trivia,
  greetings, small talk, or tech questions with no job-search intent (e.g. "what does React do?",
  "what's the speed of sound?").
- When ready_to_recommend is true, always try to match the user's field/role to the closest items
  in the specialties list, and their city to the closest item in the cities list, even if their
  wording, spelling, or language differs from the list. Leave a field empty only if truly nothing
  in that list is a reasonable match.
- Never invent a specialty or city that is not in the lists above.
- When genuinely unsure between true and false, prefer true if the message mentions any job, role,
  field, internship, or city at all."""


def _fuzzy_pick(raw: str, canonical_map: dict) -> Optional[str]:
    key = raw.strip().lower()
    if not key:
        return None
    if key in canonical_map:
        return canonical_map[key]
    close = get_close_matches(key, list(canonical_map.keys()), n=1, cutoff=0.6)
    return canonical_map[close[0]] if close else None


def run_chat_turn(message: str, history: list[dict], specialties: list[str], cities: list[str]) -> dict:
    data = chat_json(CHAT_SYSTEM_PROMPT, build_chat_prompt(message, history, specialties, cities))

    spec_canonical = {s.lower(): s for s in specialties}
    city_canonical = {c.lower(): c for c in cities}

    detected_specs = []
    for item in str_list(data.get("specialties"), 3, 80):
        match = _fuzzy_pick(item, spec_canonical)
        if match and match not in detected_specs:
            detected_specs.append(match)

    city_raw = str(data.get("city") or "").strip()
    city = _fuzzy_pick(city_raw, city_canonical) or ""

    ready = bool(data.get("ready_to_recommend"))

    return {
        "reply": str(data.get("reply") or "").strip()[:800] or "Could you tell me more about what you're looking for?",
        "specialties": detected_specs if ready else [],
        "city": city if ready else "",
        "ready_to_recommend": ready,
    }