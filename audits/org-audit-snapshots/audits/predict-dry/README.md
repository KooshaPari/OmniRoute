# Migrated from KooshaPari/pheno-predict on 2026-06-19 prior to repo deletion

> Original source: https://github.com/KooshaPari/pheno-predict (archived 2026-06-19, L5-112)
> See: [findings/2026-06-19-L5-112-predict-dry-absorption.md](../../findings/2026-06-19-L5-112-predict-dry-absorption.md) for the absorption matrix.

# pheno-predict

**Fleet-wide similar-code scanner for predictive DRY (ADR-047, L72).**

`pheno-predict` scans a target repository against a set of baseline fleet
repos, finds code blocks with high Jaccard similarity (5-token shingle based),
and outputs a list of **predictive-DRY candidates** — pairs of files across
repos where similarity is high enough that extracting a shared primitive
might be warranted.

This is the L72 (Predictive DRY discipline) tool, one of three governance
tooling additions for the v8 sweep (2026-06-18). It is the implementation of
the "weekly fleet scanner" described in `ADR-047-predictive-dry.md` §6.

## Install

```bash
# From a clone of this repo (no dependencies — stdlib only):
chmod +x pheno_predict.py
ln -s "$(pwd)/pheno_predict.py" /usr/local/bin/pheno-predict

# Or run directly:
./pheno_predict.py --help
```

## Usage

### Scan a target repo against a fleet baseline

```bash
pheno-predict scan \
    --target ../pheno-config \
    --baseline ../pheno-port-adapter ../phenotype-config ../pheno-otel \
    --threshold 0.55 \
    --format md \
    --out candidates.md
```

Output: markdown table of candidate pairs above the Jaccard threshold,
with the 4 ADR-047 criteria pre-checked for each (criteria 2 + 3 still need
human confirmation; the tool marks them as `HUMAN`).

### Run the 4 ADR-047 criteria check on a single candidate

```bash
pheno-predict check-criteria --candidate '{
  "repo_a": "pheno-config",
  "file_a": "src/loader.rs",
  "repo_b": "pheno-port-adapter",
  "file_b": "src/lib.rs",
  "jaccard": 0.61,
  "shared_shingles": 142,
  "total_shingles_a": 240,
  "total_shingles_b": 280,
  "language": "rust"
}'
```

## Algorithm

1. **Tokenize** each code file into identifier + number tokens (drop whitespace,
   punctuation, comments).
2. **Shingle** tokens into 5-token sliding windows; hash each window with SHA1.
3. **Compare** target vs baseline file-pair shingles via Jaccard similarity
   (`|A ∩ B| / |A ∪ B|`).
4. **Filter** to pairs where Jaccard ≥ threshold (default 0.55) AND
   shared_shingles ≥ 20.
5. **Pre-check** the 4 ADR-047 criteria heuristically; flag for human review.

### Why Jaccard, not AST or embeddings?

- O(n) per file pair, no model, no Python deps.
- Fast enough to scan 100 repos × 1k files in < 30 s on a MacBook.
- False positives are fine (human review catches them); false negatives are
  rare because token-shingle captures *structural* similarity (variable names,
  identifier patterns, control flow) without needing AST parsing.

### False-positive mitigation

- **min_shingles=20** (built-in) — drops short files where 5 of 5 shingles
  matching is not informative.
- **Same-language only** — cross-language Jaccard is meaningless (different
  keywords → different tokens).
- **Same-repo excluded** — only inter-repo comparisons.

## Cron integration

```cron
# Run weekly on Monday 09:00 PDT
0 9 * * 1 cd /path/to/repos && pheno-predict scan \
    --target . \
    --baseline */. \
    --threshold 0.6 \
    --format md \
    --out /tmp/pheno-predict-$(date +\%Y\%m\%d).md
```

Or wire it into a GitHub Action with the `phenotype-tooling/.github/workflows/reusable/python-ci.yml`
workflow as a reference.

## Exit codes

- **0** — scan complete, no candidates above threshold
- **1** — scan error (bad path, bad args)
- **2** — candidates found (CI can use this to flag PRs or open issues)

## Schema

See `findings/71-pillar-2026-06-17-schema.md` §3.10 (Predictive Architecture
domain, L72-L74) for the scoring rubric, and `docs/adr/2026-06-18/ADR-047-predictive-dry.md`
for the policy this tool enforces.

## Related tools

- `pheno-drift-detector` — companion L74 tool (app-substrate drift)
- `pheno-framework-lint` — companion L73 tool (substrate tier-convention enforcer)
- `phenotype-tooling/.github/workflows/reusable/python-ci.yml` — reusable
  Python CI workflow reference for predictive-DRY repos

## License

MIT (per `pheno-*` fleet convention).
