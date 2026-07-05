# Spec Map — phenodag concern → spec doc

**Date:** 2026-07-05 08:27Z

## The 5 trace concerns → Tracera spec 008

| Concern        | Tracera spec section                  | FR ID                |
|----------------|---------------------------------------|----------------------|
| DAG            | §3.1 DAG foundation                   | TR-PHENO-DAG-001..005 |
| Queue          | §3.2 Work queue                       | TR-PHENO-Q-001..004  |
| Atomic-claim   | §3.3 Claim (one-shot pickup)          | TR-PHENO-C-001..003  |
| Fuzzy-dedup    | §3.4 Dedup (input near-dup suppress)  | TR-PHENO-DEDUP-001..006 |
| Lease          | §3.5 Lease (TTL + heartbeat)          | TR-PHENO-L-001..004  |

Source: `Tracera/docs/specs/008-phenodag-absorption.md`

## The 7 PM concerns → AgilePlus spec 008

| Concern               | AgilePlus spec section            | FR ID         |
|-----------------------|-----------------------------------|---------------|
| YAML preset loader    | §3.1 Preset loader                | AP-PHENO-001  |
| 4 corpora             | §3.2 Corpora (v3-180/melosviz-185/agileplus-50/tracera-50) | AP-PHENO-002 |
| Fill (auto-task gen)  | §3.3 Fill                          | AP-PHENO-003  |
| Multi-project dashbd  | §3.4 Fleet DAG dashboard          | AP-PHENO-004  |
| Conventional commits  | §3.5 Commit policy                | AP-PHENO-005  |
| Branch hygiene        | §3.6 Branch hygiene               | AP-PHENO-006  |
| Cross-repo fleet inv  | §3.7 Fleet inventory              | AP-PHENO-007  |

Source: `AgilePlus/docs/specs/008-phenodag-absorption.md`

## The redirector

- phenodag/README.md points to BOTH Tracera AND AgilePlus
- phenodag/CHANGELOG.md documents the move
- 1-release-cycle window before archive

## Spec coverage assessment

- Trace concerns: 5/5 covered by Tracera spec 008
- PM concerns: 7/7 covered by AgilePlus spec 008
- No spec gap. No orphan FR.
