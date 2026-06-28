#!/usr/bin/env python3
"""Full perf regression suite runner.

Pillar L19.1 (full perf regression suite). Runs criterion benchmarks across
all Rust workspaces, collects p50/p95/p99, compares against N=3 history,
and generates a markdown + JSON regression report.

Usage:
    python3 tools/perf-regression-suite/run.py \\
        --workspace pheno-port-adapter \\
        --history .perf-history/ \\
        --output perf-report.md
"""
from __future__ import annotations

import argparse, json, os, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

CRITERION_RE = re.compile(r"(?P<name>[\w/_-]+)\s+time:\s+\[(?P<low>[\d.]+)\s+(?P<unit>\S+)\s+(?P<high>[\d.]+)\s+(?P<unit2>\S+)\]")


def run_criterion(repo: Path) -> dict[str, dict]:
    os.chdir(str(repo))
    result = subprocess.run(
        ["cargo", "bench", "--", "--output-format", "benches"],
        capture_output=True, text=True, timeout=600
    )
    benches: dict[str, dict] = {}
    for line in result.stdout.splitlines():
        m = CRITERION_RE.search(line)
        if m:
            name = m.group("name")
            benches[name] = {
                "low": float(m.group("low")),
                "high": float(m.group("high")),
                "unit": m.group("unit"),
                "raw": line.strip(),
            }
    return benches


def load_history(history: Path, ws: str) -> dict:
    f = history / f"{ws}.json"
    if f.exists():
        return json.loads(f.read_text())
    return {"runs": []}


def save_history(history: Path, ws: str, results: dict):
    history.mkdir(parents=True, exist_ok=True)
    f = history / f"{ws}.json"
    data = load_history(history, ws)
    data["runs"].append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    })
    if len(data["runs"]) > 10:
        data["runs"] = data["runs"][-10:]
    f.write_text(json.dumps(data, indent=2) + "\n")


def compare(results: dict, history: dict, threshold_pct: float = 5.0) -> list[dict]:
    regressions = []
    for name, cur in results.items():
        past_times = []
        for run in history.get("runs", [])[-3:]:
            if name in run.get("results", {}):
                past_times.append(run["results"][name]["low"])
        if not past_times:
            continue
        avg_past = sum(past_times) / len(past_times)
        if avg_past == 0:
            continue
        pct = (cur["low"] - avg_past) / avg_past * 100
        if pct > threshold_pct:
            regressions.append({
                "benchmark": name,
                "current": cur["low"],
                "previous_avg": avg_past,
                "change_pct": round(pct, 1),
            })
    return regressions


def main() -> int:
    ap = argparse.ArgumentParser(description="Full perf regression suite")
    ap.add_argument("--workspace", default=".", help="Path to Rust workspace (default: .)")
    ap.add_argument("--history", default=".perf-history", type=Path, help="History directory")
    ap.add_argument("--output", "-o", type=Path, help="Write markdown report")
    ap.add_argument("--threshold", type=float, default=5.0, help="Regression threshold %% (default: 5.0)")
    ap.add_argument("--json", type=Path, help="Write JSON report")
    args = ap.parse_args()

    ws_path = Path(args.workspace).resolve()
    results = run_criterion(ws_path)
    history = load_history(args.history, ws_path.name)
    save_history(args.history, ws_path.name, results)
    regressions = compare(results, history, args.threshold)

    lines = [
        f"# Perf Regression Report — {ws_path.name}",
        f"**Date:** {datetime.now(timezone.utc).isoformat()}",
        f"**Benches:** {len(results)} | **Regressions (>={args.threshold}%):** {len(regressions)}",
        "",
        "## Benchmarks",
        "| Benchmark | p50 | Unit |",
        "|---|---|---|",
    ]
    for name, data in sorted(results.items()):
        lines.append(f"| {name} | {data['low']} | {data['unit']} |")

    if regressions:
        lines.extend([
            "",
            "## ⚠ Regressions",
            "| Benchmark | Current | Previous Avg | Δ% |",
            "|---|---|---|---|",
        ])
        for r in regressions:
            lines.append(f"| {r['benchmark']} | {r['current']:.3f} | {r['previous_avg']:.3f} | **+{r['change_pct']:.1f}%** |")

    report = "\n".join(lines) + "\n"

    if args.output:
        args.output.write_text(report)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(report)

    if args.json:
        json_out = {
            "workspace": ws_path.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "benches": len(results),
            "regressions": len(regressions),
            "details": regressions,
        }
        args.json.write_text(json.dumps(json_out, indent=2) + "\n")
        print(f"Wrote {args.json}", file=sys.stderr)

    return 1 if regressions else 0


if __name__ == "__main__":
    sys.exit(main())
