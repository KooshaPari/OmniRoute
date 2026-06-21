#!/usr/bin/env python3
"""scripts/ssot-validator.py — v19 T3 L65 SSOT-injection pre-commit validator.

Authority: v19 71-pillar cycle 9 P0 plan + L65 SSOT scorecard (1→2 Adequate).
Companion to scripts/validate-ssot.sh (which scans SSOT.md structure):
this script scans STAGED .rs files for hardcoded literals that should
come from a Single Source of Truth (SSOT) — env vars, config, or constants
in a designated authority crate.

Detection scope (configurable via scripts/ssot-rules.toml):
  - Hardcoded URLs (api.example.com, http://... literals)
  - Magic numbers in non-test code (timeouts, retry counts, buffer sizes)
  - Hardcoded network ports (5432, 6379, 8080, etc.)
  - Hardcoded env-var names (read at runtime via env::var("FOO_BAR") with
    a name that should live in a pheno-config / pheno-context constant)
  - Crate-name string literals (duplicate of CARGO_PKG_NAME)
  - Hardcoded API endpoint paths (duplicates of an openapi SSOT)

Exit codes:
  0 = clean (no violations, or only `info`-severity warnings with --no-info)
  1 = violations found at error or warning severity
  2 = script error (bad config, git failure, etc.)

Usage:
  # Pre-commit mode (default): scan staged .rs files
  scripts/ssot-validator.py

  # Scan arbitrary paths (for ad-hoc audit)
  scripts/ssot-validator.py path/to/file.rs another/file.rs

  # Scan all .rs files under a directory
  scripts/ssot-validator.py --root path/to/repo --recursive

  # JSON output for CI consumption
  scripts/ssot-validator.py --json

  # Relax: only fail on `error` severity (warnings become info)
  scripts/ssot-validator.py --strict-errors-only
"""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

try:
    import tomllib as toml  # Python 3.11+
except ImportError:  # pragma: no cover
    import tomli as toml  # type: ignore[no-redef]

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

VALID_SEVERITIES = ("error", "warning", "info")


@dataclass(frozen=True)
class Rule:
    """One SSOT rule from scripts/ssot-rules.toml."""

    id: str
    description: str
    pattern: str
    severity: str
    file_globs: tuple[str, ...] = ("**/*.rs",)
    exempt_globs: tuple[str, ...] = ()
    exempt_line_patterns: tuple[str, ...] = ()
    suggestion: str = ""  # free-text fix hint

    def matches_path(self, path: str) -> bool:
        """True if the file path is in scope for this rule."""
        if not any(fnmatch.fnmatch(path, g) for g in self.file_globs):
            return False
        if any(fnmatch.fnmatch(path, g) for g in self.exempt_globs):
            return False
        return True


@dataclass
class Violation:
    """A single match against a Rule on a single line."""

    rule_id: str
    severity: str
    file: str
    line: int
    column: int
    matched_text: str
    description: str
    suggestion: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Rule loading
# ---------------------------------------------------------------------------


def load_rules(path: Path) -> list[Rule]:
    """Load rules from a TOML file. Raises on schema errors."""
    if not path.exists():
        raise FileNotFoundError(f"rules file not found: {path}")
    data = toml.loads(path.read_text(encoding="utf-8"))
    raw_rules = data.get("rule", data.get("rules", []))
    if not isinstance(raw_rules, list):
        raise ValueError(f"{path}: top-level `rule` must be an array of tables")

    rules: list[Rule] = []
    for i, r in enumerate(raw_rules):
        rid = r.get("id")
        if not rid:
            raise ValueError(f"{path}: rule #{i} missing required field `id`")
        for required in ("description", "pattern", "severity"):
            if required not in r:
                raise ValueError(f"{path}: rule `{rid}` missing required field `{required}`")
        sev = r["severity"]
        if sev not in VALID_SEVERITIES:
            raise ValueError(
                f"{path}: rule `{rid}` has invalid severity `{sev}` "
                f"(must be one of {VALID_SEVERITIES})"
            )
        # Compile to catch bad regexes early
        try:
            re.compile(r["pattern"])
        except re.error as e:
            raise ValueError(f"{path}: rule `{rid}` has invalid regex: {e}") from e

        rules.append(
            Rule(
                id=rid,
                description=r["description"],
                pattern=r["pattern"],
                severity=sev,
                file_globs=tuple(r.get("file_globs", ["**/*.rs"])),
                exempt_globs=tuple(r.get("exempt_globs", [])),
                exempt_line_patterns=tuple(r.get("exempt_line_patterns", [])),
                suggestion=r.get("suggestion", ""),
            )
        )
    return rules


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------


