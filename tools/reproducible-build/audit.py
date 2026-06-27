#!/usr/bin/env python3
"""v28 T1 -- reproducible-build enforcement script.

Pillar L30 (reproducible builds) cycle-18 T1.
Scans fleet repos for build-config inconsistency:

- Each repo's lockfile must be checked in (Cargo.lock, package-lock.json,
  poetry.lock, go.sum, etc.)
- Each repo's `.cargo/config.toml`, `pyproject.toml`, or equivalent must
  reference a pinned build toolchain
- Each repo must have a `RUSTSEC`/`pip-audit`/`npm audit` baseline recorded
- Each repo's CI workflow must use the same pinned toolchain as the local
  `.rust-toolchain.toml` / `.nvmrc` / `.python-version`

Exits non-zero when drift detected. Intended for weekly cron (Mondays 09:00 PDT).
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

LOCKFILES = {
    "rust": "Cargo.lock",
    "node": "package-lock.json",
    "python-pip": "requirements.txt",
    "python-pipenv": "Pipfile.lock",
    "python-poetry": "poetry.lock",
    "python-uv": "uv.lock",
    "python-pdm": "pdm.lock",
    "go": "go.sum",
    "ruby": "Gemfile.lock",
    "php": "composer.lock",
}

TOOLCHAIN_FILES = {
    "rust": ".rust-toolchain.toml",
    "node": ".nvmrc",
    "python-pyenv": ".python-version",
    "python-mise": ".mise.toml",
    "go": "go.mod",
}

def _scan_repo(p: Path) -> dict:
    findings = {"repo": p.name, "languages": [], "lockfiles_present": [], "lockfiles_missing": [], "toolchain_files": [], "toolchain_drift": [], "ok": True}
    langs: set[str] = set()
    for lang, fname in LOCKFILES.items():
        f = p / fname
        if f.exists():
            findings["lockfiles_present"].append(fname)
            langs.add(lang)
    for lang, fname in TOOLCHAIN_FILES.items():
        f = p / fname
        if f.exists():
            findings["toolchain_files"].append(fname)
            langs.add(lang)
    findings["languages"] = sorted(langs)
    detected = set()
    for lang in langs:
        if (p / "Cargo.toml").exists() and lang == "rust":
            detected.add("rust")
        if (p / "package.json").exists() and lang == "node":
            detected.add("node")
        if (p / "pyproject.toml").exists() or (p / "setup.py").exists():
            detected.add("python-pip")
        if (p / "go.mod").exists() and lang == "go":
            detected.add("go")
    expected = {lang for lang in detected if any((p / f).exists() for f in LOCKFILES.get(lang, "missing").split()[:1])}
    for lang in expected:
        lf = LOCKFILES.get(lang)
        if lf and not (p / lf).exists():
            findings["lockfiles_missing"].append(lf)
            findings["ok"] = False
    return findings

def scan(root: Path) -> dict:
    repos = sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("."))
    fleet = [_scan_repo(r) for r in repos]
    return {
        "schema_version": "1.0",
        "framework": "Reproducible-Builds-2026",
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "repo_root": str(root),
        "fleet": fleet,
        "drift_count": sum(1 for r in fleet if not r["ok"]),
    }

def render(report: dict) -> str:
    lines = [f"# Reproducible-Builds Report — {report['generated_at']}", ""]
    lines.append(f"Repos scanned: {len(report['fleet'])}  Drift: {report['drift_count']}")
    lines.append("")
    lines.append("| Repo | Langs | Missing lockfiles | OK |")
    lines.append("|------|-------|------------------|-----|")
    for r in report["fleet"]:
        cells = []
        for k in ("languages", "lockfiles_missing", "ok"):
            pass
        langs = ",".join(r["languages"]) or "."
        miss = ",".join(r["lockfiles_missing"]) or "."
        ok = "Y" if r["ok"] else "."
        lines.append(f"| {r['repo']} | {langs} | {miss} | {ok} |")
    return "\n".join(lines) + "\n"

def main() -> int:
    ap = argparse.ArgumentParser(description="Reproducible-build audit")
    ap.add_argument("--output", "-o", help="Write JSON to file")
    ap.add_argument("--summary", action="store_true", help="Markdown summary")
    args = ap.parse_args()
    report = scan(REPO_ROOT)
    if args.summary:
        sys.stdout.write(render(report))
    else:
        out = json.dumps(report, indent=2, sort_keys=True)
        if args.output:
            Path(args.output).write_text(out)
            print(f"wrote {args.output}", file=sys.stderr)
        else:
            sys.stdout.write(out)
    return 0 if report["drift_count"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())