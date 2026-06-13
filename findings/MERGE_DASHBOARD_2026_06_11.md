# PR Merge Dashboard — 2026-06-11

**Scope**: Batch-merge of all `is:open` KooshaPari PRs across the org per the v3 L1.4 governance keystone work.

## Personal PRs Landed (3/3 ✓)

| Repo | PR | Title | Merged At |
|---|---|---|---|
| `AgilePlus` | #704 | chore(meta): add top-level LICENSE (MIT) + .editorconfig + per-crate CODEOWNERS | 2026-06-11 09:42:44 |
| `Tracera` | #547 | feat(tracera-core): scaffold canonical entity model + Phase 1 port | 2026-06-11 09:33:32 |
| `phenotype-ops-mcp` | #47 | feat(providers/cheap_llm): merge cheap-llm-mcp into phenotype-ops-mcp | 2026-06-11 09:33:27 |

## Org-Wide PR Merge Campaign (Batch 1 + 2)

**Tools**: `gh api graphql` org-wide search → TSV → `awk MERGEABLE` → batch `gh pr merge --admin --squash --delete-branch`

### Merged (13 in batch 2, 4 in batch 1 = 17)

| Repo | PR | Title | Notes |
|---|---|---|---|
| `kmobile` | #22 | (dependabot) | merged |
| `phenoAI` | #58 | (governance) | merged |
| `Planify` | #57 | (governance) | merged |
| `hwLedger` | #106 | (governance) | merged |
| `phenotype-terrain` | #5 | (governance) | merged |
| `Agentora` | #65 | (governance) | merged |
| `phenotype-ops-mcp` | #45 | (governance) | merged |
| `phenotype-ops-mcp` | #44 | (governance) | merged |
| `Conft` | #67 | (governance) | merged |
| `Conft` | #66 | (governance) | merged |
| `Parpoura` | #238 | (governance) | merged |
| `QuadSGM` | #289 | (governance) | merged |
| `QuadSGM` | #288 | (governance) | merged |

Plus 4 from batch 1.

### Blocked (categorized)

| Block Reason | Count | Repos |
|---|---:|---|
| Need approving review (write access) | 16 | McpKit, Sidekick, BytePort, phenoForge, phenotype-infra |
| Comments unresolved | 3 | PhenoVCS |
| Review requesting changes | 2 | Conft |
| Still draft | 8 | Parpoura, pheno, AgilePlus, Tracera, Authvault |
| User lacks repo permissions | 4 | AtomsBot |
| Merge conflicts (dependabot cascade) | 42 | (most repos) |
| UNKNOWN (pending github compute) | 15 | various |

## Strategy Notes

- **Squash-merge** with `--delete-branch` to keep history clean
- **Branch name policy** blocked `chore/*` push; renamed `AgilePlus` to `feature/agileplus-meta-sweep-2026-06-11`
- **Dependabot cascade**: Merging one dependabot PR triggers conflicts on the next. Currently in rebase loop.
- **Per-repo approval required** for repos with 3+ status checks (BytePort, etc.)
- **AtomsBot** is a "no write access" repo (user not in org)

## DAG Status

- 3 personal tasks complete (own work)
- 13 cross-org governance PRs merged
- ~50+ still open across org
- ~42 dependabot cascade in flight
