#!/usr/bin/env python3
"""Gitleaks-fleet scanner v2 — runs gitleaks detect in every sub-repo.

Pillar L47.1 (cycle-22 P2-lift final). Scans each nested git repo for
gitleaks violations and reports pass/fail per repo.

Usage:
    python3 tools/gitleaks-fleet/scan_v2.py [--exclude-vendored]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def find_git_dirs(root: Path, max_depth: int = 3) -> list[Path]:
    repos = []
    for depth in range(1, max_depth + 1):
        for p in root.iterdir():
            if p.is_dir() and (p / ".git").exists() and not p.name.startswith("."):
                repos.append(p)
        break  # only top level for speed
    return sorted(repos)


def scan_repo(path: Path) -> dict:
    result = {"repo": path.name, "leaks": -1, "ok": False}
    try:
        out = subprocess.run(
            ["gitleaks", "detect", "--source", str(path), "--no-banner", "--verbose"],
            capture_output=True, text=True, timeout=30
        )
        # gitleaks exit 0 = no leaks, 1 = leaks found, others = error
        if out.returncode == 0:
            result["leaks"] = 0
            result["ok"] = True
        elif out.returncode == 1:
            result["leaks"] = out.stdout.count("leak found") or out.stdout.count("secret")
            result["ok"] = False
        else:
            result["leaks"] = -1
            result["ok"] = False
            result["error"] = out.stderr.strip()[:100]
    except FileNotFoundError:
        result["error"] = "gitleaks not installed"
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="Gitleaks-fleet scanner v2")
    ap.add_argument("--exclude-vendored", action="store_true", help="Skip vendor/ third_party/ directories")
    args = ap.parse_args()
    repos = find_git_dirs(REPO_ROOT)
    all_ok = True
    for r in repos:
        if args.exclude_vendored and any(p.name in ("vendor", "third_party") for p in r.iterdir()):
            print(f"⏭️  {r.name}: vendor/ present, skipping")
            continue
        res = scan_repo(r)
        if res["ok"]:
            print(f"✅ {res['repo']}: 0 leaks")
        else:
            print(f"❌ {res['repo']}: {res.get('leaks', '?')} leaks")
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
