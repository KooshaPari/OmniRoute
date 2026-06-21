"""CLI entry point for pheno-worklog-schema."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pheno_worklog_schema import (
    Row,
    __version__,
    migrate_v20_to_v21,
    parse,
    to_markdown,
)


def _cmd_validate(args: argparse.Namespace) -> int:
    p = Path(args.path)
    if not p.exists():
        print(f"file not found: {p}", file=sys.stderr)
        return 2
    try:
        rows = parse(p.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(rows)} row(s) parsed from {p}")
    return 0


def _cmd_migrate(args: argparse.Namespace) -> int:
    p = Path(args.path)
    if not p.exists():
        print(f"file not found: {p}", file=sys.stderr)
        return 2
    rows = parse(p.read_text(encoding="utf-8"))
    # Detect v2.0 rows by the absence of v2.1-specific defaults that
    # differ from a real filled-in value.
    migrated: list[Row] = []
    upgraded = 0
    for r in rows:
        if r.device == "unknown" and r.scope == "unknown" and r.risk == "unknown":
            # Already v2.1 (migrated or written directly).
            migrated.append(r)
        else:
            migrated.append(migrate_v20_to_v21(r))
            upgraded += 1
    out = to_markdown(migrated)
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
        print(f"wrote {len(migrated)} rows to {args.out} ({upgraded} upgraded)")
    else:
        sys.stdout.write(out)
    return 0


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pheno-worklog-schema",
        description="WORKLOG.md parser/emitter for ADR-015 v2.0 + v2.1.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    p_val = sub.add_parser("validate", help="Validate a WORKLOG.md file.")
    p_val.add_argument("path", help="Path to WORKLOG.md.")
    p_val.set_defaults(func=_cmd_validate)

    p_mig = sub.add_parser("migrate", help="Migrate v2.0 WORKLOG.md to v2.1.")
    p_mig.add_argument("path", help="Path to WORKLOG.md.")
    p_mig.add_argument("--out", default=None, help="Output path (default: stdout).")
    p_mig.set_defaults(func=_cmd_migrate)

    p.add_argument("--version", action="version", version=f"pheno-worklog-schema {__version__}")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
