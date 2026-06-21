#!/usr/bin/env python3
"""Scan retained git history for high-confidence secret and PII markers.

The output is sanitized: it reports pattern names, blob counts, and path
samples, never matched values. Run this against a bare mirror clone after
history rewrites or before reopening the repository.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict


PATTERNS = {
    "github_pat": re.compile(rb"gh[pousr]_[A-Za-z0-9_]{20,}"),
    "npm": re.compile(rb"npm_[A-Za-z0-9_-]{20,}"),
    "sentry": re.compile(rb"sntryu_[A-Za-z0-9_-]{20,}"),
    "openai": re.compile(rb"sk-[A-Za-z0-9_-]{20,}"),
    "aws_access_key": re.compile(rb"AKIA[0-9A-Z]{16}"),
    "private_key": re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "discord_bot_token": re.compile(rb"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}"),
    "google_api_key": re.compile(rb"AIza[0-9A-Za-z_-]{35}"),
    "stripe_key": re.compile(rb"sk_(?:live|test)_[0-9A-Za-z]{20,}"),
    "authorization_header": re.compile(rb"(?im)^\s*authorization:\s*(bearer|basic)\s+[A-Za-z0-9._~+/=-]{12,}"),
    "cookie_header": re.compile(rb"(?im)^\s*cookie:\s*[^=\s;]{2,}=[^;\n]{8,}"),
    "oauth_refresh_token_field": re.compile(rb"(?i)\brefresh[_-]?token\b\s*[:=]\s*['\"]?[A-Za-z0-9._~+/=-]{20,}"),
    "us_ssn": re.compile(rb"\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b"),
    "card_number": re.compile(rb"(?i)\b(?:card|credit|cc|pan|visa|mastercard|amex)\b.{0,40}\b(?:\d[ -]*?){13,19}\b|\b(?:\d[ -]*?){13,19}\b.{0,40}\b(?:card|credit|cc|pan|visa|mastercard|amex)\b"),
}


def clean_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("GIT_TRACE"):
            env.pop(key, None)
    return env


def git(git_dir: str, *args: str, input_data: bytes | None = None) -> bytes:
    return subprocess.check_output(
        ["git", f"--git-dir={git_dir}", *args],
        input=input_data,
        env=clean_env(),
        stderr=subprocess.DEVNULL,
    )


def luhn_valid(raw: bytes) -> bool:
    digits = [int(chr(ch)) for ch in re.sub(rb"\D", b"", raw)]
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


def pattern_matches(name: str, pattern: re.Pattern[bytes], data: bytes) -> bool:
    if name == "card_number":
        return any(luhn_valid(match.group(0)) for match in pattern.finditer(data))
    return bool(pattern.search(data))


def scan(git_dir: str, max_blob_bytes: int) -> dict[str, object]:
    rev_list = git(git_dir, "rev-list", "--objects", "--all").decode("utf-8", "replace")
    blob_paths: dict[str, set[str]] = defaultdict(set)

    for line in rev_list.splitlines():
        if not line:
            continue
        oid, _, path = line.partition(" ")
        blob_paths[oid].add(path or "<no-path>")

    oids = sorted(blob_paths)
    type_output = git(
        git_dir,
        "cat-file",
        "--batch-check=%(objectname) %(objecttype) %(objectsize)",
        input_data=("\n".join(oids) + "\n").encode(),
    )

    eligible: list[str] = []
    skipped_large = 0
    for raw in type_output.decode("utf-8", "replace").splitlines():
        parts = raw.split()
        if len(parts) != 3 or parts[1] != "blob":
            continue
        oid = parts[0]
        size = int(parts[2])
        if size > max_blob_bytes:
            skipped_large += 1
        else:
            eligible.append(oid)

    proc = subprocess.Popen(
        ["git", f"--git-dir={git_dir}", "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=clean_env(),
    )
    stdout, _ = proc.communicate(input=("\n".join(eligible) + "\n").encode())

    findings: dict[str, dict[str, object]] = {
        name: {"blob_count": 0, "paths": []} for name in PATTERNS
    }
    scanned_blobs = 0
    skipped_binary = 0
    offset = 0

    while True:
        newline = stdout.find(b"\n", offset)
        if newline < 0:
            break
        header = stdout[offset:newline]
        offset = newline + 1
        if not header:
            break
        oid_raw, kind, size_raw = header.split()
        oid = oid_raw.decode("ascii")
        size = int(size_raw)
        data = stdout[offset : offset + size]
        offset += size + 1
        if kind != b"blob":
            continue
        if b"\0" in data:
            skipped_binary += 1
            continue

        scanned_blobs += 1
        for name, pattern in PATTERNS.items():
            if pattern_matches(name, pattern, data):
                record = findings[name]
                record["blob_count"] = int(record["blob_count"]) + 1
                paths = record["paths"]
                assert isinstance(paths, list)
                for path in sorted(blob_paths[oid]):
                    if path not in paths and len(paths) < 20:
                        paths.append(path)

    return {
        "git_dir": git_dir,
        "scanned_blobs": scanned_blobs,
        "skipped_large_blobs": skipped_large,
        "skipped_binary_blobs": skipped_binary,
        "findings": findings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan retained git history without printing secret values.")
    parser.add_argument("git_dir", help="Bare git directory to scan.")
    parser.add_argument("--max-blob-bytes", type=int, default=2_000_000)
    parser.add_argument("--fail-on-findings", action="store_true")
    args = parser.parse_args()

    summary = scan(args.git_dir, args.max_blob_bytes)
    print(json.dumps(summary, indent=2, sort_keys=True))
    nonzero = {
        key: value for key, value in summary["findings"].items() if value["blob_count"]
    }
    return 1 if args.fail_on_findings and nonzero else 0


if __name__ == "__main__":
    sys.exit(main())
