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


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    if not path.exists():
        return ["missing file"]
    if path.suffix.lower() in DENIED_EXTENSIONS:
        return ["unsupported evidence file type"]

    try:
        data = path.read_bytes()
    except OSError:
        return ["unreadable file"]

    if b"\0" in data:
        return ["binary file"]

    text = data.decode("utf-8", errors="ignore")
    for label, pattern in (*SECRET_PATTERNS, *PII_PATTERNS):
        if pattern.search(text):
            findings.append(label)
    return findings


def scan(paths: list[Path]) -> dict[str, object]:
    failures: dict[str, list[str]] = {}
    files = iter_files(resolve_input_paths(paths))
    for path in files:
        findings = scan_file(path)
        if findings:
            failures[str(path)] = sorted(set(findings))

    return {
        "checked_files": len(files),
        "ok": not failures,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate sanitized local incident evidence notes.")
    parser.add_argument("--json", action="store_true", help="Print sanitized JSON.")
    parser.add_argument("paths", nargs="*", type=Path, default=[DEFAULT_EVIDENCE_DIR])
    args = parser.parse_args()

    try:
        summary = scan(args.paths)
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
