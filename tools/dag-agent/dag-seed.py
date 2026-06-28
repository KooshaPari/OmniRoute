#!/usr/bin/env python3
"""DAG wave-N seed generator v3 — self-extending from findings/.

Usage:
    python3 tools/dag-agent/dag-seed.py [width] [branch] [wave]

Default: width=20, branch=chore/v48-dag-wave-4-onboard, wave=wave-4
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path("/Users/kooshapari/CodeProjects/Phenotype/repos")
FINDINGS_DIR = REPO_ROOT / "findings"

GOVERNANCE_FILES = [
    "AGENTS.md", "justfile", "SSOT.md", "llms.txt",
    "deny.toml", ".pre-commit-config.yaml", ".github/workflows/ci.yml",
]

FINDING_RE = re.compile(
    r"^\s*(?:Next|Side|Self[ -]extending|Follow|Followup):\s*(.+)",
    re.MULTILINE | re.IGNORECASE,
)

def is_active_buildable(repo: Path) -> bool:
    return any((repo / f).exists() for f in [
        "Cargo.toml", "pyproject.toml", "package.json", "go.mod",
    ])

def governance_gap(repo: Path) -> list[str]:
    return [f for f in GOVERNANCE_FILES if not (repo / f).exists()]

def select_repos(width: int) -> list[dict]:
    repos = sorted(p for p in REPO_ROOT.iterdir() if p.is_dir() and not p.name.startswith("."))
    selected: list[dict] = []
    for repo in repos:
        if len(selected) >= width:
            break
        if not (repo / ".git").exists():
            continue
        if not is_active_buildable(repo):
            continue
        agents = repo / "AGENTS.md"
        if agents.exists() and agents.stat().st_size > 2500:
            continue
        missing = governance_gap(repo)
        if not missing:
            continue
        selected.append({
            "id": f"envelope-{repo.name}",
            "lane": "envelope",
            "target_repo": repo.name,
            "missing_files": missing,
            "expected_files_added": len(missing),
            "commit_message": f"feat(governance): onboard {repo.name} to fleet baseline",
        })
    return selected

def harvest_findings(width: int) -> list[dict]:
    out: list[dict] = []
    if not FINDINGS_DIR.exists():
        return out
    for fdoc in sorted(FINDINGS_DIR.glob("*-dag-wave-*-closure.md"), reverse=True):
        if len(out) >= width:
            break
        text = fdoc.read_text(errors="ignore")
        lines = FINDING_RE.findall(text)
        for line in lines[:3]:
            line = line.strip().lstrip("- ").strip()
            if not line or len(line) > 240:
                continue
            out.append({
                "id": f"finding-{fdoc.stem}-{len(out)}",
                "lane": "side-dag-findings",
                "task_kind": "followup-finding",
                "title": line[:140],
                "source_doc": str(fdoc.relative_to(REPO_ROOT)),
                "expected_files_added": 1,
            })
    return out

def main() -> int:
    width = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    branch = sys.argv[2] if len(sys.argv) > 2 else "chore/v48-dag-wave-4-onboard-2026-06-27"
    wave = sys.argv[3] if len(sys.argv) > 3 else "wave-4"

    half = max(width // 2, 5)
    envelope = select_repos(half)
    findings = harvest_findings(width - len(envelope))

    out_path = REPO_ROOT / "dag-state" / f"{wave}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "wave": wave,
        "branch": branch,
        "width": len(envelope) + len(findings),
        "envelope_count": len(envelope),
        "findings_count": len(findings),
        "created_at": "2026-06-27",
        "tasks": envelope + findings,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out_path}: {payload['width']} tasks ({len(envelope)} envelope + {len(findings)} findings)")
    for t in envelope:
        print(f"  ENV  {t['target_repo']:40s} +{t['expected_files_added']} files  lane=envelope")
    for t in findings:
        print(f"  FIND {t['id'][:55]:55s}  lane=side-dag-findings  src={t['source_doc']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
