import json
import re

from .config import AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_TIMEOUT_SECONDS

try:
    import openai
except ImportError:
    openai = None


class AIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _client():
    if openai is None:
        raise AIError(
            503,
            "The 'openai' package is not installed. Run: python -m pip install openai",
        )
    return openai.OpenAI(
        base_url=AI_BASE_URL,
        api_key=AI_API_KEY or "not-set",
        timeout=AI_TIMEOUT_SECONDS,
    )


def chat(system_prompt: str, user_prompt: str) -> str:
    client = _client()

    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except openai.APIConnectionError:
        raise AIError(
            503,
            f"Cannot reach the AI gateway at {AI_BASE_URL}. Is OmniRoute running?",
        )
    except openai.AuthenticationError:
        raise AIError(
            503,
            "The AI gateway rejected the API key. Set OMNIROUTE_API_KEY and restart the server.",
        )
    except openai.NotFoundError:
        raise AIError(
            503,
            f"The AI gateway does not recognize model '{AI_MODEL}'. Check OMNIROUTE_MODEL.",
        )
    except openai.APIStatusError as exc:
        raise AIError(502, f"The AI gateway returned an error ({exc.status_code}).")
    except Exception as exc:
        raise AIError(502, f"The AI request failed: {type(exc).__name__}")

    return response.choices[0].message.content or ""


def parse_json_response(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end <= start:
        raise ValueError("No JSON object found")

    result = json.loads(text[start:end + 1])

    if not isinstance(result, dict):
        raise ValueError("The model response is not a JSON object")

    return result


def chat_json(system_prompt: str, user_prompt: str) -> dict:
    content = chat(system_prompt, user_prompt)

    try:
        return parse_json_response(content)
    except (ValueError, json.JSONDecodeError):
        raise AIError(
            502,
            "The AI answered in an unexpected format. Please try again.",
        )


def str_list(value, limit: int, max_len: int = 300) -> list[str]:
    if not isinstance(value, list):
        return []

    items = [str(item).strip()[:max_len] for item in value if str(item).strip()]
    return items[:limit]
