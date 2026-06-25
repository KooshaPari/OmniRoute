#!/usr/bin/env python3
"""T2 v27 fleet-wide perf gate.

Pillar L19: fleet-wide perf gates.
Reads saved benchmark results and posts gate result.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

CONTROL_LIMITS = {
    "pheno-otel::exemplar_lookup": {"p95_ms": 50},
    "pheno-port-adapter::tcp_connect": {"p95_ms": 200},
    "pheno-flags::flag_lookup_1k": {"p95_ms": 5},
}


def check(crate: str, bench: str, p95_ms: float, limit: dict) -> bool:
    return p95_ms <= limit.get("p95_ms", float("inf"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True, type=Path, help="CSV with crate,bench,p50,p95,p99")
    args = ap.parse_args()

    failures = 0
    with open(args.results, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = f"{row['crate']}::{row['bench']}"
            limits = CONTROL_LIMITS.get(key)
            if not limits:
                continue
            p95 = float(row["p95"])
            ok = check(row["crate"], row["bench"], p95, limits)
            status = "PASS" if ok else "FAIL"
            if not ok:
                failures += 1
            print(f"{status} {key}: p95={p95}ms limit={limits['p95_ms']}ms")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
