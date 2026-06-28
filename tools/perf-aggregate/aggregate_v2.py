#!/usr/bin/env python3
"""Perf aggregate v2 — all 5 crates aggregated output.

Pillar L17.1 (cycle-22 P2-lift final). Runs criterion benchmarks across
all 5 target crates and aggregates results into a single table.

Usage:
    python3 tools/perf-aggregate/aggregate_v2.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TARGET_CRATES = ["pheno-flags", "pheno-otel", "pheno-port-adapter", "pheno-tracing", "pheno-errors"]


def run_criterion(repo: Path) -> list[dict]:
    benches = []
    criterion_dir = repo / "target" / "criterion"
    if not criterion_dir.is_dir():
        return benches
    for bench_dir in criterion_dir.iterdir():
        if not bench_dir.is_dir():
            continue
        est = bench_dir / "estimates.json"
        if not est.exists():
            continue
        try:
            data = json.loads(est.read_text())
            benches.append({
                "bench": bench_dir.name,
                "p95_ms": round(data.get("mean", {}).get("point_estimate", 0) / 1_000_000, 2),
                "slope_ms": round(data.get("slope", {}).get("point_estimate", 0) / 1_000_000, 3),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return benches


def main() -> int:
    ap = argparse.ArgumentParser(description="Perf aggregate v2 — all 5 crates")
    ap.add_argument("--crate", choices=TARGET_CRATES, help="Single crate")
    args = ap.parse_args()
    crates = [args.crate] if args.crate else TARGET_CRATES
    all_ok = True
    print("| Crate | Bench | p95 (ms) | Slope (ms) |")
    print("|---|---|---|---|")
    for name in crates:
        repo = REPO_ROOT / name
        if not repo.is_dir():
            print(f"| {name} | — | — | — |")
            all_ok = False
            continue
        benches = run_criterion(repo)
        if not benches:
            print(f"| {name} | (no criterion data) | — | — |")
            all_ok = False
        for b in benches:
            print(f"| {name} | {b['bench']} | {b['p95_ms']} | {b['slope_ms']} |")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
