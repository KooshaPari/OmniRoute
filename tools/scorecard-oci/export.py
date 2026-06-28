#!/usr/bin/env python3
"""Scorecard OCI artifact export — exports fleet scorecard to OCI artifact.

Pillar L65 (SSOT auto-check) v4 T2 deliverable. Reads the latest pillar
scorecard from tools/pillar-fleet/ and exports it as an OCI artifact
(signed via cosign if available).

Usage:
    python3 tools/scorecard-oci/export.py --output artifact.json
    python3 tools/scorecard-oci/export.py --push --tag fleet-scorecard-2026-06-28
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCORECARD_DIR = REPO_ROOT / "tools" / "pillar-fleet"
DEFAULT_TAG = f"fleet-scorecard-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

def collect_scorecard_data() -> dict:
    """Read the latest scorecard data from tools/pillar-fleet/ files."""
    data = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "fleet_mean": None,
        "pillars": {},
    }
    # Read scorecard.sh output if available
    scorecard_sh = SCORECARD_DIR / "scorecard.sh"
    if scorecard_sh.exists():
        try:
            result = subprocess.run(
                ["bash", str(scorecard_sh)],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                data["scorecard_output"] = result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            data["scorecard_error"] = "scorecard.sh failed or timed out"
    # Read drift.sh output if available
    drift_sh = SCORECARD_DIR / "drift.sh"
    if drift_sh.exists():
        try:
            result = subprocess.run(
                ["bash", str(drift_sh)],
                capture_output=True, text=True, timeout=30
            )
            data["drift_output"] = result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            data["drift_error"] = "drift.sh failed or timed out"
    # Read the inventory from git ls-tree
    try:
        result = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "ls-tree", "-r", "HEAD", "--name-only"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            tools = [l for l in result.stdout.strip().split("\n") if l.startswith("tools/")]
            data["tool_count"] = len(tools)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return data

def export_artifact(data: dict, output_path: Path) -> int:
    """Write the artifact JSON to disk."""
    output_path.write_text(json.dumps(data, indent=2, sort_keys=True))
    print(f"wrote {output_path} ({output_path.stat().st_size} bytes)")
    return 0

def push_artifact(data: dict, tag: str) -> int:
    """Sign and push as OCI artifact via cosign."""
    cosign = os.environ.get("COSIGN_BINARY", "cosign")
    registry = os.environ.get("OCI_REGISTRY", "ghcr.io")
    repo = os.environ.get("OCI_REPO", "KooshaPari/argis-extensions")
    ref = f"{registry}/{repo}:{tag}"
    # Check cosign availability
    try:
        subprocess.run([cosign, "version"], capture_output=True, check=True, timeout=10)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("WARN: cosign not available, skipping push")
        return 0
    # Write temp artifact
    tmp = Path("/tmp/scorecard-artifact.json")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    print(f"Pushing to {ref} ...")
    cmd = [cosign, "attest", "--predicate", str(tmp), "--type", "scorecard", ref]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"ERROR: cosign attest failed: {result.stderr.strip()}")
        return 1
    print(f"Pushed to {ref}")
    return 0

def main() -> int:
    ap = argparse.ArgumentParser(description="Scorecard OCI artifact export")
    ap.add_argument("--output", "-o", type=Path, help="Output JSON file path")
    ap.add_argument("--push", action="store_true", help="Push as OCI artifact via cosign")
    ap.add_argument("--tag", default=DEFAULT_TAG, help="OCI artifact tag (default: fleet-scorecard-YYYY-MM-DD)")
    args = ap.parse_args()
    data = collect_scorecard_data()
    if args.output:
        export_artifact(data, args.output)
    if args.push:
        return push_artifact(data, args.tag)
    if not args.output and not args.push:
        # Default: write to stdout
        json.dump(data, sys.stdout, indent=2, sort_keys=True)
        print()
    return 0

if __name__ == "__main__":
    sys.exit(main())
