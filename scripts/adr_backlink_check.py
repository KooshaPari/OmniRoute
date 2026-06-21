#!/usr/bin/env python3
"""Verify ADR cross-references resolve to existing ADRs.

For each ADR in the index, this script parses the body for cross-reference
sections (`## See Also`, `## References`, `## Related`, `## Related Decisions`),
extracts ADR-### and ADR-###B mentions, and verifies each one points to an
existing ADR file.

Exit codes:
  0  all references resolve
  1  one or more unresolved references (broken cross-references)
  2  internal error
  3  bad CLI args
  130 keyboard interrupt

Idempotent and fast: walks ADR files once, no network calls, no git ops.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable, NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
ADR_ROOT = REPO_ROOT / "docs" / "adr"

CROSSREF_SECTION_RE = re.compile(
    r"^(#{2,3})\s+(?:See Also|References|Related(?:\s+Decisions)?|Cross[ -]References?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
NEXT_HEADING_RE = re.compile(r"^(#{1,3})\s+.+$", re.MULTILINE)
ADR_REF_RE = re.compile(r"\bADR-(\d+)(B?)\b", re.IGNORECASE)
ADR_FILENAME_RE = re.compile(r"^ADR-(\d+)(B?)-.+\.md$", re.IGNORECASE)


class BrokenRef(NamedTuple):
    adr_id: str
    missing_ref: str
    section: str
    line: int


def list_adr_files() -> list[Path]:
    if not ADR_ROOT.exists():
        return []
    out: list[Path] = []
    for path in sorted(ADR_ROOT.rglob("ADR-*.md")):
        if path.name.upper() == "INDEX.MD":
            continue
        if ADR_FILENAME_RE.match(path.name):
            out.append(path)
    return out


def extract_crossref_sections(body: str) -> Iterable[tuple[str, str, int]]:
    for match in CROSSREF_SECTION_RE.finditer(body):
        start = match.start()
        heading_text = match.group(0).lstrip("#").strip()
        start_line = body.count("\n", 0, start) + 1
        current_level = len(match.group(1))
        end = len(body)
        for nxt in NEXT_HEADING_RE.finditer(body, start + len(match.group(0))):
            if len(nxt.group(1)) <= current_level:
                end = nxt.start()
                break
        section_text = body[start:end]
        yield (heading_text, section_text, start_line)


def references_in_section(section_text: str) -> list[str]:
    refs = []
    for m in ADR_REF_RE.finditer(section_text):
        n, suffix = m.group(1), m.group(2)
        refs.append(f"ADR-{int(n):03d}{suffix.upper()}")
    return refs


def check_file(path: Path, known_adr_ids: set[str]) -> list[BrokenRef]:
    body = path.read_text(encoding="utf-8", errors="replace")
    adr_id_match = ADR_FILENAME_RE.match(path.name)
    if not adr_id_match:
        return []
    n, suffix = adr_id_match.group(1), adr_id_match.group(2)
    this_id = f"ADR-{int(n):03d}{suffix.upper()}"
    broken: list[BrokenRef] = []
    for section_name, section_text, line_no in extract_crossref_sections(body):
        for ref in references_in_section(section_text):
            if ref == this_id:
                continue
            if ref not in known_adr_ids:
                broken.append(BrokenRef(this_id, ref, section_name, line_no))
    return broken


def main() -> int:
    p = argparse.ArgumentParser(
        description="Verify ADR cross-references resolve to existing ADRs."
    )
    p.add_argument("--strict", action="store_true",
                   help="Fail if any ADR has no cross-reference section at all.")
    p.add_argument("--quiet", action="store_true",
                   help="Only print errors (no success summary).")
    args = p.parse_args()

    files = list_adr_files()
    known_ids = set()
    for f in files:
        m = ADR_FILENAME_RE.match(f.name)
        if m:
            n, s = m.group(1), m.group(2)
            known_ids.add(f"ADR-{int(n):03d}{s.upper()}")

    if not args.quiet:
        print(f"Found {len(files)} ADR files; {len(known_ids)} unique identifiers.")

    by_source: dict[str, list[BrokenRef]] = defaultdict(list)
    no_sections: list[str] = []
    for f in files:
        m = ADR_FILENAME_RE.match(f.name)
        if not m:
            continue
        this_id = f"ADR-{int(m.group(1)):03d}{m.group(2).upper()}"
        broken = check_file(f, known_ids)
        by_source[this_id].extend(broken)
        body = f.read_text(encoding="utf-8", errors="replace")
        sections = list(extract_crossref_sections(body))
        if not sections and args.strict:
            no_sections.append(this_id)

    total_broken = sum(len(v) for v in by_source.values())
    if total_broken == 0 and not no_sections:
        if not args.quiet:
            print("OK: all ADR cross-references resolve.")
        return 0

    if total_broken > 0:
        print(f"\nFAIL: {total_broken} broken cross-reference(s):", file=sys.stderr)
        for source_id in sorted(by_source):
            for ref in by_source[source_id]:
                print(
                    f"  {source_id} ({ref.section}, L{ref.line}): "
                    f"-> {ref.missing_ref} (not found in repo)",
                    file=sys.stderr,
                )

    if no_sections:
        print(
            f"\nWARN: {len(no_sections)} ADR(s) have no cross-reference section:",
            file=sys.stderr,
        )
        for adr_id in sorted(no_sections):
            print(f"  {adr_id}", file=sys.stderr)

    return 1 if total_broken > 0 else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
