#!/usr/bin/env python3
"""scripts/perf_gate.py — v19 T4 perf gate runner.

Loads benchmarks/fleet-perf.toml, runs each benchmark N times, computes p95,
asserts against budget. Exit 0 if all pass, 1 otherwise. Writes a Markdown
report + JSON results to findings/perf-<date>.{txt,json}.

Authority: ADR-040 + v19 71-pillar cycle 9 P0 plan §2 Track T4.
"""
import argparse, json, statistics, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib


def load_manifest(p: Path) -> dict:
    with p.open("rb") as f:
        return tomllib.load(f)


def time_cmd(cmd, runs):
    out = []
    for _ in range(runs):
        t0 = time.perf_counter()
        subprocess.run(cmd, check=False, capture_output=True)
        out.append((time.perf_counter() - t0) * 1000.0)
    return out


def p95(s):
    s = sorted(s)
    return s[max(0, int(round(0.95 * (len(s) - 1))))]


def run_one(name, spec, defaults):
    runs = spec.get("runs", defaults.get("runs", 10))
    budget = spec["p95_budget_ms"]
    cmd = [spec.get("command", defaults.get("command", "true"))] + list(spec.get("args", []))
    samples = time_cmd(cmd, runs)
    obs = p95(samples)
    return {"name": name, "command": cmd, "runs": runs,
            "p95_ms": round(obs, 3), "budget_ms": budget,
            "passed": obs <= budget, "samples_ms": [round(x, 3) for x in samples]}


def render(results, started):
    L = [f"# Perf gate report — {started}\n",
         "| benchmark | p95 (ms) | budget (ms) | runs | status |",
         "|-----------|---------:|------------:|-----:|--------|"]
    for r in results:
        L.append(f"| {r['name']} | {r['p95_ms']} | {r['budget_ms']} | {r['runs']} | {'PASS' if r['passed'] else 'FAIL'} |")
    fail = sum(1 for r in results if not r["passed"])
    L += ["", f"Total: {len(results)}, Failed: {fail}", ""]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description="v19 T4 perf gate runner")
    ap.add_argument("--manifest", required=True, type=Path)
    ap.add_argument("--findings-dir", type=Path, default=Path("findings"))
    args = ap.parse_args()

    manifest = load_manifest(args.manifest)
    defaults = manifest.get("defaults", {})
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    results = []
    for group, entries in manifest.items():
        if group in {"meta", "defaults"}:
            continue
        # Flat form: "name" -> {p95_budget_ms: ...}; group form: "crate" -> {"method": {...}}
        if not isinstance(entries, dict) or "p95_budget_ms" in entries:
            entries = {group: entries}
        for name, spec in entries.items():
            if not isinstance(spec, dict) or "p95_budget_ms" not in spec:
                continue
            results.append(run_one(f"{group}.{name}", spec, defaults))

    report = render(results, started)
    print(report)

    args.findings_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    (args.findings_dir / f"perf-{stamp}.txt").write_text(report + "\n")
    (args.findings_dir / f"perf-{stamp}.json").write_text(json.dumps(results, indent=2) + "\n")
    print(f"Wrote: findings/perf-{stamp}.{{txt,json}}", file=sys.stderr)

    return 0 if all(r["passed"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
