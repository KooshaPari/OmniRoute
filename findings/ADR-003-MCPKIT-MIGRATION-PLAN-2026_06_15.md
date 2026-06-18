# ADR-003 McpKit → PhenoMCP — Migration Plan (2026-06-15 01:42 PDT)

## Decision recap (ADR-003, Accepted 2026-06-14)

**McpKit → MERGE into PhenoMCP.** Single MCP source of truth in the
Phenotype fleet. PhenoMCP is the org's planned MCP home
(`PhenoMCP/Cargo.toml` already declares a `crates/` workspace).
McpKit's Python is already a PhenoMCP submodule
(`McpKit/README.md:24`); Rust is real but mis-named; Go/TS are
empty scaffolds.

## Source inventory (McpKit HEAD `e316448`)

```
McpKit/
├── rust/                              # 5 real crates
│   ├── Cargo.toml                     # workspace
│   ├── Cargo.lock
│   ├── phenotype-mcp-asset/           # → PhenoMCP/crates/mcp-kit/pheno-mcp-asset
│   ├── phenotype-mcp-core/            # → PhenoMCP/crates/mcp-kit/pheno-mcp-core
│   ├── phenotype-mcp-fast/            # → PhenoMCP/crates/mcp-kit/pheno-mcp-fast
│   ├── phenotype-mcp-fast-macros/     # → PhenoMCP/crates/mcp-kit/pheno-mcp-fast-macros
│   ├── phenotype-mcp-framework/       # → PhenoMCP/crates/mcp-kit/pheno-mcp-framework
│   ├── agentora/                      # unrelated (or duplicate of monorepo Agentora)
│   ├── mcp-forge/                     # LSP codegen, unrelated to MCP
│   └── target/                        # build artifacts (not in git)
├── python/                            # 2 dirs
│   ├── agentmcp/                      # sub-pointer to PhenoMCP (per ADR-003)
│   └── pheno-mcp/                     # sub-pointer to PhenoMCP (per ADR-003)
├── go/                                # empty scaffold
│   └── go.work
├── typescript/                        # empty scaffold
│   └── package.json
├── registry.yaml                      # status: planning (stub)
├── README.md                          # "Sample servers live in the PhenoMCP repo"
├── pyproject.toml, Taskfile.yml, etc.
└── tests/
```

**Counts:** 5 Rust crates to move, 4 directory drops, 1 file rewrite
(registry.yaml → redirect), 1 archive action.

## Target inventory (PhenoMCP HEAD)

```
PhenoMCP/
├── Cargo.toml                         # workspace, members already include
│                                       #   pheno-mcp-server, -defs, -runtime,
│                                       #   -transport, pheno-ports,
│                                       #   pheno-meilisearch, pheno-qdrant
├── crates/
│   ├── pheno-mcp-server/
│   ├── pheno-mcp-defs/
│   ├── pheno-mcp-runtime/
│   ├── pheno-mcp-transport/
│   ├── pheno-ports/
│   ├── pheno-meilisearch/
│   ├── pheno-qdrant/
│   └── tool-registry/
├── docs/MCP-CATALOG.md                # canonical MCP catalog (replace registry.yaml)
├── README.md
└── ... (standard repo files)
```

## Migration plan (steps)

### Step 1: Create a fresh worktree off main

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos
git fetch origin main
git worktree add .worktrees/adr-003-mcpkit-merge-2026-06-15 \
  -b chore/adr-003-mcpkit-merge-2026-06-15 origin/main
cd .worktrees/adr-003-mcpkit-merge-2026-06-15
```

This isolates the work from the W1-2 / L5-87 branch in progress.

### Step 2: Move Rust crates (5 crates, 4-6 hours)

For each `phenotype-mcp-{name}` in `McpKit/rust/`:

1. `git mv McpKit/rust/phenotype-mcp-{name} PhenoMCP/crates/mcp-kit/pheno-mcp-{name}`
   (the new naming aligns with PhenoMCP's `pheno-mcp-*` convention)
2. In the moved crate's `Cargo.toml`:
   - Change `name = "phenotype-mcp-{name}"` → `name = "pheno-mcp-{name}"`
   - Update `[dependencies.phenotype-mcp-*]` → `pheno-mcp-*`
   - Update `[dev-dependencies]` similarly
3. Run `cargo fmt` and `cargo check` on the moved crate
4. Update PhenoMCP root `Cargo.toml` `[workspace.members]` to add:
   ```toml
   "crates/mcp-kit/pheno-mcp-asset",
   "crates/mcp-kit/pheno-mcp-core",
   "crates/mcp-kit/pheno-mcp-fast",
   "crates/mcp-kit/pheno-mcp-fast-macros",
   "crates/mcp-kit/pheno-mcp-framework",
   ```
5. Delete `McpKit/rust/Cargo.toml` and `McpKit/rust/Cargo.lock`
6. Verify `cargo check --workspace` passes from PhenoMCP root

**Rename mapping (5 crates):**

| Old (`phenotype-mcp-*`) | New (`pheno-mcp-*`) |
|---|---|
| `phenotype-mcp-asset` | `pheno-mcp-asset` |
| `phenotype-mcp-core` | `pheno-mcp-core` |
| `phenotype-mcp-fast` | `pheno-mcp-fast` |
| `phenotype-mcp-fast-macros` | `pheno-mcp-fast-macros` |
| `phenotype-mcp-framework` | `pheno-mcp-framework` |

### Step 3: Drop McpKit/python (5 minutes)

`McpKit/python/{agentmcp,pheno-mcp}` are sub-pointers to PhenoMCP
itself. Per ADR-003 step 2: drop the Python submodule pointer.

```bash
git rm McpKit/python/agentmcp McpKit/python/pheno-mcp
# remove from .gitmodules if present
# remove from McpKit/.gitmodules (or root .gitmodules)
```

### Step 4: Drop McpKit/go and McpKit/typescript (5 minutes)

Empty scaffolds per ADR-003 step 3.

```bash
git rm -r McpKit/go McpKit/typescript
```

Per ADR-003 step 3: "move to `phenoDesign/` if preserved." Decision
out of scope for this turn — recommendation: **drop**, since the
scaffolds are 1-2 files each and add maintenance cost.

### Step 5: Move or drop mcp-forge (10 minutes)

`McpKit/rust/mcp-forge/` is third-party LSP codegen (per ADR-003
context). Per ADR-003 step 4: "move to `tooling/` or drop."

Recommendation: **drop**. LSP codegen is orthogonal to MCP. The monorepo
already has `pheno-port-adapter` for port codegen.

```bash
git rm -r McpKit/rust/mcp-forge
```

### Step 6: Replace McpKit/registry.yaml with redirect (5 minutes)

```bash
git rm McpKit/registry.yaml
```

The replacement is the McpKit README (next step). PhenoMCP's
`docs/MCP-CATALOG.md` is the canonical catalog.

### Step 7: Replace McpKit/README.md with archive redirect (10 minutes)

The new McpKit README should:
- State: "This repository is archived. Code moved to PhenoMCP."
- Link: https://github.com/KooshaPari/PhenoMCP/tree/main/crates/mcp-kit
- Reference ADR-003

The new file is ~30-50 lines, similar to cheap-llm-mcp's DEPRECATED.md.

### Step 8: Commit + PR (30 minutes)

```bash
git add -A
git commit -m "feat(mcpkit): merge into PhenoMCP per ADR-003