def staged_rs_files(repo_root: Path) -> list[str]:
    """Return repo-relative paths of staged .rs files (added/copied/modified/renamed)."""
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo_root), "diff", "--cached",
             "--name-only", "--diff-filter=ACMR", "--", "*.rs"],
            capture_output=True, text=True, timeout=15, check=True,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        raise RuntimeError(f"git diff --cached failed: {e}") from e
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def expand_user_paths(paths: list[str], repo_root: Path) -> list[Path]:
    """Resolve CLI-supplied paths (relative to cwd) to absolute Path objects."""
    out: list[Path] = []
    for p in paths:
        path = Path(p)
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        out.append(path)
    return out


def walk_rs_files(root: Path) -> list[Path]:
    """Recursively find all .rs files under `root`."""
    return sorted(p for p in root.rglob("*.rs") if p.is_file())


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------


def _to_relpath(file_path: Path, repo_root: Path) -> str:
    """Return repo-relative path if possible, else the absolute path."""
    try:
        return str(file_path.resolve().relative_to(repo_root.resolve()))
    except ValueError:
        # File is outside the repo root — fall back to absolute path.
        return str(file_path.resolve())


def scan_file(
    file_path: Path,
    repo_root: Path,
    rules: list[Rule],
) -> list[Violation]:
    """Scan one file against all rules. Returns the list of violations."""
    rel = _to_relpath(file_path, repo_root)

    # Files that no rule targets → skip the file
    in_scope = [r for r in rules if r.matches_path(rel)]
    if not in_scope:
        return []

    try:
        text = file_path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        # Surface as a synthetic violation so the user sees it
        return [Violation(
            rule_id="<io-error>",
            severity="error",
            file=rel,
            line=0,
            column=0,
            matched_text="",
            description=f"cannot read file: {e}",
        )]

    violations: list[Violation] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for rule in in_scope:
            # Quick line-level exemption check (e.g. `// ssot-allow: <id>`)
            if any(re.search(p, line) for p in rule.exempt_line_patterns):
                continue
            for m in re.finditer(rule.pattern, line):
                violations.append(Violation(
                    rule_id=rule.id,
                    severity=rule.severity,
                    file=rel,
                    line=line_no,
                    column=m.start() + 1,
                    matched_text=m.group(0),
                    description=rule.description,
                    suggestion=rule.suggestion,
                ))
    return violations


def scan_files(
    files: Iterable[Path],
    repo_root: Path,
    rules: list[Rule],
) -> list[Violation]:
    """Scan an iterable of files. Skips files that don't exist on disk."""
    all_v: list[Violation] = []
    for f in files:
        if not f.exists():
            print(f"warn: {f} does not exist; skipping", file=sys.stderr)
            continue
        all_v.extend(scan_file(f, repo_root, rules))
    return all_v


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def print_human(violations: list[Violation], strict_errors_only: bool) -> None:
    """Print a human-readable report. Colors via ANSI if stdout is a tty."""
    use_color = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
    BOLD = "\033[1m" if use_color else ""
    RED = "\033[31m" if use_color else ""
    YEL = "\033[33m" if use_color else ""
    CYN = "\033[36m" if use_color else ""
    DIM = "\033[2m" if use_color else ""
    OFF = "\033[0m" if use_color else ""

    if not violations:
        print(f"{BOLD}SSOT-VALIDATOR:{OFF} clean — no violations")
        return

    by_rule: dict[str, list[Violation]] = {}
    for v in violations:
        by_rule.setdefault(v.rule_id, []).append(v)

    print(f"{BOLD}SSOT-VALIDATOR:{OFF} {len(violations)} violation(s) across "
          f"{len(by_rule)} rule(s)\n")

    for rid, group in by_rule.items():
        sev = group[0].severity
        color = RED if sev == "error" else (YEL if sev == "warning" else CYN)
        print(f"{color}[{sev.upper():7}]{OFF} {BOLD}{rid}{OFF}  "
              f"{DIM}({group[0].description}){OFF}")
        for v in group:
            snippet = v.matched_text if len(v.matched_text) < 60 else v.matched_text[:57] + "..."
            print(f"  {v.file}:{v.line}:{v.column}  {DIM}match={OFF}`{snippet}`")
            if v.suggestion:
                print(f"    {DIM}→ fix: {v.suggestion}{OFF}")
        print()

    if strict_errors_only:
        blockers = [v for v in violations if v.severity == "error"]
        if not blockers:
            print(f"{CYN}(strict-errors-only: warnings not blocking){OFF}")


