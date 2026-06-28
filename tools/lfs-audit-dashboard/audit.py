#!/usr/bin/env python3
"""T5 (L60.1) — LFS audit dashboard generator.

Reads git-lfs ls-files --long from fleet repos and produces
a markdown summary of LFS-managed file sizes and types.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path
from collections import Counter

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FLEET_DIRS = [p for p in REPO_ROOT.iterdir() if p.is_dir() and (p / ".git").exists()]

def audit_repo(repo: Path) -> dict:
    result = {"repo": repo.name, "lfs_files": 0, "total_bytes": 0, "extensions": Counter(), "largest": ("", 0)}
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "lfs", "ls-files", "--long"],
            capture_output=True, text=True, timeout=30
        )
        for line in out.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) >= 3:
                oid, size, path = parts[0], int(parts[1]), " ".join(parts[2:])
                ext = Path(path).suffix or "(no ext)"
                result["lfs_files"] += 1
                result["total_bytes"] += size
                result["extensions"][ext] += 1
                if size > result["largest"][1]:
                    result["largest"] = (path, size)
    except Exception:
        pass
    return result

def render(fleet: list[dict]) -> str:
    lines = ["# LFS Audit Dashboard\n"]
    total_files = sum(r["lfs_files"] for r in fleet)
    total_bytes = sum(r["total_bytes"] for r in fleet)
    lines.append(f"**Repos scanned:** {len(fleet)}  **LFS files:** {total_files}  **Total size:** {total_bytes / 1024**3:.2f} GB\n")
    lines.append("| Repo | LFS Files | Size (MB) | Largest File |")
    lines.append("|---|---|---|---|")
    for r in sorted(fleet, key=lambda x: -x["lfs_files"]):
        if r["lfs_files"] > 0:
            lines.append(f"| {r['repo']} | {r['lfs_files']} | {r['total_bytes'] / 1024**2:.1f} | {r['largest'][0]} ({r['largest'][1] / 1024**3:.2f} GB) |")
    ext_counter: Counter = Counter()
    for r in fleet:
        ext_counter.update(r["extensions"])
    lines.append("\n## File Type Breakdown\n")
    for ext, count in ext_counter.most_common(10):
        lines.append(f"- `{ext}`: {count} files")
    return "\n".join(lines) + "\n"

def main():
    fleet = [audit_repo(r) for r in FLEET_DIRS]
    with (REPO_ROOT / "findings" / "lfs-audit-dashboard.md").open("w") as f:
        f.write(render(fleet))
    print(f"Wrote lfs-audit-dashboard.md ({sum(r['lfs_files'] for r in fleet)} files across {len(fleet)} repos)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
