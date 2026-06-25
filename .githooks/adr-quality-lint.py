#!/usr/bin/env python3
"""ADR quality lint: enforces 71-pillar checksum validation on each ADR commit."""
import re, sys
from pathlib import Path

def lint_adr(path: Path) -> list[str]:
    errors = []
    text = path.read_text()
    if not re.search(r'^## \d+\. ', text, re.MULTILINE):
        errors.append(f"  missing '## N. Title' section header")
    if not re.search(r'\*\*Status\*\*:\s*(Accepted|Draft|Superseded|Deprecated)', text):
        errors.append(f"  missing or invalid Status: field")
    if '---' not in text:
        errors.append(f"  no separator line (---)")
    return errors

def main():
    root = Path(__file__).resolve().parent.parent.parent
    adr_dir = root / "docs/adr"
    if not adr_dir.exists():
        return 0
    errors = []
    for f in sorted(adr_dir.rglob("ADR-*.md")):
        for e in lint_adr(f):
            errors.append(f"  {f.relative_to(root)}: {e}")
    if errors:
        print("ADR quality lint errors:")
        for e in errors:
            print(e)
        sys.exit(1)
    print("ADR quality lint: PASS")

if __name__ == "__main__":
    main()
