"""Explicit source allowlist: never package credentials, uploads or browser data."""
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = ("README.md", "LICENSE", "requirements.txt", "requirements-dev.txt",
              "main.py", "run.py", ".env.example", ".gitignore")
FOLDERS = {"Static": {".html", ".css", ".js", ".svg"},
           "utils": {".py"}, "scripts": {".py"}, "tests": {".py"}}
DATA_FILES = ("DataBase/morocco_tech_companies_clean.csv",)


def build_source_archive() -> bytes:
    paths = [ROOT / name for name in (*ROOT_FILES, *DATA_FILES)]
    for folder, suffixes in FOLDERS.items():
        paths.extend(p for p in (ROOT / folder).rglob("*")
                     if p.is_file() and p.suffix in suffixes and "__pycache__" not in p.parts)
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path in sorted(set(paths)):
            if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(ROOT):
                archive.write(path, "TechMap/" + path.relative_to(ROOT).as_posix())
    return output.getvalue()
