#!/usr/bin/env python3
r"""scripts/adr_index_gen.py — Regenerate the canonical docs/adr/INDEX.md.

Authority: v20 cycle-10 71-pillar plan § Track T1 (L1 Architecture
ADR consolidation, score 2.5 → 3.0). See AGENTS.md § "App substrate
placement" and `findings/71-pillar-2026-06-17-schema.md` § AX (L1-L12)
for context.

Usage:
    python3 scripts/adr_index_gen.py                  # writes docs/adr/INDEX.md
    python3 scripts/adr_index_gen.py --out <path>     # custom output path
    python3 scripts/adr_index_gen.py --check         # exit 1 if INDEX.md is stale
    python3 scripts/adr_index_gen.py --quiet         # no banner / progress

What it does:
    1. Discovers all ADR files under `docs/adr/` (both `docs/adr/ADR-*.md`
       at the root and `docs/adr/<date>/ADR-*.md` in date directories).
       INDEX.md files in any subdirectory are excluded from the table.
    2. For each ADR file, extracts:
         - ADR number (e.g. "024", "050B") from the filename
         - Title (first H1 line in the body)
         - Date (from the parent directory name, or from the file front-matter)
         - Status (from front-matter `Status:` line; defaults to "Unknown" if
           no status can be found)
         - Cross-references count (count of `ADR-\d+B?` mentions in the body
           that point to other ADR numbers, excluding self-references)
    3. Sorts ADRs chronologically by date, then by ADR number within a date.
    4. Writes a single canonical INDEX.md with a Markdown table, a count
       summary at the top, and a `<!-- generated: ... -->` timestamp footer
       so the file is not byte-identical across runs (the body content is
       deterministic given the same set of source files).

Idempotent: re-running with the same set of source files produces the same
body content. The only line that changes between runs is the timestamp
comment in the footer, which is required by the `git diff --exit-code` check
in the CI lint workflow to fail when an ADR is added without regenerating
the index.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import re
import sys
from pathlib import Path
from typing import Iterable, NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
ADR_ROOT = REPO_ROOT / "docs" / "adr"
DEFAULT_OUT = ADR_ROOT / "INDEX.md"

# Matches an ADR-### or ADR-###B reference in body text. Case-insensitive to
# also catch `adr-024` style mentions in the rare prose body.
ADR_REF_RE = re.compile(r"\bADR-(\d+)(B?)\b", re.IGNORECASE)
ADR_FILENAME_RE = re.compile(r"^ADR-(\d+)(B?)-.+\.md$", re.IGNORECASE)
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
# Inline format: `**Status:** <value>` or `Status: <value>`. Tolerates the
# common markdown-bold-wrapped form (`**Status:** **ACCEPTED**`) by allowing
# `**` on both sides of the colon, and the parenthetical trailer
# (`Accepted (CLOSED) — 2026-06-19`) by allowing `(...)` and `— YYYY-MM-DD`
# qualifiers after the value.
INLINE_STATUS_RE = re.compile(
    r"Status\s*:\s*\**\s*(?:\**\s*)?(?P<status>[A-Za-z][A-Za-z0-9_ \-/()\[\].|]*?)\**"
    r"\s*(?:\([^)]*\))?\s*(?:[—–-]\s*\d{4}-\d{2}-\d{2})?"
    r"(?:\s*\([^)]*\))?\s*$"
)
# Table-row format: `| **Status** | <value> |`. Same trailing-tolerance rules.
TABLE_STATUS_RE = re.compile(
    r"\|\s*\**\s*Status\s*\**\s*\|\s*\**\s*(?P<status>[A-Za-z][A-Za-z0-9_ \-/()\[\].|]*?)"
    r"\s*(?:\([^)]*\))?\s*(?:[—–-]\s*\d{4}-\d{2}-\d{2})?"
    r"(?:\s*\([^)]*\))?\s*\|"
)
DATE_INLINE_RE = re.compile(
    r"^\*?\*?Date\*?\*?\s*[:=]\s*(\d{4}-\d{2}-\d{2})",
    re.MULTILINE,
)


class AdrRecord(NamedTuple):
    """One row in the canonical ADR index."""

    adr_number: str  # e.g. "024", "050B"
    adr_id: str  # e.g. "ADR-024", "ADR-050B"
    title: str
    date: str  # ISO-8601 date, "YYYY-MM-DD", or "pre-wave" for root-level ADRs
    status: str
    crossref_count: int
    relpath: str  # path relative to REPO_ROOT


def _normalise_status(raw: str) -> str:
    """Map a raw `Status:` value to a canonical bucket.

    Canonical forms are uppercase: ACCEPTED, PROPOSED, SUPERSEDED, REJECTED,
    DEPRECATED, DRAFT, ACCEPTED (CLOSED), UNKNOWN. A value that doesn't
    fit a known bucket is returned upper-cased unchanged.
    """
    if not raw:
        return "UNKNOWN"
    s = raw.strip()
    upper = s.upper()
    for bucket in (
        "ACCEPTED",
        "PROPOSED",
        "SUPERSEDED",
        "REJECTED",
        "DEPRECATED",
        "DRAFT",
    ):
        if upper == bucket:
            return bucket
    if upper.startswith("ACCEPT"):
        return "ACCEPTED (CLOSED)" if "CLOSED" in upper else "ACCEPTED"
    if upper.startswith("PROPOS"):
        return "PROPOSED"
    if upper.startswith("SUPERSED"):
        return "SUPERSEDED"
    if upper.startswith("REJECT"):
        return "REJECTED"
    if upper.startswith("DEPRECAT"):
        return "DEPRECATED"
    if upper.startswith("DRAFT"):
        return "DRAFT"
    if upper.startswith("CLOSED"):
        return "ACCEPTED (CLOSED)"
    return upper


def discover_adr_files(adr_root: Path) -> list[Path]:
    """Find every ADR-*.md file under adr_root, excluding INDEX.md."""
    if not adr_root.exists():
        return []
    found: list[Path] = []
    for path in sorted(adr_root.rglob("ADR-*.md")):
        if path.name.upper() == "INDEX.MD":
            continue
        if not ADR_FILENAME_RE.match(path.name):
            continue
        found.append(path)
    return found


def parse_adr(path: Path, adr_root: Path) -> AdrRecord:
    """Parse one ADR file into an AdrRecord."""
    rel = path.relative_to(REPO_ROOT)
    m = ADR_FILENAME_RE.match(path.name)
    assert m is not None
    num, suffix = m.group(1), m.group(2)
    adr_id = f"ADR-{num}{suffix}"
    adr_number = f"{num}{suffix}"

    text = path.read_text(encoding="utf-8", errors="replace")

    # Title: first H1.
    title_match = H1_RE.search(text)
    if title_match:
        raw_title = title_match.group(1).strip()
        prefix_re = re.compile(rf"^ADR-\d+B?\s*[:—–-]\s*", re.IGNORECASE)
        cleaned = prefix_re.sub("", raw_title, count=1)
        title = cleaned.strip() or raw_title
    else:
        title = path.stem.split("-", 1)[-1].replace("-", " ").title()

    # Date: parent directory name if it matches YYYY-MM-DD; otherwise
    # "pre-wave" for root-level files.
    parent = path.parent
    if parent == adr_root:
        date_match = DATE_INLINE_RE.search(text)
        date = date_match.group(1) if date_match else "pre-wave"
    else:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", parent.name):
            date = parent.name
        else:
            date_match = DATE_INLINE_RE.search(text)
            date = date_match.group(1) if date_match else "unknown"

    # Status: scan line-by-line; table pattern first (unambiguous),
    # then inline pattern.
    status = "Unknown"
    for line in text.splitlines():
        tm = TABLE_STATUS_RE.search(line)
        if tm:
            status = tm.group("status").strip()
            break
        im = INLINE_STATUS_RE.search(line)
        if im:
            status = im.group("status").strip()
            break

    status = _normalise_status(status)

    # Cross-references: count of `ADR-###` or `ADR-###B` mentions in the
    # body that point to OTHER ADR numbers (outgoing references).
    self_id = adr_id.upper()
    self_base = f"ADR-{num}".upper()
    crossref_count = 0
    for ref in ADR_REF_RE.finditer(text):
        ref_num = ref.group(1)
        ref_id = f"ADR-{ref_num}{ref.group(2)}".upper()
        if ref_id == self_id:
            continue
        if ref_id == self_base:
            continue
        crossref_count += 1

    return AdrRecord(
        adr_number=adr_number,
        adr_id=adr_id,
        title=title,
        date=date,
        status=status,
        crossref_count=crossref_count,
        relpath=str(rel),
    )


def render_index(records: Iterable[AdrRecord], generated_at: _dt.datetime) -> str:
    """Render the canonical INDEX.md body."""
    recs = sorted(records, key=lambda r: (r.date, r.adr_number))
    total = len(recs)
    by_status: dict[str, int] = {}
    for r in recs:
        by_status[r.status.upper()] = by_status.get(r.status.upper(), 0) + 1

    status_summary = ", ".join(
        f"{count} {status}"
        for status, count in sorted(
            by_status.items(), key=lambda kv: (-kv[1], kv[0])
        )
    )

    lines: list[str] = []
    lines.append("# ADR Index — Canonical Cross-Reference")
    lines.append("")
    lines.append(
        "This is the **single canonical entry point** for every Architecture "
        "Decision Record in the `docs/adr/` tree. It is regenerated by "
        "`scripts/adr_index_gen.py`; do not hand-edit. The CI workflow "
        "`.github/workflows/adr-lint.yml` runs the generator on every PR "
        "that touches `docs/adr/**` or `scripts/adr_*.py` and fails if the "
        "committed `docs/adr/INDEX.md` is out of date."
    )
    lines.append("")
    lines.append(f"**Total ADRs indexed:** {total}")
    lines.append(f"**Status breakdown:** {status_summary}")
    lines.append("")
    lines.append(
        "Authority: v20 cycle-10 71-pillar plan § Track T1 (L1 Architecture "
        "ADR consolidation; score 2.5 → 3.0). Refresh cadence: weekly "
        "Monday 09:00 PDT (per ADR-041). The `adr-lint` workflow provides "
        "a per-PR freshness gate."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Index table (chronological, oldest first)")
    lines.append("")
    lines.append("| ADR# | Title | Date | Status | Cross-refs count |")
    lines.append("|------|-------|------|--------|------------------|")
    for r in recs:
        title = r.title
        if len(title) > 110:
            title = title[:107] + "..."
        title = title.replace("|", "\\|")
        link = f"[{r.adr_id}]({r.relpath})"
        lines.append(
            f"| {link} | {title} | {r.date} | {r.status} | "
            f"{r.crossref_count} |"
        )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## How to use this index")
    lines.append("")
    lines.append("- **Read an ADR.** Click the ADR link in the table to open the file.")
    lines.append(
        "- **Find cross-refs.** The `Cross-refs count` column counts outgoing "
        "ADR-### mentions in this ADR's body (siblings it cites). A high "
        "number (>10) means the ADR is load-bearing in the fleet — read it "
        "before changing it. Run "
        "`python3 scripts/adr_backlink_check.py --verbose` for the incoming "
        "direction (which ADRs cite this one)."
    )
    lines.append(
        "- **Check freshness.** The `adr-lint` CI workflow regenerates this "
        "file and fails if it differs from the committed version. Add a new "
        "ADR + regen = a clean PR."
    )
    lines.append(
        "- **Verify backlinks.** `python3 scripts/adr_backlink_check.py` "
        "walks every ADR file, extracts `ADR-###` mentions, and exits 1 if "
        "any reference points to a non-existent file. Run it locally "
        "before opening a PR."
    )
    lines.append("")
    lines.append("## Conventions")
    lines.append("")
    lines.append(
        "- ADR files live at `docs/adr/<YYYY-MM-DD>/ADR-NNN-slug.md` "
        "(preferred) or `docs/adr/ADR-NNN-slug.md` (legacy root-level; "
        "ADR-006..008 today)."
    )
    lines.append(
        "- Filename pattern: `ADR-<3-digit-number>(B?)-<kebab-slug>.md`. "
        "The optional `B` suffix is reserved for ADRs that disambiguate a "
        "series-number collision (e.g. ADR-050 router rebuild vs ADR-050 "
        "T12-closure)."
    )
    lines.append(
        "- Each ADR SHOULD have a `## Cross-references` section listing "
        "2-5 of the most-relevant sibling ADRs. The `adr-lint` workflow "
        "does not enforce this today; `adr_backlink_check.py --verbose` "
        "will report it as INFO."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        "<!-- generated: " + generated_at.isoformat(timespec="seconds") + " -->"
    )
    lines.append("<!-- source: scripts/adr_index_gen.py | do not edit by hand -->")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate the canonical docs/adr/INDEX.md from ADR files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output path (default: docs/adr/INDEX.md)",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=ADR_ROOT,
        help="ADR root directory (default: docs/adr)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if the file would change; do not write.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress the progress banner; useful for CI.",
    )
    args = parser.parse_args()

    if not args.root.exists():
        print(f"ERROR: {args.root} does not exist", file=sys.stderr)
        return 2

    files = discover_adr_files(args.root)
    if not args.quiet:
        print(
            f"[adr_index_gen] discovered {len(files)} ADR file(s) under "
            f"{args.root}"
        )

    records = [parse_adr(p, args.root) for p in files]
    generated_at = _dt.datetime.now(_dt.timezone.utc)
    body = render_index(records, generated_at)

    if args.check:
        existing = (
            args.out.read_text(encoding="utf-8") if args.out.exists() else ""
        )
        existing_normalized = re.sub(
            r"<!-- generated: .*? -->", "<!-- generated: ... -->", existing
        )
        new_normalized = re.sub(
            r"<!-- generated: .*? -->", "<!-- generated: ... -->", body
        )
        if existing_normalized == new_normalized:
            if not args.quiet:
                print(
                    f"[adr_index_gen] OK: {args.out} is up to date "
                    f"({len(records)} ADRs)"
                )
            return 0
        print(
            f"STALE: {args.out} would change. Run "
            f"`python3 scripts/adr_index_gen.py` to update.",
            file=sys.stderr,
        )
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(body, encoding="utf-8")
    if not args.quiet:
        print(
            f"[adr_index_gen] wrote {args.out} ({len(records)} ADRs, "
            f"{len(body)} bytes)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())