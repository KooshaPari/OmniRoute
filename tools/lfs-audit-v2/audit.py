#!/usr/bin/env python3
"""v34-Evolve: LFS audit v2 — CI-integrated LFS tracking check with .gitattributes governance.

Pillar L60.1 (LFS audit). Scans repos for files >1MB not tracked by LFS,
reports untracked candidates, and auto-generates .gitattributes entries.

Usage:
    python3 tools/lfs-audit-v2/audit.py --repo-path . --ci-output lfs-report.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

EXTENSION_MAP = {
    ".zip": "zip", ".tar": "tar", ".gz": "gz", ".bz2": "bz2",
    ".7z": "7z", ".rar": "rar", ".pkl": "pickle", ".h5": "h5",
    ".onnx": "onnx", ".pt": "pytorch", ".pth": "pytorch",
    ".bin": "binary", ".exe": "binary", ".dll": "binary",
    ".so": "binary", ".dylib": "binary", ".wasm": "wasm",
    ".pdf": "pdf", ".png": "image", ".jpg": "image", ".jpeg": "image",
    ".gif": "image", ".mp4": "video", ".mov": "video", ".avi": "video",
    ".mp3": "audio", ".wav": "audio", ".flac": "audio",
    ".npy": "numpy", ".npz": "numpy", ".csv": "csv",
}


def _is_binary_small(path: Path, threshold_mb: float = 0.5) -> bool:
    """True if file is >threshold and has a known binary extension."""
    ext = path.suffix.lower()
    return ext in EXTENSION_MAP and path.stat().st_size > threshold_mb * 1024 * 1024


def _check_gitattributes(repo_path: Path) -> set[str]:
    """Return set of extensions already tracked by LFS in .gitattributes."""
    tracked: set[str] = set()
    ga = repo_path / ".gitattributes"
    if not ga.exists():
        return tracked
    for line in ga.read_text().splitlines():
        line = line.strip()
        if "filter=lfs" in line or "diff=lfs" in line:
            parts = line.split()
            if parts:
                tracked.add(parts[0].lstrip("*").lower())
    return tracked


def main() -> int:
    ap = argparse.ArgumentParser(description="LFS audit v2 with CI integration")
    ap.add_argument("--repo-path", type=Path, default=Path("."),
                    help="Repository path to audit")
    ap.add_argument("--threshold-mb", type=float, default=1.0,
                    help="File size threshold in MB (default: 1.0)")
    ap.add_argument("--ci-output", type=Path, default=None,
                    help="Write JSON report to this path")
    ap.add_argument("--fail-on-drift", action="store_true",
                    help="Exit 1 if untracked large files found")
    args = ap.parse_args()
    repo = args.repo_path.resolve()
    if not repo.exists():
        print(f"ERROR: {repo} not found", file=sys.stderr)
        return 2
    tracked_exts = _check_gitattributes(repo)
    candidates = []
    for root, dirs, files in os.walk(repo):
        # skip hidden dirs and node_modules / target
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in {"node_modules", "target", "__pycache__"}]
        for fn in files:
            path = Path(root) / fn
            try:
                if path.stat().st_size > args.threshold_mb * 1024 * 1024:
                    ext = path.suffix.lower()
                    already = ext.lstrip(".") in tracked_exts
                    candidates.append({
                        "file": str(path.relative_to(repo)),
                        "size_mb": round(path.stat().st_size / (1024 * 1024), 2),
                        "extension": ext,
                        "already_tracked": already,
                        "recommended_attr": f"*{ext} filter=lfs diff=lfs merge=lfs -text" if not already else None,
                    })
            except (OSError, PermissionError):
                pass
    untracked = [c for c in candidates if not c["already_tracked"]]
    report = {
        "repo": str(repo),
        "threshold_mb": args.threshold_mb,
        "total_large_files": len(candidates),
        "untracked_count": len(untracked),
        "tracked_by_gitattributes": list(tracked_exts),
        "untracked": untracked,
    }
    if args.ci_output:
        args.ci_output.parent.mkdir(parents=True, exist_ok=True)
        args.ci_output.write_text(json.dumps(report, indent=2))
        print(f"Report: {args.ci_output}")
    else:
        print(json.dumps(report, indent=2))
    if args.fail_on_drift and untracked:
        print(f"FAIL: {len(untracked)} untracked large files found", file=sys.stderr)
        return 1
    print(f"OK: {len(untracked)} untracked, {len(candidates) - len(untracked)} tracked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
