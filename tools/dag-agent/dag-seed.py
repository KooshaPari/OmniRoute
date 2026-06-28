#!/usr/bin/env python3
"""DAG wave-N seed generator v2 — self-extending from findings/.

Usage:
    python3 dag-seed.py [width] [branch] [wave]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path("/Users/kooshapari/CodeProjects/Phenotype/repos")
FINDINGS_DIR = REPO_ROOT / "findings"
FINDING_RE = re.compile(r"^(?:Next|Side|Self|Follow):\s*(.+)$", re.MULTILINE | re.IGNORECASE)
GOV_FILES = ["AGENTS.md","justfile","SSOT.md","llms.txt","deny.toml",".pre-commit-config.yaml",".github/workflows/ci.yml"]

def is_buildable(p: Path) -> bool:
    for m in ["Cargo.toml","pyproject.toml","package.json","go.mod"]:
        if (p / m).exists(): return True
    return False

def gap(p: Path) -> list[str]:
    return [f for f in GOV_FILES if not (p / f).exists()]

def select_repos(n: int) -> list[dict]:
    out = []
    for d in sorted(REPO_ROOT.iterdir()):
        if not d.is_dir() or d.name.startswith(".") or not (d / ".git").exists(): continue
        if not is_buildable(d): continue
        agents = d / "AGENTS.md"
        if agents.exists() and agents.stat().st_size > 2500: continue
        m = gap(d)
        if not m: continue
        out.append({"id":f"env-{d.name}","lane":"envelope","target_repo":d.name,"missing_files":m,"expected_files_added":len(m),"commit_message":f"feat(governance): onboard {d.name}"})
        if len(out) >= n: break
    return out

def harvest(n: int) -> list[dict]:
    out = []
    if not FINDINGS_DIR.exists(): return out
    for fdoc in sorted(FINDINGS_DIR.glob("*closure*"), reverse=True):
        text = fdoc.read_text(errors="ignore")
        for line in FINDING_RE.findall(text):
            line = line.strip().lstrip("- ").strip()
            if not line or len(line) > 240 or "todo" in line.lower(): continue
            out.append({"id":f"find-{fdoc.stem}","lane":"side-dag","title":line[:140],"source":str(fdoc.relative_to(REPO_ROOT))})
            if len(out) >= n: return out
    return out

def main() -> int:
    w = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    branch = sys.argv[2] if len(sys.argv) > 2 else "chore/v47-dag-wave-4-onboard-2026-06-27"
    wave = sys.argv[3] if len(sys.argv) > 3 else "wave-4"
    env = select_repos(w // 2)
    side = harvest(w - len(env))
    tasks = env + side
    out = REPO_ROOT / "dag-state" / f"{wave}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"wave":wave,"branch":branch,"width":len(tasks),"envelope":len(env),"findings":len(side),"tasks":tasks}
    out.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out}: {len(tasks)} tasks ({len(env)} env + {len(side)} findings)")
    for t in env[:5]: print(f"  ENV {t['target_repo']:35s} +{t['expected_files_added']} files")
    for t in side[:3]: print(f"  SIDE {t['id'][:45]} {t['title'][:40]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
