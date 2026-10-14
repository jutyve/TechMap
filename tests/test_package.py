"""The packaging script must produce a clean, runnable archive."""

import zipfile

import pytest

from scripts.package import build


@pytest.fixture(scope="module")
def archive(tmp_path_factory):
    destination = tmp_path_factory.mktemp("dist") / "TechMap-source.zip"
    build(destination)

    with zipfile.ZipFile(destination) as zf:
        return destination, zf.namelist()


def test_archive_has_a_single_root_folder(archive):
    _, members = archive
    assert members
    assert {member.split("/")[0] for member in members} == {"TechMap"}


def test_archive_contains_the_application(archive):
    _, members = archive
    for required in (
        "TechMap/run.py",
        "TechMap/app/main.py",
        "TechMap/static/index.html",
        "TechMap/static/css/style.css",
        "TechMap/static/js/app.js",
        "TechMap/database/data/morocco_tech_companies_clean.csv",
        "TechMap/requirements.txt",
        "TechMap/README.md",
    ):
        assert required in members, f"missing from archive: {required}"


def test_archive_excludes_caches_and_secrets(archive):
    _, members = archive
    for member in members:
        assert "__pycache__" not in member
        assert "/.venv/" not in member
        assert not member.endswith((".pyc", ".log", ".zip", ".tmp"))
        assert not member.endswith("/.env")
