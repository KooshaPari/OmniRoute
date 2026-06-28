#!/usr/bin/env python3
"""SSOT audit: verify every repo has SSOT.md with required sections."""
from __future__ import annotations
import os, sys, json
ROOT = "/Users/kooshapari/CodeProjects/Phenotype/repos"
def audit(repo: str) -> dict:
    result = {"repo": repo, "has_ssot": False, "has_agents": False, "has_justfile": False, "has_llms": False, "has_deny": False}
    for f, key in [("SSOT.md","has_ssot"),("AGENTS.md","has_agents"),("justfile","has_justfile"),("llms.txt","has_llms"),("deny.toml","has_deny")]:
        result[key] = os.path.isfile(f"{ROOT}/{repo}/{f}")
    return result
repos = sorted(d for d in os.listdir(ROOT) if os.path.isdir(f"{ROOT}/{d}") and not d.startswith("."))
results = [audit(r) for r in repos]
score = sum(1 for r in results if r["has_ssot"] and r["has_agents"])
total = len(results)
print(f"SSOT Audit: {score}/{total} repos have SSOT.md+AGENTS.md ({100*score//total}%)")
missing = [r for r in results if not r["has_ssot"] and r["has_agents"]]
print(f"  {len(missing)} repos have AGENTS.md but no SSOT.md (gap)")
for m in missing[:10]:
    print(f"    {m['repo']}")
with open("findings/ssot-audit-result.json","w") as f:
    json.dump({"score": score, "total": total, "missing_ssot_with_agents": len(missing), "results": results}, f, indent=2)
