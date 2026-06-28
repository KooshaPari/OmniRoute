#!/usr/bin/env python3
"""cargo-fuzz-schedule: nightly fuzz orchestration (L11.1 P2)

Reads crates/fuzz_targets.toml from each repo and runs cargo fuzz in
nightly batches, distributing CPU across the fleet's fuzz pool.

Each fuzz target gets 5 minutes of CPU per night. Coverage is uploaded
as a CI artifact and merged into the fleet coverage dashboard.

Usage:
    python3 tools/cargo-fuzz-schedule/schedule.py \
        --fuzz-config crates/fuzz_targets.toml \
        --output-dir coverage/fuzz
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import subprocess
import sys
from pathlib import Path


def load_targets(config_path: Path) -> list[dict]:
    """Load fuzz targets from a TOML config (lightweight manual parser)."""
    if not config_path.exists():
        return []
    targets = []
    current: dict = {}
    for raw in config_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[[target]]"):
            if current:
                targets.append(current)
            current = {}
        elif "=" in line:
            k, _, v = line.partition("=")
            current[k.strip()] = v.strip().strip('"')
    if current:
        targets.append(current)
    return targets


def run_fuzz_target(target: dict, output_dir: Path, minutes: int = 5) -> dict:
    """Run a single fuzz target for `minutes` of CPU."""
    name = target.get("name", "unnamed")
    crate = target.get("crate", ".")
    target_name = target.get("fuzz_target", "fuzz_target_1")
    started = _dt.datetime.now(_dt.timezone.utc).isoformat()
    result = {
        "name": name,
        "crate": crate,
        "fuzz_target": target_name,
        "started_at": started,
        "duration_minutes": minutes,
        "crashes": 0,
        "corpus_size": 0,
        "coverage_pct": 0.0,
        "exit_code": -1,
    }
    try:
        proc = subprocess.run(
            [
                "cargo",
                "+nightly",
                "fuzz",
                "run",
                target_name,
                "--",
                f"-max_total_time={minutes * 60}",
            ],
            cwd=crate,
            capture_output=True,
            text=True,
            timeout=minutes * 60 + 30,
        )
        result["exit_code"] = proc.returncode
        # crude log scrape
        for ln in proc.stdout.splitlines():
            if "cov:" in ln:
                try:
                    result["coverage_pct"] = float(ln.split("cov:")[1].strip().rstrip("%").split()[0])
                except (IndexError, ValueError):
                    pass
            if "BINGO" in ln or "crash:" in ln:
                result["crashes"] += 1
        corpus_dir = Path(crate) / "fuzz" / "corpus" / target_name
        if corpus_dir.exists():
            result["corpus_size"] = sum(1 for _ in corpus_dir.iterdir())
    except subprocess.TimeoutExpired:
        result["exit_code"] = 124
        result["error"] = "timeout"
    except Exception as exc:
        result["exit_code"] = -1
        result["error"] = str(exc)
    result["finished_at"] = _dt.datetime.now(_dt.timezone.utc).isoformat()
    return result


def schedule_nightly(targets: list[dict], output_dir: Path, total_minutes: int = 60) -> dict:
    """Distribute total_minutes across targets, 5min each (or all if fewer targets)."""
    per_target = max(1, min(5, total_minutes // max(1, len(targets))))
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for t in targets:
        results.append(run_fuzz_target(t, output_dir, minutes=per_target))
    summary = {
        "schedule_id": _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
        "target_count": len(targets),
        "per_target_minutes": per_target,
        "total_crashes": sum(r["crashes"] for r in results),
        "results": results,
    }
    (output_dir / f"fuzz-summary-{summary['schedule_id']}.json").write_text(
        json.dumps(summary, indent=2)
    )
    return summary


def render_summary(summary: dict) -> str:
    lines = [f"# cargo-fuzz schedule — {summary['schedule_id']}", ""]
    lines.append(f"Targets: {summary['target_count']}, "
                 f"per-target minutes: {summary['per_target_minutes']}, "
                 f"total crashes: {summary['total_crashes']}")
    lines.append("")
    lines.append("| Target | Crashes | Coverage | Corpus | Exit |")
    lines.append("|---|---|---|---|---|")
    for r in summary["results"]:
        lines.append(f"| {r['name']} | {r['crashes']} | {r['coverage_pct']:.1f}% | "
                     f"{r['corpus_size']} | {r['exit_code']} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="cargo-fuzz nightly scheduler")
    ap.add_argument("--fuzz-config", default="crates/fuzz_targets.toml")
    ap.add_argument("--output-dir", default="coverage/fuzz")
    ap.add_argument("--total-minutes", type=int, default=60)
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()
    targets = load_targets(Path(args.fuzz_config))
    if not targets:
        print(f"no fuzz targets at {args.fuzz_config}", file=sys.stderr)
        return 2
    summary = schedule_nightly(targets, Path(args.output_dir), args.total_minutes)
    if args.summary:
        sys.stdout.write(render_summary(summary))
    else:
        print(json.dumps(summary, indent=2))
    return 0 if summary["total_crashes"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())