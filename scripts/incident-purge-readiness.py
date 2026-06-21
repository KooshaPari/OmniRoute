#!/usr/bin/env python3
"""Check whether the GitHub Support purge request is ready to submit.

The output is sanitized. It reports provider rows and checklist labels only,
never secret values, token prefixes, account IDs, screenshots, or raw alert
payloads.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


DEFAULT_INCIDENT_DOC = Path("docs/operations/secrets-pii-incident-2026-06-20.md")
DEFAULT_PURGE_DOC = Path("docs/operations/github-purge-request-2026-06-20.md")
DEFAULT_TREE_SCANNER = Path("scripts/retained-history-secret-scan.py")

PROVIDER_HEADER = "| Provider / secret type | Alert numbers | Rotation status | Owner | Evidence link |"
READY_STATUS = {"rotated", "revoked", "complete", "completed", "not applicable", "n/a"}


def provider_rows(lines: list[str]) -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    in_inventory = False
    for line in lines:
        stripped = line.strip()
        if stripped == PROVIDER_HEADER:
            in_inventory = True
            continue
        if not in_inventory:
            continue
        if stripped.startswith("| ---"):
            continue
        if not stripped.startswith("|"):
            break

        cells = [cell.strip().strip("`") for cell in stripped.strip("|").split("|")]
        if len(cells) >= 5:
            rows.append((cells[0], cells[1], cells[2], cells[4]))
    return rows


def checklist_items(lines: list[str], section_title: str) -> dict[str, bool]:
    items: dict[str, bool] = {}
    in_section = False
    pending_label: str | None = None
    pending_checked = False

    def flush_pending() -> None:
        nonlocal pending_label, pending_checked
        if pending_label:
            items[pending_label.strip()] = pending_checked
        pending_label = None
        pending_checked = False

    for line in lines:
        if line.startswith("## "):
            flush_pending()
            in_section = line.strip() == section_title
            continue
        if not in_section:
            continue

        stripped = line.strip()
        if pending_label and not stripped:
            flush_pending()
            continue
        if stripped.startswith("- [") and "] " in stripped:
            flush_pending()
            mark = stripped[3:4].lower()
            pending_checked = mark == "x"
            pending_label = stripped.split("] ", 1)[1].strip()
            continue
        if pending_label and stripped:
            pending_label = f"{pending_label} {stripped}"

    flush_pending()
    return items


def provider_failures(incident_lines: list[str]) -> list[str]:
    failures: list[str] = []
    for provider, alerts, status, evidence in provider_rows(incident_lines):
        status_value = status.lower()
        evidence_value = evidence.lower()
        if status_value not in READY_STATUS:
            failures.append(f"{provider} alerts {alerts}: rotation status is {status}")
            continue
        if evidence_value in {"", "pending", "todo", "tbd"}:
            failures.append(f"{provider} alerts {alerts}: evidence link is {evidence or 'missing'}")
    return failures


def resolve_doc(path: Path, label: str) -> Path:
    root = Path.cwd().resolve()
    candidate = root / path
    resolved = candidate.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"{label} must be inside {root}") from exc
    if resolved.suffix.lower() != ".md":
        raise ValueError(f"{label} must be a markdown file")
    if not resolved.is_file():
        raise ValueError(f"{label} does not exist: {path}")
    return resolved


def nonzero_finding_labels(scan_summary: dict[str, object]) -> list[str]:
    findings = scan_summary.get("findings", {})
    if not isinstance(findings, dict):
        return ["malformed findings"]

    labels: list[str] = []
    for label, record in findings.items():
        if isinstance(record, dict) and int(record.get("blob_count", 0)):
            labels.append(str(label))
    return sorted(labels)


def current_tree_scan_summary() -> dict[str, object]:
    root = Path.cwd().resolve()
    scanner = root / DEFAULT_TREE_SCANNER
    if not scanner.is_file():
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "error": "scanner missing",
        }

    proc = subprocess.run(
        [
            sys.executable,
            str(scanner),
            "--worktree-root",
            str(root),
            "--fail-on-findings",
        ],
        cwd=root,
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

    finding_labels = nonzero_finding_labels(raw_summary)
    missing_files = int(raw_summary.get("missing_files", 0))
    status = "clean"
    if proc.returncode or finding_labels or missing_files:
        status = "blocked"

    return {
        "status": status,
        "scanner": str(DEFAULT_TREE_SCANNER),
        "returncode": proc.returncode,
        "scanned_files": int(raw_summary.get("scanned_files", 0)),
        "skipped_large_files": int(raw_summary.get("skipped_large_files", 0)),
        "skipped_binary_files": int(raw_summary.get("skipped_binary_files", 0)),
        "missing_files": missing_files,
        "finding_labels": finding_labels,
    }


def retained_history_scan_summary(git_dir: Path | None) -> dict[str, object]:
    if git_dir is None:
        return {"status": "not_requested"}

    scanner = Path.cwd().resolve() / DEFAULT_TREE_SCANNER
    if not scanner.is_file():
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "error": "scanner missing",
        }

    resolved_git_dir = git_dir.resolve()
    if not resolved_git_dir.is_dir():
        return {
            "status": "error",
            "scanner": str(DEFAULT_TREE_SCANNER),
            "git_dir": str(resolved_git_dir),
            "error": "retained history git dir missing",
        }

    proc = subprocess.run(
        [
            sys.executable,
            str(scanner),
            str(resolved_git_dir),
            "--fail-on-findings",
        ],
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
            "git_dir": str(resolved_git_dir),
            "returncode": proc.returncode,
            "error": "scanner returned non-json output",
        }

    finding_labels = nonzero_finding_labels(raw_summary)
    status = "clean"
    if proc.returncode or finding_labels:
        status = "blocked"

    return {
        "status": status,
        "scanner": str(DEFAULT_TREE_SCANNER),
        "git_dir": str(resolved_git_dir),
        "returncode": proc.returncode,
        "scanned_blobs": int(raw_summary.get("scanned_blobs", 0)),
        "skipped_large_blobs": int(raw_summary.get("skipped_large_blobs", 0)),
        "skipped_binary_blobs": int(raw_summary.get("skipped_binary_blobs", 0)),
        "finding_labels": finding_labels,
    }


def current_tree_scan_blockers(scan_summary: dict[str, object]) -> list[str]:
    if scan_summary["status"] == "clean":
        return []

    blockers: list[str] = []
    finding_labels = scan_summary.get("finding_labels", [])
    if finding_labels:
        labels = ", ".join(str(label) for label in finding_labels)
        blockers.append(f"current default branch scan has findings: {labels}")
    if int(scan_summary.get("missing_files", 0)):
        blockers.append("current default branch scan has missing tracked files")
    if scan_summary["status"] == "error":
        blockers.append(f"current default branch scan failed: {scan_summary.get('error', 'unknown error')}")
    if not blockers:
        blockers.append("current default branch scan failed")
    return blockers


def retained_history_scan_blockers(
    scan_summary: dict[str, object],
    full_history_checklist_checked: bool,
) -> list[str]:
    if scan_summary["status"] == "not_requested":
        if full_history_checklist_checked:
            return ["full-history checklist is checked but retained history scan was not verified"]
        return []
    if scan_summary["status"] == "clean":
        return []

    blockers: list[str] = []
    finding_labels = scan_summary.get("finding_labels", [])
    if finding_labels:
        labels = ", ".join(str(label) for label in finding_labels)
        blockers.append(f"retained history scan has findings: {labels}")
    if scan_summary["status"] == "error":
        blockers.append(f"retained history scan failed: {scan_summary.get('error', 'unknown error')}")
    if not blockers:
        blockers.append("retained history scan failed")
    return blockers


def checklist_checked(checklist: dict[str, bool], label_prefix: str) -> bool:
    return any(label.startswith(label_prefix) and checked for label, checked in checklist.items())


def readiness_summary(retained_history_git_dir: Path | None = None) -> dict[str, object]:
    incident_doc = resolve_doc(DEFAULT_INCIDENT_DOC, "incident doc")
    purge_doc = resolve_doc(DEFAULT_PURGE_DOC, "purge doc")
    incident_lines = incident_doc.read_text(encoding="utf-8").splitlines()
    purge_lines = purge_doc.read_text(encoding="utf-8").splitlines()

    provider_blockers = provider_failures(incident_lines)
    checklist = checklist_items(purge_lines, "## Confirmation Checklist")
    checklist_blockers = [f"unchecked purge checklist item: {label}" for label, checked in checklist.items() if not checked]
    current_tree_scan = current_tree_scan_summary()
    retained_history_scan = retained_history_scan_summary(retained_history_git_dir)
    technical_blockers = (
        current_tree_scan_blockers(current_tree_scan)
        + retained_history_scan_blockers(
            retained_history_scan,
            checklist_checked(checklist, "Full-history scan after rewrite is clean."),
        )
    )
    blockers = provider_blockers + checklist_blockers + technical_blockers

    return {
        "incident_doc": str(incident_doc.relative_to(Path.cwd().resolve())),
        "purge_doc": str(purge_doc.relative_to(Path.cwd().resolve())),
        "ready_to_submit_purge": not blockers,
        "provider_blocker_count": len(provider_blockers),
        "checklist_blocker_count": len(checklist_blockers),
        "technical_blocker_count": len(technical_blockers),
        "current_tree_scan": current_tree_scan,
        "retained_history_scan": retained_history_scan,
        "blockers": blockers,
    }


def print_text(summary: dict[str, object]) -> None:
    if summary["ready_to_submit_purge"]:
        print("incident-purge-readiness: ready to submit GitHub Support purge request")
        return

    print("incident-purge-readiness: blocked. No secret values are printed.")
    for blocker in summary["blockers"]:
        print(f"- {blocker}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check sanitized GitHub purge request readiness.")
    parser.add_argument("--json", action="store_true", help="Print sanitized JSON.")
    parser.add_argument(
        "--expect-blocked",
        action="store_true",
        help="Succeed only when the purge request still has blockers.",
    )
    parser.add_argument(
        "--retained-history-git-dir",
        type=Path,
        help="Bare mirror git directory for verifying the full-history purge checklist item.",
    )
    args = parser.parse_args()

    try:
        summary = readiness_summary(args.retained_history_git_dir)
    except ValueError as exc:
        print(f"incident-purge-readiness: blocked. {exc}")
        return 1

    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
    else:
        print_text(summary)

    ready = bool(summary["ready_to_submit_purge"])
    if args.expect_blocked:
        return 0 if not ready else 1
    return 0 if ready else 1


if __name__ == "__main__":
    sys.exit(main())
