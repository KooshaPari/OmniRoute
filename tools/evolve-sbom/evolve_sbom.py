#!/usr/bin/env python3
"""v36 3e-Evolve: SBOM cyclonedx cross-repo evolution."""
from __future__ import annotations

import argparse, json, subprocess, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def has_sbom(crate: Path) -> bool:
    return any((crate / "target").rglob("*.cdx.json")) or (crate / "sbom").is_dir()


def main() -> int:
    ap = argparse.ArgumentParser(description="Evolve SBOM cross-repo")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    crates = sorted(p.parent for p in REPO_ROOT.rglob("Cargo.toml")
                    if "target" not in p.parts and "node_modules" not in p.parts)
    without = [c for c in crates if not has_sbom(c)]
    report = {"total": len(crates), "with_sbom": len(crates) - len(without), "without_sbom": len(without),
              "gaps": [str(c.relative_to(REPO_ROOT)) for c in without[:20]]}
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Total: {report['total']}  With SBOM: {report['with_sbom']}  Without: {report['without_sbom']}")
        for g in report["gaps"]:
            print(f"  MISS: {g}")
    return 0 if report["without_sbom"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