Per ADR-003 (docs/adr/2026-06-14/ADR-003-mcpkit-merge-into-phenomcp.md,
Accepted 2026-06-14): merge McpKit's Rust crates into PhenoMCP
as crates/mcp-kit/, rename phenotype-mcp-* → pheno-mcp-*, drop
Python submodule pointer, drop Go/TypeScript scaffolds, drop
mcp-forge (LSP codegen orthogonal to MCP), and replace
registry.yaml with a redirect to PhenoMCP.

After this PR, the McpKit GitHub repo will be archived."
```

Push to `chore/adr-003-mcpkit-merge-2026-06-15` and open a PR against
`main` for the **monorepo**, plus a separate PR for the **PhenoMCP
submodule** if the parent PR is large enough to split.

### Step 9: Archive McpKit on GitHub (5 minutes, **BLOCKED by gh auth**)

```bash
gh api -X PATCH repos/KooshaPari/McpKit -f archived=true
# 404 with Dmouse92; needs KooshaPari or admin:org scope
```

**Blocker:** Same gh auth issue as NetScript. Dmouse92 cannot archive
KooshaPari/McpKit. Need KooshaPari GitHub identity.

## Time estimate

| Step | Duration | Risk |
|---|---|---|
| 1. Worktree setup | 5 min | Low |
| 2. Move 5 Rust crates | 4-6 hours | **High** (renames + import updates + cargo check cycles) |
| 3. Drop Python | 5 min | Low |
| 4. Drop Go/TS | 5 min | Low |
| 5. Drop mcp-forge | 10 min | Low |
| 6. Drop registry.yaml | 5 min | Low |
| 7. Replace README | 10 min | Low |
| 8. Commit + PR | 30 min | Medium (PR review coordination) |
| 9. Archive | 5 min | **BLOCKED** (gh auth) |
| **Total** | **~6-8 hours** | **High** |

## Recommendation

**Defer to a dedicated worktree session.** The Rust crate moves
(Step 2) are the long pole and require:

- Working in a clean `main`-based worktree (NOT the W1-2 / L5-87 branch)
- Running `cargo check --workspace` after each move to catch breakage
- Likely a follow-up PR per crate to keep diffs reviewable

The lightweight parts (Steps 3-7) can be batched into a single
"deprecation pass" PR. Steps 8-9 (commit + archive) are blocked by
gh auth (Dmouse92 ≠ KooshaPari).

## What was done in this turn

- **Inventoried** McpKit (5 Rust crates, 2 Python submodule pointers,
  1 Go scaffold, 1 TS scaffold, 1 mcp-forge dir, 1 registry.yaml stub).
- **Confirmed** PhenoMCP has `crates/pheno-mcp-*` naming convention
  and `docs/MCP-CATALOG.md` catalog.
- **Drafted** this 9-step migration plan.
- **No code changes** in McpKit or PhenoMCP this turn.

## Open follow-ups (deferred)

- [ ] Allocate a fresh worktree (`.worktrees/adr-003-mcpkit-merge-2026-06-15`).
- [ ] Coordinate with PhenoMCP maintainer (@team-agents per
      `McpKit/CODEOWNERS`) before opening the PR.
- [ ] Re-authenticate `gh` as KooshaPari to archive McpKit on GitHub.
- [ ] Update `L6_PHENO_REPOS_HEALTH_2026_06_14.md` to reflect the merge.

## References

- **ADR-003** (decision):
  `docs/adr/2026-06-14/ADR-003-mcpkit-merge-into-phenomcp.md`
- **McpKit HEAD:** `e316448 chore: add coverage task to Taskfile`
- **PhenoMCP HEAD:** `main` (the org MCP hub)
- **Source crates:** `McpKit/rust/{phenotype-mcp-asset, -core, -fast,
  -fast-macros, -framework}/`
- **Target crates:** `PhenoMCP/crates/{pheno-mcp-server, -defs, -runtime,
  -transport, pheno-ports, pheno-meilisearch, pheno-qdrant, tool-registry}/`
- **Canonical catalog:** `PhenoMCP/docs/MCP-CATALOG.md`
