#!/usr/bin/env python3
"""Scan retained git history or the current worktree for secret and PII markers.

The output is sanitized: it reports pattern names, blob counts, and path
samples, never matched values. Run this against a bare mirror clone after
history rewrites or before reopening the repository. Use worktree mode to
verify the current default branch before a GitHub Support purge request.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path


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


def git_worktree(root: Path, *args: str) -> bytes:
    return subprocess.check_output(
        ["git", "-C", str(root), *args],
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


def blank_findings() -> dict[str, dict[str, object]]:
    return {name: {"blob_count": 0, "paths": []} for name in PATTERNS}


def record_matches(
    findings: dict[str, dict[str, object]],
    data: bytes,
    paths: list[str],
) -> None:
    for name, pattern in PATTERNS.items():
        if pattern_matches(name, pattern, data):
            record = findings[name]
            record["blob_count"] = int(record["blob_count"]) + 1
            path_samples = record["paths"]
            assert isinstance(path_samples, list)
            for path in paths:
                if path not in path_samples and len(path_samples) < 20:
                    path_samples.append(path)


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

    findings = blank_findings()
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
        record_matches(findings, data, sorted(blob_paths[oid]))

    return {
        "mode": "history",
        "git_dir": git_dir,
        "scanned_blobs": scanned_blobs,
        "skipped_large_blobs": skipped_large,
        "skipped_binary_blobs": skipped_binary,
        "findings": findings,
    }


def normalize_worktree_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def worktree_paths(root: Path, explicit_paths: list[str]) -> list[str]:
    if explicit_paths:
        return sorted({normalize_worktree_path(path) for path in explicit_paths})

    output = git_worktree(root, "ls-files", "-z")
    return sorted(
        normalize_worktree_path(path.decode("utf-8", "replace"))
        for path in output.split(b"\0")
        if path
    )


def resolve_worktree_file(root: Path, path: str) -> Path:
    candidate = (root / path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"worktree path escapes root: {path}") from exc
    return candidate


def scan_worktree(root: Path, paths: list[str], max_blob_bytes: int) -> dict[str, object]:
    root = root.resolve()
    findings = blank_findings()
    scanned_files = 0
    skipped_large = 0
    skipped_binary = 0
    missing_files = 0

    for path in worktree_paths(root, paths):
        file_path = resolve_worktree_file(root, path)
        if not file_path.is_file():
            missing_files += 1
            continue

        size = file_path.stat().st_size
        if size > max_blob_bytes:
            skipped_large += 1
            continue

        data = file_path.read_bytes()
        if b"\0" in data:
            skipped_binary += 1
            continue

        scanned_files += 1
        record_matches(findings, data, [path])

    return {
        "mode": "worktree",
        "worktree_root": str(root),
        "scanned_files": scanned_files,
        "skipped_large_files": skipped_large,
        "skipped_binary_files": skipped_binary,
        "missing_files": missing_files,
        "findings": findings,
    }


def nonzero_findings(summary: dict[str, object]) -> dict[str, object]:
    findings = summary["findings"]
    assert isinstance(findings, dict)
    return {
        key: value for key, value in findings.items() if value["blob_count"]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan retained history or worktree files without printing secret values.")
    parser.add_argument("git_dir", nargs="?", help="Bare git directory to scan.")
    parser.add_argument(
        "--worktree-root",
        help="Scan tracked files in this worktree instead of retained git history.",
    )
    parser.add_argument(
        "--worktree-path",
        action="append",
        default=[],
        help="Worktree-relative path to scan in worktree mode. May be repeated; defaults to tracked files.",
    )
    parser.add_argument("--max-blob-bytes", type=int, default=2_000_000)
    parser.add_argument("--fail-on-findings", action="store_true")
    args = parser.parse_args()

    if args.worktree_root:
        if args.git_dir:
            parser.error("git_dir cannot be used with --worktree-root")
        try:
            summary = scan_worktree(Path(args.worktree_root), args.worktree_path, args.max_blob_bytes)
        except ValueError as exc:
            print(f"retained-history-secret-scan: blocked. {exc}", file=sys.stderr)
            return 1
    else:
        if args.worktree_path:
            parser.error("--worktree-path requires --worktree-root")
        if not args.git_dir:
            parser.error("git_dir is required unless --worktree-root is provided")
        summary = scan(args.git_dir, args.max_blob_bytes)

    print(json.dumps(summary, indent=2, sort_keys=True))
    return 1 if args.fail_on_findings and nonzero_findings(summary) else 0


if __name__ == "__main__":
    sys.exit(main())
