#!/usr/bin/env python3
"""L46.1 sbom-drift-ci — compares current SBOM against baseline and flags drift.

Reads a current CycloneDX or SPDX JSON, compares with stored baseline,
and flags added/removed/changed packages as CRITICAL or WARN.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_sbom(path: Path) -> dict[str, str]:
    """Return {name@version: license}."""
    doc = json.loads(path.read_text())
    components: list[dict] = doc.get("components", [])
    result: dict[str, str] = {}
    for c in components:
        name = c.get("name", "?")
        ver = c.get("version", "?")
        lic = ""
        for l in c.get("licenses", []):
            lic = l.get("license", {}).get("id", l.get("license", {}).get("name", ""))
        result[f"{name}@{ver}"] = lic
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="SBOM drift detector")
    ap.add_argument("current", type=Path, help="Current SBOM (JSON)")
    ap.add_argument("--baseline", type=Path, required=True, help="Baseline SBOM (JSON)")
    ap.add_argument("--output", type=Path, help="Write drift report to file")
    args = ap.parse_args()

    current = load_sbom(args.current)
    baseline = load_sbom(args.baseline)

    added = {k: v for k, v in current.items() if k not in baseline}
    removed = {k: v for k, v in baseline.items() if k not in current}
    changed = {k: (baseline[k], current[k]) for k in current if k in baseline and baseline[k] != current[k]}

    severity = 0
    if added:
        severity = max(severity, 2)
    if removed:
        severity = max(severity, 2)
    if changed:
        severity = max(severity, 1)

    lines = [f"# SBOM Drift Report", f"", f"Baseline: {args.baseline}", f"Current:  {args.current}", f""]
    lines.append(f"| Type | Package | Baseline License | Current License |")
    lines.append(f"|------|---------|-----------------|-----------------|")
    for pkg in sorted(added):
        lines.append(f"| ADDED ({severity}) | {pkg} | — | {added[pkg]} |")
    for pkg in sorted(removed):
        lines.append(f"| REMOVED ({severity}) | {pkg} | {removed[pkg]} | — |")
    for pkg in sorted(changed):
        old, new = changed[pkg]
        lines.append(f"| CHANGED (1) | {pkg} | {old} | {new} |")
    lines.append("")
    lines.append(f"**Drift severity: {severity}** (0=none, 1=warn, 2=critical)")
    report = "\n".join(lines)

    if args.output:
        args.output.write_text(report)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(report)

    return severity


if __name__ == "__main__":
    sys.exit(main())
