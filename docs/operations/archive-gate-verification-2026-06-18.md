# Archive / delete gate verification — Phase 4 (2026-06-18)

Per `BOUNDARY_OWNERS.md` 5-check gate. **Never delete TestingKit or phenoShared.**

| ID | Repo | Verdict | Evidence |
|----|------|---------|----------|
| X-01 | ObservabilityKit | **TOMBSTONE** | Repo 404; SDK listing cleanup in disposition-index |
| X-02 | Metron | **TOMBSTONE** | Repo 404 (2026-06-19); absorbed `crates/metrickit` in PO #157; HexaKit#244/#251 eviction merged |
| X-03 | Traceon | **KEEP_ARCHIVED** | `isArchived: true`; redirect docs in PO |
| X-04 | ResilienceKit | **KEEP_ARCHIVED** | Active; python-sdk impl gate open |
| X-05 | TestingKit | **HOLD DELETE** | AFFIRM Block-C; absorption target — gate not triggered |
| X-06 | PhenoKits | **ARCHIVED** | `isArchived: true`; phenokits-commons canonical |
| X-07 | phenotype-runs | **MERGED** | #10 surface-reduction retirement README |
| X-08 | phenotype-dep-guard | **MERGED** | #54 PolicyStack absorption |
| X-09 | AuthKit | **ARCHIVED** | BOUNDARY_OWNERS 5/5; AuthKit#118 fold merged; Tracera/thegent verified-clean; `gh repo archive` 2026-06-18 |
| X-10 | phenoShared | **HOLD DELETE** | P4 decompose done; 15 fleet git deps remain post–HexaKit#277 wave 5 partial drain |

## Surface reduction batch 1+2 closeout (Phase 4 tasks 71–80, 2026-06-19)

Per `BOUNDARY_OWNERS.md` 5-check gate.

| ID | Repo | Verdict | 5-check | Evidence |
|----|------|---------|---------|----------|
| SR-71 | Planify | **ARCHIVED** | 5/5 | Upstream fork; no local delta; `isArchived: true` (verified 2026-06-19) |
| SR-72 | portage | **ARCHIVED** | 5/5 | Upstream fork; no local delta; `isArchived: true` (verified 2026-06-19) |
| SR-73 | phenotype-ops-mcp | **ARCHIVED** | 5/5 | Redirect `PhenoMCPServers/servers/external/`; `isArchived: true` (verified 2026-06-19) |
| SR-74 | agileplus-spec-harmonizer | **ABSORBED** | 5/5 | AgilePlus#756 merged; `crates/agileplus-spec-harmonizer` canonical |
| SR-75 | agileplus-spec-harmonizer (post-absorb) | **TOMBSTONE** | 5/5 | Source repo 404 (deleted); `gh repo archive` N/A |
| SR-77 | phenoStandards | **STUB ONLY** | 5/5 | Repo 404; `projects/phenoStandards.json` registry stub; HexaKit absorbed 2026-06-16 |

## Actions taken

- AuthKit archived 2026-06-18 (X-09 gate pass); Metron tombstoned 2026-06-19 (repo 404 post-absorption; `gh repo archive` N/A)
- Registry rows updated in disposition-index batch PR
- **KooshaPari/pheno archived 2026-06-19** — W18b fleet manifest scan: 0 external `KooshaPari/pheno` git deps in consumer Cargo.toml/go.mod (gh search + fleet pull verify); chokepoints all `repointed` or `verified-clean`; registry closeout PR

## pheno archive gate (W18b-G)

| Check | Result |
|-------|--------|
| Fleet chokepoints closed | phenotype-gfx, Civis, phenotype-teamcomm, phenotype-go-sdk → verified-clean; TestingKit#8 merged |
| Org manifest scan | No external `github.com/KooshaPari/pheno.git` deps outside pheno self + audit docs |
| PhenoCompose | verified-clean (in-repo path deps) |
| Archive action | `gh repo archive KooshaPari/pheno` 2026-06-19 |

## Phase 3 stale-tail closeout (2026-06-18)

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| ST-01 | BytePort #201 | **UNCLOSABLE** | Repo `KooshaPari/BytePort` archived read-only (2026-06-18); canonical → `phenotype-tooling` `crates/byteport`. PR [#201](https://github.com/KooshaPari/BytePort/pull/201) remains OPEN stale — **cannot close or merge**: GitHub GraphQL `closePullRequest` returns locked-issue / read-only archive error. **Action:** leave open; track as absorbed stale tail; do not block archive gates. See [local-clone-hygiene](../operations/local-clone-hygiene-2026-06-18.md). |
| ST-02 | phenotype-omlx #22 | **CLOSE BLOCKED** | Repo archived read-only; ADR-ECO-008 triage: scope exceeds docs/benchmark-only; CI blocked |
| ST-03 | gw-phenolang | **DONE** | phenoUtils#66 index canonical; [gw-phenolang-branch-index.md](../disposition/gw-phenolang-branch-index.md); full branch sweep 2026-06-19 (main-only) |
| ST-04 | AuthKit X-09 | **ARCHIVED** | 5-check pass; Tracera/thegent repointed; archived 2026-06-18 |
| ST-05 | McpKit | **ARCHIVED + LEDGER** | registry#157 + #171 merged; repo archived 2026-06-18; hard delete deferred per BOUNDARY_OWNERS |

## Pyron archive gate (P4 — 2026-06-19)

| Check | Result |
|-------|--------|
| 1. Canonical owners named | DOMAIN_ROLES repoint targets (Configra, PhenoObservability, Authvault, Eventra, Agentora, TestingKit) |
| 2. Inbound absorptions | pheno shelf lockstep waves 2–7 + contracts decompose slices 2–4 |
| 3. Outbound consumers | 0 external `KooshaPari/Pyron` git deps in production manifests (gh org search) |
| 4. Scaffold hooks | Role owners carry templates/SDK edges per BOUNDARY_OWNERS |
| 5. Unique slice | None — vendored contracts + pheno-mcp dropped; MIGRATED.md stubs retained |
| cargo check | green post Pyron PR merge |
| Archive action | `gh repo archive KooshaPari/Pyron` pending merge |

## phenoShared archive gate (P4 — 2026-06-19, post–wave 5)

Per `BOUNDARY_OWNERS.md` 5-check gate. **Never hard-delete phenoShared** without explicit policy; prefer archive after zero-dep.

| Check | Result |
|-------|--------|
| 1. Canonical owners named | DOMAIN_ROLES owners per ADR-ECO-014 (`phenotype-types`, `phenotype-config`, `PhenoObservability`, `Eventra`, `Authvault`, `Agentora`, `phenotype-resilience`, `phenotype-rust-sdk` target) |
| 2. Inbound absorptions | P4 decompose complete — `repo-phenoshared` `fsm: done`; contracts slices 2–4 on role owners |
| 3. Outbound consumers | **FAIL** — 15 production git deps on `KooshaPari/phenoShared` (11 HexaKit, 2 PO, 1 ResilienceKit, 1 python-sdk); 0 go.mod deps |
| 4. Scaffold hooks | Partial — terminal owners carry slice crates; generic `Contract` + utils interim on phenoShared |
| 5. Unique slice | **FAIL** — 11 HexaKit interim pins + fleet `phenotype-error-core`/`phenotype-contracts` pins |
| HexaKit wave 5 | **Partial** — [HexaKit#277](https://github.com/KooshaPari/HexaKit/pull/277) merged @ `7ff8051`; 7 pins drained, 11 remain (wave 5b) |
| Archive action | **Deferred** — `gate-phenoshared` stays `fsm: hold`; `gh repo archive` blocked until zero-dep |
