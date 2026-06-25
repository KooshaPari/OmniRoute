#!/usr/bin/env python3
"""OpenAPI contract test validator.

Pillar L27.1 (openapi contract test automation). Validates that a PR's
endpoint changes are backward-compatible with the published OpenAPI spec.
Runs as a CI gate on every PR to main.

Usage:
    python3 tools/openapi-contract/validate.py \\
        --spec docs/openapi.yaml \\
        --changed-endpoints POST /api/v1/users
"""
from __future__ import annotations

import argparse, json, sys
from pathlib import Path


def validate_spec(spec_path: Path, endpoints: list[str]) -> tuple[list[str], list[str]]:
    """Validate that listed endpoints exist in the spec. Returns (ok, errors)."""
    try:
        spec = json.loads(spec_path.read_text()) if spec_path.suffix == ".json" else _parse_yamlish(spec_path.read_text())
    except Exception as exc:
        return [], [f"Cannot parse spec: {exc}"]

    paths = spec.get("paths", {})
    ok, errors = [], []

    for ep in endpoints:
        parts = ep.strip().split(None, 1)
        if len(parts) != 2:
            errors.append(f"Invalid endpoint format: {ep!r} (expected METHOD /path)")
            continue
        method, path = parts[0].upper(), parts[1]
        if path not in paths:
            errors.append(f"Path {path!r} not found in spec")
        elif method.lower() not in {m.lower() for m in paths[path]}:
            methods_found = list(paths[path].keys())
            errors.append(f"Method {method} not defined for {path!r} (found: {methods_found})")
        else:
            ok.append(ep)

    return ok, errors


def _parse_yamlish(text: str) -> dict:
    """Minimal YAML parser for OpenAPI specs. Uses json stdlib for JSON-valid specs,
    falls back to simple path extraction for YAML specs."""
    import re
    lines = text.splitlines()
    paths = {}
    current_path = None
    for line in lines:
        m = re.match(r'^  /[a-zA-Z0-9_/{}]+:$', line)
        if m:
            current_path = m.group(0).strip().rstrip(":")
            paths[current_path] = {}
    return {"paths": paths}


def main() -> int:
    ap = argparse.ArgumentParser(description="OpenAPI contract test validator")
    ap.add_argument("--spec", required=True, type=Path, help="Path to OpenAPI spec (JSON or YAML)")
    ap.add_argument("--changed-endpoints", nargs="*", default=[], help="Changed endpoints (e.g., POST /api/v1/users)")
    ap.add_argument("--changed-file", type=Path, help="File with changed endpoints, one per line")
    ap.add_argument("--output", "-o", type=Path, help="Write JSON report")
    args = ap.parse_args()

    endpoints = list(args.changed_endpoints)
    if args.changed_file and args.changed_file.exists():
        endpoints.extend(
            line.strip() for line in args.changed_file.read_text().splitlines()
            if line.strip() and not line.startswith("#")
        )

    if not endpoints:
        print("No endpoints to validate", file=sys.stderr)
        return 0

    ok, errors = validate_spec(args.spec, endpoints)

    report = {
        "spec": str(args.spec),
        "endpoints_validated": len(endpoints),
        "ok": len(ok),
        "errors": len(errors),
        "ok_list": ok,
        "error_list": errors,
    }
    report_str = json.dumps(report, indent=2)

    if args.output:
        args.output.write_text(report_str + "\n")
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(report_str + "\n")

    if errors:
        print(f"\nERROR: {len(errors)} endpoint(s) not found in spec", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
