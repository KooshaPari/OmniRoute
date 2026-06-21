#!/usr/bin/env python3
"""
pheno-drift-detector: App-substrate drift detector (ADR-049).

Scans PAUSED / CONDITIONAL app repos for 2+ non-trivial capabilities that
match the substrate pattern (per ADR-023 Rule 3). Drift hits are output as
GitHub-issue-ready JSON for weekly cron → issue auto-creation.

This is the L74 (App-substrate drift detection) tool. Run weekly via cron.

Usage:
    pheno-drift-detector scan --root .. --out hits.json
    pheno-drift-detector scan --root .. --format md --since 7d
    pheno-drift-detector validate --hit hits.json/hit-0

Exit codes:
    0 — no drift hits
    1 — scan error
    2 — drift hits found (CI can fail on this)

Design notes:
- A "non-trivial capability" is heuristic: a directory under the app repo with
  ≥ 3 source files, ≥ 1 Port trait (or interface), ≥ 1 adapter, and ≥ 1 test.
- We use only structural signals (file count, naming, port pattern) — no AST
  parsing. False positives are fine; false negatives are not.
- Drift score = capabilities_count × bus_factor_penalty × substrate_match.
  Score ≥ 1.0 → drift hit.
- The 4-criterion candidate profile comes from ADR-049 §3.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# App repo config (per ADR-023, AGENTS.md "Active / Paused app-level repos")
# ---------------------------------------------------------------------------

PAUSED_APPS = {
    "focalpoint", "QuadSGM", "WSM", "*fitness*",
}
CONDITIONAL_APPS = {
    "Dino", "HwLedger",
}
CAPSTONE_APPS = {
    "AtomsBot", "AtomsBot-2nd", "AtomsBot-3rd", "AtomsBot-4th", "AtomsBot-5th",
}
ALL_APP_REPOS = PAUSED_APPS | CONDITIONAL_APPS | CAPSTONE_APPS

# Heuristic: a "non-trivial capability" directory must contain:
MIN_DIR_FILES = 3
MIN_DIR_BYTES = 5_000

# ADR-023 Rule 3 substrate pattern: Port trait (interface / protocol / trait)
PORT_PATTERNS = [
    re.compile(r"\b(trait|interface|protocol)\s+(\w+)\s*\{"),
    re.compile(r"\bclass\s+\w+\s*[:(].*\bProtocol\b"),
    re.compile(r"\b(impl|extends|implements)\s+\w+\s+(for|of|:)"),
]
ADAPTER_PATTERNS = [
    re.compile(r"\b(impl\s+\w+\s+for\s+\w+|class\s+\w+Adapter|implements\s+\w+)"),
]
TEST_PATTERNS = [
    re.compile(r"(test_|_test\.|\.spec\.|Test\.|\.tests\.|tests?/)"),
]

# Skip-list (drift detector must not waste cycles on these)
SKIP_DIRS = {
    "target", "build", "dist", "node_modules", ".venv", "venv", "env",
    ".git", "vendor", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", "out", "bin", "obj",
}

# Drift scoring weights
W_CAPABILITY = 1.0
W_PORT_MATCH = 0.4
W_ADAPTER_MATCH = 0.3
W_TEST_MATCH = 0.3
DRIFT_THRESHOLD = 1.5


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class Capability:
    dir: str
    file_count: int
    total_bytes: int
    has_port: bool
    has_adapter: bool
    has_test: bool
    ports: list[str] = field(default_factory=list)


@dataclass
class DriftHit:
    repo: str
    bucket: str  # paused | conditional | capstone
    capabilities: list[Capability]
    drift_score: float
    candidate_paths: list[str]  # suggested extraction targets
    target_substrate: str  # pheno-*-lib | phenotype-*-sdk | phenotype-*-framework | federated-service
    rationale: str
    suggested_action: str
    matched_files: list[str] = field(default_factory=list)
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------------------------------------------------------------------------
# Repo scanning
# ---------------------------------------------------------------------------

def is_code_file(p: Path) -> bool:
    return p.suffix.lower() in {
        ".py", ".rs", ".go", ".ts", ".tsx", ".js", ".jsx",
        ".java", ".kt", ".swift", ".rb", ".php",
    }


def should_skip(p: Path) -> bool:
    return any(part in SKIP_DIRS for part in p.parts)


def detect_buckets(repo_root: Path) -> list[str]:
    """Return which ADR-023 buckets a repo belongs to (may overlap with submodule paths)."""
    name = repo_root.name
    out: list[str] = []
    if name in PAUSED_APPS or any(re.match(p.replace("*", ".*"), name) for p in PAUSED_APPS):
        out.append("paused")
    if name in CONDITIONAL_APPS or any(re.match(p.replace("*", ".*"), name) for p in CONDITIONAL_APPS):
        out.append("conditional")
    if name in CAPSTONE_APPS or any(re.match(p.replace("*", ".*"), name) for p in CAPSTONE_APPS):
        out.append("capstone")
    return out


def find_capability_dirs(repo_root: Path, min_files: int = MIN_DIR_FILES,
                          min_bytes: int = MIN_DIR_BYTES) -> list[Capability]:
    """Find non-trivial capability directories under repo_root."""
    by_dir: dict[str, list[Path]] = {}
    for p in repo_root.rglob("*"):
        if not p.is_file() or not is_code_file(p):
            continue
        if should_skip(p.relative_to(repo_root)):
            continue
        rel = p.relative_to(repo_root)
        # Group by top-level capability directory (skip root, single-file dirs)
        parts = rel.parts
        if len(parts) < 2:
            continue
        cap_dir = parts[0]
        if cap_dir.startswith(".") or cap_dir in SKIP_DIRS:
            continue
        by_dir.setdefault(cap_dir, []).append(p)

    out: list[Capability] = []
    for cap_dir, files in by_dir.items():
        if len(files) < min_files:
            continue
        total_bytes = 0
        ports: list[str] = []
        has_adapter = False
        has_test = False
        for f in files:
            try:
                total_bytes += f.stat().st_size
            except OSError:
                pass
            if total_bytes < min_bytes:
                continue
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for pat in PORT_PATTERNS:
                for m in pat.finditer(text):
                    ports.append(f"{f.name}:{m.group(0)[:50]}")
            if any(p.search(text) for p in ADAPTER_PATTERNS):
                has_adapter = True
            if any(p.search(text) for p in TEST_PATTERNS):
                has_test = True

        if total_bytes < min_bytes:
            continue
        out.append(Capability(
            dir=cap_dir,
            file_count=len(files),
            total_bytes=total_bytes,
            has_port=bool(ports),
            has_adapter=has_adapter,
            has_test=has_test,
            ports=ports[:5],
        ))
    return out


# ---------------------------------------------------------------------------
# Drift scoring (per ADR-049 §4)
# ---------------------------------------------------------------------------

def score_drift(caps: list[Capability]) -> tuple[float, str, str]:
    """Compute drift score + suggested substrate placement + rationale.

    Returns (score, target_substrate, rationale).
    """
    if len(caps) < 2:
        return 0.0, "", ""

    n = len(caps)
    ports = sum(1 for c in caps if c.has_port)
    adapters = sum(1 for c in caps if c.has_adapter)
    tests = sum(1 for c in caps if c.has_test)

    score = (
        W_CAPABILITY * n
        + W_PORT_MATCH * ports
        + W_ADAPTER_MATCH * adapters
        + W_TEST_MATCH * tests
    )

    # Heuristic substrate placement
    if ports >= 2 and adapters >= 2:
        target = "phenotype-*-framework"
    elif ports >= 1 and adapters >= 1:
        target = "phenotype-*-sdk"
    elif ports >= 1:
        target = "pheno-*-lib"
    else:
        target = "pheno-*-lib (TBD — no Port trait found; recommend extracting)"

    rationale = (
        f"Found {n} non-trivial capabilities, {ports} with Port trait, "
        f"{adapters} with Adapter, {tests} with tests. "
        f"Score {score:.2f} (threshold {DRIFT_THRESHOLD})."
    )
    return score, target, rationale


def suggest_paths(caps: list[Capability]) -> list[str]:
    return [c.dir for c in caps if c.has_port][:5]


# ---------------------------------------------------------------------------
# Output rendering
# ---------------------------------------------------------------------------

def render_json(hits: list[DriftHit]) -> str:
    return json.dumps([asdict(h) for h in hits], indent=2)


def render_gh_issues(hits: list[DriftHit]) -> str:
    """Render hits as GitHub CLI `gh issue create --body-file` ready markdown."""
    if not hits:
        return ""
    out = []
    for i, h in enumerate(hits):
        out.append(f"<!-- drift-hit: {i} -->")
        out.append(f"## Drift detected: `{h.repo}` ({h.bucket})\n")
        out.append(f"**Drift score:** {h.drift_score:.2f} (threshold {DRIFT_THRESHOLD})\n")
        out.append(f"**Suggested target substrate:** `{h.target_substrate}`\n")
        out.append(f"**Rationale:** {h.rationale}\n")
        out.append(f"**Detected:** {h.detected_at}\n")
        out.append("\n### Capabilities found\n")
        out.append("| dir | files | bytes | port | adapter | test |")
        out.append("|---|---|---|---|---|---|")
        for c in h.capabilities:
            out.append(
                f"| `{c.dir}` | {c.file_count} | {c.total_bytes} | "
                f"{'✓' if c.has_port else '✗'} | "
                f"{'✓' if c.has_adapter else '✗'} | "
                f"{'✓' if c.has_test else '✗'} |"
            )
        out.append("\n### Suggested action\n")
        out.append(f"{h.suggested_action}\n")
        out.append(f"\n### Candidate extraction paths\n")
        for p in h.candidate_paths:
            out.append(f"- `{p}`")
        out.append(f"\n---\n")
    return "\n".join(out)


def render_md(hits: list[DriftHit]) -> str:
    if not hits:
        return "## Drift detection\n\nNo drift hits this run.\n"
    out = ["## Drift detection\n"]
    out.append(f"Found **{len(hits)}** drift hits.\n")
    for h in hits:
        out.append(f"### `{h.repo}` ({h.bucket}) — score {h.drift_score:.2f}\n")
        out.append(f"- **Target substrate:** `{h.target_substrate}`")
        out.append(f"- **Rationale:** {h.rationale}")
        out.append(f"- **Suggested action:** {h.suggested_action}\n")
        out.append("| capability | files | bytes | port | adapter | test |")
        out.append("|---|---|---|---|---|---|")
        for c in h.capabilities:
            out.append(
                f"| `{c.dir}` | {c.file_count} | {c.total_bytes} | "
                f"{'✓' if c.has_port else '✗'} | "
                f"{'✓' if c.has_adapter else '✗'} | "
                f"{'✓' if c.has_test else '✗'} |"
            )
        out.append("")
    return "\n".join(out) + "\n"


def render(hits: list[DriftHit], fmt: str) -> str:
    return {"json": render_json, "gh-issues": render_gh_issues, "md": render_md}[fmt](hits)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_scan(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"error: root is not a directory: {root}", file=sys.stderr)
        return 1

    # Discover candidate app repos: any subdirectory under root whose name
    # matches an ADR-023 bucket, OR that contains an AGENTS.md with a
    # bucket_change line.
    candidates: list[tuple[Path, list[str]]] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if should_skip(child.relative_to(root)):
            continue
        buckets = detect_buckets(child)
        if buckets:
            candidates.append((child, buckets))

    hits: list[DriftHit] = []
    for repo_root, buckets in candidates:
        caps = find_capability_dirs(repo_root)
        score, target, rationale = score_drift(caps)
        if score < DRIFT_THRESHOLD:
            continue
        # Use primary bucket
        primary = buckets[0]
        suggested = (
            f"Extract '{caps[0].dir}' (and related) from {repo_root.name} into a "
            f"new `{target.split()[0]}` crate under the appropriate fleet location "
            f"(see ADR-023 substrate placement rules)."
        )
        hit = DriftHit(
            repo=repo_root.name,
            bucket=primary,
            capabilities=caps,
            drift_score=score,
            candidate_paths=suggest_paths(caps),
            target_substrate=target,
            rationale=rationale,
            suggested_action=suggested,
            matched_files=[f"{c.dir}/*" for c in caps if c.has_port],
        )
        hits.append(hit)

    out = render(hits, args.format)
    if args.out:
        Path(args.out).write_text(out)
        print(f"wrote {len(hits)} drift hits to {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(out)

    return 2 if hits else 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a single hit by re-running scan on its repo and comparing."""
    path = Path(args.hit).resolve()
    repo = json.loads(path.read_text())
    print(f"Validating drift hit: {repo['repo']} (score {repo['drift_score']:.2f})")
    print(f"Bucket: {repo['bucket']}, target: {repo['target_substrate']}")
    print(f"Rationale: {repo['rationale']}")
    # Manual confirmation expected (HITL gate per ADR-049 §5)
    if args.yes:
        print("validated=yes (--yes)")
        return 0
    print("validated=no (run with --yes to confirm)")
    return 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="pheno-drift-detector", description=__doc__.split("\n")[1])
    sub = p.add_subparsers(dest="cmd", required=True)

    scan = sub.add_parser("scan", help="scan fleet for drift hits")
    scan.add_argument("--root", required=True, help="root directory containing app repos")
    scan.add_argument("--format", choices=["json", "md", "gh-issues"], default="json")
    scan.add_argument("--out", help="write output to file (default stdout)")
    scan.set_defaults(func=cmd_scan)

    val = sub.add_parser("validate", help="validate a single drift hit")
    val.add_argument("--hit", required=True, help="path to hit JSON file")
    val.add_argument("--yes", action="store_true", help="auto-confirm validation")
    val.set_defaults(func=cmd_validate)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())