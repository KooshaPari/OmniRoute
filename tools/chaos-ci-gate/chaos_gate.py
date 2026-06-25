#!/usr/bin/env python3
"""L36 chaos-CI gate (v28 cycle-18 T2).

Runs weekly chaos experiments against a sample of fleet services and gates
any PR that introduces a chaos experiment failure. Stdlib only, Python 3.9+.

The fleet sample is defined inline below; in production this would be loaded
from chaos-injection/GAME-DAY-SCHEDULE.json. Each service has:
  - name: short identifier (e.g., "pheno-port-adapter")
  - kind: "rust" | "python" | "go"
  - command: shell command that runs the chaos experiment for that service
  - timeout_s: per-service wall-clock budget
  - paths: file path prefixes that should trigger this experiment on a PR

Usage:
    # Weekly cron (full fleet sample)
    python3 tools/chaos-ci-gate/chaos_gate.py run

    # PR mode (only services whose paths appear in --changed)
    python3 tools/chaos-ci-gate/chaos_gate.py run --changed <(git diff --name-only origin/main)

    # Dry-run (print plan, don't execute)
    python3 tools/chaos-ci-gate/chaos_gate.py plan

    # JSON output (for CI consumption)
    python3 tools/chaos-ci-gate/chaos_gate.py run --json

Exit codes:
  0  -- all sampled experiments passed (or no experiments to run)
  1  -- at least one experiment failed (gate failure)
  2  -- usage / I/O error
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as _dt
import json
import shlex
import subprocess
import sys
from pathlib import Path

SCHEMA_VERSION = "1.0"

# Sample of 3 fleet services. Real deployments would load this from
# chaos-injection/GAME-DAY-SCHEDULE.json or similar config.
FLEET_SAMPLE: list[dict] = [
    {
        "name": "pheno-port-adapter",
        "kind": "rust",
        "command": "cargo test --release --test chaos_connect_to_unroutable -- --nocapture",
        "timeout_s": 300,
        "paths": ["pheno-port-adapter/", "pheno-port-adapter/tests/"],
    },
    {
        "name": "pheno-tracing",
        "kind": "rust",
        "command": "cargo test --release --lib chaos -- --nocapture",
        "timeout_s": 240,
        "paths": ["pheno-tracing/", "pheno-tracing/src/"],
    },
    {
        "name": "pheno-otel",
        "kind": "rust",
        "command": "cargo test --release --lib chaos -- --nocapture",
        "timeout_s": 240,
        "paths": ["pheno-otel/", "pheno-otel/src/"],
    },
]


@dataclasses.dataclass
class ExperimentResult:
    name: str
    kind: str
    status: str          # "pass" | "fail" | "skipped"
    duration_s: float
    returncode: int
    stdout_tail: str
    stderr_tail: str
    reason: str = ""     # populated for skipped/fail

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


def _select_services(changed: list[str], pr_mode: bool) -> list[dict]:
    """Return services to run.

    Weekly mode (pr_mode=False): always return the full sample.
    PR mode (pr_mode=True): return only services whose `paths` intersect
    with `changed`; returns [] when no matches so the gate no-ops.
    """
    if not pr_mode:
        return list(FLEET_SAMPLE)
    selected = []
    for svc in FLEET_SAMPLE:
        for prefix in svc["paths"]:
            for f in changed:
                if f.startswith(prefix) or f == prefix.rstrip("/"):
                    selected.append(svc)
                    break
            else:
                continue
            break
    return selected


def _run_experiment(svc: dict, dry_run: bool = False) -> ExperimentResult:
    name = svc["name"]
    if dry_run:
        return ExperimentResult(
            name=name, kind=svc["kind"], status="skipped",
            duration_s=0.0, returncode=0, stdout_tail="", stderr_tail="",
            reason="dry-run",
        )
    started = _dt.datetime.now(_dt.timezone.utc)
    try:
        proc = subprocess.run(
            shlex.split(svc["command"]),
            capture_output=True, text=True,
            timeout=svc["timeout_s"], check=False,
        )
        duration = (_dt.datetime.now(_dt.timezone.utc) - started).total_seconds()
        status = "pass" if proc.returncode == 0 else "fail"
        return ExperimentResult(
            name=name, kind=svc["kind"], status=status,
            duration_s=round(duration, 3), returncode=proc.returncode,
            stdout_tail=proc.stdout[-400:], stderr_tail=proc.stderr[-400:],
        )
    except subprocess.TimeoutExpired as e:
        duration = (_dt.datetime.now(_dt.timezone.utc) - started).total_seconds()
        return ExperimentResult(
            name=name, kind=svc["kind"], status="fail",
            duration_s=round(duration, 3), returncode=124,
            stdout_tail="", stderr_tail=f"timeout after {svc['timeout_s']}s",
            reason="timeout",
        )
    except FileNotFoundError as e:
        return ExperimentResult(
            name=name, kind=svc["kind"], status="fail",
            duration_s=0.0, returncode=127, stdout_tail="", stderr_tail=str(e),
            reason="command-not-found",
        )


def _read_changed(path: str | None) -> list[str]:
    if not path:
        return []
    if path == "-":
        return [ln.strip() for ln in sys.stdin if ln.strip()]
    p = Path(path)
    if not p.exists():
        print(f"changed-file path not found: {path}", file=sys.stderr)
        sys.exit(2)
    return [ln.strip() for ln in p.read_text().splitlines() if ln.strip()]


def render_summary(report: dict) -> str:
    lines = [f"# L36 chaos-CI gate report -- {report['generated_at']}", ""]
    s = report["summary"]
    lines.append(
        f"Experiments: {s['total']}  Passed: {s['passed']}  "
        f"Failed: {s['failed']}  Skipped: {s['skipped']}"
    )
    lines.append("")
    for r in report["results"]:
        marker = {"pass": "OK  ", "fail": "FAIL", "skipped": "SKIP"}[r["status"]]
        lines.append(f"- {marker} {r['name']} ({r['kind']}) [{r['duration_s']}s]")
        if r["status"] == "fail" and r["reason"]:
            lines.append(f"      reason: {r['reason']}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="L36 chaos-CI gate runner")
    sub = ap.add_subparsers(dest="cmd", required=True)

    run_p = sub.add_parser("run", help="execute sampled chaos experiments")
    run_p.add_argument("--changed", help="file with newline-separated changed paths (PR mode)")
    run_p.add_argument("--json", action="store_true", help="emit JSON to stdout")
    run_p.add_argument("--output", "-o", help="write JSON report to file")
    run_p.add_argument("--summary", action="store_true", help="emit markdown summary")
    run_p.add_argument("--dry-run", action="store_true", help="plan only, don't execute")

    sub.add_parser("plan", help="list the sampled services without running")

    args = ap.parse_args()
    if args.cmd == "plan":
        for svc in FLEET_SAMPLE:
            print(f"{svc['name']:<24} kind={svc['kind']:<8} timeout={svc['timeout_s']}s")
        return 0

    pr_mode = getattr(args, "changed", None) is not None
    changed = _read_changed(getattr(args, "changed", None))
    selected = _select_services(changed, pr_mode=pr_mode)
    if not selected:
        # PR mode with no matching paths => no-op pass.
        report = {
            "schema_version": SCHEMA_VERSION,
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            "mode": "pr" if pr_mode else "weekly",
            "fleet_size": len(FLEET_SAMPLE),
            "selected_size": 0,
            "summary": {"total": 0, "passed": 0, "failed": 0, "skipped": 0},
            "results": [],
        }
        if args.json or args.summary:
            sys.stdout.write(render_summary(report) if args.summary else json.dumps(report, indent=2))
        else:
            print("no chaos experiments selected (PR didn't touch any trigger paths)")
        return 0

    results = [_run_experiment(svc, dry_run=args.dry_run) for svc in selected]
    summary = {
        "total": len(results),
        "passed": sum(1 for r in results if r.status == "pass"),
        "failed": sum(1 for r in results if r.status == "fail"),
        "skipped": sum(1 for r in results if r.status == "skipped"),
    }
    report = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "mode": "pr" if pr_mode else "weekly",
        "fleet_size": len(FLEET_SAMPLE),
        "selected_size": len(selected),
        "summary": summary,
        "results": [r.to_dict() for r in results],
    }
    if args.summary:
        sys.stdout.write(render_summary(report))
    elif args.json or args.output:
        out = json.dumps(report, indent=2)
        if args.output:
            Path(args.output).write_text(out)
            print(f"wrote {args.output}", file=sys.stderr)
        else:
            sys.stdout.write(out)
    else:
        for r in results:
            print(f"{r.status.upper():<5} {r.name:<24} ({r.duration_s}s)")
        print(
            f"summary: {summary['passed']}/{summary['total']} passed, "
            f"{summary['failed']} failed"
        )
    return 1 if summary["failed"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())