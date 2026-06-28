#!/usr/bin/env python3
r"""scripts/adr_lint.py — ADR quality linter (v25 cycle-15 track T6, L60).

Authority: v25 cycle-15 plan, Track T6 (L60 — arch decision record quality,
target score 2.0 -> 2.5). See ``plans/2026-06-22-v25-71-pillar-cycle-15-p1.md``.

Purpose
-------
Walk every ``ADR-*.md`` file under ``docs/adr/`` (recursive, INDEX.md skipped)
and assert the canonical structure defined by
``docs/conventions/adr-quality-convention.md``::

    Filename  : ``^ADR-\d{3,4}([A-Z]+)?-<kebab-slug>\.md$``
    H1 title  : ``# ADR-<NNN>([A-Z]+)?<sep> <title>``  (sep in {:, ---, -})
    Sections  : ``## Status``, ``## Context``, ``## Decision``,
                ``## Consequences``  (warn-only when absent)
    Length    : <= 800 lines (warn-only when exceeded)
    Cross-ref : every ``ADR-NNN`` reference in body resolves to a sibling
                file under ``docs/adr/`` (warn-only when unresolved)
    Tone      : no ``TODO`` / ``FIXME`` markers inside the ``## Decision``
                section (warn-only when found)
    Date      : ``**Date:** YYYY-MM-DD`` somewhere in the first 30 lines

The tool prints a single human-readable table::

    ADR      | H1  | Status | Context | Decision | Consequences | LOC | Refs | Verdict
    ADR-024  | OK  | OK     | OK      | OK       | OK           | 144 | 8    | PASS
    ADR-094  | OK  | OK     | OK      | OK       | MISSING      | 67  | 3    | WARN

Exit codes::

    0  all files pass (no critical failures; warnings allowed)
    1  one or more files have a CRITICAL failure (H1 missing or malformed)
    2  bad CLI arguments / I/O error

A "critical failure" today is limited to H1 identity issues (the file's own
identifier). Missing sections, oversize length, unresolved cross-refs, and
tone markers are reported as WARNINGS — they are advisory, not blocking.

Usage
-----
    python3 scripts/adr_lint.py                  # lint every ADR under docs/adr/
    python3 scripts/adr_lint.py docs/adr/2026-06-22/
                                                  # lint a single wave
    python3 scripts/adr_lint.py --root docs/adr/ # explicit root
    python3 scripts/adr_lint.py --json           # machine-readable output
    python3 scripts/adr_lint.py --quiet          # summary line only

The linter is stdlib-only and requires Python 3.9+ (``from __future__ import
annotations`` + ``list[str] | None``-style type hints not required).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

# --- repo + scan configuration ------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ADR_ROOT = REPO_ROOT / "docs" / "adr"

# Required sections (per convention doc). Section detection is case-insensitive
# against a level-2 markdown heading (``## Foo``).
REQUIRED_SECTIONS: tuple[str, ...] = (
    "Status",
    "Context",
    "Decision",
    "Consequences",
)

# 800 lines per ADR per L60 convention doc.
MAX_ADR_LINES = 800

# Front-matter scan window for the Date: field.
DATE_SCAN_WINDOW = 30

# --- regex patterns -----------------------------------------------------------

# Filename: ADR-024-71-pillar-audit-framework.md or ADR-050B-router.md
# (optional letter suffix is the v8 sweep disambiguation token).
FILENAME_RE = re.compile(
    r"^ADR-(?P<num>\d{3,4})(?P<suffix>[A-Z]+)?-(?P<slug>[a-z0-9][a-z0-9-]*)\.md$"
)

# H1 title: ``# ADR-024: title`` or ``# ADR-024 — title`` or ``# ADR-024 - title``
H1_RE = re.compile(
    r"^#\s+ADR-(?P<num>\d{3,4})(?P<suffix>[A-Z]+)?\s*"
    r"(?P<sep>[:\u2014\-])\s*(?P<title>.+?)\s*$"
)

# Level-2 markdown heading: ``## Foo`` (with optional trailing whitespace).
H2_RE = re.compile(r"^##\s+(?P<name>[A-Za-z][A-Za-z0-9 _\-/]*?)\s*$")

# Cross-ref: ADR-024, ADR-050B. Does NOT match ADR-0, ADR-12 (must be >= 3 digits
# to avoid false positives on numeric lists). Word-boundary anchored.
CROSSREF_RE = re.compile(r"\bADR-(?P<num>\d{3,4})(?P<suffix>[A-Z]+)?\b")

# ``**Date:** YYYY-MM-DD`` (or ``**Date**:`` form, list-bullet tolerated).
DATE_INLINE_RE = re.compile(
    r"^\s*(?:[-*]\s+)?\**\s*Date\s*\**\s*[:=]\s*\**\s*"
    r"(?P<date>\d{4}-\d{2}-\d{2})",
    re.IGNORECASE,
)

# Inline bold front-matter field: ``**Status:** ACCEPTED`` or ``**Status**: ACCEPTED``.
# Accepts list-bullet prefix and optional parenthetical trailers.
INLINE_FIELD_RE = re.compile(
    r"^\s*(?:[-*]\s+)?\**\s*"
    r"(?P<name>Status|Context|Decision|Consequences|L[- ]?number|L[- ]?level|L5|"
    r"Cross[- ]?refs?|Disposition|Owner)\s*\**\s*[:=]\s*\**",
    re.IGNORECASE,
)

# Fenced code-block fence.
CODE_FENCE_RE = re.compile(r"^\s*(```|~~~)")


def _is_inline_field(line: str, name: str) -> bool:
    """Return True if ``line`` is an inline bold field for the given section name.

    Examples (all match ``name="Status"``):
        ``**Status:** ACCEPTED``
        ``**Status**: ACCEPTED``
        ``- **Status**: ACCEPTED``
    """
    m = INLINE_FIELD_RE.match(line)
    if m is None:
        return False
    return m.group("name").strip().lower() == name.lower()


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------


def _mk_row(
    adr_id: str,
    h1: str,
    sections: str,
    loc: int,
    refs: str,
    verdict: str,
    issues: list[str],
) -> dict[str, object]:
    """Build the row dict used by both human and JSON output."""
    return {
        "adr": adr_id,
        "h1": h1,
        "sections": sections,
        "loc": loc,
        "refs": refs,
        "verdict": verdict,
        "issues": list(issues),
    }


def _parse_filename(path: Path) -> tuple[str, str | None, str] | None:
    """Return (num, suffix, slug) if the filename matches, else None."""
    m = FILENAME_RE.match(path.name)
    if m is None:
        return None
    return (m.group("num"), m.group("suffix"), m.group("slug"))


# -----------------------------------------------------------------------------
# Lint logic for one ADR
# -----------------------------------------------------------------------------


def _strip_code_fences(lines: list[str]) -> list[str]:
    """Return ``lines`` with fenced code blocks replaced by blank placeholders.

    Cross-references inside code blocks should not be lint-checked (they may
    be example text or quoted ADR numbers). We preserve line indices so the
    caller can map back to the original line numbers if needed.
    """
    out: list[str] = []
    in_fence = False
    fence_marker: str | None = None
    for line in lines:
        m = CODE_FENCE_RE.match(line)
        if m is not None:
            marker = m.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
                out.append("")
            elif fence_marker is not None and line.lstrip().startswith(
                fence_marker
            ):
                in_fence = False
                fence_marker = None
                out.append("")
            else:
                out.append("")
        elif in_fence:
            out.append("")
        else:
            out.append(line)
    return out


def _section_marker(line: str) -> str | None:
    """Return the section name if ``line`` is a level-2 heading, else None."""
    m = H2_RE.match(line)
    if m is None:
        return None
    return m.group("name").strip().lower()


def _extract_decision_body(lines: list[str]) -> list[str]:
    """Return the body lines that sit between ``## Decision`` and the next H2.

    Used for tone scanning (TODO/FIXME markers). If ``## Decision`` is absent,
    returns an empty list — there is nothing to scan.
    """
    out: list[str] = []
    in_decision = False
    for line in lines:
        marker = _section_marker(line)
        if marker is not None:
            if marker == "decision":
                in_decision = True
                continue
            if in_decision:
                # Next H2 reached — stop.
                break
            # Some other H2 before Decision — keep scanning.
            continue
        if in_decision:
            out.append(line)
    return out


def lint_one(path: Path, known_adr_ids: set[str]) -> dict[str, object]:
    """Lint a single ADR file. Never raises; returns the row dict.

    ``known_adr_ids`` is the set of canonical ADR identifiers built from the
    filename scan (e.g. ``{"ADR-024", "ADR-050B"}``).
    """
    rel = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
    rel_str = rel.as_posix()

    # 1. Filename pattern.
    parsed = _parse_filename(path)
    if parsed is None:
        return _mk_row(
            adr_id=path.name,
            h1="FAIL",
            sections="-",
            loc=0,
            refs="0",
            verdict="FAIL",
            issues=[f"FILENAME: does not match ADR-<NNN>([A-Z]+)?-<slug>.md"],
        )

    num, suffix, slug = parsed
    adr_id = f"ADR-{num}{suffix or ''}"

    # 2. Read body.
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return _mk_row(
            adr_id=adr_id,
            h1="FAIL",
            sections="-",
            loc=0,
            refs="0",
            verdict="FAIL",
            issues=[f"READ_ERROR: {exc}"],
        )

    raw_lines = text.splitlines()
    lines = _strip_code_fences(raw_lines)
    loc = len(raw_lines)
    issues: list[str] = []

    # 3. H1 title.
    h1_status = "OK"
    h1_line = raw_lines[0] if raw_lines else ""
    m_h1 = H1_RE.match(h1_line)
    if not m_h1:
        h1_status = "FAIL"
        issues.append(
            f"H1: first line {h1_line!r} does not match "
            f"'# ADR-{num}{suffix or ''}<sep> <title>'"
        )

    # 4. Required sections. Accept EITHER a level-2 markdown heading
    # (``## Foo``) OR an inline bold field (``**Foo:** value``). The H2
    # form is canonical; the inline form is tolerated for legacy ADRs.
    found_sections: set[str] = set()
    for line in lines:
        marker = _section_marker(line)
        if marker is not None:
            found_sections.add(marker)
    section_marks = []
    for req in REQUIRED_SECTIONS:
        if req.lower() in found_sections:
            section_marks.append("OK")
        else:
            # Fall back: look for the inline ``**Req:**`` field anywhere in
            # the front-matter (first 30 lines).
            inline_found = any(
                _is_inline_field(line, req) for line in raw_lines[:DATE_SCAN_WINDOW]
            )
            if inline_found:
                section_marks.append("OK*")  # OK via inline field (non-canonical)
            else:
                section_marks.append("MISSING")
                issues.append(f"SECTION_MISSING: ## {req} not found")
    sections_str = "/".join(section_marks)

    # 5. Length.
    if loc > MAX_ADR_LINES:
        issues.append(f"LENGTH: {loc} lines exceeds max {MAX_ADR_LINES}")

    # 6. Cross-refs. Scan lines after the H1.
    crossrefs_total = 0
    crossrefs_unresolved: list[str] = []
    for line in lines[1:]:
        for m in CROSSREF_RE.finditer(line):
            ref_id = f"ADR-{m.group('num')}{m.group('suffix') or ''}"
            crossrefs_total += 1
            if ref_id == adr_id:
                # self-reference — OK (often appears in "see ADR-024" links)
                continue
            if ref_id not in known_adr_ids:
                crossrefs_unresolved.append(ref_id)
    if crossrefs_unresolved:
        # Dedup + sort for stable output.
        uniq = sorted(set(crossrefs_unresolved))
        issues.append(
            f"CROSSREF_UNRESOLVED: {len(uniq)} reference(s) not found as "
            f"sibling ADR file: {', '.join(uniq[:5])}"
            + (" ..." if len(uniq) > 5 else "")
        )

    # 7. Tone scan inside ## Decision.
    decision_body = _extract_decision_body(lines)
    decision_text = "\n".join(decision_body)
    bad_markers: list[str] = []
    for marker in ("TODO", "FIXME"):
        if re.search(rf"\b{marker}\b", decision_text):
            bad_markers.append(marker)
    if bad_markers:
        issues.append(
            f"TONE: TODO/FIXME markers found in ## Decision: "
            f"{', '.join(bad_markers)}"
        )

    # 8. Date format in first 30 lines.
    date_ok = False
    for line in raw_lines[:DATE_SCAN_WINDOW]:
        if DATE_INLINE_RE.match(line):
            date_ok = True
            break
    if not date_ok:
        issues.append(
            f"DATE_MISSING: no 'Date: YYYY-MM-DD' in first "
            f"{DATE_SCAN_WINDOW} lines"
        )

    # 9. Verdict.
    has_critical = h1_status != "OK"
    refs_str = (
        f"{crossrefs_total}"
        if not crossrefs_unresolved
        else f"{crossrefs_total} ({len(set(crossrefs_unresolved))} unresolved)"
    )
    if has_critical:
        verdict = "FAIL"
    elif issues:
        verdict = "WARN"
    else:
        verdict = "PASS"

    return _mk_row(
        adr_id=adr_id,
        h1=h1_status,
        sections=sections_str,
        loc=loc,
        refs=refs_str,
        verdict=verdict,
        issues=issues,
    )


# -----------------------------------------------------------------------------
# Discovery + output formatting
# -----------------------------------------------------------------------------


def discover_adr_files(root: Path) -> list[Path]:
    """Return every ``ADR-*.md`` under ``root``, sorted, INDEX.md skipped."""
    if not root.exists():
        return []
    if root.is_file():
        if root.name.upper() == "INDEX.MD":
            return []
        return [root]
    files: list[Path] = []
    for path in sorted(root.rglob("ADR-*.md")):
        if path.name.upper() == "INDEX.MD":
            continue
        files.append(path)
    return files


def build_known_adr_ids(files: Iterable[Path]) -> set[str]:
    """Build the canonical set of ADR identifiers from filenames."""
    ids: set[str] = set()
    for f in files:
        parsed = _parse_filename(f)
        if parsed is None:
            continue
        num, suffix, _slug = parsed
        ids.add(f"ADR-{num}{suffix or ''}")
    return ids


def _render_human_table(rows: list[dict[str, object]]) -> str:
    """Render the rows as a fixed-width table.

    Columns: ADR | H1 | Status | Context | Decision | Consequences | LOC | Refs | Verdict
    """
    if not rows:
        return "[adr_lint] no ADR files found"
    header = (
        "ADR",
        "H1",
        "Status",
        "Context",
        "Decision",
        "Consequences",
        "LOC",
        "Refs",
        "Verdict",
    )
    body: list[tuple[str, ...]] = []
    for r in rows:
        sec_str = str(r["sections"])
        # Split "OK/OK/OK/OK" into 4 fields.
        parts = sec_str.split("/")
        while len(parts) < 4:
            parts.append("-")
        body.append(
            (
                str(r["adr"]),
                str(r["h1"]),
                parts[0],
                parts[1],
                parts[2],
                parts[3],
                str(r["loc"]),
                str(r["refs"]),
                str(r["verdict"]),
            )
        )

    widths = [max(len(h), *(len(row[i]) for row in body)) for i, h in enumerate(header)]
    sep = "-+-".join("-" * w for w in widths)
    head_line = " | ".join(h.ljust(widths[i]) for i, h in enumerate(header))

    out: list[str] = [head_line, sep]
    for row in body:
        out.append(
            " | ".join(c.ljust(widths[i]) for i, c in enumerate(row))
        )
    return "\n".join(out)


def _render_human_report(rows: list[dict[str, object]], root: Path) -> str:
    """Render the full human-readable report (table + per-file issues + summary)."""
    out: list[str] = []
    out.append(f"[adr_lint] scanning {root.as_posix()} (recursive)")
    out.append("")
    out.append(_render_human_table(rows))
    out.append("")

    # Per-file detail (only for non-PASS rows).
    failed = [r for r in rows if r["verdict"] != "PASS"]
    if failed:
        out.append("Detail (FAIL/WARN only):")
        for r in failed:
            out.append(f"  [{r['verdict']}] {r['adr']}")
            for issue in r["issues"]:  # type: ignore[union-attr]
                out.append(f"    - {issue}")
        out.append("")

    counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
    for r in rows:
        counts[str(r["verdict"])] += 1
    total = len(rows)
    out.append(
        f"[adr_lint] {total} files: "
        f"{counts['PASS']} pass, {counts['WARN']} warn, {counts['FAIL']} fail"
    )
    return "\n".join(out)


def _render_json_report(rows: list[dict[str, object]], root: Path) -> str:
    counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
    for r in rows:
        counts[str(r["verdict"])] += 1
    payload = {
        "tool": "adr_lint",
        "version": "1.0.0",
        "root": root.as_posix(),
        "summary": {
            "total": len(rows),
            "pass": counts["PASS"],
            "warn": counts["WARN"],
            "fail": counts["FAIL"],
        },
        "results": rows,
    }
    return json.dumps(payload, indent=2, sort_keys=True)


# -----------------------------------------------------------------------------
# CLI entry point
# -----------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Lint Architecture Decision Records (ADRs) under docs/adr/ "
            "for canonical structure (L60 — ADR quality)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "roots",
        nargs="*",
        type=Path,
        default=[DEFAULT_ADR_ROOT],
        help="ADR root(s) to lint (default: docs/adr/)",
    )
    parser.add_argument(
        "--root",
        dest="root_explicit",
        type=Path,
        default=None,
        help="explicit single ADR root (overrides positional roots)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="emit JSON instead of human-readable text",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="suppress per-file detail; print only the summary line",
    )
    args = parser.parse_args(argv)

    roots: list[Path]
    if args.root_explicit is not None:
        roots = [args.root_explicit]
    elif args.roots:
        roots = list(args.roots)
    else:
        roots = [DEFAULT_ADR_ROOT]

    files: list[Path] = []
    for r in roots:
        if not r.exists():
            print(f"ERROR: {r} does not exist", file=sys.stderr)
            return 2
        files.extend(discover_adr_files(r))

    if not files:
        if args.json_output:
            print(
                json.dumps(
                    {
                        "tool": "adr_lint",
                        "version": "1.0.0",
                        "summary": {"total": 0, "pass": 0, "warn": 0, "fail": 0},
                        "results": [],
                    }
                )
            )
        else:
            print(f"[adr_lint] no ADR files found under {[r.as_posix() for r in roots]}")
        return 0

    known_ids = build_known_adr_ids(files)
    rows: list[dict[str, object]] = []
    for f in files:
        rows.append(lint_one(f, known_ids))

    if args.json_output:
        print(_render_json_report(rows, roots[0]))
    elif args.quiet:
        counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
        for r in rows:
            counts[str(r["verdict"])] += 1
        total = len(rows)
        print(
            f"[adr_lint] {total} files: "
            f"{counts['PASS']} pass, {counts['WARN']} warn, "
            f"{counts['FAIL']} fail"
        )
    else:
        print(_render_human_report(rows, roots[0]))

    return 1 if any(r["verdict"] == "FAIL" for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
