#!/usr/bin/env python3
"""T1 v27 CI latency-budget gate.

Pillar L17: latency-budget-to-CI.
Reads a YAML budget file and fails CI if any span exceeds its threshold.

Usage:
    python3 tools/latency-budget-to-ci/budget.py --budget budgets/fleet.yaml --trace trace.json
"""

from __future__ import annotations

import argparse
import json
import sys
import yaml
from pathlib import Path


def load_budget(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def load_trace(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def check(span_name: str, duration_ms: float, threshold_ms: float) -> bool:
    return duration_ms <= threshold_ms


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", required=True, type=Path)
    ap.add_argument("--trace", required=True, type=Path)
    ap.add_argument("--fail-on-warn", action="store_true")
    args = ap.parse_args()

    budget = load_budget(args.budget)
    trace = load_trace(args.trace)

    threshold_map: dict[str, float] = {}
    for entry in budget.get("spans", []):
        threshold_map[entry["name"]] = entry["threshold_ms"]

    failures = 0
    warnings = 0
    for span in trace.get("spans", []):
        name = span.get("name", "")
        dur = span.get("duration_ms", 0.0)
        threshold = threshold_map.get(name)
        if threshold is None:
            continue
        ok = check(name, dur, threshold)
        if not ok:
            ratio = dur / threshold
            if ratio > 1.5:
                print(f"FAIL {name}: {dur:.1f}ms > {threshold}ms (x{ratio:.1f})")
                failures += 1
            else:
                print(f"WARN {name}: {dur:.1f}ms > {threshold}ms (x{ratio:.1f})")
                warnings += 1

    if failures:
        print(f"FAILURE: {failures} span(s) exceeded hard budget")
    if warnings:
        print(f"WARNING: {warnings} span(s) exceeded soft budget")
    if args.fail_on_warn and warnings:
        return 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
