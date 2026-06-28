#!/usr/bin/env python3
"""Evolve: fleet-wide SBOM generation checker.

v36 3e-Evolve track: checks every Cargo.toml crate has a CI step that
calls cargo-cyclonedx or the tools/sbom-cyclonedx-fleet/generate.py.

Usage:
    python3 tools/evolve-sbom/evolve.py [--check]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
RUST_CRATES = [p.parent for p in REPO.rglob("Cargo.toml")
               if "target" not in p.parts]
SBOM_KEYWORDS = {"cyclonedx", "sbom", "cargo-cyclonedx"}


def evolve_sbom(check: bool) -> int:
    missing = []
    for crate in sorted(RUST_CRATES):
        ci_yamls = list(crate.glob(".github/workflows/*.yml"))
        has_sbom = False
        for cy in ci_yamls:
            content = cy.read_text().lower()
            if any(kw in content for kw in SBOM_KEYWORDS):
                has_sbom = True
                break
        if not has_sbom:
            missing.append(crate.name)

    if not missing:
        print("OK: all crates have SBOM CI step")
        return 0

    print(f"MISSING SBOM CI: {len(missing)} crates")
    for m in sorted(missing):
        print(f"  {m}")
    return 1 if check else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet-wide SBOM generation checker")
    ap.add_argument("--check", action="store_true", help="Exit non-zero if missing")
    args = ap.parse_args()
    return evolve_sbom(check=args.check)


if __name__ == "__main__":
    sys.exit(main())
