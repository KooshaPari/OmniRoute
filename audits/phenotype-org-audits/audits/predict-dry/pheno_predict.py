#!/usr/bin/env python3
"""
pheno-predict: Fleet-wide similar-code scanner for predictive DRY (ADR-047).

Scans a target repo against a set of baseline fleet repos, finds code blocks
with high Jaccard similarity (token-shingle based), and outputs a list of
predictive-DRY candidates — pairs of (repo_a, repo_b, file_a, file_b, jaccard)
where similarity > threshold.

This is the L72 (Predictive DRY discipline) tool. Use it weekly via cron
(see ADR-047 §6).

Usage:
    pheno-predict scan --target pheno-config --baseline ../sibling-repos
        --threshold 0.55 --out json|csv|md
    pheno-predict check-criteria --candidate '{"repo_a":"...", ...}'

Exit codes:
    0 — scan complete, no candidates above threshold
    1 — scan error
    2 — candidates found (CI can use this to flag PRs)

Design notes:
- Token-shingle Jaccard is O(n) per file pair, no AST or embedding model needed.
- We use 5-token shingles (medium-grained); a 3-token window would yield false
  positives from short identifiers.
- File size cap at 1 MB per file (skip binaries, generated, vendored).
- Skip-list: target/, build/, dist/, node_modules/, .venv/, .git/, vendor/.

This is ADR-047 / L72 implementation. Schema is documented in
`findings/71-pillar-2026-06-17-schema.md` §3.10 (Predictive Architecture).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SHINGLE_LEN = 5
MAX_FILE_BYTES = 1_000_000
SKIP_DIRS = {
    "target", "build", "dist", "node_modules", ".venv", "venv", "env",
    ".git", "vendor", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", "out", "bin", "obj",
}
CODE_EXTS = {
    ".py", ".pyi", ".rs", ".go", ".ts", ".tsx", ".js", ".jsx",
    ".java", ".kt", ".swift", ".m", ".mm", ".rb", ".php",
    ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".scala",
    ".ex", ".exs", ".clj", ".cljs", ".lua",
}
DEFAULT_THRESHOLD = 0.55
TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]{1,}|\d+")


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class FileSig:
    path: str          # relative to repo root
    repo: str
    shingles: set[bytes]
    line_count: int
    size_bytes: int
    language: str


@dataclass
class Candidate:
    repo_a: str
    file_a: str
    repo_b: str
    file_b: str
    jaccard: float
    shared_shingles: int
    total_shingles_a: int
    total_shingles_b: int
    language: str
    meets_4_criteria: bool = False
    criteria_notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Tokenization
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    """Tokenize code text into identifier + number tokens (whitespace + punctuation dropped)."""
    return TOKEN_RE.findall(text)


def shingles(tokens: list[str], n: int = SHINGLE_LEN) -> set[bytes]:
    """Return set of n-token hash shingles."""
    if len(tokens) < n:
        return set()
    out: set[bytes] = set()
    for i in range(len(tokens) - n + 1):
        chunk = " ".join(tokens[i : i + n])
        out.add(hashlib.sha1(chunk.encode("utf-8", errors="replace")).digest())
    return out


def detect_language(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".py": "python", ".rs": "rust", ".go": "go",
        ".ts": "typescript", ".tsx": "typescript",
        ".js": "javascript", ".jsx": "javascript",
        ".java": "java", ".kt": "kotlin", ".swift": "swift",
        ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp",
        ".cs": "csharp", ".scala": "scala", ".ex": "elixir",
        ".clj": "clojure", ".lua": "lua",
    }.get(ext, "other")


# ---------------------------------------------------------------------------
# File scan
# ---------------------------------------------------------------------------

def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def iter_code_files(root: Path) -> Iterable[Path]:
    """Yield code files under root, skipping vendored/build dirs."""
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if should_skip(p.relative_to(root)):
            continue
        if p.suffix.lower() not in CODE_EXTS:
            continue
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        yield p


def scan_repo(repo_root: Path, repo_name: str | None = None) -> list[FileSig]:
    """Scan one repo and return FileSig per code file."""
    repo_name = repo_name or repo_root.name
    out: list[FileSig] = []
    for fp in iter_code_files(repo_root):
        try:
            text = fp.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        toks = tokenize(text)
        if len(toks) < SHINGLE_LEN:
            continue
        sh = shingles(toks)
        if not sh:
            continue
        out.append(FileSig(
            path=str(fp.relative_to(repo_root)),
            repo=repo_name,
            shingles=sh,
            line_count=text.count("\n") + 1,
            size_bytes=fp.stat().st_size,
            language=detect_language(fp),
        ))
    return out


# ---------------------------------------------------------------------------
# Pairwise comparison
# ---------------------------------------------------------------------------

def jaccard(a: set[bytes], b: set[bytes]) -> tuple[float, int]:
    if not a or not b:
        return 0.0, 0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0, 0
    return inter / union, inter


def find_candidates(
    target: list[FileSig],
    baseline: list[FileSig],
    threshold: float = DEFAULT_THRESHOLD,
    min_shingles: int = 20,
) -> list[Candidate]:
    """Pairwise compare target files vs baseline files; return candidates ≥ threshold."""
    out: list[Candidate] = []
    by_lang: dict[str, list[FileSig]] = defaultdict(list)
    for f in baseline:
        by_lang[f.language].append(f)

    for fa in target:
        candidates = by_lang.get(fa.language, [])
        for fb in candidates:
            if fa.repo == fb.repo:
                continue
            j, shared = jaccard(fa.shingles, fb.shingles)
            if j >= threshold and shared >= min_shingles:
                out.append(Candidate(
                    repo_a=fa.repo,
                    file_a=fa.path,
                    repo_b=fb.repo,
                    file_b=fb.path,
                    jaccard=round(j, 4),
                    shared_shingles=shared,
                    total_shingles_a=len(fa.shingles),
                    total_shingles_b=len(fb.shingles),
                    language=fa.language,
                ))
    out.sort(key=lambda c: c.jaccard, reverse=True)
    return out


# ---------------------------------------------------------------------------
# ADR-047 4-criteria check
# ---------------------------------------------------------------------------

def check_4_criteria(c: Candidate) -> Candidate:
    """Heuristic check of the 4 ADR-047 predictive-DRY criteria.

    Heuristic — human review still required for the final sign-off. This
    just pre-filters obvious passes/fails.
    """
    notes: list[str] = []
    passes = 0

    # Criterion 1: 1+ current consumer with working code (size proxy)
    if c.total_shingles_a >= 50 and c.total_shingles_b >= 50:
        passes += 1
        notes.append("criterion-1: ✓ both files > 50 shingles (working code)")
    else:
        notes.append(f"criterion-1: ⚠ small file (a={c.total_shingles_a}, b={c.total_shingles_b} shingles)")

    # Criterion 2: 1+ named predicted consumer (requires human — we only flag)
    notes.append("criterion-2: HUMAN — author must name predicted consumer in PREDICTIVE.md")

    # Criterion 3: clean Port trait boundary (requires human — we only flag)
    notes.append("criterion-3: HUMAN — author must show Port trait / clean abstraction")

    # Criterion 4: bounded reversal cost (cheap heuristic: jaccard > 0.85 → hard to revert)
    if c.jaccard < 0.85:
        passes += 1
        notes.append("criterion-4: ✓ jaccard < 0.85 → ≤ 1 day revert cost")
    else:
        notes.append(f"criterion-4: ⚠ jaccard {c.jaccard} ≥ 0.85 → may be a near-duplicate, not extract")

    c.meets_4_criteria = passes >= 2  # heuristic — human review for criteria 2 + 3
    c.criteria_notes = notes
    return c


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def render_json(cands: list[Candidate]) -> str:
    return json.dumps([asdict(c) for c in cands], indent=2)


def render_csv(cands: list[Candidate]) -> str:
    if not cands:
        return "repo_a,file_a,repo_b,file_b,jaccard,shared_shingles,language,meets_4_criteria\n"
    rows = ["repo_a,file_a,repo_b,file_b,jaccard,shared_shingles,language,meets_4_criteria"]
    for c in cands:
        rows.append(
            f"{c.repo_a},{c.file_a},{c.repo_b},{c.file_b},"
            f"{c.jaccard:.4f},{c.shared_shingles},{c.language},{c.meets_4_criteria}"
        )
    return "\n".join(rows) + "\n"


def render_md(cands: list[Candidate]) -> str:
    if not cands:
        return "## Predictive DRY candidates\n\nNone found above threshold.\n"
    out = ["## Predictive DRY candidates\n"]
    out.append(f"Found **{len(cands)}** candidate pairs above threshold.\n")
    out.append("| repo_a | file_a | repo_b | file_b | jaccard | shared | lang | 4-criteria |")
    out.append("|---|---|---|---|---|---|---|---|")
    for c in cands:
        out.append(
            f"| `{c.repo_a}` | `{c.file_a}` | `{c.repo_b}` | `{c.file_b}` | "
            f"{c.jaccard:.4f} | {c.shared_shingles} | {c.language} | "
            f"{'✓' if c.meets_4_criteria else '⚠'}"
        )
    out.append("")
    out.append("### Criterion notes (per ADR-047)")
    for i, c in enumerate(cands[:5], 1):  # top 5 only
        out.append(f"\n**Candidate {i}:** `{c.repo_a}/{c.file_a}` ↔ `{c.repo_b}/{c.file_b}`")
        for note in c.criteria_notes:
            out.append(f"- {note}")
    return "\n".join(out) + "\n"


def render(cands: list[Candidate], fmt: str) -> str:
    return {"json": render_json, "csv": render_csv, "md": render_md}[fmt](cands)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_scan(args: argparse.Namespace) -> int:
    target_root = Path(args.target).resolve()
    if not target_root.is_dir():
        print(f"error: target is not a directory: {target_root}", file=sys.stderr)
        return 1

    baseline_roots = [Path(p).resolve() for p in args.baseline]
    for br in baseline_roots:
        if not br.is_dir():
            print(f"warning: baseline dir missing: {br}", file=sys.stderr)

    target_sigs = scan_repo(target_root, target_root.name)
    baseline_sigs: list[FileSig] = []
    for br in baseline_roots:
        baseline_sigs.extend(scan_repo(br, br.name))

    threshold = args.threshold
    cands = find_candidates(target_sigs, baseline_sigs, threshold=threshold)
    cands = [check_4_criteria(c) for c in cands]

    out = render(cands, args.format)
    if args.out:
        Path(args.out).write_text(out)
        print(f"wrote {len(cands)} candidates to {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(out)

    return 2 if cands else 0


def cmd_check_criteria(args: argparse.Namespace) -> int:
    """Check the 4 ADR-047 criteria for a single candidate (JSON in, JSON out)."""
    c = Candidate(**json.loads(args.candidate))
    c = check_4_criteria(c)
    print(json.dumps(asdict(c), indent=2))
    return 0 if c.meets_4_criteria else 2


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="pheno-predict", description=__doc__.split("\n")[1])
    sub = p.add_subparsers(dest="cmd", required=True)

    scan = sub.add_parser("scan", help="scan target vs baseline repos for similar code")
    scan.add_argument("--target", required=True, help="target repo path")
    scan.add_argument("--baseline", nargs="+", required=True, help="baseline repo path(s)")
    scan.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                      help=f"Jaccard threshold (default {DEFAULT_THRESHOLD})")
    scan.add_argument("--format", choices=["json", "csv", "md"], default="md")
    scan.add_argument("--out", help="write output to file (default stdout)")
    scan.set_defaults(func=cmd_scan)

    check = sub.add_parser("check-criteria", help="run 4 ADR-047 criteria check on a candidate")
    check.add_argument("--candidate", required=True, help="JSON candidate object")
    check.set_defaults(func=cmd_check_criteria)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())