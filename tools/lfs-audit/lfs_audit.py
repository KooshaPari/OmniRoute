#!/usr/bin/env python3
"""LFS audit tool — checks fleet repos for LFS-tracked file types.

Pillar L60 (LFS policy compliance) v27 T5.

Scans all repos under REPO_ROOT, checks .gitattributes for LFS patterns,
and reports files that should be LFS-tracked but aren't.

Usage:
    python3 tools/lfs-audit/lfs_audit.py
    python3 tools/lfs-audit/lfs_audit.py --repo HeliosLab
    python3 tools/lfs-audit/lfs_audit.py --json output.json
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# File extensions that SHOULD be LFS-tracked in any repo
LFS_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",       # images
    ".ttf", ".otf", ".woff", ".woff2",                      # fonts
    ".mp4", ".mov", ".avi", ".webm",                         # video
    ".mp3", ".wav", ".ogg",                                  # audio
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",  # docs
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",            # archives
    ".dmg", ".pkg", ".exe", ".msi", ".app",                  # binaries
    ".psd", ".ai", ".sketch",                                # design
    ".flac", ".aiff",                                         # lossless audio
    ".iso", ".img", ".vhd", ".vmdk",                         # disk images
    ".pth", ".pt", ".onnx", ".pb", ".tflite",                # ML models
    ".npy", ".npz", ".h5", ".hdf5",                          # data arrays
}

# Path patterns that should be LFS-tracked
LFS_PATH_PATTERNS = [
    "vendor/",
    "third_party/",
    "assets/",
    "static/",
    "public/",
    "testdata/",
    "fixtures/",
    "benchmarks/data/",
]


def check_repo(repo: Path) -> dict:
    """Check a single repo for LFS compliance."""
    result = {
        "repo": repo.name,
        "path": str(repo.relative_to(REPO_ROOT)),
        "has_gitattributes": False,
        "lfs_patterns_in_gitattributes": [],
        "non_lfs_binary_files": [],
        "violations": [],
    }

    gitattr = repo / ".gitattributes"
    if not gitattr.exists():
        result["violations"].append("missing .gitattributes")
        return result

    result["has_gitattributes"] = True

    # Parse .gitattributes for LFS patterns
    try:
        text = gitattr.read_text()
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "filter=lfs" in line or "lfs" in line.lower():
                pattern = line.split()[0] if line.split() else line
                result["lfs_patterns_in_gitattributes"].append(pattern)
    except Exception as e:
        result["violations"].append(f"error reading .gitattributes: {e}")

    # Check for binary/large files not tracked by LFS
    try:
        # Get list of files tracked by git
        out = subprocess.run(
            ["git", "-C", str(repo), "ls-files"],
            capture_output=True, text=True, timeout=30
        )
        if out.returncode != 0:
            result["violations"].append("git ls-files failed")
            return result

        tracked = [f for f in out.stdout.splitlines() if f.strip()]

        for f in tracked:
            fp = repo / f
            if not fp.exists() or fp.is_symlink():
                continue

            ext = fp.suffix.lower()
            if ext not in LFS_EXTENSIONS:
                # Check path patterns
                matched = False
                for pat in LFS_PATH_PATTERNS:
                    if f.startswith(pat):
                        matched = True
                        break
                if not matched:
                    continue

            # Check if this file is LFS-tracked
            attr_out = subprocess.run(
                ["git", "-C", str(repo), "check-attr", "filter", f],
                capture_output=True, text=True, timeout=10
            )
            if "filter: lfs" not in attr_out.stdout:
                size = fp.stat().st_size
                result["non_lfs_binary_files"].append({
                    "path": f,
                    "size_bytes": size,
                    "size_kb": round(size / 1024, 1),
                })
    except subprocess.TimeoutExpired:
        result["violations"].append("timeout scanning large repo")
    except Exception as e:
        result["violations"].append(f"scan error: {e}")

    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="LFS audit tool")
    ap.add_argument("--repo", help="Single repo to audit")
    ap.add_argument("--json", "-o", help="Write JSON output to file")
    ap.add_argument("--summary", action="store_true", help="Print summary table")
    args = ap.parse_args()

    repos = sorted(
        p for p in REPO_ROOT.iterdir()
        if p.is_dir() and not p.name.startswith(".") and (p / ".git").exists()
    )

    if args.repo:
        repos = [p for p in repos if p.name == args.repo]
        if not repos:
            print(f"repo not found: {args.repo}", file=sys.stderr)
            return 2

    results = []
    for r in repos:
        results.append(check_repo(r))

    total_violations = sum(len(r["violations"]) for r in results)
    total_binary = sum(len(r["non_lfs_binary_files"]) for r in results)
    missing_gitattr = sum(1 for r in results if not r["has_gitattributes"])

    report = {
        "schema_version": "1.0",
        "framework": "LFS-POLICY-2026",
        "generated_at": subprocess.run(
            ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
        ).stdout.strip(),
        "repos_scanned": len(results),
        "missing_gitattributes": missing_gitattr,
        "total_violations": total_violations,
        "total_non_lfs_binaries": total_binary,
        "results": results,
    }

    if args.json:
        Path(args.json).write_text(json.dumps(report, indent=2, sort_keys=True))
        print(f"wrote {args.json}", file=sys.stderr)
    else:
        print(json.dumps(report, indent=2, sort_keys=True))

    if args.summary:
        print(f"\n--- SUMMARY ---")
        print(f"Repos scanned: {len(results)}")
        print(f"Missing .gitattributes: {missing_gitattr}")
        print(f"Total violations: {total_violations}")
        print(f"Non-LFS binary files: {total_binary}")
        for r in results:
            if not r["has_gitattributes"] or r["violations"]:
                print(f"  {r['repo']}: {len(r['violations'])} violations, "
                      f"{len(r['non_lfs_binary_files'])} untracked binaries")

    return 0 if total_violations == 0 and total_binary == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
