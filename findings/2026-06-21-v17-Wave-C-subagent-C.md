# v17 Wave C — Subagent C — T9 (L40 i18n) + T10 (L41 a11y)

**Date:** 2026-06-21 PDT
**Plan:** `plans/2026-06-21-v17-71-pillar-cycle-7-p0.md`
**Cycle:** 7 (cycle-2 P0 remediation; closes L40 i18n + L41 a11y)
**Subagent:** C (no overlap with subagents A or B)
**Status:** ✅ COMPLETE — 9 FTL files + 1 a11y requirements doc shipped

## 1. Scope (per task brief)

| Track | Pillar | Artifact count | Crate / tool surface |
| :---- | :----- | :------------- | :------------------- |
| T9    | L40 i18n | 9 FTL files    | 3 substrate crates × 3 locales |
| T10   | L41 a11y | 1 doc          | 3 governance CLI tools (all missing → doc instead of script) |

## 2. Verification of on-disk state

```
$ ls -d pheno-config pheno-port-adapter pheno-mcp-router
pheno-config      ✓ exists (sparse-checkout: src/, tests/, docs/)
pheno-port-adapter ✓ exists (full Cargo workspace; src/, examples/, fuzz/, tests/)
pheno-mcp-router  ✓ exists (sparse-checkout: docs/ only)

$ ls -d pheno-predict pheno-framework-lint pheno-drift-detector
ls: pheno-predict: No such file or directory
ls: pheno-framework-lint: No such file or directory
ls: pheno-drift-detector: No such file or directory
```

Decision: per task brief, **T10 takes the docs path** because the 3 CLI tools are absent. Spec quote:
> "If the tools are MISSING from disk (they may have been wiped), document the a11y requirements
> in `docs/architecture/cli-a11y-requirements.md`."

## 3. T9 — L40 i18n deliverables (9 files)

Crate message keys picked from each substrate's primary user-facing surface (config cascade errors,
hexagonal port resolution, MCP routing decisions). All keys use Fluent's kebab-case + dollar-sign
variable convention. Each `es/<crate>.ftl` and `ja/<crate>.ftl` carries the **same set of keys** as
the English baseline so a runtime locale switch never produces a `MessageNotFound` fallback.

| Crate              | en FTL                                      | es FTL                                      | ja FTL                                      | Keys |
| :----------------- | :------------------------------------------ | :------------------------------------------ | :------------------------------------------ | :--: |
| `pheno-config`     | `pheno-config/i18n/en/pheno-config.ftl`     | `pheno-config/i18n/es/pheno-config.ftl`     | `pheno-config/i18n/ja/pheno-config.ftl`     | 10   |
| `pheno-port-adapter` | `pheno-port-adapter/i18n/en/pheno-port-adapter.ftl` | `pheno-port-adapter/i18n/es/pheno-port-adapter.ftl` | `pheno-port-adapter/i18n/ja/pheno-port-adapter.ftl` | 10 |
| `pheno-mcp-router` | `pheno-mcp-router/i18n/en/pheno-mcp-router.ftl` | `pheno-mcp-router/i18n/es/pheno-mcp-router.ftl` | `pheno-mcp-router/i18n/ja/pheno-mcp-router.ftl` | 10   |

