# Release Contract Rebaseline

Status: **in progress** · Owner: release-contract lane · Date: 2026-08-01

## Goal

Rebuild the release documentation gate against current `main` (`65560b3d52`) using
the accepted ADR-0005 generated-i18n policy. The gate must be deterministic,
manifest-driven, scoped, and safe against path escapes.

## Deliverables

| ID    | Deliverable                           | Status             | Evidence                                        |
| ----- | ------------------------------------- | ------------------ | ----------------------------------------------- |
| RC-01 | Manifest-driven release checker       | verified           | `scripts/check/check-docs-sync.mjs` (304 lines) |
| RC-02 | Release manifest                      | verified           | `config/release/release-contract.json`          |
| RC-03 | Concern-based regression suite        | verified           | `tests/unit/docs-sync-contract.test.ts` (11/11) |
| RC-04 | ADR-0005 i18n alignment               | verified by design | generated docs are ignored                      |
| RC-05 | Machine-readable session traceability | verified           | all seven living docs present                   |

## Safety

Only this isolated worktree is in scope. The dirty primary checkout and forensic
recovery paths are preserved. No ordinary commit, merge, or production release
is authorized by this session.
