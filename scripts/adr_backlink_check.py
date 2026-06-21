#!/usr/bin/env python3
r"""scripts/adr_backlink_check.py — Verify ADR cross-references resolve.

For each ADR file in `docs/adr/`, this script extracts every `ADR-\d+B?`
mention in the body and verifies that a corresponding ADR file exists in
the repository. It exits 0 if all references resolve, 1 if any do not,
and 2 on internal error.

Usage:
    python3 scripts/adr_backlink_check.py                  # exit 1 on broken refs
    python3 scripts/adr_backlink_check.py --verbose         # also print resolved refs
    python3 scripts/adr_backlink_check.py --quiet          # summary only
    python3 scripts/adr_backlink_check.py --strict         # fail if any ADR has zero refs

The script scans the WHOLE body of each ADR file, not just the
`## Cross-references` section. This catches inline mentions like
"Per ADR-024, the 71-pillar audit..." in the body as well as the curated
list at the bottom of each file.

A baseline file (`scripts/adr_backlink_baseline.txt`) lists known-broken
pairs from the v17+ monorepo consolidation so the CI gate does not fail
on legacy dangling references.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ADR_ROOT = REPO_ROOT / "docs" / "adr"
BASELINE_FILE = REPO_ROOT / "scripts" / "adr_backlink_baseline.txt"

# `ADR-NNN` or `ADR-NNNB`. Word-boundary so we don't match inside larger
# identifiers. Case-insensitive.
ADR_REF_RE = re.compile(r"\bADR-(\d+)(B?)\b", re.IGNORECASE)
ADR_FILENAME_RE = re.compile(r"^ADR-(\d+)(B?)-.+\.md$", re.IGNORECASE)


def list_adr_files(adr_root):
    if not adr_root.exists():
        return []
    out = []
    for path in sorted(adr_root.rglob("ADR-*.md")):
        if path.name.upper() == "INDEX.MD":
            continue
        if ADR_FILENAME_RE.match(path.name):
            out.append(path)
    return out


def normalise_id(num, suffix):
    return f"ADR-{int(num):03d}{suffix.upper()}"


def collect_references(path):
    m = ADR_FILENAME_RE.match(path.name)
    if not m:
        return "", []
    this_id = normalise_id(m.group(1), m.group(2))
    body = path.read_text(encoding="utf-8", errors="replace")
    refs = []
    for line_no, line in enumerate(body.splitlines(), start=1):
        for match in ADR_REF_RE.finditer(line):
            ref_id = normalise_id(match.group(1), match.group(2))
            if ref_id == this_id:
                continue
            refs.append((ref_id, line_no, line.strip()))
    return this_id, refs


def load_baseline(path):
    if not path.exists():
        return set()
    pairs = set()
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            src, tgt = line.split("|", 1)
            pairs.add((src.strip(), tgt.strip()))
    return pairs


def main():
    p = argparse.ArgumentParser(
        description="Verify ADR cross-references resolve to existing ADRs.",
    )
    p.add_argument("--root", type=Path, default=ADR_ROOT)
    p.add_argument("--baseline", type=Path, default=BASELINE_FILE)
    p.add_argument("--strict", action="store_true",
                   help="Also fail if any ADR has zero outgoing references.")
    p.add_argument("--quiet", action="store_true",
                   help="Suppress the success summary; print errors only.")
    p.add_argument("--verbose", action="store_true",
                   help="Print every resolved reference, not just broken ones.")
    args = p.parse_args()

    if not args.root.exists():
        print(f"ERROR: ADR root {args.root} does not exist", file=sys.stderr)
        return 2

    files = list_adr_files(args.root)
    baseline = load_baseline(args.baseline)

    known_ids = set()
    for f in files:
        m = ADR_FILENAME_RE.match(f.name)
        if m:
            known_ids.add(normalise_id(m.group(1), m.group(2)))

    all_refs = []
    broken = []
    no_refs = []

    for path in files:
        src_id, refs = collect_references(path)
        if args.strict and not refs:
            no_refs.append(src_id)
        for ref_id, line_no, line_text in refs:
            all_refs.append((path, src_id, ref_id, line_no, line_text))
            if ref_id not in known_ids:
                broken.append((path, src_id, ref_id, line_no, line_text))

    total_refs = len(all_refs)
    new_broken = [b for b in broken if (b[1], b[2]) not in baseline]
    baseline_broken = [b for b in broken if (b[1], b[2]) in baseline]

    if args.verbose:
        for path, src, ref, line, text in sorted(all_refs, key=lambda t: (t[1], t[2], t[3])):
            print(f"  {src} (L{line}): -> {ref}  | {text[:80]}")

    if not args.quiet:
        print(
            f"Found {len(files)} ADR files; {len(known_ids)} unique identifiers; "
            f"{total_refs} total references; "
            f"{len(broken)} broken ({len(new_broken)} new, "
            f"{len(baseline_broken)} baselined)."
        )

    if new_broken:
        print(
            f"\nFAIL: {len(new_broken)} NEW broken cross-reference(s) "
            f"(not in baseline):",
            file=sys.stderr,
        )
        for path, src, ref, line, text in sorted(new_broken, key=lambda x: (x[1], x[3])):
            print(
                f"  {src} ({path.name}:L{line}): -> {ref} (not found in repo)",
                file=sys.stderr,
            )
            print(f"      | {text[:100]}", file=sys.stderr)

    if baseline_broken and not args.quiet:
        print(
            f"\nINFO: {len(baseline_broken)} baselined broken reference(s) "
            f"(suppressed by {args.baseline}):"
        )
        for path, src, ref, line, text in sorted(baseline_broken, key=lambda x: (x[1], x[3])):
            print(f"  {src} (L{line}): -> {ref}", file=sys.stderr)

    if no_refs:
        print(
            f"\nFAIL (--strict): {len(no_refs)} ADR(s) have zero outgoing "
            f"cross-references:",
            file=sys.stderr,
        )
        for adr_id in sorted(no_refs):
            print(f"  {adr_id}", file=sys.stderr)

    if new_broken or no_refs:
        return 1

    if not args.quiet:
        print("\nOK: all ADR cross-references resolve.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
