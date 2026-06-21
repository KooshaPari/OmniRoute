#!/usr/bin/env python3
"""Require immutable GitHub Actions references in workflow files."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


DEFAULT_WORKFLOW_DIR = Path(".github/workflows")


def is_full_sha(ref: str) -> bool:
    return len(ref) == 40 and all(ch in "0123456789abcdefABCDEF" for ch in ref)


def extract_uses(line: str) -> str | None:
    stripped = line.strip()
    if not stripped.startswith("uses:"):
        return None
    value = stripped.split(":", 1)[1].strip()
    if " #" in value:
        value = value.split(" #", 1)[0].strip()
    return value.strip("'\"")


def allowed_reference(value: str) -> bool:
    if value.startswith(("./", "../", "docker://")):
        return True
    if "@" not in value:
        return False
    _action, ref = value.rsplit("@", 1)
    return is_full_sha(ref)


def resolve_input_paths(paths: list[Path]) -> list[Path]:
    root = Path.cwd().resolve()
    resolved_paths: list[Path] = []
    for path in paths:
        candidate = path if path.is_absolute() else root / path
        resolved = candidate.resolve()
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise ValueError(f"workflow path must be inside {root}") from exc
        resolved_paths.append(resolved)
    return resolved_paths


def workflow_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(path.rglob("*.yml")))
            files.extend(sorted(path.rglob("*.yaml")))
        else:
            files.append(path)
    return files


def scan(paths: list[Path]) -> dict[str, object]:
    failures: list[str] = []
    files = workflow_files(resolve_input_paths(paths))
    for path in files:
        if not path.exists():
            failures.append(f"{path}: missing workflow file")
            continue
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            value = extract_uses(line)
            if value and not allowed_reference(value):
                failures.append(f"{path}:{line_number}: unpinned action reference")
    return {"checked_files": len(files), "ok": not failures, "failures": failures}


def main() -> int:
    parser = argparse.ArgumentParser(description="Block mutable GitHub Actions references.")
    parser.add_argument("paths", nargs="*", type=Path, default=[DEFAULT_WORKFLOW_DIR])
    args = parser.parse_args()

    try:
        summary = scan(args.paths)
    except ValueError as exc:
        print(f"workflow-action-guard blocked this change. {exc}")
        return 1
    if summary["ok"]:
        print(f"workflow-action-guard: checked {summary['checked_files']} workflow file(s)")
        return 0

    print("workflow-action-guard blocked this change. No secrets are printed.")
    for failure in summary["failures"]:
        print(f"- {failure}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
