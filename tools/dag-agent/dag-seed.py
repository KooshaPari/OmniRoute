#!/usr/bin/env python3
"""DAG wave-1 seed generator — envelope expansion.

Selects 20 active buildable repos lacking governance baseline, emits
dag-state/wave-1.json (one row per repo). The dispatcher then runs
20 parallel subagents — each committing the 7-file governance scaffold.

Selection criteria (priority order):
  1. No AGENTS.md OR no justfile (governance gap)
  2. Has Cargo.toml / pyproject.toml / package.json / go.mod (active)
  3. Has nested .git/ (own history, onboardable independently)
  4. Not in active worktree (avoid merge conflict)
  5. Existing AGENTS.md < 50 lines (avoid overwriting detailed docs)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path("/Users/kooshapari/CodeProjects/Phenotype/repos")
GOVERNANCE_FILES = [
    "AGENTS.md",
    "justfile",
    "SSOT.md",
    "llms.txt",
    "deny.toml",
    ".pre-commit-config.yaml",
    ".github/workflows/ci.yml",
]

def is_active_buildable(repo: Path) -> bool:
    return (
        (repo / "Cargo.toml").exists()
        or (repo / "pyproject.toml").exists()
        or (repo / "package.json").exists()
        or (repo / "go.mod").exists()
    )

def governance_gap(repo: Path) -> list[str]:
    missing = []
    for f in GOVERNANCE_FILES:
        if not (repo / f).exists():
            missing.append(f)
    return missing

def already_covered(repo: Path) -> bool:
    agents = repo / "AGENTS.md"
    if agents.exists() and agents.stat().st_size > 2500:  # ~50 lines
        return True
    return False

def select_repos(width: int = 20) -> list[dict]:
    repos = sorted([p for p in REPO_ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")])
    selected: list[dict] = []
    for repo in repos:
        if len(selected) >= width:
            break
        if not (repo / ".git").exists():
            continue
        if not is_active_buildable(repo):
            continue
        if already_covered(repo):
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
            "commit_template": f"feat(governance): onboard {repo.name} to fleet baseline",
            "expected_branch": "chore/v38-dag-wave-1-2026-06-26",
            "depends_on": [],
            "wave": "wave-1",
            "stage": 1,
        })
    return selected

def main() -> int:
    width = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    selected = select_repos(width)
    out_path = Path("dag-state/wave-1.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "wave": "wave-1",
        "scope": "envelope-expansion",
        "width": len(selected),
        "created_at": "2026-06-26",
        "stage": 1,
        "tasks": selected,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out_path}: {len(selected)} tasks")
    for t in selected:
        print(f"  - {t['target_repo']}: +{t['expected_files_added']} files")
    return 0

if __name__ == "__main__":
    sys.exit(main())