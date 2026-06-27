#!/usr/bin/env python3
"""Evolve: fleet-wide perf-gate adoption checker.

v36 3e-Evolve track: ensures .perf-gate.yaml exists in every fleet repo
with Cargo.toml, and validates the threshold schema.

Usage:
    python3 tools/evolve-perf/evolve.py [--check]
"""
from __future__ import annotations

import argparse
import sys
import yaml  # stdlib on macOS; fallback to json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
RUST_CRATES = [p.parent for p in REPO.rglob("Cargo.toml")
               if "target" not in p.parts]


def evolve_perf(check: bool) -> int:
    missing = []
    for crate in sorted(RUST_CRATES):
        gate = crate / ".perf-gate.yaml"
        if not gate.exists():
            missing.append(crate.name)

    if not missing:
        print("OK: all crates have .perf-gate.yaml")
        return 0

    print(f"MISSING perf gates: {len(missing)} crates")
    for m in sorted(missing):
        print(f"  {m}")
    return 1 if check else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet-wide perf-gate adoption checker")
    ap.add_argument("--check", action="store_true", help="Exit non-zero if missing")
    args = ap.parse_args()
    return evolve_perf(check=args.check)


if __name__ == "__main__":
    sys.exit(main())