def print_json(violations: list[Violation], repo_root: Path) -> None:
    """Emit a JSON report on stdout for CI consumption."""
    report = {
        "schema_version": "ssot-validator/v1",
        "generated_at": subprocess.run(
            ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
            capture_output=True, text=True, check=True,
        ).stdout.strip(),
        "repo_root": str(repo_root),
        "violation_count": len(violations),
        "violations": [v.to_dict() for v in violations],
    }
    print(json.dumps(report, indent=2))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    here = Path(__file__).resolve().parent
    default_rules = here / "ssot-rules.toml"

    ap = argparse.ArgumentParser(
        description="SSOT-injection pre-commit validator (L65, v19 T3).",
        epilog="With no positional args, scans staged .rs files in the "
               "current git repo. Pass paths to scan arbitrary files.",
    )
    ap.add_argument("paths", nargs="*",
                    help="Files or directories to scan (default: staged .rs files)")
    ap.add_argument("--rules", default=str(default_rules),
                    help=f"Path to rules TOML (default: {default_rules.name})")
    ap.add_argument("--repo-root", default=None,
                    help="Repo root for path-relative reporting "
                         "(default: git rev-parse --show-toplevel, else cwd)")
    ap.add_argument("--root", action="store_true",
                    help="Treat positional `paths` as roots and recurse for .rs files")
    ap.add_argument("--json", action="store_true",
                    help="Emit JSON report on stdout")
    ap.add_argument("--strict-errors-only", action="store_true",
                    help="Only exit non-zero on `error` severity (warnings are advisory)")
    ap.add_argument("--quiet", action="store_true",
                    help="Suppress human banner; still print errors/warnings")
    args = ap.parse_args()

    # Resolve repo root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        try:
            r = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True, text=True, timeout=5, check=True,
            )
            repo_root = Path(r.stdout.strip()).resolve()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            repo_root = Path.cwd().resolve()

    # Load rules
    try:
        rules = load_rules(Path(args.rules))
    except (FileNotFoundError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if not rules:
        print("error: zero rules loaded from {args.rules}", file=sys.stderr)
        return 2

    # Decide which files to scan
    try:
        if args.paths:
            roots = expand_user_paths(list(args.paths), repo_root)
            if args.root:
                files: list[Path] = []
                for r in roots:
                    if r.is_dir():
                        files.extend(walk_rs_files(r))
                    elif r.is_file():
                        files.append(r)
            else:
                files = [p for p in roots if p.is_file()]
        else:
            files = [repo_root / rel for rel in staged_rs_files(repo_root)]
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if not args.quiet and not args.json:
        print(f"# SSOT-VALIDATOR (L65 / v19 T3) — {len(rules)} rule(s), "
              f"{len(files)} file(s) under {repo_root}\n")

    violations = scan_files(files, repo_root, rules)

    if args.json:
        print_json(violations, repo_root)
    elif not args.quiet:
        print_human(violations, args.strict_errors_only)
    else:
        # Quiet mode: just emit one-line-per-violation on stderr
        for v in violations:
            print(f"{v.severity}\t{v.rule_id}\t{v.file}:{v.line}:{v.column}\t{v.matched_text}",
                  file=sys.stderr)

    # Exit-code policy
    if not violations:
        return 0
    if args.strict_errors_only:
        return 1 if any(v.severity == "error" for v in violations) else 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
