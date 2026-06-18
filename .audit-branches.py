#!/usr/bin/env python3
"""Audit OmniRoute branches: merge state, divergence, unique commits."""
import subprocess
import re
import sys
from collections import defaultdict

REPO = "OmniRoute"
ANSI = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

def run(cmd, cwd=REPO, check=False):
    full = f"git -c color.branch=no -c color.diff=no -c color.status=no {cmd}"
    result = subprocess.run(full, shell=True, cwd=cwd, capture_output=True, text=True)
    return result.stdout, result.stderr, result.returncode

def get_branches(remote=False):
    if remote:
        out, _, _ = run("branch -r")
    else:
        out, _, _ = run("branch")
    branches = []
    for line in out.splitlines():
        line = ANSI.sub('', line).strip()
        if not line:
            continue
        if line == 'HEAD' or '->' in line:
            continue
        if line.startswith('* '):
            line = line[2:]
        if remote:
            if line.startswith('origin/'):
                line = line[len('origin/'):]
                if line == 'HEAD':
                    continue
            else:
                continue
        else:
            if line.startswith('remotes/') or 'origin/HEAD' in line:
                continue
        if 'upstream/release' in line or 'upstream/test' in line:
            continue
        if line.startswith('release/v'):
            continue
        branches.append(line)
    return sorted(set(branches))

def get_count(a, b):
    out, _, _ = run(f"rev-list --count {a}..{b}")
    return out.strip() or "0"

def is_merged(branch_ref, target="origin/main"):
    result = subprocess.run(
        f"git merge-base --is-ancestor {branch_ref} {target}",
        shell=True, cwd=REPO, capture_output=True, text=True
    )
    return result.returncode == 0

def get_log(branch_ref, n=3):
    out, _, _ = run(f"log --oneline -n {n} {branch_ref}")
    return out.strip()

def main():
    print("=" * 130)
    print(f"OMNIRoute BRANCH AUDIT — 2026-06-18")
    print("=" * 130)

    print("\n## LOCAL BRANCHES (KP fork, local only)")
    print("-" * 130)
    print(f"  {'branch':54s} | {'ahead_o':>7s} | {'behind_o':>8s} | {'merged':>7s} | HEAD")
    print("  " + "-" * 128)
    locals_ = get_branches(remote=False)
    for b in locals_:
        ref = f"refs/heads/{b}"
        ahead_o = get_count("origin/main", ref)
        behind_o = get_count(ref, "origin/main")
        merged = is_merged(ref)
        log = get_log(ref, n=1)
        head_short = log.split('\n')[0] if log else ""
        print(f"  {b:54s} | {ahead_o:>7s} | {behind_o:>8s} | {str(merged):>7s} | {head_short[:80]}")

    print("\n## REMOTE BRANCHES (KP fork, on origin)")
    print("-" * 130)
    print(f"  {'branch':54s} | {'ahead_o':>7s} | {'behind_o':>8s} | {'merged':>7s} | HEAD")
    print("  " + "-" * 128)
    remotes = get_branches(remote=True)
    for b in remotes:
        if b == "main":
            continue
        ref = f"origin/{b}"
        ahead_o = get_count("origin/main", ref)
        behind_o = get_count(ref, "origin/main")
        merged = is_merged(ref)
        log = get_log(ref, n=1)
        head_short = log.split('\n')[0] if log else ""
        print(f"  {b:54s} | {ahead_o:>7s} | {behind_o:>8s} | {str(merged):>7s} | {head_short[:80]}")

if __name__ == "__main__":
    main()
