#!/usr/bin/env python3
"""Validate local incident evidence notes before tracker updates.

Evidence for provider-side rotation belongs outside git. This checker is for
local sanitized notes only; it reports file paths and finding labels without
printing matched values.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


DEFAULT_EVIDENCE_DIR = Path("incident-evidence")
DEFAULT_INCIDENT_DOC = Path("docs/operations/secrets-pii-incident-2026-06-20.md")
PROVIDER_HEADER = "| Provider / secret type | Alert numbers | Rotation status | Owner | Evidence link |"
REQUIRED_NOTE_FIELDS = (
    "provider",
    "alerts",
    "status",
    "activity_review",
    "replacement",
    "evidence_ref",
    "verified_by",
    "verified_at_utc",
)
ALLOWED_STATUS_VALUES = {"revoked", "rotated", "not applicable"}
ALLOWED_ACTIVITY_REVIEW_VALUES = {"complete", "needs follow-up", "not applicable"}
UTC_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
DENIED_EXTENSIONS = {
    ".csv",
    ".gif",
    ".har",
    ".htm",
    ".html",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".webp",
    ".zip",
}
SECRET_PATTERNS = (
    ("GitHub token", re.compile(r"gh[pousr]_\w{20,}")),
    ("npm token", re.compile(r"npm_[A-Za-z0-9_-]{20,}")),
    ("Sentry token", re.compile(r"sntryu_[A-Za-z0-9_-]{20,}")),
    ("OpenAI key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Discord bot token", re.compile(r"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("authorization header", re.compile(r"(?im)^\s*authorization:\s*(bearer|basic)\s+\S{12,}")),
    ("cookie header", re.compile(r"(?im)^\s*cookie:\s*[^=\s;]{2,}=[^;\n]{8,}")),
    ("refresh token field", re.compile(r"(?i)\brefresh[_-]?token\b\s*[:=]")),
)
PII_PATTERNS = (
    ("email address", re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")),
    ("IPv4 address", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("US SSN", re.compile(r"\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b")),
    ("account identifier label", re.compile(r"(?i)\b(account|tenant|organization|org|user|client)[_-]?id\b\s*[:=]")),
    ("raw alert payload marker", re.compile(r"(?i)\b(secret_scanning_alert|raw[_ -]?alert|provider[_ -]?export|console[_ -]?export)\b")),
)


def normalize_inventory_key(provider: str, alerts: str) -> tuple[str, str]:
    normalized_alerts = ", ".join(part.strip() for part in alerts.split(",") if part.strip())
    return (provider.strip().lower(), normalized_alerts)


def is_alert_list(value: str) -> bool:
    parts = [part.strip() for part in value.split(",")]
    return bool(parts) and all(part.isdecimal() for part in parts)


def provider_inventory(incident_doc: Path = DEFAULT_INCIDENT_DOC) -> set[tuple[str, str]]:
    if not incident_doc.exists():
        return set()

    inventory: set[tuple[str, str]] = set()
    in_inventory = False
    for line in incident_doc.read_text(encoding="utf-8").splitlines():
        if line.strip() == PROVIDER_HEADER:
            in_inventory = True
            continue
        if not in_inventory:
            continue
        if line.strip().startswith("| ---"):
            continue
        if not line.strip().startswith("|"):
            break

        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) >= 2 and is_alert_list(cells[1]):
            inventory.add(normalize_inventory_key(cells[0], cells[1]))
    return inventory


def parse_note_fields(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        normalized_key = key.strip().lower()
        if normalized_key in REQUIRED_NOTE_FIELDS:
            fields[normalized_key] = value.strip()
    return fields


def schema_findings(text: str, inventory: set[tuple[str, str]]) -> list[str]:
    fields = parse_note_fields(text)
    findings: list[str] = []

    for field in REQUIRED_NOTE_FIELDS:
        if not fields.get(field):
            findings.append(f"missing required field: {field}")

    status = fields.get("status", "").lower()
    if status and status not in ALLOWED_STATUS_VALUES:
        findings.append("invalid status value")

    activity_review = fields.get("activity_review", "").lower()
    if activity_review and activity_review not in ALLOWED_ACTIVITY_REVIEW_VALUES:
        findings.append("invalid activity_review value")

    verified_at_utc = fields.get("verified_at_utc", "")
    if verified_at_utc and not UTC_TIMESTAMP_PATTERN.match(verified_at_utc):
        findings.append("invalid verified_at_utc timestamp")

    alerts = fields.get("alerts", "")
    if alerts and not is_alert_list(alerts):
        findings.append("invalid alerts value")

    provider = fields.get("provider", "")
    if provider and alerts and is_alert_list(alerts):
        if not inventory:
            findings.append("missing provider inventory")
        elif normalize_inventory_key(provider, alerts) not in inventory:
            findings.append("provider alerts not in incident inventory")

    return findings


def iter_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(candidate for candidate in path.rglob("*") if candidate.is_file()))
        elif path.is_file():
            files.append(path)
        else:
            files.append(path)
    return files


def resolve_input_paths(paths: list[Path]) -> list[Path]:
    root = Path.cwd().resolve()
    resolved_paths: list[Path] = []
    for path in paths:
        candidate = path if path.is_absolute() else root / path
        resolved = candidate.resolve()
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise ValueError(f"evidence path must be inside {root}") from exc
        resolved_paths.append(resolved)
    return resolved_paths


def scan_file(path: Path, inventory: set[tuple[str, str]]) -> tuple[list[str], tuple[str, str] | None]:
    findings: list[str] = []
    if not path.exists():
        return ["missing file"], None
    if path.suffix.lower() in DENIED_EXTENSIONS:
        return ["unsupported evidence file type"], None

    try:
        data = path.read_bytes()
    except OSError:
        return ["unreadable file"], None

    if b"\0" in data:
        return ["binary file"], None

    text = data.decode("utf-8", errors="ignore")
    for label, pattern in (*SECRET_PATTERNS, *PII_PATTERNS):
        if pattern.search(text):
            findings.append(label)
    findings.extend(schema_findings(text, inventory))
    fields = parse_note_fields(text)
    evidence_key = None
    provider = fields.get("provider", "")
    alerts = fields.get("alerts", "")
    if not findings and provider and alerts:
        evidence_key = normalize_inventory_key(provider, alerts)
    return findings, evidence_key


def format_inventory_key(key: tuple[str, str]) -> str:
    provider, alerts = key
    return f"{provider} alerts {alerts}"


def scan(paths: list[Path], allow_missing_default: bool = False, require_all: bool = False) -> dict[str, object]:
    failures: dict[str, list[str]] = {}
    inventory = provider_inventory()
    covered: set[tuple[str, str]] = set()
    if allow_missing_default and paths == [DEFAULT_EVIDENCE_DIR] and not DEFAULT_EVIDENCE_DIR.exists():
        files: list[Path] = []
    else:
        files = iter_files(resolve_input_paths(paths))
    for path in files:
        findings, evidence_key = scan_file(path, inventory)
        if findings:
            failures[str(path)] = sorted(set(findings))
        elif evidence_key:
            covered.add(evidence_key)

    missing_rows: list[str] = []
    if require_all:
        missing_rows = [format_inventory_key(key) for key in sorted(inventory - covered)]
        if missing_rows:
            failures["inventory coverage"] = [f"missing evidence: {row}" for row in missing_rows]

    return {
        "checked_files": len(files),
        "covered_inventory_rows": len(covered),
        "inventory_rows": len(inventory),
        "missing_inventory_rows": missing_rows,
        "ok": not failures,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate sanitized local incident evidence notes.")
    parser.add_argument("--json", action="store_true", help="Print sanitized JSON.")
    parser.add_argument(
        "--require-all",
        action="store_true",
        help="Fail unless sanitized local notes cover every provider inventory row.",
    )
    parser.add_argument("paths", nargs="*", type=Path)
    args = parser.parse_args()
    paths = args.paths or [DEFAULT_EVIDENCE_DIR]

    try:
        summary = scan(paths, allow_missing_default=not args.paths, require_all=args.require_all)
    except ValueError as exc:
        print(f"incident-evidence-guard blocked evidence. {exc}")
        return 1

    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
    elif summary["ok"]:
        print(f"incident-evidence-guard: checked {summary['checked_files']} file(s)")
    else:
        print("incident-evidence-guard blocked evidence. No values are printed.")
        for path, labels in summary["failures"].items():
            print(f"- {path}: {', '.join(labels)}")
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
