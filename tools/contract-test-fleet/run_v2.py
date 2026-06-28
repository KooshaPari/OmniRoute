#!/usr/bin/env python3
"""Contract test fleet runner v2 — verify all subscriber repos have pact-consumer/.

Pillar L27.1 (cycle-22 P2-lift final). Checks every subscriber crate for
a pact-consumer/ directory with at least one Pact test file.

Usage:
    python3 tools/contract-test-fleet/run_v2.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

SUBSCRIBER_CRATES = [
    "pheno-flags", "pheno-otel", "pheno-port-adapter", "pheno-tracing",
    "pheno-errors", "PhenoMCP", "PhenoCompose", "phenotype-ops",
    "phenotype-handoff", "pheno-vcs",
]


def check_repo(name: str) -> dict:
    repo = REPO_ROOT / name
    result = {"repo": name, "exists": repo.is_dir(), "has_contract_dir": False, "test_files": 0}
    if not result["exists"]:
        return result
    contract_dir = repo / "pact-consumer"
    result["has_contract_dir"] = contract_dir.is_dir()
    if result["has_contract_dir"]:
        result["test_files"] = sum(1 for f in contract_dir.rglob("*.rs") if f.name.startswith("test_"))
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="Contract test fleet runner v2")
    args = ap.parse_args()
    results = [check_repo(c) for c in SUBSCRIBER_CRATES]
    all_ok = True
    print("| Repo | Exists | pact-consumer/ | Test files |")
    print("|---|---|---|---|")
    for r in results:
        status = "✅" if r["has_contract_dir"] and r["test_files"] > 0 else "❌"
        print(f"| {r['repo']} | {r['exists']} | {r['has_contract_dir']} | {r['test_files']} |")
        if not r["has_contract_dir"] or r["test_files"] == 0:
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
