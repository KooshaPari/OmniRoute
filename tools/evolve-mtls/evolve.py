#!/usr/bin/env python3
"""Evolve: fleet-wide mTLS config applier.

v36 3e-Evolve track: reads tools/embed-mtls/embed.sh and applies
the mTLS YAML config to every substrate that has a tls-port-to-adapter
annotation in its Cargo.toml or AGENTS.md.

Usage:
    python3 tools/evolve-mtls/evolve.py [--apply] [--check]
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
EMBED = REPO / "tools" / "embed-mtls" / "embed.sh"
CONFIG_DIR = REPO / "config" / "mtls"


def evolve_mtls(apply: bool, check: bool) -> int:
    if not EMBED.exists():
        print(f"ERROR: {EMBED} not found", file=sys.stderr)
        return 2
    mtls_configs = list(CONFIG_DIR.glob("*.yaml")) if CONFIG_DIR.exists() else []
    if not mtls_configs:
        print(f"WARN: no mTLS configs in {CONFIG_DIR}", file=sys.stderr)
        return 0
    for cfg in mtls_configs:
        sub_command = ["bash", str(EMBED), str(cfg)]
        desc = f"  {cfg.name}"
        if apply:
            result = subprocess.run(sub_command, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                print(f"OK{desc}")
            else:
                print(f"FAIL{desc}: {result.stderr.strip()}")
                if check:
                    return 1
        else:
            print(f"DRY-RUN{desc}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet-wide mTLS config applier")
    ap.add_argument("--apply", action="store_true", help="Apply mTLS configs")
    ap.add_argument("--check", action="store_true", help="Exit non-zero on failures")
    args = ap.parse_args()
    return evolve_mtls(apply=args.apply, check=args.check)


if __name__ == "__main__":
    sys.exit(main())
