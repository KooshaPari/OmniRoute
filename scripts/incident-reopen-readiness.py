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
DEFAULT_INCIDENT_ISSUE = 320
DEFAULT_TREE_SCANNER = Path("scripts/retained-history-secret-scan.py")

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


def incident_issue_from_github(repository: str, issue_number: int) -> dict[str, object]:
    issue = run_gh_api(f"repos/{repository}/issues/{issue_number}")
    if not isinstance(issue, dict):
        raise ValueError("GitHub API returned an unexpected issue shape")
    return summarize_incident_issue(repository, issue_number, issue)


def incident_issue_from_fixture(path: Path) -> dict[str, object]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"incident issue fixture cannot be read: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"incident issue fixture is not json: {path}") from exc

    if not isinstance(raw, dict):
        raise ValueError("incident issue fixture must be a json object")
    return {
        "repository": str(raw.get("repository", "fixture")),
        "number": int(raw.get("number", DEFAULT_INCIDENT_ISSUE)),
        "state": str(raw.get("state", "open")).lower(),
        "title": str(raw.get("title", "")),
        "url": str(raw.get("url", "")),
    }


def summarize_incident_issue(
    repository: str,
    issue_number: int,
    issue: dict[str, object],
) -> dict[str, object]:
    return {
        "repository": repository,
        "number": issue_number,
        "state": str(issue.get("state", "unknown")).lower(),
        "title": str(issue.get("title", "")),
        "url": str(issue.get("html_url", "")),
    }


def incident_issue_failures(summary: dict[str, object]) -> list[str]:
    if summary.get("state") == "closed":
        return []
    number = summary.get("number", DEFAULT_INCIDENT_ISSUE)
    return [f"incident issue #{number} is not closed"]


def nonzero_finding_labels(scan_summary: dict[str, object]) -> list[str]:
    findings = scan_summary.get("findings", {})
    if not isinstance(findings, dict):
        return ["malformed findings"]

    labels: list[str] = []
    for label, record in findings.items():
        if isinstance(record, dict) and int(record.get("blob_count", 0)):
            labels.append(str(label))
    return sorted(labels)


def scan_runner(args: list[str]) -> dict[str, object]:
    scanner = Path.cwd().resolve() / DEFAULT_TREE_SCANNER
    if not scanner.is_file():
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "error": "scanner missing",
        }

    proc = subprocess.run(
        [sys.executable, str(scanner), *args, "--fail-on-findings"],
        cwd=Path.cwd().resolve(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    try:
        raw_summary = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "returncode": proc.returncode,
            "error": "scanner returned non-json output",
        }

    return {
        "raw_summary": raw_summary,
        "returncode": proc.returncode,
        "finding_labels": nonzero_finding_labels(raw_summary),
    }


def current_tree_scan_summary() -> dict[str, object]:
    scan = scan_runner(["--worktree-root", str(Path.cwd().resolve())])
    if scan.get("status") == "error":
        return scan

    raw_summary = scan["raw_summary"]
    assert isinstance(raw_summary, dict)
    finding_labels = scan["finding_labels"]
    missing_files = int(raw_summary.get("missing_files", 0))
    status = "clean"
    if scan["returncode"] or finding_labels or missing_files:
        status = "blocked"

    return {
        "status": status,
        "scanner": str(DEFAULT_TREE_SCANNER),
        "returncode": int(scan["returncode"]),
        "scanned_files": int(raw_summary.get("scanned_files", 0)),
        "skipped_large_files": int(raw_summary.get("skipped_large_files", 0)),
        "skipped_binary_files": int(raw_summary.get("skipped_binary_files", 0)),
        "missing_files": missing_files,
        "finding_labels": finding_labels,
    }


def retained_history_scan_summary(git_dir: Path | None) -> dict[str, object]:
    if git_dir is None:
        return {"status": "not_requested"}

    resolved_git_dir = git_dir.resolve()
    if not resolved_git_dir.is_dir():
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "git_dir": str(resolved_git_dir),
            "error": "retained history git dir missing",
        }

    scan = scan_runner([str(resolved_git_dir)])
    if scan.get("status") == "error":
        scan["git_dir"] = str(resolved_git_dir)
        return scan

    raw_summary = scan["raw_summary"]
    assert isinstance(raw_summary, dict)
    finding_labels = scan["finding_labels"]
    status = "clean"
    if scan["returncode"] or finding_labels:
        status = "blocked"

    return {
        "status": status,
        "scanner": str(DEFAULT_TREE_SCANNER),
        "git_dir": str(resolved_git_dir),
        "returncode": int(scan["returncode"]),
        "scanned_blobs": int(raw_summary.get("scanned_blobs", 0)),
        "skipped_large_blobs": int(raw_summary.get("skipped_large_blobs", 0)),
        "skipped_binary_blobs": int(raw_summary.get("skipped_binary_blobs", 0)),
        "finding_labels": finding_labels,
    }


