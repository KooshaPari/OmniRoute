#!/usr/bin/env python3
"""Block new high-risk secret and prompt-dump additions.

This guard intentionally scans changed files, not the whole repository. The
repository has historical prompt dumps that require separate history rewrite.
Patterns are intentionally high-confidence to avoid blocking ordinary docs.
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import re
import subprocess
import sys
from pathlib import Path


DENIED_PATHS = (
    "docs/curated-prompts/**",
    "docs/curated-plans/**",
    "**/chatgpt-export/**",
    "**/claude-export/**",
    "**/cursor-export/**",
    "**/prompt-dumps/**",
    "**/session-dumps/**",
    "**/*chat-export*",
    "**/*conversation-export*",
    "**/*prompt-history*",
    "**/*session-history*",
    "**/*browser-cookies*",
    "**/*cookies.txt",
    "incident-evidence/**",
    ".incident-evidence/**",
    "local/incident-evidence/**",
    "**/*provider-console-export*",
    "**/*provider-export*",
    "**/*console-screenshot*",
    "**/*provider-screenshot*",
    "**/.env",
    "**/.env.*",
    "**/*.pem",
    "**/*.key",
    "**/*_rsa",
    "**/*id_rsa*",
    "**/*credential*.json",
    "**/*credentials*.json",
    "**/*service-account*.json",
)

CONTENT_PATTERNS = (
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}")),
    ("npm token", re.compile(r"npm_[A-Za-z0-9_-]{20,}")),
    ("Sentry token", re.compile(r"sntryu_[A-Za-z0-9_-]{20,}")),
    ("OpenAI key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Discord bot token", re.compile(r"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("HTTP authorization header", re.compile(r"(?im)^\s*authorization:\s*(bearer|basic)\s+[A-Za-z0-9._~+/=-]{12,}")),
    ("cookie header", re.compile(r"(?im)^\s*cookie:\s*[^=\s;]{2,}=[^;\n]{8,}")),
    ("OAuth refresh token field", re.compile(r"(?i)\brefresh[_-]?token\b\s*[:=]\s*['\"]?[A-Za-z0-9._~+/=-]{20,}")),
    ("US SSN", re.compile(r"\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b")),
    ("credit card number", re.compile(r"(?i)\b(?:card|credit|cc|pan|visa|mastercard|amex)\b.{0,40}\b(?:\d[ -]*?){13,19}\b|\b(?:\d[ -]*?){13,19}\b.{0,40}\b(?:card|credit|cc|pan|visa|mastercard|amex)\b")),
    ("raw chat export marker", re.compile(r"(?i)\b(conversation_id|message_author|chatgpt|claude\.ai|cursor chat|prompt history)\b.{0,80}\b(content|messages|transcript)\b")),
)

SELF_ALLOWED_LABELS = {
    "scripts/secret-guard.py": {"raw chat export marker"},
}


def luhn_valid(candidate: str) -> bool:
    digits = [int(ch) for ch in re.sub(r"\D", "", candidate)]
    if not 13 <= len(digits) <= 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def run_git(args: list[str]) -> list[str]:
    proc = subprocess.run(
        ["git", *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def repo_root() -> Path:
    return Path(run_git(["rev-parse", "--show-toplevel"])[0])


def normalize(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def changed_files(args: argparse.Namespace) -> list[str]:
    if args.files:
        return [normalize(path) for path in args.files]

    if args.staged:
        return [normalize(path) for path in run_git(["diff", "--cached", "--name-only", "--diff-filter=ACMRT"])]

    if args.since_ref:
        return [normalize(path) for path in run_git(["diff", "--name-only", "--diff-filter=ACMRT", args.since_ref, "HEAD"])]

    return [normalize(path) for path in run_git(["diff", "--name-only", "--diff-filter=ACMRT", "HEAD~1", "HEAD"])]


def is_denied_path(path: str) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in DENIED_PATHS)


def scan_file(path: str) -> list[str]:
    findings: list[str] = []
    normalized_path = normalize(path)
    allowed_labels = SELF_ALLOWED_LABELS.get(normalized_path, set())
    file_path = Path(path)
    if not file_path.is_file():
        return findings

    try:
        data = file_path.read_bytes()
    except OSError:
        return findings

    if b"\0" in data:
        return findings

    text = data.decode("utf-8", errors="ignore")
    for label, pattern in CONTENT_PATTERNS:
        if label in allowed_labels:
            continue

        if label == "credit card number":
            if any(luhn_valid(match.group(0)) for match in pattern.finditer(text)):
                findings.append(label)
            continue

        if pattern.search(text):
            findings.append(label)
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Block changed files that look like secrets or prompt dumps.")
    parser.add_argument("--staged", action="store_true", help="Scan staged files.")
    parser.add_argument("--since-ref", help="Scan changes from this ref to HEAD.")
    parser.add_argument("files", nargs="*", help="Explicit files to scan.")
    args = parser.parse_args()

    if not args.files:
        os.chdir(repo_root())

    paths = sorted(set(changed_files(args)))
    failures: list[str] = []

    for path in paths:
        if is_denied_path(path):
            failures.append(f"{path}: blocked path for secrets/PII risk")
            continue

        findings = scan_file(path)
        if findings:
            labels = ", ".join(sorted(set(findings)))
            failures.append(f"{path}: potential secret pattern ({labels})")

    if failures:
        print("secret-guard blocked this change. No secret values are printed.")
        for failure in failures:
            print(f"- {failure}")
        print("Use sanitized fixtures/placeholders and keep prompt/session dumps out of git.")
        return 1

    print(f"secret-guard: checked {len(paths)} changed file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
