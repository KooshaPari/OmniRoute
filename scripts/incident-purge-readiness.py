#!/usr/bin/env python3
"""Check whether the GitHub Support purge request is ready to submit.

The output is sanitized. It reports provider rows and checklist labels only,
never secret values, token prefixes, account IDs, screenshots, or raw alert
payloads.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


DEFAULT_INCIDENT_DOC = Path("docs/operations/secrets-pii-incident-2026-06-20.md")
DEFAULT_PURGE_DOC = Path("docs/operations/github-purge-request-2026-06-20.md")

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


def readiness_summary() -> dict[str, object]:
    incident_doc = resolve_doc(DEFAULT_INCIDENT_DOC, "incident doc")
    purge_doc = resolve_doc(DEFAULT_PURGE_DOC, "purge doc")
    incident_lines = incident_doc.read_text(encoding="utf-8").splitlines()
    purge_lines = purge_doc.read_text(encoding="utf-8").splitlines()

    provider_blockers = provider_failures(incident_lines)
    checklist = checklist_items(purge_lines, "## Confirmation Checklist")
    checklist_blockers = [f"unchecked purge checklist item: {label}" for label, checked in checklist.items() if not checked]
    blockers = provider_blockers + checklist_blockers

    return {
        "incident_doc": str(incident_doc.relative_to(Path.cwd().resolve())),
        "purge_doc": str(purge_doc.relative_to(Path.cwd().resolve())),
        "ready_to_submit_purge": not blockers,
        "provider_blocker_count": len(provider_blockers),
        "checklist_blocker_count": len(checklist_blockers),
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
    args = parser.parse_args()

    try:
        summary = readiness_summary()
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
