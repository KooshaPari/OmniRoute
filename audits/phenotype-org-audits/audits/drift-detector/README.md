# Migrated from KooshaPari/pheno-drift-detector on 2026-06-19 prior to repo deletion

> Original source: https://github.com/KooshaPari/pheno-drift-detector (archived 2026-06-19, L5-112)
> See: [findings/2026-06-19-L5-112-drift-detector-absorption.md](../../findings/2026-06-19-L5-112-drift-detector-absorption.md) for the absorption matrix.
> Note: governance files (deny.toml, .gitattributes) are preserved as snapshots in `governance/` subdir for fleet-history provenance. They are NOT authoritative for org-audits — which has its own.

# pheno-drift-detector

**App-substrate drift detector (ADR-049, L74).**

`pheno-drift-detector` scans PAUSED / CONDITIONAL / CAPSTONE app repos for
**2+ non-trivial capabilities** that match the substrate pattern. When
detected, it outputs GitHub-issue-ready JSON for weekly cron → issue
auto-creation.

This is the L74 (App-substrate drift detection) tool, one of three governance
tooling additions for the v8 sweep (2026-06-18). It is the implementation of
the "weekly drift cron" described in `ADR-049-app-substrate-drift-detector.md`.

## Install

```bash
chmod +x pheno_drift_detector.py
ln -s "$(pwd)/pheno_drift_detector.py" /usr/local/bin/pheno-drift-detector
./pheno_drift_detector.py --help
```

## Usage

### Scan the fleet for drift hits

```bash
pheno-drift-detector scan \
    --root .. \
    --format gh-issues \
    --out drift-hits.md
```

`--root` is the directory containing the app repos. The detector walks each
subdirectory, infers its ADR-023 bucket from the repo name
(PAUSED / CONDITIONAL / CAPSTONE), and applies the 4-criterion candidate
profile from ADR-049 §3.

### Validate a single hit

```bash
pheno-drift-detector validate --hit drift-hits/hit-0.json --yes
```

HITL gate: human must confirm before extraction PR is opened.

## Algorithm (ADR-049 §4 — 3 passes)

### Pass 1 — Discover app repos
Walk `--root`; for each subdirectory, check if its name matches an ADR-023
bucket (see `PAUSED_APPS`, `CONDITIONAL_APPS`, `CAPSTONE_APPS` in the script).
If yes, schedule for scanning.

### Pass 2 — Find non-trivial capabilities
For each candidate app repo, group source files by top-level directory.
A "non-trivial capability" must have:
- ≥ 3 source files
- ≥ 5 KB total
- at least one file matching a Port trait pattern (`trait Foo {`, `interface Foo {`, etc.)

### Pass 3 — Score + suggest
Drift score = `n_capabilities × 1.0 + n_ports × 0.4 + n_adapters × 0.3 + n_tests × 0.3`.
Threshold: **1.5**. Hits above the threshold get:
- **Target substrate**: `pheno-*-lib` (Port only) / `phenotype-*-sdk` (Port + Adapter)
  / `phenotype-*-framework` (≥ 2 Ports + ≥ 2 Adapters) / federated-service.
- **Suggested action**: extract `cap[0].dir` (and related) into the suggested substrate.

## Output formats

- **`json`** — raw DriftHit objects, machine-readable
- **`md`** — human-readable summary table
- **`gh-issues`** — markdown formatted for `gh issue create --body-file -`

## Cron integration

```cron
# Run weekly on Monday 09:00 PDT, post to a tracking repo as issues
0 9 * * 1 cd /path/to/repos && pheno-drift-detector scan \
    --root . --format gh-issues --out /tmp/drift-$(date +\%Y\%m\%d).md \
    && gh issue create --label drift-detector --body-file /tmp/drift-*.md \
       --title "Drift detection $(date +\%Y-\%m-\%d)" \
       --repo KooshaPari/phenotype-org-audits
```

## Exit codes

- **0** — no drift hits
- **1** — scan error
- **2** — drift hits found (CI can fail on this)

## Retroactive hits (validated 2026-06-18)

| Repo | Bucket | Drift score | Action |
|---|---|---|---|
| `HwLedger` | CONDITIONAL | 2.4 | ✓ Extract `pheno-capacity` math lib (per ADR-035) |
| `Dino` | CONDITIONAL | 1.9 | ⚠ Engine primitives should be extracted; defer to L8 follow-up |
| `AtomsBot*` | CAPSTONE | 0.8 | ✗ Below threshold; legally mined only, no extraction |

## Schema

See `findings/71-pillar-2026-06-17-schema.md` §3.10 (L74 — App-substrate drift
detection) for the scoring rubric, and `docs/adr/2026-06-18/ADR-049-app-substrate-drift-detector.md`
for the policy this tool enforces.

## Related tools

- `pheno-predict` — companion L72 tool (similar-code scanner)
- `pheno-framework-lint` — companion L73 tool (substrate tier-convention enforcer)

## License

MIT (per `pheno-*` fleet convention).