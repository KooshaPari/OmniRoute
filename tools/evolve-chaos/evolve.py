#!/usr/bin/env python3
"""Evolve: fleet-wide chaos gating.

v36 3e-Evolve track: reads chaos-injection/ scenarios and runs
tools/embed-chaos/embed.sh for each. Supports --gate to fail on
unresolved P0 findings.

Usage:
    python3 tools/evolve-chaos/evolve.py [--gate]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
CHAOS_DIR = REPO / "chaos-injection"
EMBED = REPO / "tools" / "embed-chaos" / "embed.sh"


def evolve_chaos(gate: bool) -> int:
    if not CHAOS_DIR.exists():
        print(f"WARN: {CHAOS_DIR} not found", file=sys.stderr)
        return 0
    scenarios = sorted(CHAOS_DIR.glob("*.json")) + sorted(CHAOS_DIR.glob("*.yaml"))
    if not scenarios:
        print(f"WARN: no chaos scenarios in {CHAOS_DIR}", file=sys.stderr)
        return 0
    failures = []
    for sc in scenarios:
        desc = f"  {sc.name}"
        if EMBED.exists():
            result = subprocess.run(["bash", str(EMBED), str(sc)], capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                print(f"PASS{desc}")
            else:
                print(f"FAIL{desc}: {result.stderr.strip()}")
                if gate:
                    failures.append(sc)
        else:
            print(f"DRY-RUN{desc}")
    if gate and failures:
        print(f"GATE: {len(failures)} chaos scenarios failed", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet-wide chaos gating")
    ap.add_argument("--gate", action="store_true", help="Exit non-zero on failures")
    args = ap.parse_args()
    return evolve_chaos(gate=args.gate)


if __name__ == "__main__":
    sys.exit(main())
