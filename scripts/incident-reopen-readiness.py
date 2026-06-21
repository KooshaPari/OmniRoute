#!/usr/bin/env python3
"""Check whether the secret-spill incident is ready to reopen public surfaces.

The output is sanitized. It reports gate names and provider rows only, never
secret values, token prefixes, account IDs, screenshots, or raw alert payloads.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


DEFAULT_INCIDENT_DOC = Path("docs/operations/secrets-pii-incident-2026-06-20.md")

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


def readiness_summary() -> dict[str, object]:
    resolved_doc = resolve_incident_doc()
    text = resolved_doc.read_text(encoding="utf-8")
    lines = text.splitlines()
    provider_blockers = provider_failures(lines)
    gate_blockers = gate_failures(lines)
    blockers = provider_blockers + gate_blockers
    return {
        "incident_doc": str(resolved_doc.relative_to(Path.cwd().resolve())),
        "ready_to_reopen": not blockers,
        "provider_blocker_count": len(provider_blockers),
        "gate_blocker_count": len(gate_blockers),
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
    args = parser.parse_args()

    try:
        summary = readiness_summary()
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
