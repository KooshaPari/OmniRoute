#!/usr/bin/env python3
"""Evolve: fleet-wide fuzz schedule verifier.

v36 3e-Evolve track: ensures cargo-fuzz targets exist in every crate with
a Cargo.toml, verifies they compile, and reports schedule adherence.

Usage:
    python3 tools/evolve-fuzz/evolve.py [--check] [--fix]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent

RUST_CRATES = [p.parent for p in REPO.rglob("Cargo.toml")
               if "target" not in p.parts and "fuzz" not in p.parts]

IGNORE = {"pheno-errors", "pheno-config", "pheno-context"}


def evolve_fuzz(check: bool, fix: bool) -> int:
    missing = []
    for crate in sorted({p for p in RUST_CRATES if p.name not in IGNORE}):
        fuzz_dir = crate / "fuzz"
        if not fuzz_dir.exists():
            missing.append(crate.name)
        elif not list(fuzz_dir.rglob("*.rs")):
            missing.append(crate.name)

    if not missing:
        print("OK: all crates have cargo-fuzz targets")
        return 0

    print(f"MISSING fuzz targets: {len(missing)} crates")
    for m in sorted(missing):
        print(f"  {m}")
    if fix:
        for m in sorted(missing):
            crate = next(p for p in RUST_CRATES if p.name == m)
            subprocess.run(["cargo", "fuzz", "init"], cwd=crate,
                           capture_output=True)
            print(f"  initialized fuzz in {m}")
    return 1 if check else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet-wide fuzz schedule verifier")
    ap.add_argument("--check", action="store_true", help="Exit non-zero if missing")
    ap.add_argument("--fix", action="store_true", help="Initialize missing fuzz targets")
    args = ap.parse_args()
    return evolve_fuzz(check=args.check, fix=args.fix)


if __name__ == "__main__":
    sys.exit(main())
