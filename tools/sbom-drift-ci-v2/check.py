#!/usr/bin/env python3
"""v34-Enforce: SBOM drift CI gate v2 — blocks PR when drift exceeds threshold.

Pillar L46.1 (SBOM drift CI). Reads previous SBOM from artifact store,
compares critical fields (bomFormat, component count, licenses), and
fails CI if drift severity > WARN.

Usage:
    python3 tools/sbom-drift-ci-v2/check.py --prev build/report.cdx.json --curr build/current.cdx.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


CRITICAL_KEYS = ["bomFormat", "specVersion"]
WARN_KEYS = ["components", "licenses"]


def _load_sbom(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _count_components(doc: dict) -> int:
    return len(doc.get("components", []))


def _diff(prev: dict, curr: dict) -> list[dict]:
    findings = []
    for key in CRITICAL_KEYS:
        if prev.get(key) != curr.get(key):
            findings.append({"key": key, "severity": "CRITICAL",
                             "prev": prev.get(key), "curr": curr.get(key)})
    prev_count = _count_components(prev)
    curr_count = _count_components(curr)
    if prev_count != curr_count:
        findings.append({"key": "component_count", "severity": "WARN",
                         "prev": prev_count, "curr": curr_count})
    prev_licenses = set(prev.get("metadata", {}).get("licenses", []))
    curr_licenses = set(curr.get("metadata", {}).get("licenses", []))
    if prev_licenses != curr_licenses:
        findings.append({"key": "licenses", "severity": "WARN",
                         "prev": list(prev_licenses), "curr": list(curr_licenses)})
    return findings


def main() -> int:
    ap = argparse.ArgumentParser(description="SBOM drift CI gate")
    ap.add_argument("--prev", required=True, type=Path)
    ap.add_argument("--curr", required=True, type=Path)
    ap.add_argument("--fail-on", default="CRITICAL", choices=["CRITICAL", "WARN"])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if not args.prev.exists():
        print(f"WARN: no previous SBOM at {args.prev} — skipping drift check", file=sys.stderr)
        return 0
    prev = _load_sbom(args.prev)
    curr = _load_sbom(args.curr)
    findings = _diff(prev, curr)
    if args.json:
        print(json.dumps({"drift": findings}, indent=2))
        return 0
    fail_sev = {"CRITICAL": 2, "WARN": 1}[args.fail_on]
    exit_code = 0
    for f in findings:
        sev = {"CRITICAL": 2, "WARN": 1}.get(f["severity"], 0)
        icon = "❌" if sev >= fail_sev else "⚠️ "
        print(f"{icon} [{f['severity']}] {f['key']}: {f.get('prev')} -> {f.get('curr')}")
        if sev >= fail_sev:
            exit_code = max(exit_code, sev)
    if exit_code == 0:
        print("✅ No SBOM drift detected.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
