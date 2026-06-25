#!/usr/bin/env python3
"""L38 ADR index auto-refresh gate (v28 cycle-18 T3).

Walks docs/adr/ for ADR-NNN-*.md files, parses the frontmatter header
(title / status / date) for each, and checks that every ADR number is
referenced from the master ADR index. Also enforces a 30-day freshness
window on the index's "Last updated" stamp.

The master index is `docs/adr/INDEX.md`; falls back to `ADR.md` at the
repo root when no INDEX.md exists. Per-wave indices under
`docs/adr/<date>/INDEX.md` are informational only and not gate-checked
(the master index is the single source of truth).

Stdlib only, Python 3.9+.

Usage:
    # CI gate mode (default exit codes)
    python3 tools/adr-index-check/adr_index_check.py check [--root <path>]

    # List mode (dump parsed ADRs)
    python3 tools/adr-index-check/adr_index_check.py list [--root <path>]

    # JSON output for CI consumption
    python3 tools/adr-index-check/adr_index_check.py check --json

Exit codes:
    0  -- index is fresh and contains every ADR
    1  -- gate failure (missing entries, stale index, or duplicate numbers)
    2  -- usage / I/O error (missing root, bad args, no ADRs found)
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as _dt
import json
import re
import sys
from pathlib import Path

SCHEMA_VERSION = "1.0"
FRESHNESS_DAYS = 30

# ADR filename: ADR-NNN-*.md  (NNN is 3+ digits; optional trailing letter
# for variants like ADR-035B, ADR-036B)
ADR_STEM_RE = re.compile(r"^ADR-(\d+)([A-Z]?)(?:-(.+))?$")
INDEX_REF_RE = re.compile(r"ADR-(\d+)([A-Z]?)")

# Header lines we parse from each ADR (Markdown-style, not YAML).
STATUS_LINE_RE = re.compile(r"^\*\*Status:\*\*\s*(.+?)\s*$", re.IGNORECASE)
DATE_LINE_RE = re.compile(r"^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$", re.IGNORECASE)
TITLE_LINE_RE = re.compile(r"^#\s+ADR-(\d+)([A-Z]?)\b[^\n]*$")

# "Last updated" stamp patterns (a few shapes are accepted).
LAST_UPDATED_RES = (
    re.compile(r"\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE),
    re.compile(r"\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE),
    re.compile(r"_Last updated:\s*(\d{4}-\d{2}-\d{2})_", re.IGNORECASE),
)


@dataclasses.dataclass
class AdrRecord:
    number: int          # 35, 36, ...
    variant: str         # "" or "B"
    stem: str            # "ADR-035-configra-migration-gates"
    title: str
    status: str
    date: str            # YYYY-MM-DD or ""
    path: str            # repo-relative POSIX path

    @property
    def number_id(self) -> str:
        return f"ADR-{self.number:03d}{self.variant}"

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class GateReport:
    schema_version: str
    generated_at: str
    adr_dir: str
    index_path: str
    freshness_days: int
    summary: dict
    missing: list[str]
    stale_index: bool
    last_updated: str
    duplicates: list[str]
    records: list[dict]

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


def _iter_adr_files(adr_dir: Path) -> list[Path]:
    """Return ADR-NNN-*.md files under adr_dir (root + per-wave subdirs).

    Skips INDEX.md and per-wave sub-aggregates -- we only consider
    individual ADR documents.
    """
    if not adr_dir.exists():
        return []
    out: list[Path] = []
    for p in sorted(adr_dir.glob("ADR-*.md")):
        if not p.is_file():
            continue
        # Skip nested ADR-*.md accidentally placed under non-date subdirs
        # (date subdirs are fine; we walk them too).
        out.append(p)
    for sub in sorted(p for p in adr_dir.iterdir() if p.is_dir()):
        for p in sorted(sub.glob("ADR-*.md")):
            if p.is_file():
                out.append(p)
    return out


def _parse_adr(path: Path, repo_root: Path) -> AdrRecord | None:
    stem = path.stem
    m = ADR_STEM_RE.match(stem)
    if not m:
        return None
    number = int(m.group(1))
    variant = m.group(2) or ""

    title = ""
    status = ""
    date = ""
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for _ in range(80):  # parse top 80 lines only
                line = f.readline()
                if not line:
                    break
                if not title:
                    tm = TITLE_LINE_RE.match(line)
                    if tm:
                        title = line[2:].strip()
                        continue
                if not status:
                    sm = STATUS_LINE_RE.match(line)
                    if sm:
                        status = sm.group(1).strip()
                if not date:
                    dm = DATE_LINE_RE.match(line)
                    if dm:
                        date = dm.group(1).strip()
                if title and status and date:
                    break
    except OSError:
        pass

    if not title:
        title = stem.replace("-", " ")

    rel = path.relative_to(repo_root).as_posix() if repo_root in path.parents or path == repo_root else str(path)
    return AdrRecord(
        number=number,
        variant=variant,
        stem=stem,
        title=title,
        status=status,
        date=date,
        path=rel,
    )


def _find_index(adr_dir: Path, repo_root: Path) -> Path | None:
    """Master index: docs/adr/INDEX.md, falling back to ADR.md at repo root."""
    candidates = [
        adr_dir / "INDEX.md",
        repo_root / "ADR.md",
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def _extract_last_updated(text: str) -> str:
    for pat in LAST_UPDATED_RES:
        m = pat.search(text)
        if m:
            return m.group(1)
    return ""


def _is_stale(last_updated: str, now: _dt.date, days: int) -> bool:
    if not last_updated:
        return True
    try:
        d = _dt.date.fromisoformat(last_updated)
    except ValueError:
        return True
    return (now - d).days > days


def _index_mentions(text: str) -> set[str]:
    """Return the set of ADR number ids referenced in `text` (e.g. ADR-035, ADR-035B)."""
    found: set[str] = set()
    for m in INDEX_REF_RE.finditer(text):
        n = int(m.group(1))
        v = m.group(2) or ""
        found.add(f"ADR-{n:03d}{v}")
    return found


def render_summary(report: GateReport) -> str:
    r = report
    s = r.summary
    lines = [f"# L38 ADR index check -- {r.generated_at}", ""]
    lines.append(
        f"ADRs found: {s['total']}  In index: {s['in_index']}  "
        f"Missing: {s['missing']}  Duplicates: {s['duplicates']}  "
        f"Stale index: {r.stale_index}"
    )
    if r.last_updated:
        lines.append(f"Index last updated: {r.last_updated} (freshness: {r.freshness_days}d)")
    lines.append("")
    for adr in sorted(s["referenced"]):
        lines.append(f"- present  {adr}")
    for adr in r.missing:
        lines.append(f"- MISSING  {adr}")
    for adr in r.duplicates:
        lines.append(f"- DUP      {adr}")
    if r.stale_index:
        lines.append("")
        lines.append(
            f"ACTION: bump 'Last updated' stamp in {r.index_path} "
            f"(must be within {r.freshness_days} days of today)"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="L38 ADR index auto-refresh gate")
    ap.add_argument(
        "--root",
        default=".",
        help="repo root (default: cwd)",
    )
    ap.add_argument(
        "--adr-dir",
        default="docs/adr",
        help="ADR directory relative to --root (default: docs/adr)",
    )
    ap.add_argument(
        "--freshness-days",
        type=int,
        default=FRESHNESS_DAYS,
        help=f"max age of index 'Last updated' stamp (default: {FRESHNESS_DAYS})",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="verify the index covers every ADR + freshness")
    sub.add_parser("list", help="list parsed ADRs (no index check)")

    for s in (sub.choices["check"], sub.choices["list"]):
        s.add_argument("--json", action="store_true", help="emit JSON to stdout")
        s.add_argument("--summary", action="store_true", help="emit markdown summary")
        s.add_argument("--output", "-o", help="write JSON report to file")

    args = ap.parse_args()
    root = Path(args.root).resolve()
    adr_dir = (root / args.adr_dir).resolve()

    if not root.is_dir():
        print(f"root not found: {root}", file=sys.stderr)
        return 2
    if not adr_dir.is_dir():
        print(f"ADR directory not found: {adr_dir}", file=sys.stderr)
        return 2

    adr_files = _iter_adr_files(adr_dir)
    if not adr_files:
        print(f"no ADR files found under {adr_dir}", file=sys.stderr)
        return 2

    records: list[AdrRecord] = []
    for p in adr_files:
        rec = _parse_adr(p, root)
        if rec is not None:
            records.append(rec)

    if args.cmd == "list":
        out = {"schema_version": SCHEMA_VERSION, "count": len(records),
               "records": [r.to_dict() for r in records]}
        if args.json or args.output:
            payload = json.dumps(out, indent=2)
            if args.output:
                Path(args.output).write_text(payload)
                print(f"wrote {args.output}", file=sys.stderr)
            else:
                sys.stdout.write(payload)
        else:
            for r in records:
                status = r.status or "unknown"
                date = r.date or "?"
                print(f"{r.number_id:<10} {date}  {status:<10}  {r.path}")
            print(f"total: {len(records)}")
        return 0

    # cmd == "check"
    index_path = _find_index(adr_dir, root)
    if index_path is None:
        print(
            f"no master index found (looked for {adr_dir / 'INDEX.md'} "
            f"and {root / 'ADR.md'})",
            file=sys.stderr,
        )
        return 2

    try:
        index_text = index_path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        print(f"failed to read index {index_path}: {e}", file=sys.stderr)
        return 2

    today = _dt.datetime.now(_dt.timezone.utc).date()
    last_updated = _extract_last_updated(index_text)
    stale = _is_stale(last_updated, today, args.freshness_days)

    # Detect duplicate ADR numbers (e.g. ADR-035 in two waves).
    by_id: dict[str, list[AdrRecord]] = {}
    for r in records:
        by_id.setdefault(r.number_id, []).append(r)
    duplicates = sorted(nid for nid, recs in by_id.items() if len(recs) > 1)

    # Required: every ADR appears in the index. We treat the index as
    # authoritative -- if it doesn't mention ADR-035, that's a miss.
    referenced = _index_mentions(index_text)
    missing = sorted(r.number_id for r in records if r.number_id not in referenced)

    in_index = len(records) - len(missing)
    summary = {
        "total": len(records),
        "in_index": in_index,
        "missing": len(missing),
        "duplicates": len(duplicates),
        "referenced": sorted(referenced),
    }

    report = GateReport(
        schema_version=SCHEMA_VERSION,
        generated_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        adr_dir=str(adr_dir.relative_to(root)) if adr_dir.is_relative_to(root) else str(adr_dir),
        index_path=str(index_path.relative_to(root)) if index_path.is_relative_to(root) else str(index_path),
        freshness_days=args.freshness_days,
        summary=summary,
        missing=missing,
        stale_index=stale,
        last_updated=last_updated,
        duplicates=duplicates,
        records=[r.to_dict() for r in records],
    )

    failed = bool(missing) or stale or bool(duplicates)
    if args.summary:
        sys.stdout.write(render_summary(report))
    elif args.json or args.output:
        out = json.dumps(report.to_dict(), indent=2)
        if args.output:
            Path(args.output).write_text(out)
            print(f"wrote {args.output}", file=sys.stderr)
        else:
            sys.stdout.write(out)
    else:
        for r in sorted(records, key=lambda x: (x.number, x.variant)):
            mark = "OK  " if r.number_id in referenced else "MISS"
            print(f"{mark} {r.number_id:<10} {r.path}")
        print(
            f"summary: {in_index}/{len(records)} in index, "
            f"{len(missing)} missing, stale_index={stale}, "
            f"last_updated={last_updated or '(none)'}"
        )
        if failed:
            if missing:
                print(f"remediation: add entries to {report.index_path}: {', '.join(missing)}")
            if stale:
                print(
                    f"remediation: update 'Last updated' stamp in {report.index_path} "
                    f"(must be within {args.freshness_days} days of {today.isoformat()})"
                )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())