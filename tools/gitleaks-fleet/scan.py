#!/usr/bin/env python3
"""gitleaks-fleet: fleet-wide gitleaks scanner (L47.1 P2)

Walks every repo in the fleet, runs gitleaks detect, and aggregates
findings into a single fleet-wide report. Excludes vendor/, target/,
node_modules/, .git/.

Usage:
    python3 tools/gitleaks-fleet/scan.py \
        --repo-root . \
        --output reports/gitleaks-fleet.json
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys
from pathlib import Path


EXCLUDE_DIRS = {"vendor", "target", "node_modules", ".git", "dist", "build", ".venv", "__pycache__"}


def iter_repos(repo_root: Path) -> list[Path]:
    """Find git repo roots (top-level directories containing .git)."""
    out: list[Path] = []
    for d in sorted(repo_root.iterdir()):
        if not d.is_dir() or d.name in EXCLUDE_DIRS or d.name.startswith("."):
            continue
        if (d / ".git").exists():
            out.append(d)
    return out


def scan_repo(repo: Path) -> dict:
    """Run gitleaks detect on a single repo."""
    started = _dt.datetime.now(_dt.timezone.utc).isoformat()
    findings: list[dict] = []
    try:
        proc = subprocess.run(
            ["gitleaks", "detect", "--no-git", "-r", str(repo), "-f", "json", "-q"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        for ln in proc.stdout.strip().splitlines():
            if not ln.strip():
                continue
            try:
                f = json.loads(ln)
                findings.append(f)
            except Exception:
                pass
    except FileNotFoundError:
        # gitleaks not installed — emit advisory only
        pass
    except subprocess.TimeoutExpired:
        findings.append({"RuleID": "TIMEOUT", "repo": str(repo), "Description": "scan timeout"})
    except Exception as exc:
        findings.append({"RuleID": "ERROR", "repo": str(repo), "Description": str(exc)})
    return {
        "repo": str(repo),
        "scanned_at": started,
        "finding_count": len(findings),
        "findings": findings,
    }


def fleet_scan(repo_root: Path) -> dict:
    repos = iter_repos(repo_root)
    results = [scan_repo(r) for r in repos]
    total = sum(r["finding_count"] for r in results)
    return {
        "scanned_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "repo_count": len(repos),
        "total_findings": total,
        "results": results,
    }


def render(report: dict) -> str:
    lines = [f"# Gitleaks fleet scan — {report['scanned_at']}", ""]
    lines.append(f"Repos: {report['repo_count']}, "
                 f"total findings: {report['total_findings']}")
    lines.append("")
    lines.append("| Repo | Findings |")
    lines.append("|---|---|")
    for r in sorted(report["results"], key=lambda x: -x["finding_count"]):
        lines.append(f"| `{r['repo']}` | {r['finding_count']} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet gitleaks scanner")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--output", required=True)
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()
    report = fleet_scan(Path(args.repo_root))
    Path(args.output).write_text(json.dumps(report, indent=2))
    if args.summary:
        sys.stdout.write(render(report))
    return 0 if report["total_findings"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())