#!/usr/bin/env python3
"""
pheno-framework-lint: ADR-048 substrate graduation & tier-convention linter (L73).

Enforces the 4 substrate-tier conventions from ADR-048 / AGENTS.md:

  - pheno-*-lib:    no business logic, no App deps, no `domain/` dir
  - phenotype-*-sdk: polyglot consumers (≥ 2 languages import it) OR ADR-018
                     PRCP markers
  - phenotype-*-framework: IoC lifecycle, ≥ 1 Port trait, ≥ 1 Adapter impl,
                     docs/architecture/ exists
  - federated-service: long-running (binary + Dockerfile/compose), health
                     endpoint, deployment config

Usage:
    pheno-framework-lint check --path /path/to/repo
    pheno-framework-lint check-all --root /path/to/fleet --out json

Exit codes:
    0 — no violations
    1 — scan error
    2 — violations found

Design notes:
- All checks are heuristic (file presence + grep + naming convention) — false
  positives are fine; false negatives are not. Author review required for
  promotion PRs (PROMOTION.md template).
- This is the L73 (Substrate graduation path) tool. See
  `findings/71-pillar-2026-06-17-schema.md` §3.10.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# Tier definitions (ADR-048 §2, AGENTS.md "App substrate placement")
# ---------------------------------------------------------------------------

TIER_PATTERNS = {
    "pheno-*-lib":         re.compile(r"^pheno-[a-z0-9-]+$"),
    "phenotype-*-sdk":     re.compile(r"^phenotype-[a-z0-9-]+-?(sdk|ts|py|go|rs|js|kotlin|swift)$"),
    "phenotype-*-framework": re.compile(r"^phenotype-[a-z0-9-]+-framework$"),
    "federated-service":   re.compile(r"^(pheno|phenotype)-?[A-Z][A-Za-z0-9]+$"),
}

# Files / dirs that imply business logic (forbidden in pheno-*-lib)
BUSINESS_LOGIC_MARKERS = [
    re.compile(r"\bdomain\b"),  # dir name
    re.compile(r"\busecase[s]?\b"),
    re.compile(r"\bapp\b/"),
    re.compile(r"\bcontroller\b"),
    re.compile(r"\bhandler\b"),
]

# Files that imply binary / deployment (federated service)
DEPLOY_MARKERS = [
    "Dockerfile",
    "docker-compose.yml",
    "k8s",
    "helm",
    "Procfile",
    "fly.toml",
    "render.yaml",
]

# IoC / lifecycle markers (phenotype-*-framework)
IOC_MARKERS = [
    re.compile(r"\b(Lifecycle|Hook|Plugin|Extension|Resolver|Builder)\b"),
    re.compile(r"\b(Bootstrap|Initialize|Setup)\("),
]

# ADR-018 PRCP markers (polyglot reuse)
PRCP_MARKERS = [
    re.compile(r"#\[pyo3\]"),
    re.compile(r"\buniffi::\b"),
    re.compile(r"\bwasm_bindgen\b"),
    re.compile(r"pyimport\b"),
    re.compile(r"\bgrpc\b"),
]

# ADR-014 Port trait markers
PORT_TRAIT_MARKERS = [
    re.compile(r"\btrait\s+\w+\s*\{"),
    re.compile(r"\binterface\s+\w+\s*\{"),
    re.compile(r"\bprotocol\s+\w+\b"),
]

SKIP_DIRS = {
    "target", "build", "dist", "node_modules", ".venv", "venv", "env",
    ".git", "vendor", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", "out", "bin", "obj",
}


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class Violation:
    rule: str
    severity: str  # error | warning
    path: str
    detail: str
    remediation: str


@dataclass
class RepoReport:
    repo: str
    inferred_tier: str  # one of TIER_PATTERNS keys, or "unknown"
    violations: list[Violation] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Tier inference
# ---------------------------------------------------------------------------

def infer_tier(repo_name: str) -> str:
    for tier, pat in TIER_PATTERNS.items():
        if pat.match(repo_name):
            return tier
    return "unknown"


# ---------------------------------------------------------------------------
# Tier-specific checks
# ---------------------------------------------------------------------------

def check_pheno_lib(repo_root: Path) -> tuple[list[Violation], list[str]]:
    """pheno-*-lib: no business logic, no App deps, no domain/ dir."""
    violations: list[Violation] = []
    passed: list[str] = []

    # Rule 1: no domain/ dir
    if (repo_root / "domain").is_dir() or (repo_root / "src" / "domain").is_dir():
        violations.append(Violation(
            rule="pheno-lib/no-domain",
            severity="error",
            path=str(repo_root),
            detail="pheno-*-lib contains a `domain/` directory — this implies business logic.",
            remediation="Move domain logic to a phenotype-*-sdk or phenotype-*-framework; pheno-*-lib is primitives only.",
        ))
    else:
        passed.append("no-domain")

    # Rule 2: no business-logic markers in source files
    found_markers: list[tuple[str, str]] = []
    for src in iter_source_files(repo_root):
        try:
            text = src.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for marker in BUSINESS_LOGIC_MARKERS:
            if marker.search(text):
                found_markers.append((str(src.relative_to(repo_root)), marker.pattern))
    if found_markers:
        for path, pat in found_markers[:5]:
            violations.append(Violation(
                rule="pheno-lib/no-business-logic",
                severity="warning",
                path=path,
                detail=f"found business-logic marker `{pat}`",
                remediation="Refactor into phenotype-*-sdk or phenotype-*-framework; keep pheno-*-lib primitives-only.",
            ))
    else:
        passed.append("no-business-logic")

    # Rule 3: no App deps in Cargo.toml (basic grep)
    cargo = repo_root / "Cargo.toml"
    if cargo.is_file():
        try:
            text = cargo.read_text(encoding="utf-8")
        except OSError:
            text = ""
        if re.search(r"^(?!#).*\b(AtomsBot|QuadSGM|focalpoint|HwLedger|Dino)\s*=", text, re.M):
            violations.append(Violation(
                rule="pheno-lib/no-app-deps",
                severity="error",
                path="Cargo.toml",
                detail="pheno-*-lib depends on an app-level repo",
                remediation="App-level deps are forbidden in pheno-*-lib (ADR-023 Rule 3).",
            ))
        else:
            passed.append("no-app-deps")

    return violations, passed


def check_phenotype_sdk(repo_root: Path) -> tuple[list[Violation], list[str]]:
    """phenotype-*-sdk: polyglot consumers (≥ 2 languages) OR ADR-018 PRCP markers."""
    violations: list[Violation] = []
    passed: list[str] = []

    has_prcp = False
    for src in iter_source_files(repo_root):
        try:
            text = src.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for marker in PRCP_MARKERS:
            if marker.search(text):
                has_prcp = True
                break

    # Look for evidence of consumers in ≥ 2 languages (heuristic: README mentions ≥ 2 langs
    # OR tests/ directory has files in ≥ 2 languages OR examples/ has ≥ 2 langs)
    readme_text = ""
    for name in ("README.md", "Readme.md", "readme.md"):
        p = repo_root / name
        if p.is_file():
            try:
                readme_text = p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            break

    langs = set()
    for lang, exts in {
        "python": [".py"], "rust": [".rs"], "typescript": [".ts", ".tsx"],
        "go": [".go"], "kotlin": [".kt"], "swift": [".swift"],
        "ruby": [".rb"], "java": [".java"],
    }.items():
        for ext in exts:
            if any(repo_root.rglob(f"*{ext}")):
                langs.add(lang)

    n_lang = len(langs)
    if n_lang >= 2 or has_prcp:
        if has_prcp:
            passed.append(f"prcp-marker-found (n_lang={n_lang})")
        else:
            passed.append(f"polyglot ({n_lang} langs)")
    else:
        violations.append(Violation(
            rule="phenotype-sdk/polyglot-required",
            severity="error",
            path=str(repo_root),
            detail=f"phenotype-*-sdk must have polyglot consumers (≥ 2 languages) OR ADR-018 PRCP markers. Found {n_lang} lang(s) in repo, no PRCP markers.",
            remediation="Add a consumer in another language, or add an ADR-018 PRCP marker (pyo3/uniffi/wasm_bindgen/grpc).",
        ))

    # No business-logic in src? (warn, not error — SDKs can have domain)
    return violations, passed


def check_phenotype_framework(repo_root: Path) -> tuple[list[Violation], list[str]]:
    """phenotype-*-framework: IoC lifecycle, ≥ 1 Port trait, ≥ 1 Adapter impl, docs/architecture/."""
    violations: list[Violation] = []
    passed: list[str] = []

    # Rule 1: at least 1 Port trait
    port_count = 0
    adapter_count = 0
    ioc_count = 0
    for src in iter_source_files(repo_root):
        try:
            text = src.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if any(p.search(text) for p in PORT_TRAIT_MARKERS):
            port_count += 1
        if re.search(r"\b(impl\s+\w+\s+for\s+\w+|class\s+\w+Adapter|implements\s+\w+)\b", text):
            adapter_count += 1
        if any(p.search(text) for p in IOC_MARKERS):
            ioc_count += 1

    if port_count >= 1:
        passed.append(f"port-trait (n={port_count})")
    else:
        violations.append(Violation(
            rule="phenotype-framework/port-trait",
            severity="error",
            path=str(repo_root),
            detail="no Port trait / interface found — phenotype-*-framework requires ≥ 1",
            remediation="Add a Port trait (Rust) / interface (Type/Java) / protocol (Python/Swift).",
        ))
    if adapter_count >= 1:
        passed.append(f"adapter-impl (n={adapter_count})")
    else:
        violations.append(Violation(
            rule="phenotype-framework/adapter-impl",
            severity="error",
            path=str(repo_root),
            detail="no Adapter impl found — phenotype-*-framework requires ≥ 1",
            remediation="Add an adapter implementing the Port trait.",
        ))
    if ioc_count >= 1:
        passed.append(f"ioc-lifecycle (n={ioc_count})")
    else:
        violations.append(Violation(
            rule="phenotype-framework/ioc-lifecycle",
            severity="warning",
            path=str(repo_root),
            detail="no IoC / lifecycle / hook marker found — phenotype-*-framework typically has one",
            remediation="Add a Lifecycle / Hook / Plugin / Builder trait to formalize extension points.",
        ))

    # Rule 4: docs/architecture/ exists (or ARCHITECTURE.md)
    arch = (repo_root / "docs" / "architecture").is_dir() or (repo_root / "ARCHITECTURE.md").is_file()
    if arch:
        passed.append("architecture-doc")
    else:
        violations.append(Violation(
            rule="phenotype-framework/architecture-doc",
            severity="error",
            path=str(repo_root),
            detail="no docs/architecture/ dir or ARCHITECTURE.md — frameworks must document lifecycle",
            remediation="Add docs/architecture/ or ARCHITECTURE.md describing the IoC contract.",
        ))

    return violations, passed


def check_federated_service(repo_root: Path) -> tuple[list[Violation], list[str]]:
    """federated-service: long-running binary, Dockerfile, health endpoint, deployment config."""
    violations: list[Violation] = []
    passed: list[str] = []

    # Rule 1: Dockerfile or compose
    has_deploy = any((repo_root / m).exists() for m in DEPLOY_MARKERS)
    if has_deploy:
        passed.append("deploy-config")
    else:
        violations.append(Violation(
            rule="federated-service/deploy-config",
            severity="warning",
            path=str(repo_root),
            detail=f"no Dockerfile / k8s / compose / Procfile / fly.toml found",
            remediation="Add a Dockerfile and at least one deployment manifest.",
        ))

    # Rule 2: health endpoint (heuristic: /health or /readyz in source)
    has_health = False
    for src in iter_source_files(repo_root):
        try:
            text = src.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if re.search(r"/(health|healthz|readyz|livez|ready)", text):
            has_health = True
            break
    if has_health:
        passed.append("health-endpoint")
    else:
        violations.append(Violation(
            rule="federated-service/health-endpoint",
            severity="error",
            path=str(repo_root),
            detail="no /health /healthz /readyz /livez /ready endpoint found",
            remediation="Add a /health (liveness) and /readyz (readiness) endpoint.",
        ))

    return violations, passed


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_source_file(p: Path) -> bool:
    return p.suffix.lower() in {
        ".py", ".pyi", ".rs", ".go", ".ts", ".tsx", ".js", ".jsx",
        ".java", ".kt", ".swift", ".rb", ".php", ".c", ".cc", ".cpp",
        ".h", ".hpp", ".cs", ".scala",
    }


def iter_source_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file() or not is_source_file(p):
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            continue
        yield p


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_check(args: argparse.Namespace) -> int:
    path = Path(args.path).resolve()
    if not path.is_dir():
        print(f"error: not a directory: {path}", file=sys.stderr)
        return 1
    tier = infer_tier(path.name)
    check_fn = {
        "pheno-*-lib": check_pheno_lib,
        "phenotype-*-sdk": check_phenotype_sdk,
        "phenotype-*-framework": check_phenotype_framework,
        "federated-service": check_federated_service,
    }.get(tier)
    report = RepoReport(repo=path.name, inferred_tier=tier)
    if check_fn is None:
        report.violations.append(Violation(
            rule="unknown-tier",
            severity="warning",
            path=str(path),
            detail=f"repo name `{path.name}` does not match any ADR-023 substrate pattern",
            remediation="Rename to one of: pheno-*-lib, phenotype-*-sdk, phenotype-*-framework, or move under federated-service namespace.",
        ))
    else:
        v, p = check_fn(path)
        report.violations.extend(v)
        report.passed.extend(p)
    print(json.dumps(asdict(report), indent=2))
    return 2 if report.violations else 0


def cmd_check_all(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"error: root not a directory: {root}", file=sys.stderr)
        return 1
    reports: list[RepoReport] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if child.name.startswith("."):
            continue
        # Quick tier inference
        tier = infer_tier(child.name)
        if tier == "unknown":
            continue
        check_fn = {
            "pheno-*-lib": check_pheno_lib,
            "phenotype-*-sdk": check_phenotype_sdk,
            "phenotype-*-framework": check_phenotype_framework,
            "federated-service": check_federated_service,
        }.get(tier)
        report = RepoReport(repo=child.name, inferred_tier=tier)
        if check_fn:
            v, p = check_fn(child)
            report.violations.extend(v)
            report.passed.extend(p)
        reports.append(report)
    out = json.dumps([asdict(r) for r in reports], indent=2)
    if args.out:
        Path(args.out).write_text(out)
        n_violations = sum(len(r.violations) for r in reports)
        print(f"wrote {len(reports)} reports ({n_violations} violations) to {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(out)
    return 2 if any(r.violations for r in reports) else 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="pheno-framework-lint", description=__doc__.split("\n")[1])
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("check", help="check a single repo")
    c.add_argument("--path", required=True)
    c.set_defaults(func=cmd_check)

    a = sub.add_parser("check-all", help="check all repos under a root")
    a.add_argument("--root", required=True)
    a.add_argument("--out", help="write output to file")
    a.set_defaults(func=cmd_check_all)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())