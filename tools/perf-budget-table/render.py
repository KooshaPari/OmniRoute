#!/usr/bin/env python3
"""perf-budget-table: per-endpoint latency budget table generator (L17.1 P2)

Reads latency-budget.json (schema defined in findings/2026-06-23-L17-latency-budget-spec.md)
and emits a Markdown table suitable for inclusion in PR descriptions and
release notes.

Usage:
    python3 tools/perf-budget-table/render.py --budget perf/latency-budget.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def render(budget: dict) -> str:
    repo = budget.get("repo", "unknown")
    version = budget.get("version", "0.0.0")
    endpoints = budget.get("endpoints", [])
    lines = [f"# Latency budget — `{repo}` v{version}", ""]
    lines.append(f"_Budget policy: p95 + p99 targets, measured at the load balancer._")
    lines.append("")
    lines.append("| Endpoint | Method | p95 (ms) | p99 (ms) | SLA class | Owner |")
    lines.append("|---|---|---|---|---|---|")
    for ep in endpoints:
        lines.append(
            f"| `{ep.get('path','?')}` "
            f"| {ep.get('method','GET')} "
            f"| {ep.get('p95_ms','-')} "
            f"| {ep.get('p99_ms','-')} "
            f"| {ep.get('sla','standard')} "
            f"| @{ep.get('owner','-')} |"
        )
    lines.append("")
    lines.append("## SLA classes")
    lines.append("")
    lines.append("- **critical**: p99 < 50ms, error rate < 0.1%, page on first breach")
    lines.append("- **standard**: p99 < 200ms, error rate < 1%, alert on 3 consecutive breaches")
    lines.append("- **batch**: p99 < 5s, error rate < 5%, alert on daily digest")
    lines.append("")
    lines.append(f"_Total endpoints: {len(endpoints)}_")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Render latency budget as Markdown")
    ap.add_argument("--budget", required=True, help="path to latency-budget.json")
    args = ap.parse_args()
    p = Path(args.budget)
    if not p.exists():
        print(f"budget file not found: {p}", file=sys.stderr)
        return 2
    budget = json.loads(p.read_text())
    sys.stdout.write(render(budget))
    return 0


if __name__ == "__main__":
    sys.exit(main())