"""Smoke tests for the API and the static file layout.

They run offline: no AI provider and no network access are needed.
"""

import pathlib

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.config import CSV_PATH, STATIC_DIR

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]

client = TestClient(app)


def test_dataset_is_present():
    assert pathlib.Path(CSV_PATH).is_file(), f"missing dataset: {CSV_PATH}"


def test_stats():
    payload = client.get("/api/stats").json()
    assert isinstance(payload, dict) and payload


def test_companies_page():
    payload = client.get("/api/companies", params={"limit": 5}).json()
    assert payload["total"] > 0
    assert len(payload["items"]) <= 5
    first = payload["items"][0]
    assert {"id", "company_name", "city", "specialties"} <= set(first)


def test_companies_by_ids_roundtrip():
    page = client.get("/api/companies", params={"limit": 1}).json()
    company_id = page["items"][0]["id"]

    payload = client.get("/api/companies/by-ids", params={"ids": str(company_id)}).json()
    assert [item["id"] for item in payload["items"]] == [company_id]

    assert client.get("/api/companies/by-ids", params={"ids": ""}).json() == {"items": []}


def test_filter_validation():
    assert client.get("/api/companies", params={"sort": "nonsense"}).status_code == 422


def test_cities_and_specialties():
    cities = client.get("/api/cities").json()
    specialties = client.get("/api/specialties").json()
    assert cities and all(isinstance(city, str) for city in cities)
    assert specialties and {"name", "count"} <= set(specialties[0])


def test_unknown_company_is_404():
    response = client.post("/api/companies/999999/cover-letter", json={"full_name": "Test"})
    assert response.status_code == 404


def test_index_html_is_served_with_new_asset_paths():
    response = client.get("/")
    assert response.status_code == 200
    body = response.text
    for asset in (
        "css/base.css",
        "css/workspace.css",
        "css/studio.css",
        "js/core/theme.js",
        "js/features/app.js",
        "js/features/studio.js",
        "assets/icons/mark.svg",
    ):
        assert asset in body, f"index.html does not reference {asset}"


@pytest.mark.parametrize(
    "asset",
    [
        "css/base.css",
        "css/workspace.css",
        "css/studio.css",
        "js/core/theme.js",
        "js/features/app.js",
        "js/features/workspace.js",
        "js/features/quick-actions.js",
        "js/features/studio.js",
        "assets/icons/mark.svg",
    ],
)
def test_static_assets_are_served(asset):
    assert client.get(f"/{asset}").status_code == 200


def test_static_directory_is_organized():
    root = pathlib.Path(STATIC_DIR)
    # Only the page, this docs file, and one folder per asset kind at the root.
    assert sorted(p.name for p in root.iterdir()) == ["README.md", "assets", "css", "index.html", "js"]
    # Stylesheets stay flat and CSS-only; scripts are grouped by role
    # (core = pre-paint, features = page behaviour, legacy = unloaded).
    assert {p.suffix for p in (root / "css").iterdir()} == {".css"}
    assert sorted(p.name for p in (root / "js").iterdir()) == ["core", "features", "legacy"]
    for group in ("core", "features", "legacy"):
        assert {p.suffix for p in (root / "js" / group).iterdir()} == {".js"}
    assert (root / "assets" / "icons" / "mark.svg").is_file()
