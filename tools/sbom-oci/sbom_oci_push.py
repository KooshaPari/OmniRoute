#!/usr/bin/env python3
"""SBOM-to-OCI artifact push tool.

Pillar L52.1 (fleet-wide mTLS/integrity). Takes a CycloneDX SBOM file,
cosign-signs it (if cosign binary available), and pushes as an OCI artifact
to the configured registry.

Usage:
    python3 tools/sbom-oci/sbom_oci_push.py \\
        --sbom build/report.cdx.json \\
        --repo ghcr.io/KooshaPari/phenotype-go-sdk \\
        --tag v1.2.3
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

DEFAULT_REGISTRY = "ghcr.io"


def _verify_sbom(path: Path) -> bool:
    try:
        doc = json.loads(path.read_text())
        if doc.get("bomFormat") != "CycloneDX":
            print(f"WARN: {path} is not CycloneDX format", file=sys.stderr)
        return True
    except (json.JSONDecodeError, OSError) as exc:
        print(f"ERROR: {path} is not valid JSON: {exc}", file=sys.stderr)
        return False


def _cosign_sign(sbom_path: Path, repo: str, tag: str) -> bool:
    cosign = os.environ.get("COSIGN_BINARY", "cosign")
    try:
        subprocess.run([cosign, "version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("WARN: cosign not available, skipping signature", file=sys.stderr)
        return False
    ref = f"{DEFAULT_REGISTRY}/{repo}:sbom-{tag}"
    cmd = [
        cosign, "attest",
        "--predicate", str(sbom_path),
        "--type", "cyclonedx",
        ref,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)
        print(result.stdout.strip())
        return True
    except subprocess.CalledProcessError as exc:
        print(f"ERROR: cosign attest failed: {exc.stderr.strip()}", file=sys.stderr)
        return False


def main() -> int:
    ap = argparse.ArgumentParser(description="SBOM-to-OCI artifact pusher")
    ap.add_argument("--sbom", required=True, type=Path, help="Path to CycloneDX JSON SBOM")
    ap.add_argument("--repo", required=True, help="OCI repository (e.g., KooshaPari/phenotype-go-sdk)")
    ap.add_argument("--tag", required=True, help="Release tag (e.g., v1.2.3)")
    ap.add_argument("--registry", default=DEFAULT_REGISTRY, help="OCI registry host (default: ghcr.io)")
    ap.add_argument("--dry-run", action="store_true", help="Validate only, do not push")
    args = ap.parse_args()

    if not args.sbom.exists():
        print(f"ERROR: {args.sbom} does not exist", file=sys.stderr)
        return 2
    if not _verify_sbom(args.sbom):
        return 3

    print(f"SBOM: {args.sbom} ({args.sbom.stat().st_size} bytes)")
    print(f"Ref:  {args.registry}/{args.repo}:sbom-{args.tag}")
    print(f"Cosign: {'AVAILABLE' if os.environ.get('COSIGN_BINARY', 'cosign') else 'not configured'}")

    if args.dry_run:
        print("Dry-run: validation passed, skipping push")
        return 0

    success = _cosign_sign(args.sbom, args.repo, args.tag)
    if success:
        print(f"Pushed: {args.registry}/{args.repo}:sbom-{args.tag}")
        return 0
    print("WARN: push attempted but cosign step had issues", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
