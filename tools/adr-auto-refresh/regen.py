#!/usr/bin/env python3
"""
L38.1 — ADR INDEX.md auto-refresh.

Scans docs/adr/ for all .md files, extracts MADR metadata (status, date,
title), and regenerates the top-level ADR.md index file. Preserves any
non-table content above and below the ADR index section.

Usage:
    python3 tools/adr-auto-refresh/regen.py \\
        --adr-dir docs/adr \\
        --index ADR.md \\
        [--dry-run]
"""

import argparse
import os
import re
import sys
from datetime import date
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# MADR metadata extraction
# ---------------------------------------------------------------------------

MADR_TITLE_RE = re.compile(r"^#\s*(?:ADR-)?(\d+)[—\-]\s*(.+)$", re.MULTILINE)
MADR_STATUS_RE = re.compile(r">\s*\*?Status\*?:\s*(\S+(?:\s+\S+)*)", re.IGNORECASE | re.MULTILINE)
MADR_DATE_RE = re.compile(r">\s*\*?Date\*?:\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE | re.MULTILINE)

# For files like docs/adr/0001-record-architecture-decisions.md we extract
# the numeric prefix from the filename.
ADR_FILENAME_RE = re.compile(r"^(\d+)[—\-]?.*\.md$")


def extract_adr_metadata(filepath: str) -> Optional[dict]:
    """Extract ID, title, status, date from a MADR-format ADR file.

    Returns None if the file does not look like an ADR.
    """
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    # Skip files that don't look like ADRs
    if not content.strip().startswith("# "):
        return None

    # Extract title
    title_match = MADR_TITLE_RE.search(content)
    title = title_match.group(2).strip() if title_match else None

    # Extract numeric ID (try filename first, then title)
    basename = os.path.basename(filepath)
    fname_match = ADR_FILENAME_RE.match(basename)
    numeric_id = fname_match.group(1) if fname_match else None

    if not numeric_id and title_match:
        numeric_id = title_match.group(1).strip()

    if not numeric_id:
        return None

    # Pad to 4 digits if short
    if len(numeric_id) <= 2:
        adr_id = f"ADR-{int(numeric_id):03d}"
    else:
        adr_id = numeric_id

    # Extract status
    status_match = MADR_STATUS_RE.search(content)
    status = status_match.group(1).strip() if status_match else "Unknown"

    # Normalise status casing
    status_map = {
        "accepted": "Accepted",
        "proposed": "Proposed",
        "deprecated": "Deprecated",
        "superseded": "Superseded",
        "in progress": "In Progress",
    }
    status = status_map.get(status.lower(), status)

    # Extract date
    date_match = MADR_DATE_RE.search(content)
    adr_date = date_match.group(1) if date_match else "unknown"

    # Determine a driver/owner if mentioned (e.g., in a "Driver:" line)
    driver_match = re.search(r">\s*\*?Driver\*?:\s*(.+)$", content, re.MULTILINE | re.IGNORECASE)
    driver = driver_match.group(1).strip() if driver_match else "—"

    return {
        "id": adr_id,
        "numeric_id": numeric_id,
        "title": title or f"ADR {adr_id}",
        "status": status,
        "date": adr_date,
        "driver": driver,
        "filepath": filepath,
        "basename": basename,
    }


# ---------------------------------------------------------------------------
# Index generator
# ---------------------------------------------------------------------------

def generate_index_rows(adrs: list[dict]) -> str:
    """Generate the ADR index table rows, sorted by numeric ID.

    Returns the markdown table as a string (including header).
    """
    # Sort by numeric ID ascending
    adrs.sort(key=lambda a: int(re.sub(r"\D", "", a["numeric_id"]) or 0))

    lines = [
        "| ID | Title | Status | Date | Driver |",
        "|---|---|---|---|---|",
    ]

    for a in adrs:
        link = a["filepath"] if not a["filepath"].startswith("docs/") else a["filepath"]
        # For files in docs/adr/ we link relative
        if a["filepath"].startswith("docs/"):
            display = f"[{a['title']}]({a['filepath']})"
        else:
            display = a["title"]
        lines.append(
            f"| **{a['id']}** | {display} | {a['status']} | {a['date']} | {a['driver']} |"
        )

    return "\n".join(lines) + "\n"


def generate_adr_index(adr_dir: str, existing_index: str) -> str:
    """Regenerate the ADR index in the existing ADR.md file.

    Preserves everything above the first ADR index table (the header/)
    and everything after the last ADR index table (cross-references,
    how-to-add section).

    Returns the full new file content, or raises on error.
    """
    # Scan docs/adr/ for all candidate files
    adr_path = Path(adr_dir)
    if not adr_path.is_dir():
        raise ValueError(f"ADR directory {adr_dir} does not exist")

    adrs = []
    for fpath in sorted(adr_path.glob("*.md")):
        meta = extract_adr_metadata(str(fpath))
        if meta:
            adrs.append(meta)

    # Also scan the root for ADR-*.md (like ADR-001-canonical-routing.md)
    root_adr_dir = Path(existing_index).parent
    for fpath in sorted(root_adr_dir.glob("ADR-*.md")):
        meta = extract_adr_metadata(str(fpath))
        if meta:
            adrs.append(meta)

    new_table = generate_index_rows(adrs)

    # Now read the existing index and replace the table section
    index_path = Path(existing_index)
    if index_path.exists():
        content = index_path.read_text(encoding="utf-8")
    else:
        # New file: generate from scratch
        return (f"# Architecture Decision Records (ADR) — Top-Level Index\n"
                f"\n"
                f"> **Status**: Living document. Each ADR is immutable once accepted; changes\n"
                f"> require a new ADR that supersedes the old one.\n"
                f"> **Last updated**: {date.today().isoformat()}.\n"
                f"> **Owner**: OmniRoute core team (see `CODEOWNERS`).\n"
                f"\n"
                f"This file is the **top-level index** of architecture decisions.\n"
                f"The detailed ADR files live in `{adr_dir}/`. This index provides the\n"
                f"chronological + thematic view.\n"
                f"\n"
                f"---\n"
                f"\n"
                f"## ADR Index\n"
                f"\n"
                f"{new_table}\n")

    # Find the first table (| ID | Title | ...) and last table line
    lines = content.split("\n")
    table_start = None
    table_end = None

    for i, line in enumerate(lines):
        if line.strip().startswith("| **ADR-") or line.strip().startswith("| ID | Title |"):
            if table_start is None:
                table_start = i
        if table_start is not None and line.strip().startswith("|") and ("**" in line or "---" in line):
            table_end = i
        elif table_start is not None and not line.strip().startswith("|"):
            # We've passed the table
            break

    if table_start is None:
        # No table found, append after the header
        # Find the "## ADR Index" heading
        for i, line in enumerate(lines):
            if line.strip().startswith("## ADR Index"):
                table_start = i + 1
                # Find end of any existing content after heading until next section
                for j in range(i + 1, len(lines)):
                    if lines[j].strip().startswith("## ") and j > i + 1:
                        table_end = j
                        break
                break

    if table_start is not None and table_end is not None:
        # Preserve the header (lines before table_start) and footer (lines after table_end)
        header = "\n".join(lines[:table_start]).rstrip()
        footer_start = table_end + 1
        footer = "\n".join(lines[footer_start:]) if footer_start < len(lines) else ""
    elif table_start is not None:
        header = "\n".join(lines[:table_start]).rstrip()
        footer = ""
    else:
        # Should not happen with the heading-based fallback, but be safe
        header = "\n".join(lines).rstrip()
        footer = ""

    # Update the "Last updated" line
    header = re.sub(
        r"> \*\*Last updated\*\*: \S+",
        f"> **Last updated**: {date.today().isoformat()} (auto-refresh).",
        header,
    )

    result = header + "\n\n" + new_table
    if footer.strip():
        result += "\n" + footer

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="ADR INDEX.md auto-refresh")
    parser.add_argument(
        "--adr-dir",
        default="docs/adr",
        help="Directory containing ADR .md files (default: docs/adr)",
    )
    parser.add_argument(
        "--index",
        default="ADR.md",
        help="Path to the ADR index file (default: ADR.md)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the new content instead of writing it",
    )
    args = parser.parse_args()

    try:
        new_content = generate_adr_index(args.adr_dir, args.index)
    except (ValueError, FileNotFoundError) as e:
        print(f"::error::{e}")
        return 1

    adr_count = new_content.count("| **ADR-")

    if args.dry_run:
        print(new_content)
    else:
        index_path = Path(args.index)
        index_path.write_text(new_content, encoding="utf-8")
        print(f"✅ Updated {args.index} with {adr_count} ADR entries")

    # Print summary for GitHub Actions step summary
    print(f"\nADR entries in index: {adr_count}")
    print(f"ADR source directory: {args.adr_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