def scan_failures(
    current_tree_scan: dict[str, object],
    retained_history_scan: dict[str, object],
) -> list[str]:
    failures: list[str] = []
    if current_tree_scan["status"] != "clean":
        finding_labels = current_tree_scan.get("finding_labels", [])
        if finding_labels:
            labels = ", ".join(str(label) for label in finding_labels)
            failures.append(f"current default branch scan has findings: {labels}")
        if int(current_tree_scan.get("missing_files", 0)):
            failures.append("current default branch scan has missing tracked files")
        if current_tree_scan["status"] == "error":
            failures.append(f"current default branch scan failed: {current_tree_scan.get('error', 'unknown error')}")
        if not failures:
            failures.append("current default branch scan failed")

    if retained_history_scan["status"] == "not_requested":
        failures.append("retained history scan was not verified")
    elif retained_history_scan["status"] != "clean":
        retained_failures: list[str] = []
        finding_labels = retained_history_scan.get("finding_labels", [])
        if finding_labels:
            labels = ", ".join(str(label) for label in finding_labels)
            retained_failures.append(f"retained history scan has findings: {labels}")
        if retained_history_scan["status"] == "error":
            retained_failures.append(f"retained history scan failed: {retained_history_scan.get('error', 'unknown error')}")
        if not retained_failures:
            retained_failures.append("retained history scan failed")
        failures.extend(retained_failures)
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
    verify_incident_issue: bool = False,
    incident_issue: int = DEFAULT_INCIDENT_ISSUE,
    incident_issue_fixture: Path | None = None,
    verify_scans: bool = False,
    retained_history_git_dir: Path | None = None,
) -> dict[str, object]:
    resolved_doc = resolve_incident_doc()
    text = resolved_doc.read_text(encoding="utf-8")
    lines = text.splitlines()
    provider_blockers = provider_failures(lines)
    gate_blockers = gate_failures(lines)
    live_controls: dict[str, object] = {"status": "not_requested"}
    live_control_blockers: list[str] = []
    incident_issue_summary: dict[str, object] = {"status": "not_requested"}
    incident_issue_blockers: list[str] = []
    current_tree_scan: dict[str, object] = {"status": "not_requested"}
    retained_history_scan: dict[str, object] = {"status": "not_requested"}
    scan_blockers: list[str] = []
    if verify_live_controls:
        if live_controls_fixture:
            live_controls = live_controls_from_fixture(live_controls_fixture)
        else:
            live_controls = live_controls_from_github(repository)
        live_controls["status"] = "checked"
        live_control_blockers = live_control_failures(live_controls)
    if verify_incident_issue:
        if incident_issue_fixture:
            incident_issue_summary = incident_issue_from_fixture(incident_issue_fixture)
        else:
            incident_issue_summary = incident_issue_from_github(repository, incident_issue)
        incident_issue_summary["status"] = "checked"
        incident_issue_blockers = incident_issue_failures(incident_issue_summary)
    if verify_scans:
        current_tree_scan = current_tree_scan_summary()
        retained_history_scan = retained_history_scan_summary(retained_history_git_dir)
        scan_blockers = scan_failures(current_tree_scan, retained_history_scan)
    blockers = provider_blockers + gate_blockers + live_control_blockers + incident_issue_blockers + scan_blockers
    return {
        "incident_doc": str(resolved_doc.relative_to(Path.cwd().resolve())),
        "ready_to_reopen": not blockers,
        "provider_blocker_count": len(provider_blockers),
        "gate_blocker_count": len(gate_blockers),
        "live_control_blocker_count": len(live_control_blockers),
        "incident_issue_blocker_count": len(incident_issue_blockers),
        "scan_blocker_count": len(scan_blockers),
        "live_controls": live_controls,
        "incident_issue": incident_issue_summary,
        "current_tree_scan": current_tree_scan,
        "retained_history_scan": retained_history_scan,
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
    parser.add_argument(
        "--verify-incident-issue",
        action="store_true",
        help="Verify that the incident tracker issue is closed before reopening.",
    )
    parser.add_argument(
        "--incident-issue",
        type=int,
        default=DEFAULT_INCIDENT_ISSUE,
        help="Incident issue number to check when --verify-incident-issue is used.",
    )
    parser.add_argument(
        "--incident-issue-fixture",
        type=Path,
        help="Read sanitized issue state from a JSON fixture instead of GitHub.",
    )
    parser.add_argument(
        "--verify-scans",
        action="store_true",
        help="Verify current-tree and retained-history scans before reopening.",
    )
    parser.add_argument(
        "--retained-history-git-dir",
        type=Path,
        help="Bare mirror git directory for --verify-scans.",
    )
    args = parser.parse_args()

    try:
        summary = readiness_summary(
            args.verify_live_controls,
            args.repository,
            args.live_controls_fixture,
            args.verify_incident_issue,
            args.incident_issue,
            args.incident_issue_fixture,
            args.verify_scans,
            args.retained_history_git_dir,
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
