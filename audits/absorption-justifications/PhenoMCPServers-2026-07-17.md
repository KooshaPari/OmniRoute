# PhenoMCPServers → ARCHIVE_ONLY (absorption failsafe) — 2026-07-17

**Source repo:** `KooshaPari/PhenoMCPServers`
**Planned target (this task):** `phenodocs/registry/mcp-servers/` (per task spec: "if docs: mkdir -p .../phenodocs/registry/mcp-servers && cp -r PhenoMCPServers/* .../phenodocs/registry/mcp-servers/")
**Planned target (earlier audit, 2026-07-17T04:55Z):** `PhenoMCPServers (self, fleet aggregator)` — `disposition: DECLARE_SPINE`, `absorbed_target_path: docs/spine/PhenoMCPServers.md`
**Final disposition:** **ARCHIVE_ONLY** — source is runnable code, not pure registry docs; multiple target-conflicts match the Stashly/eyetracker/focalpoint/configra/kmobile/pine/civis/phenotype-omlx/phenotype-harness failsafe pattern.

## Audit summary

PhenoMCPServers is a **30-file Python monorepo** plus runnable MCP server packages. The preflight audit confirms (sizes via `du -sh` + `gh api repos/KooshaPari/PhenoMCPServers --jq '.size'`):

| Subtree | Size | Kind | Notes |
| --- | --- | --- | --- |
| `servers/` | 5.5 MB | runnable Python | `substrate/` (18 entries), `pheno-org/` (7 entries), `forge3-bridge/` (11 entries), `external/` (4 entries) — MCP server packages |
| `docs/` | 132 KB | markdown | wiring guides, ADR shards, retire/ subtree, MCP-CATALOG, LANGUAGE-TIERS-AND-ROLES, etc. |
| `uv.lock` | 72 KB | lockfile | pins `phenofastmcp @ git+https://github.com/KooshaPari/PhenoFastMCP.git@v3.4.2` and 30+ transitive deps |
| `skills/` | 68 KB | markdown + yaml | 8 skill bundles (`SKILL.md` + `skill.yaml`) — `catalog-wiring`, `forge3-bridge`, `github-fork-policy`, `language-tier-picker`, `mcp-boundary-guard`, `phenodag-claim`, `substrate-dispatch`, `substrate-vs-servers` |
| `templates/` | 64 KB | scaffold | `mcp-server/` (Python scaffold) + `mcp-server-ts7/` (TypeScript scaffold) for HexaKit `hexakit init mcp-server --catalog phenomcp` |
| `catalog/registry.yaml` | 13 KB | YAML | **SSOT** for servers, skills, plugins, agents — 12,926 bytes |
| `scripts/` | 20 KB | Python | `validate_catalog.py`, `validate_bundle_wiring.py`, `validate_fork_parents.py`, `validate_stale_patterns.py` |
| `tests/` | 16 KB | pytest | `test_bundle_wiring.py`, `test_hexakit_template.py`, `test_mcp_server_ts7_template.py` |
| `plugins/`, `agents/`, `schemas/` | ~24 KB combined | yaml + json | 1 plugin (`phenotype-bundle`), 1 agent (`fleet-lead`), 2 JSON schemas |
| `pyproject.toml` | 4 KB | manifest | `[project] name = "phenomcp"`, version 0.x, `phenofastmcp` dep |
| `README.md`, `SSOT.md`, `AGENTS.md`, `deny.toml`, `cliff.toml`, `justfile`, `llms.txt`, `pyproject.toml` | < 20 KB combined | config | root metadata |

Total: 2,594 KB on GitHub (`gh api`); 5.8 MB+ on disk including `.venv/`. Language: Python (primary) + 30+ Python packages across 4 server workspaces. Last push 2026-07-17T12:25:12Z (per `gh api`).

The repo is **healthy and self-bootstrapping** — it has its own `pyproject.toml`, its own validation pipeline (`python scripts/validate_catalog.py`), its own PyPI publishing pipeline (via `phenofastmcp` dependency), and its own catalog metadata format (YAML + JSON Schema). The README explicitly says: *"PhenoMCPServers — Phenotype **implementations** registry — runnable MCP servers plus **skills**, **plugins**, and **agent artifacts**."*

## Why ARCHIVE_ONLY instead of `phenodocs/registry/mcp-servers/`

The task spec called for `cp -r PhenoMCPServers/* phenodocs/registry/mcp-servers/` **only if the source is pure registry docs (markdown)**. PhenoMCPServers is **not** pure docs — it's a code-bearing repository with markdown as one of several artifact kinds. The disposition is therefore **ARCHIVE_ONLY** per the task's own fallback clause: *"Failsafe: ARCHIVE_ONLY if conflicts."*

### Conflict #1 — Source is runnable code, not pure docs

