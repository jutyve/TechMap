"""Build a clean, self-contained source archive of the project.

    python scripts/package.py                     -> TechMap-source.zip
    python scripts/package.py /path/to/out.zip    -> custom destination

The archive contains a single `TechMap/` folder with the application, the
cleaned company dataset and the docs. Caches, virtual environments, secrets,
logs and previously generated archives are left out.
"""

import fnmatch
import pathlib
import sys
import zipfile

PROJECT_DIR = pathlib.Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = "TechMap"

EXCLUDED_DIRS = {
    ".git", ".venv", "venv", "env", "__pycache__", ".pytest_cache",
    ".ruff_cache", ".mypy_cache", ".idea", ".vscode", "uploads", ".arena",
}

EXCLUDED_PATTERNS = (
    "*.py[cod]", "*.log", "*.zip", "*.tmp", ".env", ".env.*", ".DS_Store", "Thumbs.db",
)


def is_excluded(relative: pathlib.Path) -> bool:
    # The provider template contains no secrets and the AI setup instructions
    # in the README rely on it, so it ships with the archive; real `.env`
    # files (and variants such as `.env.local`) never do.
    if relative.as_posix() == ".env.example":
        return False
    if any(part in EXCLUDED_DIRS for part in relative.parts):
        return True
    return any(fnmatch.fnmatch(relative.name, pattern) for pattern in EXCLUDED_PATTERNS)


def iter_files():
    for path in sorted(PROJECT_DIR.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(PROJECT_DIR)
        if is_excluded(relative):
            continue
        yield path, relative


def build(destination: pathlib.Path) -> pathlib.Path:
    destination = destination.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, relative in iter_files():
            archive.write(path, f"{ARCHIVE_ROOT}/{relative.as_posix()}")

    return destination


def main(argv: list[str]) -> int:
    destination = pathlib.Path(argv[1]) if len(argv) > 1 else PROJECT_DIR / "TechMap-source.zip"
    archive = build(destination)

    with zipfile.ZipFile(archive) as zf:
        count = len(zf.namelist())

    print(f"Created {archive} ({count} files). Extract it and run: python run.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
