"""Company directory: listing, lookups and aggregate statistics."""

from typing import Optional

from fastapi import APIRouter, Query

from ...services.data import (
    compute_stats,
    filter_companies,
    get_cities_list,
    get_specialty_counts,
    load_data,
    public_company,
)

router = APIRouter(prefix="/api", tags=["companies"])


@router.get("/companies")
def get_companies(
    specialties: str = "",
    match: str = Query("any", pattern="^(any|all)$"),
    city: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recommended", pattern="^(recommended|name|name_desc|city)$"),
    contact: str = Query("all", pattern="^(all|email|careers|website)$"),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    df = load_data()
    wanted = [s.strip().lower() for s in specialties.split("|") if s.strip()]

    df = filter_companies(df, wanted, match, city, search)
    contact_columns = {"email": "apply_email", "careers": "careers_url", "website": "website"}
    if contact != "all":
        column = contact_columns[contact]
        if contact == "email":
            df = df[df[column].str.strip() != ""]
        else:
            df = df[df[column].str.match(r"(?i)^https?://", na=False)]
    if sort == "recommended":
        df = df.sort_values(by=["_score", "_name", "_id"], ascending=[False, True, True])
    elif sort == "city":
        df = df.sort_values(by=["city", "_name", "_id"])
    else:
        df = df.sort_values(by=["_name", "_id"], ascending=[sort == "name", True])
    page = df.iloc[offset:offset + limit]

    return {
        "total": int(len(df)),
        "items": [public_company(row) for row in page.to_dict(orient="records")],
    }


@router.get("/companies/by-ids")
def get_companies_by_ids(ids: str = ""):
    wanted_ids = {int(i) for i in ids.split(",") if i.strip().isdigit()}
    if not wanted_ids:
        return {"items": []}

    df = load_data()
    matches = df[df["_id"].isin(wanted_ids)]
    matches = matches.sort_values(by=["_score", "_name"], ascending=[False, True])

    return {"items": [public_company(row) for row in matches.to_dict(orient="records")]}


@router.get("/specialties")
def get_specialties():
    df = load_data()
    counts = get_specialty_counts(df)
    return [{"name": name, "count": count} for name, count in counts.most_common()]


@router.get("/cities")
def get_cities():
    return get_cities_list(load_data())


@router.get("/stats")
def get_stats():
    return compute_stats(load_data())
