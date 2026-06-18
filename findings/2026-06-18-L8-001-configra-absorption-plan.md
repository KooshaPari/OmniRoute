# Configra absorption — execution plan (L8-001 / T10)

**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Plan version:** v1.0
**Refs:**
- ADR-031 (canonical config name: Configra)
- ADR-035 (migration gates)
- ADR-022 (superseded for naming; Rust/TS split remains)
- `docs/adr/2026-06-17/ADR-031-configra-absorb.md`
- `docs/adr/2026-06-18/ADR-035-configra-migration-gates.md`

---

## 1. Source probe (T10.1 complete)

### Local state

| Repo | Path | LoC | Meta-bundle | CI | Tier |
|---|---|---|---|---|---|
| `pheno-config` | `pheno-config/` | 1,303 (645 src + 656 tests) | ✓ (AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT/APACHE) | ✗ | lib |
| `phenotype-config` | (remote-only) | unknown | unknown | unknown | lib |
| `phenotype-config-rs` | (remote-only) | unknown | unknown | unknown | lib |
| `Conft` | (remote-only, KEEP per ADR-031) | unknown | unknown | unknown | lib (TS) |
| `settly-config` | (remote-only) | unknown | unknown | unknown | lib (Python) |
| `settly-config-rs` | (remote-only) | unknown | unknown | unknown | lib |
| `settly-config-ts` | (remote-only) | unknown | unknown | unknown | lib (TS) |
| `phenotype-python-sdk/phenotype_config` | (sub-crate) | unknown | unknown | unknown | lib (Python) |

### Configra remote (probe 2026-06-18)

```
main @ 84b4db24a
11+ branches: bootstrap/codeowners, chore/expand-codeowners, chore/lane-greenup,
chore/pin-github-actions-20260430, ci/add-release-workflow, ci/pin-trufflehog,
codex/configra-release-drafter-config, cursor/release-workflow-security-reliability-595f, ...
```

**Configra has substantial hygiene/governance history (123 commits per ADR-031) but no Rust source code yet.** It is governance-only; this absorption adds the Rust code.

## 2. Migration gates (per ADR-035)

| Gate | Status | Action |
|---|---|---|
| **Gate 1: Configra hygiene ≥ 80% (24/30)** | UNKNOWN | Run 71-pillar audit on Configra first |
| **Gate 2: Zero secret leaks in last 30 days** | UNKNOWN | Run `pheno-secret-scan` on Configra last 30 commits |
| **Gate 3: SLSA build provenance configured** | UNKNOWN | Check `Configra/docs/slsa.md` |
| **Gate 4: Conft (TS edge) unblocked** | UNKNOWN | Review Conft for hidden Rust |

All 4 gates must PASS before any code is moved.

## 3. Migration sequence (T10.3-T10.12, 10 PRs, ~90 min)

| # | PR | Source | Target | Action |
|---|---|---|---|---|
| 10.3 | Configra#1 | `pheno-config/*` | `Configra/pheno-config/` | Copy + preserve history (squash) |
| 10.4 | Configra#2 | `phenotype-config/*` | `Configra/phenotype-config/` | Same |
| 10.5 | Configra#3 | `phenotype-config-rs/*` | `Configra/phenotype-config-rs/` | Same |
| 10.6 | Configra#4 | `settly-config/*` | `Configra/settly-config/` | Same |
| 10.7 | Configra#5 | `settly-config-rs/*` | `Configra/settly-config-rs/` | Same |
| 10.8 | Configra#6 | `phenotype-python-sdk/phenotype_config/*` | `Configra/phenotype-python-config/` | Same |
| 10.9 | phenotype-config#2 | n/a | `phenotype-config/README.md` | Deprecation notice → Configra |
| 10.10 | pheno-config#1 | n/a | `pheno-config/README.md` | Deprecation notice → Configra |
| 10.11 | settly-config#1 | n/a | `settly-config*/README.md` | Deprecation notice → Configra (squash) |
| 10.12 | monorepo (this branch) | n/a | `SSOT.md`, `AGENTS.md`, `STATUS.md` | Update config references |

## 4. Pre-flight checks (must run before T10.3)

```bash
# Gate 1: 71-pillar audit on Configra
cd /Users/kooshapari/CodeProjects/Phenotype/repos
git clone https://github.com/KooshaPari/Configra.git /tmp/Configra-audit 2>&1
cd /tmp/Configra-audit
# Run 71-pillar audit; target score ≥ 24/30

# Gate 2: secret scan
pheno-secret-scan --since='30 days ago' --strict 2>&1

# Gate 3: SLSA check
test -f docs/slsa.md && echo "PASS" || echo "FAIL"

# Gate 4: Conft review
gh pr list --repo KooshaPari/Conft --state all --limit 20
```

## 5. Open questions

1. Should `pheno-config` content be a sub-crate (`Configra/pheno-config/`) or a workspace member (`Configra/crates/pheno-config/`)?
   - **Recommendation:** sub-crate (preserves history, less disruptive)
2. Should `settly-config*` history be preserved (preserves 90 days of work) or squashed (cleaner)?
   - **Recommendation:** preserve (per ADR-031 Configra precedent — preserves 123 commits)
3. Should the absorption preserve the pheno-config v0.2.0 stable release tag?
   - **Recommendation:** yes — tag `pheno-config@0.2.0` → `Configra/pheno-config@0.2.0`
4. Does the user want a single combined PR or one PR per source repo (8 total)?
   - **Recommendation:** 8 PRs (one per source) — easier to review and revert

## 6. Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Configra gates fail | Medium | High | Run gates first (T10.0 pre-flight); defer migration if any fail |
| Conft review finds hidden Rust | Low | Medium | Review Conft PRs before Configra absorption |
| `pheno-config` v0.2.0 tag conflicts | Low | Low | Tag as `Configra/pheno-config@0.2.0` (separate namespace) |
| `pheno-config` consumers break | Medium | High | Provide deprecation notice + redirect for 28-day grace period |
| `settly-config*` history conflicts | Low | Medium | Use `git filter-branch` or `git subtree add` to import cleanly |

## 7. Success criteria

1. All 4 gates PASS
2. 8 source repos are deprecated (1 kept: Conft, TS edge)
3. `Configra` is the canonical Rust config crate
4. `phenotype-config` README → "DEPRECATED, see Configra"
5. `pheno-config` README → "DEPRECATED, see Configra"
6. `settly-config*` READMEs → "DEPRECATED, see Configra"
7. SSOT.md, AGENTS.md, STATUS.md updated
8. 28-day grace period starts after merge; repos archived 2026-07-15

## 8. Next action

T10.1.5 — Run Gate 1 (71-pillar audit on Configra) and Gate 2 (secret scan on Configra). Report results in `findings/2026-06-18-L8-001-configra-absorption-plan.md` (this file's companion).
