"""Shared helpers for the route modules."""

from fastapi import HTTPException

from ..services.data import load_data


def get_company_or_404(company_id: int) -> dict:
    """Return the full record for `company_id` or raise HTTP 404."""
    df = load_data()
    matches = df[df["_id"] == company_id]

    if matches.empty:
        raise HTTPException(status_code=404, detail="Company not found.")

    row = matches.iloc[0]
    return {
        "id": int(row["_id"]),
        "name": row["company_name"],
        "city": row["city"],
        "description": row["description"],
        "specialties": row["_specs"],
        "apply_email": str(row["apply_email"]).strip(),
    }
