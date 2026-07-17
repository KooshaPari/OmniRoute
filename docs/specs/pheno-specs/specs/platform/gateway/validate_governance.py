#!/usr/bin/env python3
"""Governance Validation Script

Validates compliance with Phenotype organization governance rules
for a given repository.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# ANSI colors
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
RESET = "\033[0m"


def check_file(path: str, description: str) -> bool:
    """Check if a file exists."""
    exists = os.path.exists(path)
    status = f"{GREEN}✓{RESET}" if exists else f"{RED}✗{RESET}"
    print(f"  {status} {description}: {path}")
    return exists


def check_dir(path: str, description: str) -> bool:
    """Check if a directory exists and has files."""
    exists = os.path.isdir(path)
    count = len(os.listdir(path)) if exists else 0
    status = f"{GREEN}✓{RESET}" if exists and count > 0 else f"{RED}✗{RESET}"
    print(f"  {status} {description}: {path} ({count} items)")
    return exists and count > 0


def run_ptrace_check(repo_path: str, ptrace_path: str | None = None) -> bool:
    """Run ptrace drift check.

    Args:
        repo_path: Absolute path to the repository root.
        ptrace_path: Path to the ptrace binary. If None, skips the check.

    Returns:
        True if ptrace passed or was skipped, False on drift failure.
    """
    if not ptrace_path:
        print(f"  {YELLOW}⚠{RESET} ptrace drift check skipped (no ptrace_path)")
        return True

    ptrace_resolved = Path(ptrace_path).resolve()
    if not ptrace_resolved.is_file():
        print(f"  {YELLOW}⚠{RESET} ptrace binary not found: {ptrace_resolved}")
        return True

    try:
        result = subprocess.run(  # noqa: S603  # path resolved + validated as file above
            [str(ptrace_resolved), "check-drift", "--path", ".", "--threshold", "90"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )
        drift_ok = result.returncode == 0
        status = f"{GREEN}✓{RESET}" if drift_ok else f"{YELLOW}⚠{RESET}"
        print(f"  {status} ptrace drift check")
        return drift_ok
    except FileNotFoundError:
        print(f"  {YELLOW}⚠{RESET} ptrace binary not found at {ptrace_resolved}")
        return True
    except subprocess.TimeoutExpired:
        print(f"  {YELLOW}⚠{RESET} ptrace drift check timed out")
        return False
    except subprocess.CalledProcessError:
        print(f"  {YELLOW}⚠{RESET} ptrace drift check failed")
        return False


def discover_repo_name(repo_path: str) -> str:
    """Attempt to discover the repo name from the filesystem.

    Checks VERSION file, then directory basename, falls back to 'unknown'.
    """
    version_file = Path(repo_path) / "VERSION"
    if version_file.is_file():
        try:
            content = version_file.read_text().strip()
            if content:
                return content
        except OSError:
            pass
    return Path(repo_path).resolve().name


def validate_repo(repo_path: str | None = None, ptrace_path: str | None = None) -> int:
    """Run all validation checks.

    Args:
        repo_path: Path to repository root. Defaults to parent of this script.
        ptrace_path: Optional path to ptrace binary.

    Returns:
        0 if validation passes (>=80% checks), 1 otherwise.
    """
    if repo_path is None:
        repo_path = os.path.dirname(os.path.abspath(__file__))

    repo_path_resolved = str(Path(repo_path).resolve())
    if not Path(repo_path_resolved).is_dir():
        print(f"Error: directory does not exist: {repo_path_resolved}", file=sys.stderr)
        return 1

    repo_name = discover_repo_name(repo_path_resolved)

    print(f"\n{'='*60}")
    print(f"Governance Validation: {repo_name}")
    print(f"{'='*60}\n")

    checks: list[bool] = []

    # Artifact checks
    print("📋 ARTIFACTS")
    checks.append(check_file(f"{repo_path_resolved}/CLAUDE.md", "CLAUDE.md"))
    checks.append(check_file(f"{repo_path_resolved}/AGENTS.md", "AGENTS.md"))
    checks.append(check_file(f"{repo_path_resolved}/README.md", "README.md"))

    # Governance checks
    print("\n⚖️  GOVERNANCE")
    trace_yaml = f"{repo_path_resolved}/.phenotype/ai-traceability.yaml"
    checks.append(check_file(trace_yaml, "AI attribution"))
    trace_workflow = f"{repo_path_resolved}/.github/workflows/traceability.yml"
    checks.append(check_file(trace_workflow, "CI/CD workflow"))

    # Traceability checks
    print("\n🔍 TRACEABILITY")
    specs_dir = f"{repo_path_resolved}/specs"
    if os.path.exists(specs_dir):
        checks.append(check_dir(specs_dir, "specs/ directory"))
    else:
        print(f"  {YELLOW}⚠{RESET} specs/ directory (optional)")

    # Run ptrace
    checks.append(run_ptrace_check(repo_path_resolved, ptrace_path))

    # Summary
    print(f"\n{'='*60}")
    passed = sum(checks)
    total = len(checks)
    percentage = (passed / total * 100) if total > 0 else 0

    if percentage >= 80:
        msg = f"{passed}/{total} checks passed ({percentage:.0f}%)"
        print(f"{GREEN}✅ PASS: {msg}{RESET}")
        return 0
    else:
        msg = f"{passed}/{total} checks passed ({percentage:.0f}%)"
        print(f"{RED}❌ FAIL: {msg}{RESET}")
        return 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Validate Phenotype organization governance rules.",
    )
    parser.add_argument(
        "--repo-path",
        default=None,
        help="Path to the repository root (default: parent of this script)",
    )
    parser.add_argument(
        "--ptrace-path",
        default=None,
        help="Path to the ptrace binary (default: skip ptrace check)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = parse_args(argv)
    return validate_repo(repo_path=args.repo_path, ptrace_path=args.ptrace_path)


if __name__ == "__main__":
    sys.exit(main())
