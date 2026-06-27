#!/usr/bin/env python3
"""Cargo-fuzz schedule generator v2 — fleet-wide.

Pillar L11.1 (cycle-22 P2-lift final). Generates a schedule.csv for
each repo's fuzz/ directory: which targets to run, with what budget,
and whether to run daily / weekly / monthly.

Usage:
    python3 tools/cargo-fuzz-schedule/schedule_v2.py --repo pheno-port-adapter
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FUZZ_DIRS = ["fuzz", "fuzz_targets", "fuzz/corpus"]


def _find_fuzz_targets(repo: Path) -> list[str]:
    targets = []
    for fd in FUZZ_DIRS:
        d = repo / fd / "fuzz_targets"
        if d.exists():
            targets.extend(p.stem for p in d.glob("*.rs") if p.stem.startswith("fuzz_"))
    return sorted(set(targets))


DEFAULT_BUDGET = {
    "daily": 5 * 60,     # 5 minutes
    "weekly": 30 * 60,   # 30 minutes
    "monthly": 4 * 3600, # 4 hours
}


def _cadence(target: str, target_count: int) -> str:
    if target_count <= 3:
        return "daily"
    if "stress" in target or "long" in target:
        return "weekly"
    return "daily"


def generate(repo: Path) -> list[dict]:
    targets = _find_fuzz_targets(repo)
    schedule = []
    for t in targets:
        cad = _cadence(t, len(targets))
        budget_s = DEFAULT_BUDGET[cad]
        schedule.append({
            "repo": repo.name,
            "target": t,
            "cadence": cad,
            "budget_s": budget_s,
            "generated_at": datetime.utcnow().isoformat(),
        })
    return schedule


def main() -> int:
    ap = argparse.ArgumentParser(description="Cargo-fuzz schedule generator v2")
    ap.add_argument("--repo", type=Path, help="Single repo path (default: scan all)")
    args = ap.parse_args()
    repos = [REPO_ROOT / args.repo] if args.repo else sorted(REPO_ROOT.iterdir())
    repos = [r for r in repos if r.is_dir() and not r.name.startswith(".") and (r / "Cargo.toml").exists()]
    all_rows = []
    for r in repos:
        all_rows.extend(generate(r))
    writer = csv.DictWriter(sys.stdout, fieldnames=["repo", "target", "cadence", "budget_s", "generated_at"])
    writer.writeheader()
    writer.writerows(all_rows)
    print(f"# Total: {len(all_rows)} targets across {len(repos)} repos", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
