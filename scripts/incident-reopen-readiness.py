#!/usr/bin/env python3
"""Check whether the secret-spill incident is ready to reopen public surfaces.

The output is sanitized. It reports gate names and provider rows only, never
secret values, token prefixes, account IDs, screenshots, or raw alert payloads.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


DEFAULT_INCIDENT_DOC = Path("docs/operations/secrets-pii-incident-2026-06-20.md")
DEFAULT_REPOSITORY = "KooshaPari/phenotype-registry"

PROVIDER_HEADER = "| Provider / secret type | Alert numbers | Rotation status | Owner | Evidence link |"
READY_STATUS = {"rotated", "revoked", "complete", "completed", "not applicable", "n/a"}


def normalize_cell(cell: str) -> str:
    return cell.strip().strip("`").strip()


def table_rows(lines: list[str], header: str) -> list[list[str]]:
    rows: list[list[str]] = []
    in_table = False

    for line in lines:
        if line.strip() == header:
            in_table = True
            continue

        if not in_table:
            continue

        stripped = line.strip()
        if stripped.startswith("| ---"):
            continue
        if not stripped.startswith("|"):
            break

        cells = [normalize_cell(cell) for cell in stripped.strip("|").split("|")]
        if cells:
            rows.append(cells)

    return rows


def reopen_gate_items(lines: list[str]) -> dict[str, bool]:
    items: dict[str, bool] = {}
    in_section = False

    for line in lines:
        if line.startswith("## "):
            in_section = line.strip() == "## Reopen Readiness Gate"
            continue

        if not in_section:
            continue

        stripped = line.strip()
        if stripped.startswith("- [") and "] " in stripped:
            mark = stripped[3:4].lower()
            label = stripped.split("] ", 1)[1].strip()
            if mark in {" ", "x"} and label:
                items[label] = mark == "x"

    return items


def provider_failures(lines: list[str]) -> list[str]:
    failures: list[str] = []
    for cells in table_rows(lines, PROVIDER_HEADER):
        if len(cells) < 5:
            continue

        provider, alerts, status, _owner, evidence = cells[:5]
        status_value = status.lower()
        evidence_value = evidence.lower()
        if status_value not in READY_STATUS:
            failures.append(f"{provider} alerts {alerts}: rotation status is {status}")
            continue
        if evidence_value in {"", "pending", "todo", "tbd"}:
            failures.append(f"{provider} alerts {alerts}: evidence link is {evidence or 'missing'}")

    return failures


def gate_failures(lines: list[str]) -> list[str]:
    items = reopen_gate_items(lines)
    if not items:
        return ["Reopen Readiness Gate section is missing"]

    return [f"unchecked gate: {label}" for label, checked in items.items() if not checked]


def run_gh_api(path: str) -> object:
    proc = subprocess.run(
        ["gh", "api", path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode:
        raise ValueError(f"GitHub API request failed for {path}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"GitHub API returned non-json for {path}") from exc


def live_controls_from_github(repository: str) -> dict[str, object]:
    repo = run_gh_api(f"repos/{repository}")
    actions = run_gh_api(f"repos/{repository}/actions/permissions")
    protection = run_gh_api(f"repos/{repository}/branches/main/protection")
    if not isinstance(repo, dict) or not isinstance(actions, dict) or not isinstance(protection, dict):
        raise ValueError("GitHub API returned an unexpected shape")

    return summarize_live_controls(repository, repo, actions, protection)


def live_controls_from_fixture(path: Path) -> dict[str, object]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"live controls fixture cannot be read: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"live controls fixture is not json: {path}") from exc

    if not isinstance(raw, dict):
        raise ValueError("live controls fixture must be a json object")
    return {
        "repository": str(raw.get("repository", "fixture")),
        "private": bool(raw.get("private")),
        "pages_enabled": bool(raw.get("pages_enabled")),
        "actions_enabled": bool(raw.get("actions_enabled")),
        "branch_protection": {
            "enforce_admins": bool(raw.get("enforce_admins")),
            "allow_deletions": bool(raw.get("allow_deletions")),
            "allow_force_pushes": bool(raw.get("allow_force_pushes")),
        },
    }


def summarize_live_controls(
    repository: str,
    repo: dict[str, object],
    actions: dict[str, object],
    protection: dict[str, object],
) -> dict[str, object]:
    enforce_admins = protection.get("enforce_admins", {})
    allow_deletions = protection.get("allow_deletions", {})
    allow_force_pushes = protection.get("allow_force_pushes", {})
    return {
        "repository": repository,
        "private": bool(repo.get("private")),
        "pages_enabled": bool(repo.get("has_pages")),
        "actions_enabled": bool(actions.get("enabled")),
        "branch_protection": {
            "enforce_admins": bool(enforce_admins.get("enabled")) if isinstance(enforce_admins, dict) else False,
            "allow_deletions": bool(allow_deletions.get("enabled")) if isinstance(allow_deletions, dict) else True,
            "allow_force_pushes": bool(allow_force_pushes.get("enabled")) if isinstance(allow_force_pushes, dict) else True,
        },
    }


def live_control_failures(summary: dict[str, object]) -> list[str]:
    failures: list[str] = []
    if not summary.get("private"):
        failures.append("live control: repository is not private")
    if summary.get("pages_enabled"):
        failures.append("live control: GitHub Pages is enabled")
    if summary.get("actions_enabled"):
        failures.append("live control: GitHub Actions is enabled")

    protection = summary.get("branch_protection", {})
    if not isinstance(protection, dict):
        return failures + ["live control: branch protection summary is missing"]
    if not protection.get("enforce_admins"):
        failures.append("live control: branch protection does not enforce admins")
    if protection.get("allow_deletions"):
        failures.append("live control: branch deletions are allowed")
    if protection.get("allow_force_pushes"):
        failures.append("live control: force pushes are allowed")
    return failures


def resolve_incident_doc() -> Path:
    root = Path.cwd().resolve()
    candidate = root / DEFAULT_INCIDENT_DOC
    resolved = candidate.resolve()

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"incident doc must be inside {root}") from exc

    if resolved.suffix.lower() != ".md":
        raise ValueError("incident doc must be a markdown file")
    if not resolved.is_file():
        raise ValueError(f"incident doc does not exist: {DEFAULT_INCIDENT_DOC}")
    return resolved


def readiness_summary(
    verify_live_controls: bool = False,
    repository: str = DEFAULT_REPOSITORY,
    live_controls_fixture: Path | None = None,
) -> dict[str, object]:
    resolved_doc = resolve_incident_doc()
    text = resolved_doc.read_text(encoding="utf-8")
    lines = text.splitlines()
    provider_blockers = provider_failures(lines)
    gate_blockers = gate_failures(lines)
    live_controls: dict[str, object] = {"status": "not_requested"}
    live_control_blockers: list[str] = []
    if verify_live_controls:
        if live_controls_fixture:
            live_controls = live_controls_from_fixture(live_controls_fixture)
        else:
            live_controls = live_controls_from_github(repository)
        live_controls["status"] = "checked"
        live_control_blockers = live_control_failures(live_controls)
    blockers = provider_blockers + gate_blockers + live_control_blockers
    return {
        "incident_doc": str(resolved_doc.relative_to(Path.cwd().resolve())),
        "ready_to_reopen": not blockers,
        "provider_blocker_count": len(provider_blockers),
        "gate_blocker_count": len(gate_blockers),
        "live_control_blocker_count": len(live_control_blockers),
        "live_controls": live_controls,
        "blockers": blockers,
    }


def print_text(summary: dict[str, object]) -> None:
    if summary["ready_to_reopen"]:
        print("incident-reopen-readiness: ready to reopen public surfaces")
        return

    print("incident-reopen-readiness: blocked. No secret values are printed.")
    for blocker in summary["blockers"]:
        print(f"- {blocker}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check sanitized incident reopen gates.")
    parser.add_argument("--json", action="store_true", help="Print sanitized JSON.")
    parser.add_argument(
        "--expect-open",
        action="store_true",
        help="Succeed only when the incident still has blockers.",
    )
    parser.add_argument(
        "--verify-live-controls",
        action="store_true",
        help="Verify repository visibility, Actions, Pages, and branch-protection controls through GitHub.",
    )
    parser.add_argument(
        "--repository",
        default=DEFAULT_REPOSITORY,
        help="Repository to check when --verify-live-controls is used.",
    )
    parser.add_argument(
        "--live-controls-fixture",
        type=Path,
        help="Read sanitized live-control booleans from a JSON fixture instead of GitHub.",
    )
    args = parser.parse_args()

    try:
        summary = readiness_summary(
            args.verify_live_controls,
            args.repository,
            args.live_controls_fixture,
        )
    except ValueError as exc:
        print(f"incident-reopen-readiness: blocked. {exc}")
        return 1

    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
    else:
        print_text(summary)

    ready = bool(summary["ready_to_reopen"])
    if args.expect_open:
        return 0 if not ready else 1
    return 0 if ready else 1


if __name__ == "__main__":
    sys.exit(main())
