#!/usr/bin/env python3
"""v36 3e-Evolve: mTLS config cross-repo evolution."""
from __future__ import annotations

import argparse, json, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def has_mtls_config(repo: Path) -> bool:
    return (repo / "mtls.yaml").exists() or (repo / ".mtls.yaml").exists() or (repo / "tools" / "mtls-fleet").exists()


def main() -> int:
    ap = argparse.ArgumentParser(description="Evolve mTLS cross-repo")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    repos = sorted(d for d in REPO_ROOT.iterdir() if d.is_dir() and not d.name.startswith("."))
    without = [r for r in repos if not has_mtls_config(r)]
    report = {"total": len(repos), "with_mtls": len(repos) - len(without), "without_mtls": len(without),
              "gaps": sorted(str(r.relative_to(REPO_ROOT)) for r in without)[:20]}
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Total: {report['total']}  With mTLS: {report['with_mtls']}  Without: {report['without_mtls']}")
        for g in report["gaps"]:
            print(f"  MISS: {g}")
    return 0 if report["without_mtls"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