The task audit predicate is *"Determine if pure registry docs (markdown) or actual code."* The `if docs: cp -r` branch is skipped because:
- `servers/{substrate,pheno-org,forge3-bridge,external}/` are deployable MCP server packages, not documentation
- `pyproject.toml` + `uv.lock` + `.venv/` declare and pin a real Python build
- `tests/` contains pytest modules that import the server packages
- `scripts/validate_*.py` are executable Python (not docs)
- The `if docs` predicate fails at the first byte — the source is dominated by runnable code, not markdown

### Conflict #2 — Destination doesn't exist / is wrong repo

- `phenodocs/registry/` directory does not exist on disk. The actual `registry/` in the phenotype monorepo lives at `phenotype-registry/registry/disposition-index.json` (which is the only canonical registry index).
- `phenodocs` is a VitePress documentation site (`.vitepress/`, `docs/`, `index.md`, `package.json` with VitePress deps). Putting 5.5 MB of runnable Python in a docs site is a category mismatch — `phenodocs` has no build/test target for Python and no `pyproject.toml` workspace member for it.
- The task's destination `phenodocs/registry/mcp-servers/` is inconsistent with both the actual `phenotype-registry` registry location and the prior `disposition-index.json` row (DSPI-13) which points to `docs/spine/PhenoMCPServers.md` (in `phenotype-registry`, not `phenodocs`).

### Conflict #3 — Earlier 2026-07-17 audit already decided differently

The DSPI-13 row in `phenotype-registry/registry/disposition-index.json` (created 2026-07-17T04:55:00Z) records:
- `disposition: DECLARE_SPINE`
- `target: PhenoMCPServers (self, fleet aggregator)`
- `absorbing_repo: phenotype-registry`
- `absorbed_target_path: docs/spine/PhenoMCPServers.md`
- `archive_reason: self-declared-spine-member`

The earlier audit explicitly states: *"Self-declared implementations registry (catalog + schemas + servers + skills + plugins + agents). Has its own 30-file structure with multi-Python packages, validation scripts, and PyPI publishing pipeline. **Not absorbable into any other repo.** Treating as a SELF-DECLARED SPINE MEMBER alongside the 4-role spine (registry=INDEX, PhenoSpecs=ADRs, PhenoHandbook=CONVENTIONS, governance=ENFORCEMENT). Recommend: add PhenoMCPServers=IMPLEMENTATIONS to the 5th spine role, update SPINE-DEFINITION.md."*

The current task's plan (`disposition: absorbed`, `target: phenodocs (registry/mcp-servers/)`) directly contradicts this prior decision.

### Conflict #4 — The "kept live" recommendation

The earlier audit's spine document (`phenotype-registry/docs/spine/PhenoMCPServers.md`) states: *"Source repo (`KooshaPari/PhenoMCPServers`): kept live"*. Archiving the source breaks the spine-member recommendation (a spine member should have a live canonical home). The current task's `gh repo archive` step overrides this — accepted because the task's failsafe is explicit ("ARCHIVE_ONLY if conflicts") and a sealed read-only archive preserves the source as a forensic anchor for any future reactivation.

## Fails-condition path executed

Per the task spec: *"Failsafe: ARCHIVE_ONLY if conflicts."* The fails-condition was met on all four axes above. Executed:

1. **Preflight audit complete.** Read `README.md` (69 lines), `ls -la` of root, `du -sh` of every subdirectory, `ls -la` of every subdirectory, `gh api repos/KooshaPari/PhenoMCPServers --jq` for size + last-push + default-branch. Confirmed: 5.5 MB+ runnable Python source, 2,594 KB on GitHub, last push today, `isArchived: false` at audit time.
2. **No code copied.** `phenodocs/registry/mcp-servers/` was not created. The `if docs: cp -r` branch was skipped because the `if docs` predicate evaluated to `false` (code, not docs).
3. **No commit on `phenodocs`.** The current `phenodocs` branch (`absorb/parpoura-2026-07-17`) is untouched — it carries an earlier `feat(packages): absorb StealthStartup + design-tokens from prior batch` (71ec15e) and was not modified by this task.
4. **GitHub archive** — `gh repo archive KooshaPari/PhenoMCPServers -y` (exit 0). Verified post-archive with `gh repo view KooshaPari/PhenoMCPServers --json isArchived` → `isArchived: true`.
5. **Registry updated (preserved DECLARE_SPINE, appended failsafe rationale)** — `phenotype-registry/registry/disposition-index.json` row DSPI-13: `disposition: DECLARE_SPINE` **unchanged** (the structural decision stands); `archive_reason` extended from `"self-declared-spine-member"` to `"self-declared-spine-member + github-sealed-via-failsafe-2026-07-17"`; `note` field appended (using `|` separator, mirroring the `repo-hwledger` 2026-07-17 failsafe pattern) with the full failsafe rationale and restore procedure. The append preserves the original audit text verbatim and adds ~1,600 characters of failsafe context.
6. **Audit artifact retained.** This file (replacing the earlier 30-line QUEUED stub) records the failsafe action in full.
7. **Spine document retained.** `phenotype-registry/docs/spine/PhenoMCPServers.md` is unchanged; the 5th-spine role (IMPLEMENTATIONS) proposal remains in force. Archive is orthogonal to spine membership — a sealed read-only archive can still serve as a forensic anchor for the spine role, and a future `gh repo unarchive` would restore the live source.

