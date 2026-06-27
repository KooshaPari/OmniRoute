#!/usr/bin/env python3
"""Perf budget table renderer v2 — all 5 crates.

Pillar L17.1 (cycle-22 P2-lift final). Checks that the 5 target crates
have a `perf/` directory and renders a summary table.

Usage:
    python3 tools/perf-budget-table/render_v2.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TARGET_CRATES = ["pheno-flags", "pheno-otel", "pheno-port-adapter", "pheno-tracing", "pheno-errors"]


def check(repo: Path) -> dict:
    perf_dir = repo / "perf"
    return {
        "crate": repo.name,
        "has_perf_dir": perf_dir.is_dir(),
        "bench_files": sorted(f.name for f in perf_dir.glob("*.rs")) if perf_dir.is_dir() else [],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Perf budget table renderer v2")
    ap.add_argument("--crate", choices=TARGET_CRATES, help="Single crate check")
    args = ap.parse_args()
    crates = [args.crate] if args.crate else TARGET_CRATES
    all_ok = True
    print("| Crate | perf/ exists | Bench files |")
    print("|---|---|---|")
    for name in crates:
        repo = REPO_ROOT / name
        if not repo.is_dir():
            print(f"| {name} | MISSING | — |")
            all_ok = False
            continue
        info = check(repo)
        status = "✅" if info["has_perf_dir"] else "❌"
        files = ", ".join(info["bench_files"]) if info["bench_files"] else "—"
        print(f"| {name} | {status} | {files} |")
        if not info["has_perf_dir"]:
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
