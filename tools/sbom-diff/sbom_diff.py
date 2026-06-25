#!/usr/bin/env python3
"""SBOM diff tool for fleet release verification (v26 T1, Pillar L29).

Compares two CycloneDX SBOMs and emits a structured diff:
- added packages (new in target)
- removed packages (dropped from target)
- upgraded packages (same name, higher version)
- downgraded packages (same name, lower version)
- license changes

Output: JSON to stdout (or --output file) for CI gate consumption.

Usage:
    python3 tools/sbom-diff/sbom_diff.py --base base.cdx.json --target target.cdx.json
    python3 tools/sbom-diff/sbom_diff.py --base base.json --target target.json --output diff.json
    python3 tools/sbom-diff/sbom_diff.py --base base.json --target target.json --strict
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0"

def _load(p: Path) -> dict[str, Any]:
    return json.loads(p.read_text())

def _pkg_key(c: dict[str, Any]) -> str:
    purl = c.get("purl") or ""
    if purl:
        return purl
    return f"{c.get('group','')}/{c.get('name','')}"

def _pkg_version(c: dict[str, Any]) -> str:
    return c.get("version", "") or ""

def _pkg_lic(c: dict[str, Any]) -> str:
    licenses = c.get("licenses") or []
    if not licenses:
        return ""
    l = licenses[0]
    if isinstance(l, dict):
        return l.get("license", {}).get("id", "") or l.get("license", {}).get("name", "")
    return str(l)

def _components(sbom: dict[str, Any]) -> list[dict[str, Any]]:
    return list(sbom.get("components") or sbom.get("packages") or [])

def diff_sboms(base: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    base_pkgs = {_pkg_key(c): c for c in _components(base)}
    target_pkgs = {_pkg_key(c): c for c in _components(target)}
    added = []
    removed = []
    upgraded = []
    downgraded = []
    license_changes = []
    for key in sorted(target_pkgs.keys() | base_pkgs.keys()):
        b = base_pkgs.get(key)
        t = target_pkgs.get(key)
        if b is None and t is not None:
            added.append({"purl": key, "name": t.get("name"), "version": _pkg_version(t)})
        elif t is None and b is not None:
            removed.append({"purl": key, "name": b.get("name"), "version": _pkg_version(b)})
        elif b is not None and t is not None:
            bv, tv = _pkg_version(b), _pkg_version(t)
            bl, tl = _pkg_lic(b), _pkg_lic(t)
            if bv != tv:
                try:
                    if _vercmp(tv) > _vercmp(bv):
                        upgraded.append({"purl": key, "name": t.get("name"), "from": bv, "to": tv})
                    elif _vercmp(tv) < _vercmp(bv):
                        downgraded.append({"purl": key, "name": t.get("name"), "from": bv, "to": tv})
                except ValueError:
                    changed = {"purl": key, "name": t.get("name"), "from": bv, "to": tv}
                    upgraded.append(changed) if tv else downgraded.append(changed)
            if bl != tl:
                license_changes.append({"purl": key, "name": t.get("name"), "from": bl, "to": tl})
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "base_components": len(base_pkgs),
        "target_components": len(target_pkgs),
        "summary": {
            "added": len(added),
            "removed": len(removed),
            "upgraded": len(upgraded),
            "downgraded": len(downgraded),
            "license_changes": len(license_changes),
        },
        "added": added,
        "removed": removed,
        "upgraded": upgraded,
        "downgraded": downgraded,
        "license_changes": license_changes,
    }

def _vercmp(v: str) -> tuple:
    if not v:
        return (0,)
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(p)
    return tuple(parts)

def render_summary(diff: dict[str, Any]) -> str:
    s = diff["summary"]
    lines = [
        f"# SBOM diff — {diff['generated_at']}",
        "",
        f"Base components: {diff['base_components']}  Target components: {diff['target_components']}",
        f"Added: {s['added']}  Removed: {s['removed']}  Upgraded: {s['upgraded']}  "
        f"Downgraded: {s['downgraded']}  License changes: {s['license_changes']}",
        "",
    ]
    if diff["added"]:
        lines.append("## Added")
        for p in diff["added"]:
            lines.append(f"- `{p['purl']}` {p['version']}")
        lines.append("")
    if diff["removed"]:
        lines.append("## Removed")
        for p in diff["removed"]:
            lines.append(f"- `{p['purl']}` {p['version']}")
        lines.append("")
    if diff["upgraded"]:
        lines.append("## Upgraded")
        for p in diff["upgraded"]:
            lines.append(f"- `{p['purl']}` {p['from']} → {p['to']}")
        lines.append("")
    if diff["downgraded"]:
        lines.append("## Downgraded")
        for p in diff["downgraded"]:
            lines.append(f"- `{p['purl']}` {p['from']} → {p['to']}")
        lines.append("")
    if diff["license_changes"]:
        lines.append("## License changes")
        for p in diff["license_changes"]:
            lines.append(f"- `{p['purl']}` {p['from']!r} → {p['to']!r}")
        lines.append("")
    return "\n".join(lines)

def main() -> int:
    ap = argparse.ArgumentParser(description="CycloneDX SBOM diff")
    ap.add_argument("--base", required=True, help="Base SBOM path (CycloneDX JSON)")
    ap.add_argument("--target", required=True, help="Target SBOM path (CycloneDX JSON)")
    ap.add_argument("--output", "-o", help="Write JSON to file (default: stdout)")
    ap.add_argument("--summary", action="store_true", help="Emit markdown summary")
    ap.add_argument("--strict", action="store_true", help="Exit 1 if any added/removed/downgraded")
    ap.add_argument("--max-downgrades", type=int, default=0,
                    help="Fail if more than N downgrades (default 0)")
    args = ap.parse_args()
    base = _load(Path(args.base))
    target = _load(Path(args.target))
    d = diff_sboms(base, target)
    if args.summary:
        sys.stdout.write(render_summary(d))
    else:
        out = json.dumps(d, indent=2, sort_keys=True)
        if args.output:
            Path(args.output).write_text(out)
            print(f"wrote {args.output}", file=sys.stderr)
        else:
            sys.stdout.write(out)
    s = d["summary"]
    if args.strict and (s["added"] or s["removed"] or s["downgraded"]):
        return 1
    if s["downgraded"] > args.max_downgrades:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
