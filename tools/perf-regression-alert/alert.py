#!/usr/bin/env python3
"""Perf regression alert generator (Pillar L45).

Reads perf-gate history (bench_history.jsonl from L19 perf-gate binary) and
emits GitHub Actions summary annotations + alert payload when a baseline
regression exceeds threshold.

Usage:
    python3 tools/perf-regression-alert/alert.py \\
        --baseline .perf/baselines/main.json \\
        --current .perf/current/main.json \\
        --threshold 0.05 \\
        --output .perf/alerts.json

Exit codes:
    0: no regression
    1: regression detected (within threshold)
    2: regression exceeds threshold (alert)
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import sys
from pathlib import Path


def _load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _delta_pct(baseline: float, current: float) -> float:
    if baseline == 0:
        return 0.0 if current == 0 else 1.0
    return (current - baseline) / baseline


def evaluate(baseline: dict, current: dict, threshold: float) -> dict:
    """Compare baseline vs current metric sets.

    Each dict is {"metric_name": {"p50": ..., "p95": ..., "p99": ...}, ...}
    """
    metrics_checked = []
    regressions = []
    for name, base_vals in baseline.items():
        if name not in current:
            continue
        cur_vals = current[name]
        for stat in ("p50", "p95", "p99"):
            if stat not in base_vals or stat not in cur_vals:
                continue
            delta = _delta_pct(base_vals[stat], cur_vals[stat])
            metrics_checked.append({
                "metric": f"{name}.{stat}",
                "baseline": base_vals[stat],
                "current": cur_vals[stat],
                "delta_pct": round(delta * 100, 3),
            })
            if delta > threshold:
                regressions.append({
                    "metric": f"{name}.{stat}",
                    "baseline": base_vals[stat],
                    "current": cur_vals[stat],
                    "delta_pct": round(delta * 100, 3),
                    "severity": "critical" if delta > 2 * threshold else "warning",
                })
    return {
        "schema_version": "1.0",
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "threshold_pct": round(threshold * 100, 2),
        "metrics_checked": len(metrics_checked),
        "regressions": regressions,
        "all_checks": metrics_checked,
    }


def render_summary(report: dict) -> str:
    lines = [f"# Perf Regression Report — {report['generated_at']}", ""]
    lines.append(f"Threshold: **{report['threshold_pct']}%**  "
                 f"Metrics checked: **{report['metrics_checked']}**  "
                 f"Regressions: **{len(report['regressions'])}**")
    if not report["regressions"]:
        lines.append("\n## No regressions detected")
        return "\n".join(lines) + "\n"
    lines.append("\n## Regressions")
    lines.append("")
    lines.append("| Severity | Metric | Baseline | Current | Delta |")
    lines.append("|---|---|---|---|---|")
    for r in sorted(report["regressions"], key=lambda x: -x["delta_pct"]):
        lines.append(
            f"| {r['severity']} | {r['metric']} | "
            f"{r['baseline']} | {r['current']} | +{r['delta_pct']}% |"
        )
    return "\n".join(lines) + "\n"


def write_github_summary(report: dict, summary_path: Path) -> None:
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(render_summary(report))


def main() -> int:
    ap = argparse.ArgumentParser(description="Perf regression alert")
    ap.add_argument("--baseline", required=True, type=Path,
                    help="Path to baseline metrics JSON")
    ap.add_argument("--current", required=True, type=Path,
                    help="Path to current metrics JSON")
    ap.add_argument("--threshold", type=float, default=0.05,
                    help="Regression threshold (default 5%%)")
    ap.add_argument("--output", type=Path,
                    help="Write alert JSON to this path")
    ap.add_argument("--github-summary", type=Path,
                    help="Write GitHub Actions summary markdown")
    args = ap.parse_args()

    baseline = _load(args.baseline)
    current = _load(args.current)
    if not baseline or not current:
        print("baseline or current file empty/missing", file=sys.stderr)
        return 0
    report = evaluate(baseline, current, args.threshold)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, sort_keys=True))
    if args.github_summary:
        write_github_summary(report, args.github_summary)
    else:
        sys.stdout.write(render_summary(report))
    if not report["regressions"]:
        return 0
    if any(r["severity"] == "critical" for r in report["regressions"]):
        return 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
