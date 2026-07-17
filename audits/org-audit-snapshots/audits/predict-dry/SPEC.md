# SPEC.md — pheno-predict

**Version:** 0.1.0
**Discipline:** L72 (Predictive DRY) — see `findings/71-pillar-2026-06-17-schema.md` §3.10
**ADR anchor:** ADR-047 (Predictive DRY discipline)

---

## 1. Purpose

Identify pairs of files across fleet repos whose token-shingle Jaccard
similarity is high enough to suggest a candidate for predictive-DRY
extraction — *before* the duplication grows to the point where extraction
becomes expensive.

This is the predictive analog of the existing `consume` (reactive DRY) tool.
Where `consume` reacts to *existing* duplication, `pheno-predict` proactively
flags *emerging* duplication, giving the fleet a 1-2 release lead time to
extract primitives.

## 2. Inputs

- `--target PATH` — the repo to scan (required)
- `--baseline PATH [PATH ...]` — one or more repos to compare against (required, ≥ 1)
- `--threshold FLOAT` — Jaccard threshold; default 0.55
- `--format {json,csv,md}` — output format; default `md`
- `--out PATH` — output file (default: stdout)

## 3. Algorithm

1. **Tokenize** each code file into identifier + number tokens
   (`[A-Za-z_][A-Za-z0-9_]{1,}|\d+`). Drop whitespace, punctuation, comments.
2. **Shingle** tokens into 5-token sliding windows; hash each window with SHA1
   (`SHINGLE_LEN = 5`).
3. **Filter** to code files: ext ∈ {.py, .pyi, .rs, .go, .ts, .tsx, .js, .jsx,
   .java, .kt, .swift, .m, .mm, .rb, .php, .c, .cc, .cpp, .h, .hpp, .cs,
   .scala, .ex, .exs, .clj, .cljs, .lua} AND size ≤ 1 MB.
4. **Skip** vendored/build dirs: target/, build/, dist/, node_modules/, .venv/,
   venv/, env/, .git/, vendor/, __pycache__/, .pytest_cache/, .mypy_cache/,
   .ruff_cache/, out/, bin/, obj/.
5. **Compare** target vs baseline file-pair shingles via Jaccard
   (`|A ∩ B| / |A ∪ B|`). Same-language only. Same-repo excluded.
6. **Filter** to pairs where Jaccard ≥ threshold AND shared_shingles ≥ 20.
7. **Pre-check** the 4 ADR-047 criteria heuristically (see §5).

## 4. Output

A list of `Candidate` records:

```python
@dataclass
class Candidate:
    repo_a: str
    file_a: str
    repo_b: str
    file_b: str
    jaccard: float            # rounded to 4 decimal places
    shared_shingles: int
    total_shingles_a: int
    total_shingles_b: int
    language: str
    meets_4_criteria: bool    # ADR-047 heuristic pre-check
    criteria_notes: list[str]
```

Sorted by `jaccard` descending. Exit code: 0 if no candidates, 1 if error,
2 if candidates found (CI-friendly).

## 5. ADR-047 4-criteria pre-check

Heuristic pre-filter; human review still required for criteria 2 + 3.

| # | Criterion | Heuristic |
|---|---|---|
| 1 | 1+ current consumer with working code | Both files have ≥ 50 shingles |
| 2 | 1+ named predicted consumer | HUMAN — flagged in `criteria_notes` |
| 3 | Clean Port trait boundary | HUMAN — flagged in `criteria_notes` |
| 4 | Bounded reversal cost | Jaccard < 0.85 → ≤ 1 day revert |

`meets_4_criteria = (criterion-1 passes) AND (criterion-4 passes)` (the two
heuristic-checkable criteria). Criteria 2 + 3 must be confirmed by a human
before any extraction PR is opened.

## 6. Why stdlib only (no embeddings, no AST, no network)

- **O(n) per file pair** — fast enough to scan 100 repos × 1k files in < 30 s
  on a MacBook.
- **No model, no download, no GPU** — fits the substrate pattern of "one
  purpose, zero external surface area".
- **Token-shingle captures *structural* similarity** (variable names, identifier
  patterns, control flow) without needing AST parsing.
- **False positives are fine** — human review catches them; false negatives are
  rare at Jaccard 0.55+.

## 7. Exit codes

| Code | Meaning |
|---|---|
| 0 | Scan complete, no candidates above threshold |
| 1 | Scan error (bad path, bad args) |
| 2 | Candidates found (CI can use this to flag PRs or open issues) |

## 8. Non-goals

- **Not a deduplicator.** `pheno-predict` flags candidates; the actual
  extraction is done in a follow-up PR using the existing `consume` pattern.
- **Not a similarity search engine.** For full-text / semantic search, use
  a vector DB or ripgrep.
- **Not a security tool.** Adversarial code (obfuscation, padding attacks)
  is out of scope.
