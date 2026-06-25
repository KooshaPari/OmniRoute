#!/usr/bin/env python3
"""
L17.1 — Weekly latency budget check.

Reads the performance budget table from docs/PERF_BUDGETS.md and
compares it against real latency measurements (from a metrics store
or a k6 run). Emits a structured JSON report and exits non-zero if
any budget has been breached.

Usage:
    python3 tools/latency-budget-cron/check.py \\
        --budgets docs/PERF_BUDGETS.md \\
        --metrics-path /tmp/latency-metrics.json \\
        [--threshold-pct 10]

If --metrics-path is not provided, the script runs in "spec-only" mode
and only validates that the budgets file is well-formed.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Budget model
# ---------------------------------------------------------------------------

class Budget:
    """A single per-endpoint latency budget from the PERF_BUDGETS.md table."""

    def __init__(self, endpoint: str, method: str, p50: float, p95: float, p99: float, notes: str = ""):
        self.endpoint = endpoint
        self.method = method
        self.p50 = p50  # ms
        self.p95 = p95  # ms
        self.p99 = p99  # ms
        self.notes = notes

    def __repr__(self) -> str:
        return (f"{self.method} {self.endpoint}: p50={self.p50} p95={self.p95} p99={self.p99}")


# ---------------------------------------------------------------------------
# Parser for PERF_BUDGETS.md tables
# ---------------------------------------------------------------------------

def parse_budgets(path: str) -> list[Budget]:
    """Parse latency budgets from the canonical PERF_BUDGETS.md."""
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()

    budgets: list[Budget] = []
    # We look for markdown tables with | Endpoint | Method | p50 | p95 | p99 | ...
    # in sections named "Inference endpoints", "Files + batches", "Agents", etc.
    in_table = False
    headers = []

    TABLE_ROW_RE = re.compile(
        r"^\|\s*(`/[^`]+`|/[^\s|]+)\s*\|\s*([A-Z]+)\s*\|\s*([\d.]+)\s*ms?\s*\|\s*([\d.]+)\s*ms?\s*\|\s*([\d.]+)\s*ms?"
    )

    for line in lines:
        stripped = line.strip()
        # Detect table header row
        if stripped.startswith("| Endpoint |"):
            in_table = True
            headers = [h.strip() for h in stripped.split("|")[1:-1]]
            continue
        # Detect table separator
        if in_table and stripped.startswith("|---"):
            continue
        # Detect end of table: blank line or new section heading after table
        if in_table and (not stripped or (stripped.startswith("###") or stripped.startswith("##"))):
            in_table = False
            continue

        if in_table:
            m = TABLE_ROW_RE.match(stripped)
            if m:
                endpoint = m.group(1).strip("`")
                method = m.group(2)
                try:
                    p50 = float(m.group(3))
                    p95 = float(m.group(4))
                    p99 = float(m.group(5))
                except ValueError:
                    continue
                # Parse notes if present
                parts = stripped.split("|")
                notes = parts[6].strip() if len(parts) >= 7 else ""
                budgets.append(Budget(endpoint, method, p50, p95, p99, notes))

    return budgets


# ---------------------------------------------------------------------------
# Metrics loading
# ---------------------------------------------------------------------------

def load_metrics(path: str) -> dict:
    """Load observed latency metrics from a JSON file.

    Expected format:
    {
      "endpoints": {
        "GET /api/health/ping": {"p50": 4, "p95": 15, "p99": 40, "count": 5000},
        "POST /v1/responses": {"p50": 750, "p95": 1700, "p99": 3200, "count": 800},
        ...
      },
      "window": "2026-06-20T00:00:00Z/2026-06-26T23:59:59Z"
    }
    """
    if not path or not os.path.exists(path):
        return {"endpoints": {}, "window": "N/A"}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Check logic
# ---------------------------------------------------------------------------

def key_for_budget(b: Budget) -> str:
    """Canonical key that appears in metrics (e.g. 'POST /v1/responses')."""
    return f"{b.method} {b.endpoint}"


def check_budgets(
    budgets: list[Budget], metrics: dict, threshold_pct: float
) -> list[dict]:
    """Compare observed metrics against budgets.

    Returns a list of breach records (empty = all green).
    Each breach: {endpoint, method, metric, budget, observed, delta_pct}
    """
    endpoints = metrics.get("endpoints", {})
    breaches = []

    for b in budgets:
        key = key_for_budget(b)
        obs = endpoints.get(key)
        if obs is None:
            # No data for this endpoint — not a breach, just skip
            continue

        checks = [
            ("p50", b.p50, obs.get("p50")),
            ("p95", b.p95, obs.get("p95")),
            ("p99", b.p99, obs.get("p99")),
        ]

        for metric_name, budget_val, observed_val in checks:
            if observed_val is None:
                continue
            if observed_val > budget_val * (1 + threshold_pct / 100):
                delta_pct = ((observed_val - budget_val) / budget_val) * 100
                breaches.append({
                    "endpoint": b.endpoint,
                    "method": b.method,
                    "metric": metric_name,
                    "budget_ms": budget_val,
                    "observed_ms": observed_val,
                    "delta_pct": round(delta_pct, 1),
                })

    return breaches


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Weekly latency budget check")
    parser.add_argument(
        "--budgets",
        default="docs/PERF_BUDGETS.md",
        help="Path to PERF_BUDGETS.md (default: docs/PERF_BUDGETS.md)",
    )
    parser.add_argument(
        "--metrics-path",
        default=None,
        help="Path to observed latency metrics JSON (optional; spec-only mode if omitted)",
    )
    parser.add_argument(
        "--threshold-pct",
        type=float,
        default=10.0,
        help="Allowed overage percentage before breach (default: 10%%)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path to write JSON report (default: stdout)",
    )
    args = parser.parse_args()

    budgets_path = Path(args.budgets)
    if not budgets_path.exists():
        print(f"::error::Budgets file not found: {budgets_path}")
        return 1

    budgets = parse_budgets(str(budgets_path))
    if not budgets:
        print(f"::error::No budgets could be parsed from {budgets_path}")
        return 1

    print(f"Parsed {len(budgets)} endpoint budgets from {budgets_path}")

    metrics = load_metrics(args.metrics_path) if args.metrics_path else {"endpoints": {}, "window": "N/A"}
    observed_count = len(metrics.get("endpoints", {}))
    print(f"Observed metrics: {observed_count} endpoints (window: {metrics.get('window', 'N/A')})")

    breaches = check_budgets(budgets, metrics, args.threshold_pct)

    report = {
        "status": "BREACH" if breaches else "OK",
        "budgets_file": str(budgets_path),
        "budget_count": len(budgets),
        "metrics_window": metrics.get("window", "N/A"),
        "metrics_endpoint_count": observed_count,
        "threshold_pct": args.threshold_pct,
        "breaches": breaches,
        "breach_count": len(breaches),
    }

    report_json = json.dumps(report, indent=2)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report_json)
        print(f"Report written to {output_path}")
    else:
        print(report_json)

    # GitHub Actions annotations
    for b in breaches:
        print(
            f"::warning title=LatencyBudgetBreach::"
            f"{b['method']} {b['endpoint']} {b['metric']}: "
            f"{b['observed_ms']}ms > {b['budget_ms']}ms "
            f"(+{b['delta_pct']}%)"
        )

    if breaches:
        print(f"::error::Latency budget breached: {len(breaches)} overages found")
        return 1

    print("✅ All latency budgets within threshold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
