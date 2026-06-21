#!/usr/bin/env python3
"""
adr_index_gen.py - Regenerate docs/adr/INDEX.md (chronological table).

Scans docs/adr/**/*.md for ADR files, extracts ADR number, title, status,
date, scope summary, and supersedes-link from each, and writes a single
chronological Markdown table to docs/adr/INDEX.md.

Status values are normalized to one of: PROPOSED, ACCEPTED, SUPERSEDED,
ACCEPTED (CLOSED), or the raw value if unrecognized. The pillar-grouped
view (hand-curated) lives at docs/adr/INDEX-by-pillar.md; this script
writes only the chronological table.

Usage:
    python3 scripts/adr_index_gen.py [--root PATH] [--out PATH]

Exit 0 on success, 2 on I/O error.
"""
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ADR_NUM_RE = re.compile(r"ADR-(\d{3})")
H1_RE = re.compile(r"^#\s+ADR-\d+[^\n]*", re.MULTILINE)
STATUS_RE = re.compile(
    r"\*\*\s*Status\*\*?\s*[:|]\s*\*?\*?([A-Za-z][A-Za-z0-9 ()/—\-]*)", re.MULTILINE
)
DATE_RE = re.compile(r"\*\*\s*Date\*\*?\s*[:|]\s*\*?\*?(\d{4}-\d{2}-\d{2})", re.MULTILINE)
SUPERSEDES_RE = re.compile(r"\*\*\s*Supersedes\*\*?\s*[:|]\s*([^\n]+)")
SUMMARY_RE = re.compile(r"^##\s+Context\s*\n+([^\n#][^\n]*)", re.MULTILINE)


def parse_adr(path: Path):
    """Return dict for one ADR file, or None if filename is not an ADR."""
    m = ADR_NUM_RE.search(path.name)
    if not m:
        return None
    num = int(m.group(1))
    text = path.read_text(encoding="utf-8", errors="replace")

    h1 = H1_RE.search(text)
    title = h1.group(0).lstrip("# ").strip() if h1 else path.stem
    title = re.sub(r"^ADR-\d+[\s:—\-]+", "", title).strip()

    status = STATUS_RE.search(text)
    status_raw = status.group(1).strip() if status else "UNKNOWN"

    date = DATE_RE.search(text)
    date_str = date.group(1) if date else ""

    sup = SUPERSEDES_RE.search(text)
    sup_str = sup.group(1).strip() if sup else ""

    sm = SUMMARY_RE.search(text)
    summary = " ".join(sm.group(1).split())[:240] if sm else ""

    return {
        "num": num,
        "title": title,
        "status": status_raw,
        "date": date_str,
        "summary": summary,
        "supersedes": sup_str,
        "rel_path": str(path),
    }


def normalize_status(s: str) -> str:
    """Map raw status text to a canonical display value."""
    u = s.upper()
    if "SUPERSEDED" in u:
        return "SUPERSEDED"
    if "PROPOSED" in u:
        return "PROPOSED"
    if "ACCEPTED" in u or "CLOSED" in u:
        return "ACCEPTED" if "CLOSED" not in u else "ACCEPTED (CLOSED)"
    return s


def render_table(rows, root):
    """Return the full chronological INDEX.md body as a single string."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# ADR Index - Chronological Cross-Reference",
        "",
        f"**Generated:** {now}  ",
        f"**Source:** {len(rows)} ADR file(s) under `{root}/`  ",
        "**Generator:** `scripts/adr_index_gen.py` (v20 T1)  ",
        "**Pillar-grouped view:** `docs/adr/INDEX-by-pillar.md` (hand-curated)  ",
        "**Backlink validator:** `scripts/adr_backlink_check.py`  ",
        "",
        "## Master Table",
        "",
        "| # | ADR | Date | Status | Title | Scope summary | Supersedes |",
        "|---:|-----|------|--------|-------|---------------|------------|",
    ]
    for r in rows:
        s = normalize_status(r["status"])
        summary = r["summary"].replace("|", "\\|")
        sup = r["supersedes"].replace("|", "\\|") or "-"
        title = r["title"][:80].replace("|", "\\|")
        lines.append(
            f"| {r['num']:03d} | "
            f"[{r['num']:03d}]({r['rel_path']}) | "
            f"{r['date']} | {s} | {title} | "
            f"{summary[:200]} | {sup[:60]} |"
        )
    lines.extend([
        "",
        "---",
        "",
        "## Notes",
        "",
        "- This file is **auto-generated** by `scripts/adr_index_gen.py`. "
        "Do not edit by hand; the `adr-lint` CI workflow fails if it "
        "drifts from the on-disk ADRs.",
        "- The hand-curated **pillar-grouped** view lives at "
        "`docs/adr/INDEX-by-pillar.md` (per ADR-024 + ADR-041; cadence: "
        "weekly Mon 09:00 PDT).",
        "- ADR numbers may collide across date directories (e.g. ADR-077 "
        "in `2026-06-20/` is SLSA, ADR-077 in `2026-06-21/` is Vault). "
        "Disambiguation is by file path.",
        "- Cross-references in ADR bodies are validated by "
        "`scripts/adr_backlink_check.py` (run on every ADR-touching PR).",
        "",
        f"<!-- generated: {now} by scripts/adr_index_gen.py -->",
    ])
    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--root", default="docs/adr", help="ADR root directory")
    p.add_argument("--out", default="docs/adr/INDEX.md", help="Output path")
    p.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if --out would change; do not write the file",
    )
    args = p.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        print(f"ERROR: ADR root {root} does not exist", file=sys.stderr)
        return 2

    files = sorted(root.rglob("ADR-*.md"))
    rows = [r for r in (parse_adr(f) for f in files) if r is not None]
    rows.sort(key=lambda r: (r["num"], r["rel_path"]))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.check:
        # Build the would-be table only and compare against existing file
        new_text = render_table(rows, args.root)
        existing = out.read_text(encoding="utf-8", errors="replace") if out.exists() else ""
        if new_text != existing:
            print(f"STALE: {out} would change ({len(rows)} ADR rows).", file=sys.stderr)
            return 1
        print(f"OK: {out} is fresh ({len(rows)} ADR rows).")
        return 0

    out.write_text(render_table(rows, args.root) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(rows)} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
