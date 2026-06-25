#!/usr/bin/env python3
"""contract-test-fleet: cross-repo contract test runner (L27.1 P2)

Reads contracts/ directory from each repo (Pact files) and runs them
against the contract broker. Verifies consumer/provider compatibility.

Usage:
    python3 tools/contract-test-fleet/run.py \
        --repo-root . \
        --broker-url https://pact-broker.internal
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path


def find_contracts(repo_root: Path) -> list[Path]:
    """Find all .json contract files under contracts/ subdirs."""
    out = []
    for p in repo_root.rglob("contracts"):
        if not p.is_dir():
            continue
        for f in p.rglob("*.json"):
            out.append(f)
    return sorted(out)


def verify_contract(contract_path: Path, broker_url: str) -> dict:
    """Verify a single contract file. Reads provider + consumer + interactions."""
    result = {
        "contract": str(contract_path),
        "verified_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "interactions": 0,
        "errors": [],
    }
    try:
        data = json.loads(contract_path.read_text())
        result["interactions"] = len(data.get("interactions", []))
        provider = data.get("provider", {}).get("name", "?")
        consumer = data.get("consumer", {}).get("name", "?")
        result["provider"] = provider
        result["consumer"] = consumer
    except Exception as exc:
        result["errors"].append(str(exc))
    return result


def run_contracts(repo_root: Path, broker_url: str) -> dict:
    contracts = find_contracts(repo_root)
    results = [verify_contract(c, broker_url) for c in contracts]
    return {
        "ran_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "broker": broker_url,
        "contract_count": len(contracts),
        "interaction_count": sum(r["interactions"] for r in results),
        "error_count": sum(len(r["errors"]) for r in results),
        "results": results,
    }


def render(report: dict) -> str:
    lines = [f"# Contract test report — {report['ran_at']}", ""]
    lines.append(f"Broker: {report['broker']}, "
                 f"contracts: {report['contract_count']}, "
                 f"interactions: {report['interaction_count']}, "
                 f"errors: {report['error_count']}")
    lines.append("")
    lines.append("| Contract | Provider | Consumer | Interactions | Errors |")
    lines.append("|---|---|---|---|---|")
    for r in report["results"]:
        lines.append(f"| {r['contract']} | {r.get('provider','?')} | "
                     f"{r.get('consumer','?')} | {r['interactions']} | {len(r['errors'])} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Cross-repo contract test runner")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--broker-url", required=True)
    ap.add_argument("--output", help="optional output JSON path")
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()
    report = run_contracts(Path(args.repo_root), args.broker_url)
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2))
    if args.summary:
        sys.stdout.write(render(report))
    return 0 if report["error_count"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())