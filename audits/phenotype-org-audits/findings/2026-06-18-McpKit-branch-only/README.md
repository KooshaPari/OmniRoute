# McpKit Branch-Only Archive (2026-06-18)

## Why this archive exists

The source repo `KooshaPari/McpKit` was archived (read-only marker) on GitHub on **2026-06-17**, the same day as the broader Dmouse92 → KooshaPari consolidation. Per ADR-003 (2026-06-14), `McpKit` is to be **merged into `PhenoMCP`**; per the broader ADR-029 Dmouse92 migration (2026-06-17), `KooshaPari/McpKit` is the canonical owner.

Because the remote is archived, **any content that lived only on non-`main` branches is now frozen locally**. If those local branches were to be garbage-collected, that content would be lost forever.

This archive preserves the unique branch-only artifacts as historical / research material. **It is NOT a contract** — none of these files should be reactivated or treated as a spec for any future McpKit work. All active substrate work is in `PhenoMCP` (per ADR-003).

## What was extracted

| Artifact | Source branch | Source commit | Size | Why preserved |
|---|---|---|---|---|
| `MCP_TOOLKITS_SOTA.md` | `origin/feat/journey-impl` | `6b6156a` | 3,638 lines | Aspirational SOTA research documenting a Python substrate tree that was never built. Richest unique doc in the repo. |
| `journey-traceability-RICH.md` | commit hash only | `430a882` | 79 lines (+4 over stub) | Rich-media traceability autograder scaffold. Was never on a remote branch — only reachable via dangling local refs. |
| `sessions/20260428-taskfile-mcpkit/*` (7 files) | `origin/feat/journey-impl` | `6b6156a` | 2,367 B total | Day-1 Taskfile session notes (Goal / Research / Spec / DAG / Strategy / Issues / Testing). |
| `sessions/20260429-mcpkit-sladge-badge/*` (7 files) | `origin/feat/journey-impl` | `6b6156a` | 3,195 B total | Day-2 sladge-badge session notes. Reveals a `rust/agentora` worktree branch in canonical checkout (out of scope for this archive). |
| `sladge-badge-scripts/cmd/generate/*.go` (8 files) | local `docs/mcpkit-sladge-badge` | `971a6c7` | 58,431 B total | Go CLI badge generator (`rust/mcp-forge/cmd/generate/`). |
| `sladge-badge-scripts/cmd/generate/README.md` + `LICENSE` | local `docs/mcpkit-sladge-badge` | `971a6c7` | 12,385 B total | |
| `sladge-badge-scripts/demo.cast` | local `docs/mcpkit-sladge-badge` | `971a6c7` | 4,385 B | asciinema recording of the badge generator running. |

**Total: 29 files, ~316 KB** (the SOTA doc alone is 132 KB)

See `BRANCH_PROVENANCE.md` for the per-file commit hash, branch, and byte size.

## What was NOT extracted (and why)

| Item | Reason for exclusion |
|---|---|
| `docs/journeys/manifests/README.md` | Single 1-page README on feat/journey-impl; not unique (generic journey manifests pattern from phenotype-infra). |
| `python/agentmcp/*` on feat/journey-impl | The Python `agentmcp` package was merged INTO McpKit via commit `0a46183` ("chore: merge AgentMCP into McpKit as python/agentmcp/") and is now part of `KooshaPari/McpKit`'s permanent record on main. Not branch-only. |
| `rust/phenotype-mcp-fast*` on feat/journey-impl | Crate was added in commit `fe4b79a` (2026-05-28) and is **not** branch-only — present on main. |
| `python/pheno-mcp` symlink/file on feat/journey-impl + sladge branches | Single line; not substantive. |
| `go/go.work` on sladge branches | Trivial Go workspace file. |
| `pyproject.toml`, `rust/Cargo.toml` on sladge branches | Stub manifests, not unique artifacts. |
| Other 170+ files on `origin/main` (CI, governance, README, etc.) | All on main; no preservation needed. |

## Cross-references

| Doc | Path | Status |
|---|---|---|
| Main McpKit absorption audit (L5-104) | `findings/2026-06-17-L5-104-bulk-rust-ts-migration.md` | EXISTS — McpKit covered as part of bulk migration |
| McpKit-specific audit | `findings/2026-06-18-McpKit-absorption-audit.md` | **NOT FOUND** — McpKit was migrated as part of the bulk PR; no standalone audit file was authored. The "merge into PhenoMCP per ADR-003" is captured in the bulk migration doc. |
| Dmouse92 migration proof | `findings/2026-06-17-L5-104-archival-proof.md` | EXISTS — McpKit listed as archived |
| ADR-003 (McpKit → PhenoMCP merge) | `docs/adr/2026-06-14/ADR-003-mcpkit-merge-into-phenomcp.md` | External — not in this archive |
| This archive's provenance | `BRANCH_PROVENANCE.md` (same dir) | EXISTS — full per-file commit hash table |
| Session day-1 (Taskfile) | `sessions/20260428-taskfile-mcpkit/` (same dir) | 7 files |
| Session day-2 (sladge) | `sessions/20260429-mcpkit-sladge-badge/` (same dir) | 7 files |

## Status

**Preserved as historical / SOTA research material. Not a contract. Not a spec.**

If a future engineer needs to consult what `MCP_TOOLKITS_SOTA.md` said about the (never-built) Python substrate, or how the sladge badge generator worked, they can read these files. No file in this archive should be merged, restored, or otherwise treated as a source of truth.

**Maintenance contract:** if the `KooshaPari/McpKit` GitHub repo is ever permanently deleted (90-day retention expires 2026-09-15 if not extended), the local branches `feat/journey-impl`, `chore/audit-safe-workflows-0605*`, `fix/trufflehog-setup-pin-0605`, `docs/mcpkit-sladge-badge`, `docs/mcpkit-sladge-ci-refresh` should be backed up to a fresh git bundle (`git bundle create /backup/McpKit-2026-06-18.bundle --all`) and the bundle hash logged here. This archive is sufficient as-is for research; the bundle is insurance against local ref expiry.

## Provenance verification

```bash
# Re-verify all line counts from this archive
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-org-audits
wc -l findings/2026-06-18-McpKit-branch-only/MCP_TOOLKITS_SOTA.md           # 3638
wc -l findings/2026-06-18-McpKit-branch-only/journey-traceability-RICH.md   # 85 (79 + 6 metadata + final newline)
ls -la findings/2026-06-18-McpKit-branch-only/sessions/20260428-taskfile-mcpkit/   # 7 files
ls -la findings/2026-06-18-McpKit-branch-only/sessions/20260429-mcpkit-sladge-badge/ # 7 files
ls -la findings/2026-06-18-McpKit-branch-only/sladge-badge-scripts/cmd/generate/    # 10 files
ls -la findings/2026-06-18-McpKit-branch-only/sladge-badge-scripts/demo.cast
```

See `BRANCH_PROVENANCE.md` for the source-side verification commands (re-runnable against the McpKit local clone).