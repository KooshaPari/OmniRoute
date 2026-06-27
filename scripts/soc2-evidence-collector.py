#!/usr/bin/env python3
"""SOC2 evidence collector for Phenotype fleet repos.

Pillar L51 (SOC2 evidence automation) cycle-15 T1.
Collects evidence for CC1-CC9 controls and emits JSON or markdown summary.

Usage:
    python3 scripts/soc2-evidence-collector.py --control CC6.1 --output evidence.json
    python3 scripts/soc2-evidence-collector.py --all --summary
    python3 scripts/soc2-evidence-collector.py --all --repo HeliosLab
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _has_workflow_named(repo: Path, needle: str) -> bool:
    wf = repo / ".github" / "workflows"
    if not wf.is_dir():
        return False
    return any(needle in p.name.lower() for p in wf.iterdir() if p.is_file())


CONTROLS = {
    "CC1.1": {"name": "Code of conduct",          "check": lambda r: (r / "CODE_OF_CONDUCT.md").exists()},
    "CC1.4": {"name": "Reviewer assignment",     "check": lambda r: (r / ".github" / "CODEOWNERS").exists()},
    "CC2.1": {"name": "AGENTS.md per repo",       "check": lambda r: (r / "AGENTS.md").exists()},
    "CC2.3": {"name": "SSOT per repo",            "check": lambda r: (r / "SSOT.md").exists() or (r / "docs" / "ssot.md").exists()},
    "CC3.1": {"name": "PR template",              "check": lambda r: (r / ".github" / "pull_request_template.md").exists()},
    "CC3.4": {"name": "CHANGELOG",                "check": lambda r: (r / "CHANGELOG.md").exists()},
    "CC5.2": {"name": "Justfile",                 "check": lambda r: (r / "justfile").exists()},
    "CC5.3": {"name": "Devcontainer",             "check": lambda r: (r / ".devcontainer" / "devcontainer.json").exists()},
    "CC6.1": {"name": "Pre-commit hooks",         "check": lambda r: (r / ".pre-commit-config.yaml").exists()},
    "CC6.6": {"name": "Branch protection",        "check": lambda r: (r / ".github" / "CODEOWNERS").exists()},
    "CC6.8": {"name": "Malware scanning",         "check": lambda r: _has_workflow_named(r, "secret-scan")},
    "CC7.1": {"name": "Vulnerability management", "check": lambda r: _has_workflow_named(r, "audit") or _has_workflow_named(r, "deny")},
    "CC7.2": {"name": "Monitoring (OTel)",        "check": lambda r: (r / "pheno-tracing").exists() or any("pheno-otel" in p.name for p in r.iterdir() if p.is_dir())},
    "CC7.3": {"name": "Incident response",        "check": lambda r: (r / "SECURITY.md").exists()},
    "CC7.4": {"name": "Backup / recovery",        "check": lambda r: (r / "docs" / "runbooks").exists() or (r / "runbooks").exists()},
    "CC8.1": {"name": "Change management",        "check": lambda r: (r / "AGENTS.md").exists()},
    "CC9.1": {"name": "Risk mitigation",          "check": lambda r: (r / "deny.toml").exists() or _has_workflow_named(r, "audit")},
    "CC9.2": {"name": "Vendor management",        "check": lambda r: (r / "docs" / "vendors.md").exists() or (r / "VENDORS.md").exists()},
}


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def _hash_file(p: Path) -> str:
    if not p.exists() or p.is_dir():
        return ""
    h = hashlib.sha256()
    try:
        h.update(p.read_bytes())
        return h.hexdigest()[:12]
    except Exception:
        return ""


def _git_info(repo: Path) -> dict:
    info = {"path": str(repo.relative_to(REPO_ROOT))}
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "log", "-1", "--format=%h %s %ai", "HEAD"],
            capture_output=True, text=True, timeout=10,
        )
        info["head"] = out.stdout.strip() if out.returncode == 0 else "no-git"
        out = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        info["branch"] = out.stdout.strip() if out.returncode == 0 else "unknown"
    except Exception as exc:
        info["error"] = str(exc)
    return info


def _pick_artifact(repo: Path, control_id: str) -> tuple[str | None, str | None]:
    """Return (relative_artifact_path, sha256_12) for the control, if any."""
    candidates = (
        repo / f"{control_id}.md",
        repo / "docs" / f"{control_id}.md",
        repo / "AGENTS.md",
        repo / "SSOT.md",
        repo / "CODE_OF_CONDUCT.md",
        repo / "CHANGELOG.md",
        repo / "SECURITY.md",
        repo / "justfile",
        repo / ".pre-commit-config.yaml",
        repo / ".github" / "CODEOWNERS",
        repo / ".devcontainer" / "devcontainer.json",
        repo / "deny.toml",
        repo / "VENDORS.md",
    )
    for c in candidates:
        if c.exists() and c.is_file():
            return str(c.relative_to(REPO_ROOT)), _hash_file(c)
    return None, None


def collect_one(repo: Path, control_id: str) -> dict:
    ctl = CONTROLS[control_id]
    evidence = {
        "control_id": control_id,
        "control_name": ctl["name"],
        "repo": str(repo.relative_to(REPO_ROOT)),
        "satisfied": False,
        "artifact": None,
        "artifact_sha256_12": None,
        "git_head": None,
        "git_branch": None,
        "collected_at": _now(),
    }
    try:
        evidence["satisfied"] = bool(ctl["check"](repo))
    except Exception as exc:
        evidence["check_error"] = str(exc)
    artifact, sha = _pick_artifact(repo, control_id)
    evidence["artifact"] = artifact
    evidence["artifact_sha256_12"] = sha
    info = _git_info(repo)
    evidence["git_head"] = info.get("head")
    evidence["git_branch"] = info.get("branch")
    return evidence


def list_repos() -> list[Path]:
    repos = []
    for p in REPO_ROOT.iterdir():
        if not p.is_dir() or p.name.startswith("."):
            continue
        # Real fleet repos either have .git/ (nested) or are well-known
        if (p / ".git").exists() or p.name in {
            "AgilePlus", "HexaKit", "PhenoCompose", "phenodag", "phenoShared",
            "PhenotypeHandoff",
        }:
            repos.append(p)
    return sorted(repos)


def collect_all(controls: list[str] | None = None) -> dict:
    controls = controls or list(CONTROLS.keys())
    repos = list_repos()
    fleet = []
    for r in repos:
        fleet.append({
            "repo": r.name,
            "controls": [collect_one(r, c) for c in controls],
        })
    return {
        "schema_version": "1.0",
        "framework": "SOC2-Type-II-2017",
        "generated_at": _now(),
        "repo_root": str(REPO_ROOT),
        "controls": [{"id": c, "name": CONTROLS[c]["name"]} for c in controls],
        "fleet": fleet,
    }


def render_summary(report: dict) -> str:
    lines = [
        f"# SOC2 Evidence Report — {report['generated_at']}",
        "",
        f"Framework: {report['framework']}  Repo root: `{report['repo_root']}`",
        f"Repos scanned: {len(report['fleet'])}  Controls: {len(report['controls'])}",
        "",
        "## Coverage Matrix",
        "",
        "| Repo | " + " | ".join(c["id"] for c in report["controls"]) + " |",
        "|" + "---|" * (len(report["controls"]) + 1),
    ]
    for entry in report["fleet"]:
        cells = ["Y" if c["satisfied"] else "." for c in entry["controls"]]
        lines.append(f"| {entry['repo']} | " + " | ".join(cells) + " |")
    lines.append("")
    satisfied = sum(1 for e in report["fleet"] for c in e["controls"] if c["satisfied"])
    total = sum(len(e["controls"]) for e in report["fleet"])
    pct = 100.0 * satisfied / total if total else 0
    lines.append(f"## Summary: {satisfied}/{total} controls satisfied ({pct:.1f}%)")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="SOC2 evidence collector for Phenotype fleet")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--control", help="Single control id (e.g. CC6.1)")
    g.add_argument("--all", action="store_true", help="All 18 controls")
    ap.add_argument("--repo", help="Single repo name (default: all repos)")
    ap.add_argument("--output", "-o", help="Write JSON to file (default: stdout)")
    ap.add_argument("--summary", action="store_true", help="Emit markdown summary table")
    args = ap.parse_args()

    controls = list(CONTROLS.keys()) if args.all else [args.control]
    for c in controls:
        if c not in CONTROLS:
            print(f"unknown control: {c}", file=sys.stderr)
            return 2

    report = collect_all(controls)
    if args.repo:
        report["fleet"] = [e for e in report["fleet"] if e["repo"] == args.repo]

    if args.summary:
        sys.stdout.write(render_summary(report))
    else:
        out = json.dumps(report, indent=2, sort_keys=True)
        if args.output:
            Path(args.output).write_text(out)
            print(f"wrote {args.output}", file=sys.stderr)
        else:
            sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())