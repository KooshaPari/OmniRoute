#!/usr/bin/env python3
"""perf-aggregate: fleet-wide perf aggregator (L19.1 P2)

Reads per-repo perf results (JSON files from criterion/pytest-benchmark/etc.)
and produces a unified fleet-wide report. Used by the v30 perf-gate CI step.

Usage:
    python3 tools/perf-aggregate/aggregate.py \
        --reports-dir perf-reports/ \
        --output perf/fleet-summary.json
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path


def load_reports(reports_dir: Path) -> list[dict]:
    out: list[dict] = []
    for p in sorted(reports_dir.rglob("*.json")):
        try:
            d = json.loads(p.read_text())
            d["_source"] = str(p.relative_to(reports_dir))
            out.append(d)
        except Exception as exc:
            print(f"skip {p}: {exc}", file=sys.stderr)
    return out


def aggregate(reports: list[dict]) -> dict:
    by_repo: dict = {}
    by_bench: dict = {}
    for r in reports:
        repo = r.get("repo", "?")
        bench = r.get("bench", "?")
        metric = r.get("metric", "p95_ms")
        value = r.get("value")
        if value is None:
            continue
        by_repo.setdefault(repo, []).append({"bench": bench, "metric": metric, "value": value})
        by_bench.setdefault(bench, []).append({"repo": repo, "metric": metric, "value": value})
    summary = {
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "report_count": len(reports),
        "repo_count": len(by_repo),
        "bench_count": len(by_bench),
        "by_repo": {k: sorted(v, key=lambda x: x["bench"]) for k, v in sorted(by_repo.items())},
        "by_bench": {k: sorted(v, key=lambda x: x["repo"]) for k, v in sorted(by_bench.items())},
    }
    # fleet p95/p99 across all benchmarks
    fleet = []
    for r in reports:
        if r.get("metric") in {"p95_ms", "p99_ms"} and r.get("value") is not None:
            fleet.append({"bench": r["bench"], "repo": r["repo"],
                          "metric": r["metric"], "value": r["value"]})
    fleet.sort(key=lambda x: x["value"], reverse=True)
    summary["fleet_top_slowest"] = fleet[:20]
    return summary


def render_table(summary: dict) -> str:
    lines = [f"# Fleet perf aggregate — {summary['generated_at']}", ""]
    lines.append(f"Reports: {summary['report_count']}, "
                 f"repos: {summary['repo_count']}, "
                 f"benches: {summary['bench_count']}")
    lines.append("")
    lines.append("## Top 20 slowest fleet-wide")
    lines.append("")
    lines.append("| Bench | Repo | Metric | Value |")
    lines.append("|---|---|---|---|")
    for f in summary["fleet_top_slowest"]:
        lines.append(f"| {f['bench']} | {f['repo']} | {f['metric']} | {f['value']} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet perf aggregator")
    ap.add_argument("--reports-dir", required=True)
    ap.add_argument("--output", required=True, help="output JSON path")
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()
    reports = load_reports(Path(args.reports_dir))
    if not reports:
        print(f"no reports in {args.reports_dir}", file=sys.stderr)
        return 2
    summary = aggregate(reports)
    Path(args.output).write_text(json.dumps(summary, indent=2))
    if args.summary:
        sys.stdout.write(render_table(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())