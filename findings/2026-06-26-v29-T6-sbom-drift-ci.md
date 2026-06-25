# v29-T6 — L46.1 SBOM Drift CI Gate Adoption (P1→3.0)

## What
Run `tools/sbom-diff/sbom_diff.py` on every release to verify SBOM drift doesn't exceed threshold.

## Action
Add `sbom-diff-ci.yml` to call `sbom_diff.py` and fail on CRITICAL drift. Threshold: 0 added/removed binaries, <3 license changes allowed.

Ref: `tools/sbom-diff/sbom_diff.py` (exists from v26 T1)
