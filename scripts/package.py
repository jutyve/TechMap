"""Create an independently runnable source ZIP, excluding secrets and caches."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from utils.source_archive import build_source_archive

if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("delivery/TechMap-source.zip")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(build_source_archive())
    print(f"Created {target.resolve()} ({target.stat().st_size:,} bytes)")
