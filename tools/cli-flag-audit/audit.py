#!/usr/bin/env python3
"""CLI flag discipline auditor (L39).

Scans Rust and Go source trees for flag naming conventions:
- Rust clap: flags should use kebab-case (--my-flag), not snake_case (--my_flag)
- Go flag/cobra: flags should use kebab-case (--my-flag), not snake_case (--my_flag)
- Reports violations, warnings, and a pass/fail summary.

Usage:
    python3 tools/cli-flag-audit/audit.py [--path <dir>] [--strict]

Exit code:
    0 — all flags conform
    1 — violations found (or --strict with warnings)
"""

import argparse
import os
import re
import sys
from pathlib import Path

VIOLATION = "VIOLATION"
WARNING = "WARNING"
PASS = "PASS"

# Patterns that detect flag definitions in Rust (clap) and Go (flag/cobra)
RUST_FLAG_PATTERNS = [
    # clap: .arg("--my-flag") or .arg("my-flag")
    re.compile(r'\.arg\(\s*"(-{1,2})?(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
    # clap: #[arg(long = "my-flag")] or #[arg(short = 'm')]
    re.compile(r'long\s*=\s*"(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
    # structopt: #[structopt(long = "my-flag")]
    re.compile(r'(?:structopt|clap)\(\s*long\s*=\s*"(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
]

GO_FLAG_PATTERNS = [
    # flag.String("my-flag", ...) or flag.String("my_flag", ...)
    re.compile(r'flag\.(?:String|Bool|Int|Int64|Uint|Uint64|Float64|Duration)\(\s*"(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
    # pflag / cobra: StringVarP(&x, "my-flag", "m", ...)
    re.compile(r'(?:String|Bool|Int|Int64)VarP?\(\s*[^,]+,\s*"(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
    # cobra command flag: cmd.Flags().String("my-flag", ...)
    re.compile(r'Flags\(\)\.(?:String|Bool|Int|Int64Var?)\(\s*"(?P<flag>[a-zA-Z][a-zA-Z0-9_-]*)"'),
]

# Patterns for kebab-case detection
KEBAB_RE = re.compile(r'^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$')
SNAKE_RE = re.compile(r'^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)*$')


def flag_violation(flag: str, filename: str, line_no: int, line: str) -> dict | None:
    """Check a flag name for naming violations. Returns a dict or None."""
    if KEBAB_RE.match(flag):
        return None  # OK — kebab-case
    if SNAKE_RE.match(flag):
        return {
            "type": VIOLATION,
            "flag": flag,
            "file": filename,
            "line": line_no,
            "detail": f"snake_case flag '{flag}': use kebab-case instead (--{flag.replace('_', '-')})",
            "suggested": f"--{flag.replace('_', '-')}",
        }
    if flag.startswith("no-"):
        # clap auto-generated negation flags like --no-flag — skip
        return None
    return {
        "type": WARNING,
        "flag": flag,
        "file": filename,
        "line": line_no,
        "detail": f"non-standard flag '{flag}': use kebab-case",
        "suggested": None,
    }


def scan_file(filepath: Path) -> list[dict]:
    """Scan a single file for flag definition patterns."""
    results = []
    try:
        text = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return results

    if filepath.suffix == ".rs":
        patterns = RUST_FLAG_PATTERNS
    elif filepath.suffix == ".go":
        patterns = GO_FLAG_PATTERNS
    else:
        return results

    lines = text.splitlines()
    for i, line_no in enumerate(range(1, len(lines) + 1)):
        line = lines[i] if i < len(lines) else ""
        for pat in patterns:
            for m in pat.finditer(line):
                flag = m.group("flag")
                if not flag:
                    continue
                violation = flag_violation(flag, str(filepath), line_no, line)
                if violation:
                    results.append(violation)
    return results


def scan_tree(root: Path) -> list[dict]:
    """Recursively scan a directory tree for Rust and Go source files."""
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip hidden dirs, node_modules, target
        dirnames[:] = [
            d for d in dirnames
            if not d.startswith(".") and d not in ("node_modules", "target", "vendor", "third_party")
        ]
        for fn in filenames:
            if fn.endswith(".rs") or fn.endswith(".go"):
                filepath = Path(dirpath) / fn
                results.extend(scan_file(filepath))
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="CLI flag discipline auditor (L39)")
    parser.add_argument("--path", default=".", help="Root path to scan (default: cwd)")
    parser.add_argument("--strict", action="store_true", help="Emit warnings as violations")
    args = parser.parse_args()

    root = Path(args.path).resolve()
    if not root.is_dir():
        print(f"Error: {root} is not a directory", file=sys.stderr)
        return 2

    results = scan_tree(root)
    violations = [r for r in results if r["type"] == VIOLATION]
    warnings_list = [r for r in results if r["type"] == WARNING]

    # Report
    if not results:
        print(f"✅ No flag definitions found under {root}")
        return 0

    for r in violations:
        print(f"  ❌ {r['file']}:{r['line']} — {r['detail']}")

    for r in warnings_list:
        print(f"  ⚠️  {r['file']}:{r['line']} — {r['detail']}")

    total = len(violations) + len(warnings_list)
    word = "violations" if violations else "warnings"
    emoji = "❌" if violations else ("⚠️" if args.strict and warnings_list else "✅")
    print(f"\n{emoji} {total} {word} in {len(results) if results else 0} files")
    print(f"   {len(violations)} violations, {len(warnings_list)} warnings")

    if violations:
        return 1
    if args.strict and warnings_list:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
