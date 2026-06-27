#!/usr/bin/env python3
"""SBOM cyclonedx-fleet generator v2 — verify CycloneDX output per Rust crate.

Pillar L29.1 (cycle-22 P2-lift final). Checks that every Rust workspace
crate has a CycloneDX SBOM artifact and that the SBOM is parseable.

Usage:
    python3 tools/sbom-cyclonedx-fleet/generate_v2.py [--crate pheno-flags]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

RUST_WORKSPACE_DIRS = [
    "pheno-flags", "pheno-otel", "pheno-port-adapter", "pheno-tracing",
    "pheno-errors", "PhenoMCP", "PhenoCompose", "phenotype-ops",
    "hexakit/CoreKit", "hexakit/DomainKit", "hexakit/InfraKit",
]


def check_crate(name: str) -> dict:
    crate_dir = REPO_ROOT / name
    result = {"crate": name, "exists": crate_dir.is_dir(), "has_sbom": False, "parseable": False}
    if not result["exists"]:
        return result
    sbom_path = crate_dir / "build" / "report.cdx.json"
    if sbom_path.exists():
        result["has_sbom"] = True
        try:
            doc = json.loads(sbom_path.read_text())
            result["parseable"] = doc.get("bomFormat") == "CycloneDX"
        except (json.JSONDecodeError, OSError):
            result["parseable"] = False
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="SBOM cyclonedx-fleet verifier v2")
    ap.add_argument("--crate", help="Single crate check (default: all)")
    args = ap.parse_args()
    targets = [args.crate] if args.crate else RUST_WORKSPACE_DIRS
    all_ok = True
    for name in targets:
        r = check_crate(name)
        status = "✅" if r["has_sbom"] and r["parseable"] else "❌"
        print(f"{status} {r['crate']}: exists={r['exists']}, SBOM={r['has_sbom']}, parseable={r['parseable']}")
        if not r["has_sbom"] or not r["parseable"]:
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