## Reactivation path (for future agents)

If a future agent wishes to re-attempt absorption (e.g. to a NEW target that doesn't collide with phenodocs or the spine role):

1. **Unarchive on GitHub:** `gh repo unarchive KooshaPari/PhenoMCPServers` (reverses the seal; the repo is sealed read-only, not deleted, so all 30 files + git history are intact).
2. **Re-evaluate the target.** Candidate targets that wouldn't trigger the failsafe:
   - **Standalone reactivation** (recommended): keep `PhenoMCPServers` as a self-hosted implementations registry (the original 2026-07-17 audit's recommendation). This honors the `disposition: DECLARE_SPINE` decision and the 5th-spine role proposal.
   - **`phenotype-tooling`** (if PhenoMCPServers is genuinely tooling-shaped): would need a full audit of `phenotype-tooling/crates/` + workspace member collision check, plus resolution of the `phenofastmcp` git-dependency.
   - **`phenodocs/docs/specs/pheno-mcp/`** (docs-only extraction): could absorb the `docs/` subtree (132 KB of markdown) and the `catalog/registry.yaml` SSOT (13 KB YAML) into a docs-only mirror, leaving the runnable `servers/` in the GitHub archive as a forensic reference. This is the **only partial absorption** that's coherent with phenodocs' docs-site scope.
3. **Revert this audit's `note` append** in `registry/disposition-index.json` row DSPI-13, and revert `archive_reason` to its prior value.
4. **Update `disposition`** from `DECLARE_SPINE` to the new disposition (`ABSORB` or `ARCHIVE_ONLY-reactivated`), and bump `fsm` to the new state.
5. **Run the validation pipeline** in the new home: `pip install -e ".[dev]"` and `python scripts/validate_catalog.py` (if the receiving repo can host Python).
6. **Update `SPINE-DEFINITION.md`** if the 5th-spine role is ratified, to declare `PhenoMCPServers = IMPLEMENTATIONS`.

## Cross-references

- Registry row (disposition): `phenotype-registry/registry/disposition-index.json` id `DSPI-13`
- Earlier audit stub: `phenotype-registry/audits/absorption-justifications/PhenoMCPServers-2026-07-17.md` (30-line QUEUED; superseded by this file)
- Spine document: `phenotype-registry/docs/spine/PhenoMCPServers.md` (proposes 5th spine role = IMPLEMENTATIONS)
- Source README: `PhenoMCPServers/README.md` (69 lines, declares "implementations registry")
- Source structure: `ls -la PhenoMCPServers/`, `du -sh PhenoMCPServers/*`
- Prior commit precedent (eyetracker failsafe): `phenotype-registry/audits/absorption-justifications/eyetracker-2026-07-17.md`
- Failsafe pattern precedents (9 mirror cases, all 2026-07-17): Stashly, Pine, kmobile, Civis, Configra, FocalPoint, eyetracker, phenotype-omlx, phenotype-harness-deferred

## Verification

| Artifact | State |
| --- | --- |
| `KooshaPari/PhenoMCPServers` GitHub repo | **archived** via `gh repo archive KooshaPari/PhenoMCPServers -y` (verified `isArchived: true` 2026-07-17; size 2594 KB; last push 2026-07-17T12:25:12Z) |
| `phenotype-registry/registry/disposition-index.json` `DSPI-13` row | `disposition: DECLARE_SPINE` (preserved); `archive_reason: "self-declared-spine-member + github-sealed-via-failsafe-2026-07-17"`; `note` appended with `|` separator (preserves original audit text + ~1,600 chars of failsafe rationale + restore procedure) |
| `phenotype-registry/docs/spine/PhenoMCPServers.md` | unchanged (5th-spine role proposal remains in force) |
| `phenodocs/registry/` | not created |
| `phenodocs` working tree | not modified (still on branch `absorb/parpoura-2026-07-17`, HEAD `71ec15e`) |
| `phenodocs/registry/mcp-servers/` | does not exist (intentional) |
| `PhenoMCPServers/servers/` source | preserved at `repos/PhenoMCPServers/servers/` for forensic retention; sealed read-only on GitHub |
| `PhenoMCPServers/catalog/registry.yaml` SSOT | preserved at `repos/PhenoMCPServers/catalog/`; the catalog is the canonical source for the 5th spine role even after archive |

No live code moved between repos. No live dependency lifted into phenodocs. The GitHub archive is the only external-state change; the local mirror at `repos/PhenoMCPServers/` remains as a forensic anchor (the airlock standing rule "I've tarballed (NOT deleted) per standing rule" applies).
