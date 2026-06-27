#!/usr/bin/env python3
"""L38.1 adr-auto-refresh — rebuilds docs/adr/INDEX.md from all ADR documents.

Scans docs/adr/** for ADR-*.md files, extracts title/status/date from YAML
frontmatter, and regenerates INDEX.md with a sorted table.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path


ADR_DIR = Path("docs/adr")
INDEX_FILE = ADR_DIR / "INDEX.md"
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def parse_adr(path: Path) -> dict | None:
    text = path.read_text()
    m = FRONTMATTER_RE.search(text)
    if not m:
        return None
    # simple yaml-like frontmatter parser (no pyyaml dep)
    meta = {}
    for line in m.group(1).strip().splitlines():
        if ":" in line:
            # normalize key: renames "ADR-NNN:" to just name
            parts = line.split(":", 1)
            key = parts[0].strip().strip('"').lower().replace("-", "_")
            val = parts[1].strip().strip('"')
            if " - " in val:
                parts2 = val.split(" - ", 1)
                val = parts2[1].strip()
            meta[key] = val
    return meta


def read_title_from_body(path: Path) -> str:
    """Fallback: read the first #-line after frontmatter."""
    text = path.read_text()
    # strip frontmatter
    rest = FRONTMATTER_RE.sub("", text).strip()
    for line in rest.splitlines():
        if line.startswith("# "):
            return line.lstrip("# ").strip()
    return path.stem


def build_index(adr_dir: Path) -> str:
    lines = [
        "# Architecture Decision Records (ADR) Index",
        "",
        "| ADR | Title | Status | Date |",
        "|-----|-------|--------|------|",
    ]
    for p in sorted(adr_dir.glob("ADR-*.md")):
        meta = parse_adr(p)
        if meta:
            title = meta.get("title", read_title_from_body(p))
            status = meta.get("status", "proposed").capitalize()
            date = meta.get("date", "")[:10]
        else:
            title = read_title_from_body(p)
            status = "Unknown"
            date = ""
        lines.append(f"| {p.stem} | {title} | {status} | {date} |")

    lines.append("")
    lines.append(f"_Auto-generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adr-dir", default=str(ADR_DIR))
    ap.add_argument("--output", default=str(INDEX_FILE))
    ap.add_argument("--check", action="store_true",
                    help="Exit non-zero if INDEX.md is stale")
    args = ap.parse_args()

    adr_dir = Path(args.adr_dir)
    output = Path(args.output)
    content = build_index(adr_dir)

    if args.check:
        if output.exists() and output.read_text() == content:
            print("INDEX.md is up-to-date")
            return 0
        print("INDEX.md is stale — run `python3 adr-auto-refresh.py` to regenerate",
              file=sys.stderr)
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content)
    print(f"Regenerated {output}: {len(content)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
