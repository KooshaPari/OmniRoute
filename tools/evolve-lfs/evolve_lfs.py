#!/usr/bin/env python3
"""v36 3e-Evolve: LFS tracking cross-repo evolution."""
from __future__ import annotations

import argparse, json, subprocess, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def has_lfs(repo: Path) -> bool:
    result = subprocess.run(["git", "-C", str(repo), "lfs", "ls-files", "--size"],
                            capture_output=True, text=True, timeout=10)
    return bool(result.stdout.strip())


def main() -> int:
    ap = argparse.ArgumentParser(description="Evolve LFS cross-repo")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    repos = sorted(d for d in REPO_ROOT.iterdir() if (d / ".git").exists() or (d / ".git").is_file())
    without = [r for r in repos if not has_lfs(r)]
    report = {"total": len(repos), "with_lfs": len(repos) - len(without), "without_lfs": len(without),
              "gaps": sorted(str(r.relative_to(REPO_ROOT)) for r in without)[:20]}
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Total: {report['total']}  With LFS: {report['with_lfs']}  Without: {report['without_lfs']}")
        for g in report["gaps"]:
            print(f"  MISS: {g}")
    return 0 if report["without_lfs"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
