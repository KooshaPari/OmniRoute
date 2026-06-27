#!/usr/bin/env python3
"""scripts/migrate-worklog-v20-to-v21.py — v2.0 → v2.1 worklog schema migrator.

Usage:
    python3 scripts/migrate-worklog-v20-to-v21.py <WORKLOG.md> [<WORKLOG.md> ...]

Idempotent: re-running on a v2.1 file is a no-op.

v2.0 schema (10 cols): Date | Task ID | Layer | Action | Files | Notes
v2.1 schema (11 cols): Date | Task ID | Layer | Action | Files | Notes | device:

The v2.1 final canonical schema is a 7-column schema (6 legacy + `device:` as
the 7th). This script migrates 6-col v2.0 → 7-col v2.1 by inserting
`device: macbook` (the most common pre-v2.1 default) as the new 7th column.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

V21_DEVICE_COL = "device:"
V21_DEFAULT_DEVICE = "macbook"


def detect_columns(header: str) -> int:
    return len([c for c in header.strip().split("|") if c.strip()])


def migrate(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines:
        return "EMPTY"

    header = lines[0]
    ncols = detect_columns(header)
    if ncols == 7 and V21_DEVICE_COL in header:
        return "ALREADY_V21"
    if ncols != 6:
        return f"SKIP (ncols={ncols}, expected 6)"

    # Insert "device:" as the 7th column header.
    new_header = header.rstrip().rstrip("|").rstrip() + f" | {V21_DEVICE_COL}"
    new_lines = [new_header]
    for line in lines[1:]:
        if not line.strip():
            new_lines.append(line)
            continue
        if line.count("|") < 5:
            new_lines.append(line)
            continue
        # Strip trailing pipe/whitespace, append new col with leading space + value + space
        new_lines.append(line.rstrip().rstrip("|").rstrip() + f" | {V21_DEFAULT_DEVICE}")

    path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    return "MIGRATED"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()

    rc = 0
    for f in args.files:
        if not f.exists():
            print(f"MISSING {f}", file=sys.stderr)
            rc = 1
            continue
        result = migrate(f)
        print(f"{result:18s} {f}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