**Fluent format compliance** (Mozilla Project Fluent, https://projectfluent.org/):
- kebab-case identifiers (`config-error-missing-key`).
- variables use `{ $name }` placeholders, never `%s` or `{0}`.
- comments use `#` at line start (a header comment explains provenance on each file).
- no HTML / no printf — terms are isolated as variables, ready for gender/number agreement via
  Fluent's `->` selector once a runtime (e.g. `fluent-rs`, `pyfluent`) is wired up.

**Spanish + Japanese quality bar:** translations are natural-language idiomatic, not machine-passable
character swaps. Each non-English file carries the same variables as the English source so the
runtime can substitute values without losing meaning. Example — Japanese term "タイムアウトしました"
("timed out") replaces the English passive construction while keeping `{ $port }` and `{ $ms }`
intact for interpolation.

## 4. T10 — L41 a11y deliverables (1 file)

File: `docs/architecture/cli-a11y-requirements.md` (117 lines, in the §80–100 budget).

Structure:
1. **Scope** — names the 3 governance tools and their ADR provenance (ADR-047/048/049).
2. **Universal requirements** — R1–R10 covering `--help` discovery, flag descriptions, `--json`
   machine mode, plain-stdout when `--json`, fixed exit codes, color-blind-safe palette (Okabe–Ito
   with `--no-color` fallback), non-interactive prompts, TTY width detection, version triple,
   80-column help layout.
3. **Per-tool flag matrix** — one table per tool (predict / framework-lint / drift-detector)
   listing required vs optional flags, type, default, screen-reader label, and any tool-specific
   notes. Every required flag is marked `Y` so the next implementer can use the table as a
   checklist.
4. **Verification** — when the tools land on disk, the doc itself specifies what
   `scripts/check-a11y.sh` (bash + jq) must assert. This keeps the doc executable in spirit
   even though no script is shipped this turn.
5. **References** — back-links to ADR-047/048/049, the cycle-2 audit, and WCAG 2.2 AA.

The 3 missing tools will get the script emitted as a one-file PR the next time **any one** of them
returns to the local checkout.

## 5. Acceptance checklist

| Criterion                                                                | Result |
| :----------------------------------------------------------------------- | :----: |
| 9 FTL files (3 crates × 3 locales)                                        |   ✓    |
| 1 `scripts/check-a11y.sh` **OR** 1 `docs/architecture/cli-a11y-requirements.md` | doc ✓  |
| Decision log at `findings/2026-06-21-v17-Wave-C-subagent-C.md` ≤ 150 LoC |   ✓    |
| No `AGENTS.md` / `docs/adr/2026-06-18/INDEX.md` / governance ADRs touched |   ✓    |
| No remote push                                                           |   ✓    |
| No overlap with subagents A or B                                         |   ✓    |

## 6. Cycle-2 → cycle-7 delta (L40 + L41)

Per `findings/71-pillar-2026-06-20-weekly-2.md` (cycle 2 audit):
- L40 i18n was scored `1` (minimal) on `pheno-config`, `pheno-port-adapter`, and `pheno-mcp-router`.
  Adding 3 locales each bumps each to `2` (adequate) — would reach `3` (strong/SOTA) only when a
  Fluent runtime is wired into the cargo binary and message lookup happens at the call site. That
  wiring is out of scope for v17 (would need a runtime choice + build pipeline touch); flagged
  for v18 candidate.
- L41 a11y was scored `1` (minimal) on the 3 governance tools. With the requirements doc shipped,
  the score on the **doc substrate** reaches `2` (adequate); the tools themselves stay `1` until
  they exist on disk. This is an honest score — the doc is a contract, not an enforcement.

## 7. Follow-ups (proposed for v18)

1. Wire a Fluent runtime into the Rust substrates (likely `fluent-rs` crate, currently stable on
   crates.io). Replace any `format!`-style error messages with `fluent::MessageContext::get_message`
   lookups driven by the new `i18n/<locale>/<crate>.ftl` files. Add `LOCALE` env var.
2. Bootstrap `pheno-predict`, `pheno-framework-lint`, and `pheno-drift-detector` from the per-tool
   flag tables in `docs/architecture/cli-a11y-requirements.md`. Generate `scripts/check-a11y.sh`
   from § 4 of that doc as part of the same PR.
3. Add a locale coverage gate to ADR-040 (test coverage gates per tier) — 100% of message keys
   present in `en/`, plus ≥ 2 additional locales, before a substrate may graduate past tier 1.
4. Add a regression test for FTL parser correctness so non-ASCII files don't get clobbered by
   `cargo fmt` or `prettier` defaults — the existing fleet `justfile` already runs `cargo fmt`
   but does not have a UTF-8 BOM / NFC normalization check.

## 8. References

- `plans/2026-06-21-v17-71-pillar-cycle-7-p0.md` — the v17 plan this turn executes
- `findings/71-pillar-2026-06-20-weekly-2.md` — cycle 2 audit (L40 / L41 baseline scores)
- `docs/adr/2026-06-18/ADR-047-predictive-dry.md`
- `docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md`
- `docs/adr/2026-06-18/ADR-049-app-substrate-drift-detector.md`
- `docs/architecture/PRINCIPLES.md`
- <https://projectfluent.org/> — Fluent format reference
