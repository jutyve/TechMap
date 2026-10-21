import os
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Optional

import pandas as pd

from .config import COLUMNS, CSV_PATH

_cache = {"mtime": None, "df": None}


def split_specialties(value) -> list[str]:
    parts = re.split(r"[;,]", str(value or ""))
    return [
        p.strip()
        for p in parts
        if p.strip() and p.strip().lower() != "nan"
    ]


def split_emails(value) -> list[str]:
    return [p.strip() for p in str(value or "").split(";") if p.strip()]


def city_key(value) -> str:
    """Case- and accent-insensitive key used to compare city names.

    The collected dataset writes some cities more than one way ("Marrakech"
    and "marrakech", "Kenitra" and "kénitra"), so grouping by this key keeps
    counts, filters and listings consistent.
    """
    ascii_form = (
        unicodedata.normalize("NFKD", str(value or ""))
        .encode("ascii", "ignore")
        .decode()
    )
    return re.sub(r"[^a-z0-9]+", " ", ascii_form.lower()).strip()


def city_display_names(values) -> dict[str, str]:
    """Pick one display spelling per city key: the most common variant."""
    forms: dict[str, Counter] = defaultdict(Counter)
    for value in values:
        raw = str(value or "").strip()
        if raw:
            forms[city_key(raw)][raw] += 1

    names: dict[str, str] = {}
    for key, counter in forms.items():
        best = counter.most_common(1)[0][0]
        if len(counter) == 1 and best.islower():
            best = " ".join(word[:1].upper() + word[1:] for word in best.split())
        names[key] = best
    return names


def safe_url(value) -> str:
    value = str(value or "").strip()
    return value if value.lower().startswith(("http://", "https://")) else ""


def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = ""

    df = df.fillna("").copy()

    # One canonical spelling per city, then the cleaned value drives every
    # listing, filter and statistic that follows.
    city_names = city_display_names(df["city"])
    df["_city_key"] = df["city"].apply(city_key)
    df["city"] = [
        city_names.get(key) or raw
        for key, raw in zip(df["_city_key"], df["city"])
    ]

    df["_id"] = range(len(df))
    df["_name"] = df["company_name"].str.lower()
    df["_specs"] = df["specialties"].apply(split_specialties)
    df["_specs_lower"] = df["_specs"].apply(
        lambda items: {s.lower() for s in items}
    )
    df["_hay"] = (
        df["company_name"]
        + " "
        + df["city"]
        + " "
        + df["description"]
        + " "
        + df["specialties"]
    ).str.lower()

    def has(col):
        return (df[col].astype(str).str.strip() != "").astype(int)

    df["_score"] = (
        3 * has("apply_email")
        + 2 * has("careers_url")
        + has("contact_url")
        + has("website")
        + has("description")
    )

    return df


def load_data() -> pd.DataFrame:
    if not os.path.exists(CSV_PATH):
        if _cache["df"] is None or _cache["mtime"] != "missing":
            print(f"WARNING: {CSV_PATH} not found - the app will show no companies.")
            df = _prepare(pd.DataFrame(columns=COLUMNS))
            _cache.update(mtime="missing", df=df)
        return _cache["df"]

    mtime = os.path.getmtime(CSV_PATH)

    if _cache["mtime"] != mtime:
        df = pd.read_csv(
            CSV_PATH,
            dtype=str,
            encoding="utf-8-sig",
        ).fillna("")
        _cache.update(mtime=mtime, df=_prepare(df))

    return _cache["df"]


def public_company(row: dict) -> dict:
    apply_email = str(row["apply_email"]).strip()
    emails = split_emails(row["all_emails"])

    if apply_email:
        emails = [apply_email] + [
            email for email in emails if email != apply_email
        ]

    return {
        "id": int(row["_id"]),
        "company_name": row["company_name"],
        "city": row["city"],
        "specialties": row["_specs"],
        "description": row["description"],
        "website": safe_url(row["website"]),
        "apply_link": safe_url(row["apply_link"]),
        "apply_via": row["apply_via"],
        "careers_url": safe_url(row["careers_url"]),
        "contact_url": safe_url(row["contact_url"]),
        "apply_email": apply_email,
        "emails": emails,
        "phone": row["phone"],
        "source": row["source"],
    }


def filter_companies(
    df: pd.DataFrame,
    wanted: list[str],
    match: str,
    city: Optional[str],
    search: Optional[str],
) -> pd.DataFrame:
    if wanted:
        if match == "all":
            mask = df["_specs_lower"].apply(
                lambda have: all(item in have for item in wanted)
            )
        else:
            mask = df["_specs_lower"].apply(
                lambda have: any(item in have for item in wanted)
            )
        df = df[mask]

    if city and city != "all":
        df = df[df["_city_key"] == city_key(city)]

    if search and search.strip():
        df = df[
            df["_hay"].str.contains(
                re.escape(search.strip().lower()),
                na=False,
            )
        ]

    return df


def get_specialty_counts(df: pd.DataFrame) -> Counter:
    return Counter(
        specialty
        for specialties in df["_specs"]
        for specialty in specialties
    )


def known_specialties() -> list[str]:
    df = load_data()
    counts = get_specialty_counts(df)
    return [name for name, _ in counts.most_common()]


def get_cities_list(df: pd.DataFrame) -> list[str]:
    return sorted({
        city.strip()
        for city in df["city"]
        if city.strip()
    })


def compute_stats(df: pd.DataFrame) -> dict:
    def filled(col):
        if col == "website":
            return int((df[col].apply(safe_url) != "").sum())
        return int((df[col].astype(str).str.strip() != "").sum())

    specialty_counts = get_specialty_counts(df)
    city_counts = Counter(
        city.strip()
        for city in df["city"]
        if city.strip()
    )
    via_counts = Counter(
        via.strip()
        for via in df["apply_via"]
        if via.strip()
    )

    return {
        "total_companies": int(len(df)),
        "with_website": filled("website"),
        "with_email": filled("apply_email"),
        "with_phone": filled("phone"),
        "specialty_distribution": dict(specialty_counts),
        "city_distribution": dict(city_counts),
        "apply_via_distribution": dict(via_counts),
    }