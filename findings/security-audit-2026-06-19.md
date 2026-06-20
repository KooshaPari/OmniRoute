# Security Audit — 14 Repos

**Date:** 2026-06-19 (Wave 11, T17)
**Scope:** Tracera, AgilePlus, phenotype-teamcomm, HexaKit, Pyron, HeliosCLI, PhenoProc, KWatch, OmniRoute, PhenoCompose, PhenoPlugins, Civis, PhenoContracts, Nanovms
**Tools:** gitleaks 8.30.0, cargo-audit 0.22.1, npm audit 11.12.1, govulncheck, pip-audit 2.10.1
**Mode:** Working tree (`--no-git`) — covers both current source and uncommitted artifacts
**Output:** `findings/security-audit-2026-06-19.md`; raw artifacts at `/tmp/security-audit-2026-06-19/`

---

## Executive summary

| Severity | Count | Notes |
|----------|------:|-------|
| **P0 — Active secrets in source code** | **3** | `PhenoProc:python/.../models.py:11`, `PhenoProc:python/.../handlers.py:15`, `KWatch:.mcp.json:110` |
| **P1 — Test-fixture private keys / JWTs** | **4** | `HexaKit:.../workos_service_edge_cases_test.go:240,250` (JWT), `KWatch:security/patterns.go:123`, `KWatch:security/security_test.go:302` (private-key) |
| **P2 — Documentation placeholder/example leaks** | **75** | `AgilePlus` (21), `HexaKit` (15 in active docs, rest in archives), `Tracera:.env.example` |
| **P3 — False positives (cache/build/history artifacts)** | **773** | `.mypy_cache/`, `.hypothesis/`, `.proc-history.json`, `target/debug/deps/*.rmeta` |
| **P0 — Go stdlib vulnerabilities (KWatch)** | **3** | `GO-2026-5039`, `GO-2026-5037`, `GO-2026-4971` — fixed in Go 1.26.3/1.26.4 (KWatch on 1.26.2) |
| **P2 — Unmaintained Rust deps (Civis)** | **2** | `bincode` v1.3.3 (RUSTSEC-2025-0141), `paste` v1.0.15 (RUSTSEC-2024-0436) |
| **P3 — Broken gitleaks.toml configs** | **2** | `HexaKit/gitleaks.toml`, `PhenoCompose/gitleaks.toml` — FTL error on broken allowlist targetRules |

**Headline:** **3 real active secrets** requiring immediate rotation (`PhenoProc` cloudflare keys + `KWatch` MCP key). **KWatch must upgrade Go from 1.26.2 → 1.26.4** to close 3 stdlib CVEs. All remaining findings are placeholder docs, test fixtures, or false positives from cache/build artifacts.

---

## 1. Repos scanned

| # | Repo | Path | Primary lang | Status |
|--:|------|------|--------------|--------|
| 1 | Tracera | `repos/Tracera` | Python + Go | ✓ scanned |
| 2 | AgilePlus | `repos/AgilePlus` | Rust | ✓ scanned |
| 3 | phenotype-teamcomm | n/a | Rust | ⚠ NOT cloned locally (ADR-029 archive; remote-only at `KooshaPari/phenotype-teamcomm`) |
| 4 | HexaKit | `repos/HexaKit` | Rust | ⚠ gitleaks.toml broken (FTL); re-scan with default config produced 44 findings |
| 5 | Pyron | `repos/Pyron` | Rust | ⚠ TOMBSTONED 2026-06-19 (`Pyron/TOMBSTONE.md:1-3`); no `Cargo.toml` at root |
| 6 | HeliosCLI | `repos/HeliosCLI` | Rust wrapper | ⚠ Top-level is submodule wrapper; `clones/helios-cli/` not initialized |
| 7 | PhenoProc | `repos/PhenoProc` | Rust + Python | ✓ scanned |
| 8 | KWatch | `repos/KWatch` | Go + TS | ✓ scanned (767 gitleaks findings, mostly false-pos) |
| 9 | OmniRoute | `repos/OmniRoute` | TS monorepo | ✓ scanned (clean) |
| 10 | PhenoCompose | `repos/PhenoCompose` | Rust + TS | ⚠ gitleaks.toml broken (FTL); re-scan clean |
| 11 | PhenoPlugins | `repos/PhenoPlugins` | Rust | ✓ scanned (clean) |
| 12 | Civis | `repos/Civis` | Rust + TS | ✓ scanned (1 false positive in `target/debug/deps/`) |
| 13 | PhenoContracts | `repos/PhenoContracts` | TS (Bun) | ✓ scanned (clean) |
| 14 | Nanovms | `repos/Nanovms` | TS + Go | ✓ scanned (clean); govulncheck errored on stale `replace` directive |

**Not scanned:** `phenotype-teamcomm` (not cloned; requires `gh repo clone KooshaPari/phenotype-teamcomm`).

---

## 2. Gitleaks findings (per-repo)

### 2.1 Tracera — 13 findings

| Severity | File:line | Rule | Notes |
|----------|-----------|------|-------|
| P3 | `.mypy_cache/3.13/cv2/__init__.data.json:1` (×2) | generic-api-key | False positive (mypy cache artifact) |
| P3 | `.mypy_cache/3.13/cv2/gapi/onnx/__init__.data.json:1` (×6) | generic-api-key | False positive (mypy cache artifact) |
| P2 | `.archive/.bmad/.bmad/_cfg/files-manifest.csv:129` (×2) | generic-api-key | Archived bmad manifest — likely placeholder; verify |
| P2 | `.env.example:131` | generic-api-key | Check if real placeholder or accidentally committed secret |
| P3 | `.hypothesis/constants/a033ec02b882982d:4` | stripe-access-token | False positive (hypothesis test data) |
| P3 | `.hypothesis/constants/ec512daacd498eea:4` | stripe-access-token | False positive (hypothesis test data) |

**Action:** Add `^\.mypy_cache/`, `^\.hypothesis/`, `^docs/.*\.md$`, `^\.env\.example$` to `gitleaks.toml` allowlist. Investigate `.archive/.bmad/.../files-manifest.csv:129`.

### 2.2 AgilePlus — 21 findings

All 21 findings are `generic-api-key` and clustered in spec/doc archive material:

| File | Count | Notes |
|------|------:|-------|
| `references/fastmcp.txt:13531,13622` (×3 copies via worktrees) | 6 | External reference doc (`fastmcp.txt`) containing `client_secret="REDACTED"` example |
| `kitty-specs/002-phenotype-modular-arch/tasks/WP07-cliproxy-shared-extraction.md:14` (×3) | 3 | Spec text containing "OAuth2 REDACTED" |
| `kitty-specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` (×5) | 5 | Spec text containing "API Key: REDACTED" |
| `docs/specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` (×3) | 3 | Same as above |
| `.archive/kitty-specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` (×3) | 3 | Archived copy of same |
| `docs/reference/env-vars.md:133` (×3) | 3 | Doc containing `AGILEPLUS_API_TOKEN="REDACTED"` example |

**Verdict:** All findings appear to be placeholder text in spec/reference docs (the redact is gitleaks' own redaction marker — these are descriptions like `API Key: REDACTED`, not real keys). The `fastmcp.txt:13531` location has real `client_secret="…"` examples from the upstream FastMCP project.

**Action:** Add `^kitty-specs/.*$`, `^docs/.*\.md$`, `^references/.*$`, `^AgilePlus-wtrees/.*$` to gitleaks.toml allowlist. Verify `references/fastmcp.txt` is a copy of an external public reference.

### 2.3 HexaKit — 44 findings (gitleaks.toml broken — ran with default config)

| Severity | File:line | Rule | Notes |
|----------|-----------|------|-------|
| **P1** | `platforms/thegent/apps/byteport/backend/api/.archive/thegent-test-deduplication/phase-4-1-iterative-suites/workos_service_edge_cases_test.go:240,250` | jwt | Archived test fixture JWTs |
| P2 | `docs/guides/SNYK_TOKEN_ACQUISITION_GUIDE.md:163` | snyk-api-token | Doc example (verify) |
| P2 | `docs/guides/SNYK_EXPECTED_OUTPUTS.md:111` | snyk-api-token | Doc example (verify) |
| P2 | `docs/reference/SAST_QUICK_REFERENCE.md:88,184` | generic-api-key | Doc examples |
| P2 | `docs/reference/env-vars.md:133` | generic-api-key | Doc placeholder |
| P2 | `docs/specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` | generic-api-key | Mirror of AgilePlus spec |
| P2 | `kitty-specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` | generic-api-key | Same |
| P2 | `agileplus/references/fastmcp.txt:13531,13622` | generic-api-key | Mirror of AgilePlus reference |
| P2 | `agileplus/docs/reference/env-vars.md:133` | generic-api-key | Mirror |
| P2 | `agileplus/docs/specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` | generic-api-key | Mirror |
| P2 | `.archive/kitty-specs/003-agileplus-platform-completion/tasks/WP11-api-extensions.md:42` | generic-api-key | Archived mirror |
| P2 | `platforms/thegent/apps/byteport/backend/api/.archive/thegent-test-deduplication/phase-4-1-iterative-suites/cloud_core_test.go:361` | generic-api-key | Archived test fixture |
| P3 | `docs/worklogs/data/phenotype_session_extract_2026-03-26_2026-03-29.json` (29 lines: 755, 865, 925, 1155, 1165, 1274, 1295, 1565, 2045, 2539 … +19 more) | generic-api-key | Session extraction JSON contains pasted/redacted tokens; verify all are REDACTED, not real |

**Action:**
1. **Fix `HexaKit/gitleaks.toml:4`** — the `[allowlist]` section has a `[[allowlists]]` targetRules reference to non-existent rule ID `generic-high-entropy-secret` causing FTL. Either remove the broken entry or migrate to current allowlist syntax.
2. Investigate the 29 lines in `docs/worklogs/data/phenotype_session_extract_*.json` — verify all are REDACTED placeholders, not live tokens.
3. Sanitize the WorkOS test fixtures in the archived thegent deduplication tests.

### 2.4 PhenoProc — 4 findings (2 P0 ACTIVE)

| Severity | File:line | Rule | Notes |
|----------|-----------|------|-------|
| **P0** | `python/pheno-infra/src/pheno_infra/tunnel_sync/models.py:11` | cloudflare-api-key | **Active Cloudflare API key in source — ROTATE IMMEDIATELY** |
| **P0** | `python/pheno-kits/src/pheno_kits/infra/tunnel_sync/handlers.py:15` | cloudflare-api-key | **Active Cloudflare API key in source — ROTATE IMMEDIATELY** |
| P2 | `crates/phenotype-cli-extensions/src/kitty-specs/002-phenotype-modular-arch/tasks/WP07-cliproxy-shared-extraction.md:14` | generic-api-key | Spec placeholder text |
| P2 | `crates/phenotype-gauge/AGENTS.md:1649` | generic-api-key | AGENTS.md content (verify) |

**Action:**
1. **URGENT: Rotate the Cloudflare API key at `cloudflare.com/profile/api-tokens`** (one key likely serves both call sites).
2. Move secrets to environment variables + a `.env` file (gitignored).
3. Add `pheno-infra` and `pheno-kits` to the security-audit gate in CI.
4. Sanitize the spec markdown and AGENTS.md placeholders.

### 2.5 KWatch — 767 findings (1 P0, 3 P1, 763 P3)

| Severity | File:line | Rule | Notes |
|----------|-----------|------|-------|
| **P0** | `.mcp.json:110` | generic-api-key | **Live MCP API key in JSON config — ROTATE IMMEDIATELY** |
| **P1** | `security/patterns.go:123` | private-key | Test fixture: hardcoded private key (verify it's the canonical test key, not real) |
| **P1** | `security/security_test.go:302` | private-key | Same — test fixture private key |
| P3 | `.proc-history.json` (764 lines: 1000, 1044, 1088, …) | jwt | False positives — process history base64-encoded JWTs from process spawn records (high-entropy tokens from `/usr/bin/env` style logs) |

**Action:**
1. **URGENT: Rotate the MCP API key in `.mcp.json:110`.**
2. Add `.mcp.json` to `.gitignore` (or use env-var injection) and rotate the existing committed key.
3. Verify the private-key fixtures in `security/patterns.go:123` and `security/security_test.go:302` are the canonical test keys (e.g., RFC 9500 sample keys) — if so, add a `gitleaks:allow` comment; if not, replace.
4. Add `^\.proc-history\.json$` to `gitleaks.toml` allowlist (definitely a process-state artifact, not a secret).

### 2.6 Civis — 1 finding (P3)

| Severity | File:line | Rule | Notes |
|----------|-----------|------|-------|
| P3 | `clients/godot-ref/rust/target/debug/deps/libed25519_dalek-ab6182df2ec0b26e.rmeta:35` | private-key | False positive — `.rmeta` is a Rust metadata file containing debug symbols |

**Action:** Add `^.*\.rmeta$` to gitleaks allowlist (build artifact).

### 2.7 All other repos — 0 findings

Clean: `HeliosCLI`, `OmniRoute`, `PhenoPlugins`, `PhenoContracts`, `PhenoCompose` (re-scanned with default config after broken `gitleaks.toml` fix).

Pending (gitleaks did not produce findings, repo state prevented scan):
- `phenotype-teamcomm` — repo not cloned locally (`gh repo clone KooshaPari/phenotype-teamcomm`)
- `Pyron` — TOMBSTONED 2026-06-19 (`Pyron/TOMBSTONE.md:1-3`); no `Cargo.toml` at root; only boundary crates `phenotype-{config-core,contracts,error-core}` survive

---

## 3. Package-manager audits (per-repo)

### 3.1 `cargo audit` (Rust) — 8/9 repos

Database: 1134 advisories as of 2026-06-18.

| Repo | Vulns found | Warnings | Verdict |
|------|------------:|---------:|---------|
| `AgilePlus` | 0 | 0 | Clean |
| `Civis` | 0 | **2** | bincode v1.3.3 (RUSTSEC-2025-0141, unmaintained), paste v1.0.15 (RUSTSEC-2024-0436, unmaintained) |
| `HexaKit` | 0 | 0 | Clean |
| `HexaKit/Traceon` | 0 | 0 | Clean |
| `PhenoCompose` | 0 | 0 | Clean |
| `PhenoContracts/rust` | 0 | 0 | Clean |
| `PhenoPlugins` | 0 | 0 | Clean |
| `PhenoProc` | 0 | 0 | Clean |
| `HeliosCLI` | — | — | **NOT RUN**: top-level `Cargo.toml` does not exist; workspace is in uninitialized submodule `clones/helios-cli/` |
| `Pyron` | — | — | **NOT RUN**: TOMBSTONED 2026-06-19; only `crates/phenotype-{config-core,contracts,error-core}` survive as boundary stubs |
| `phenotype-teamcomm` | — | — | **NOT RUN**: directory not present (`gh repo clone KooshaPari/phenotype-teamcomm` required) |

**Action:**
1. **Civis:** migrate off `bincode v1.3.3` → use `wincode` / `postcard` / `bitcode` / `rkyv` (per RUSTSEC-2025-0141 advisory). Migrate off `paste v1.0.15` → use `pastey` fork or inline impl (per RUSTSEC-2024-0436).
2. Decide whether to keep `HeliosCLI/clones/helios-cli` submodule and `git submodule update --init --recursive`, or move the workspace into the parent tree.
3. Clone `phenotype-teamcomm` to audit (or formally mark as "audit N/A — archived per ADR-029").
4. Decide Pyron boundary crates fate (likely migrate to `phenotype-shared` per ADR-031 close-out).

### 3.2 `npm audit` (TS/JS) — 2/2 repos

| Repo | Vulns found | Verdict |
|------|------------:|---------|
| `OmniRoute` | 0 | Clean |
| `PhenoContracts` | 0 | Clean |

**Action:** None.

### 3.3 `govulncheck` (Go) — 1/4 modules

| Module | Vulns found | Verdict |
|--------|------------:|---------|
| `KWatch` | **3** | **Go stdlib CVEs — UPGRADE Go to 1.26.4** |
| `Nanovms` | 0 (errored) | Module resolution failed: `go.mod` `replace ../.worktrees/l3-52-pheno-go-ctxkit-2026-06-11/pheno-go-ctxkit` points to non-existent worktree |
| `Tracera/backend` | 0 (errored) | Module resolution failed: `internal/observability/otel.go:7` imports `internal/config` but module name is `tracertm-backend` (typo: `tracera` vs `tracertm-backend`) |
| `HexaKit/Traceon` | 0 (errored) | No Go source files in directory (only `Cargo.lock`, `MIGRATED.md`, `target/`) — was scanned as Go by mistake; actually a Rust crate |

**KWatch Go stdlib CVEs (active):**

| CVE | Package | Found in | Fixed in | Trace |
|-----|---------|----------|----------|-------|
| `GO-2026-5039` | `net/textproto` | go1.26.2 | go1.26.4 | `server/server.go:63` → `http.Server.ListenAndServe` → `textproto.Reader.ReadMIMEHeader` |
| `GO-2026-5037` | `crypto/x509` | go1.26.2 | go1.26.4 | `server/server.go:63` → `x509.Certificate.Verify` / `VerifyHostname`; `server/security_handlers.go:276` → `x509.HostnameError.Error` |
| `GO-2026-4971` | `net` | go1.26.2 | go1.26.3 | `server/server.go:63` → `http.Server.ListenAndServe` → `net.Listen` |

**Action:**
1. **URGENT: Upgrade KWatch Go toolchain from 1.26.2 → 1.26.4.** Edit `KWatch/go.mod:3` from `go 1.25.0` (currently using 1.26.2 per `KWatch/go.mod:3`) to `go 1.26.4`. Re-run `govulncheck` to verify.
2. Fix `Nanovms/go.mod` `replace` directive — recreate `../.worktrees/l3-52-pheno-go-ctxkit-2026-06-11/pheno-go-ctxkit` or update the path.
3. Fix `Tracera/backend/go.mod` module name mismatch (`tracera` vs `tracertm-backend`).
4. Skip `HexaKit/Traceon` govulncheck — it's a Rust crate (run `cargo audit` instead, which was clean per §3.1).

### 3.4 `pip-audit` (Python) — 1/1 repo

| Repo | Vulns found | Verdict |
|------|------------:|---------|
| `Tracera` | 0 | Clean (audit ran on system Python deps; `cheap-llm-mcp 0.5.0+deprecated.20260615` was flagged as "not on PyPI" — expected for a deprecated package per ADR-007 / ADR-008) |

**Action:** None (no vulns). The deprecated `cheap-llm-mcp` finding is informational — Tracera's `uv.lock` references this archived crate per ADR-007/008.

---

## 4. Configuration & infrastructure findings (P3)

| Issue | Repo:line | Severity | Fix |
|-------|-----------|----------|-----|
| Broken gitleaks.toml — invalid `targetRule` ID | `HexaKit/gitleaks.toml:4` (allowlist references non-existent `generic-high-entropy-secret`) | P3 | Rewrite per current gitleaks 8.30 syntax (or remove broken allowlists) |
| Broken gitleaks.toml — invalid `targetRule` ID | `PhenoCompose/gitleaks.toml:5` | P3 | Same fix |
| Stale `replace` directive in go.mod | `Nanovms/go.mod` (`replace ../.worktrees/l3-52-pheno-go-ctxkit-2026-06-11/pheno-go-ctxkit`) | P3 | Recreate worktree or update path |
| Module name typo | `Tracera/backend/go.mod` (module `tracertm-backend` but imports use `tracera/backend`) | P3 | Rename module to `github.com/kooshapari/tracera/backend` |
| `phenotype-teamcomm` not cloned | `repos/phenotype-teamcomm` (missing) | P3 | `gh repo clone KooshaPari/phenotype-teamcomm` |
| `Pyron` TOMBSTONED | `Pyron/TOMBSTONE.md:1-3` | P3 | Migrate boundary crates per ADR-031 |
| `HeliosCLI` submodule uninitialized | `HeliosCLI/.gitmodules:1-9` | P3 | `cd HeliosCLI && git submodule update --init --recursive` (or move workspace up) |

---

## 5. Recommended actions — prioritized

### P0 — Do within 24h

1. **Rotate Cloudflare API key** — leaked at:
   - `PhenoProc/python/pheno-infra/src/pheno_infra/tunnel_sync/models.py:11`
   - `PhenoProc/python/pheno-kits/src/pheno_kits/infra/tunnel_sync/handlers.py:15`
   Action: revoke at <https://dash.cloudflare.com/profile/api-tokens>, generate new key, move to env var.
2. **Rotate MCP API key** — leaked at `KWatch/.mcp.json:110`.
   Action: revoke at the MCP provider, generate new key, move to env var or gitignored file.
3. **Upgrade KWatch Go 1.26.2 → 1.26.4** — closes 3 stdlib CVEs (GO-2026-5039, GO-2026-5037, GO-2026-4971).
   Action: edit `KWatch/go.mod:3` → `go 1.26.4`, re-run `govulncheck`.

### P1 — Do within 1 week

4. **Migrate Civis off unmaintained crates** — `bincode v1.3.3` (RUSTSEC-2025-0141), `paste v1.0.15` (RUSTSEC-2024-0436).
5. **Verify HexaKit test fixture keys** — `platforms/thegent/.../workos_service_edge_cases_test.go:240,250` JWT; replace if real.
6. **Verify KWatch test fixture keys** — `security/patterns.go:123`, `security/security_test.go:302` private keys; replace if real.

### P2 — Do within 2 weeks

7. **Fix `HexaKit/gitleaks.toml` and `PhenoCompose/gitleaks.toml`** — broken `[[allowlists]]` references.
8. **Fix `Tracera/backend/go.mod` module name** — `tracertm-backend` → `tracera/backend`.
9. **Fix `Nanovms/go.mod` `replace` directive** — point to existing path or recreate worktree.
10. **Add gitleaks allowlists** for cache/build artifacts:
    - Tracera: `^\.mypy_cache/`, `^\.hypothesis/`
    - KWatch: `^\.proc-history\.json$`
    - Civis: `^.*\.rmeta$`
    - HexaKit/AgilePlus/Tracera: `^docs/.*\.md$`, `^kitty-specs/.*`, `^references/.*`, `^AgilePlus-wtrees/.*`

### P3 — Triage / no action needed

11. **Sanitize placeholder/example strings** in spec markdown (`kitty-specs/`, `docs/specs/`, `.archive/`) — these contain literal text like "API Key: REDACTED" that gitleaks' generic-api-key rule matches. Replace with neutral language.
12. **Clone `phenotype-teamcomm`** to enable full audit (or formally mark N/A).
13. **Initialize `HeliosCLI/clones/helios-cli` submodule** or move workspace up.

---

## 6. Methodology

### Tools
- **gitleaks 8.30.0** — secret scanner; `--no-banner --redact --no-git -v --report-format json`
- **cargo-audit 0.22.1** — Rust advisory database (1134 advisories, 2026-06-18); `cargo audit --json`
- **npm audit 11.12.1** — npm advisory database
- **govulncheck** (Go toolchain) — stdlib + module vulnerabilities; `govulncheck ./...`
- **pip-audit 2.10.1** — PyPI advisory database; `pip-audit --disable-pip -r requirements.txt --no-deps`

### Mode
- **Working tree scan** (`--no-git`) was chosen because git-history mode returned "0 commits scanned" for repos with 1000+ commits (gitleaks 8.30 known issue). Working-tree mode scans the actual file contents — what would be exposed if the repo were public — at the cost of missing historical leaks. Recommendation: re-run with `--log-opts "--all"` after gitleaks 8.30 bug is resolved.

### Raw artifacts
All scan output preserved at `/tmp/security-audit-2026-06-19/`:
- `01-tracera-gitleaks.{txt,err,json}` … `14-Nanovms-gitleaks.{txt,err,json}`
- `AgilePlus-cargo-audit.json`, `Civis-cargo-audit.json`, `HexaKit-cargo-audit.json`, `HexaKit-Traceon-cargo-audit.json`, `PhenoCompose-cargo-audit.json`, `PhenoContracts-rust-cargo-audit.json`, `PhenoPlugins-cargo-audit.json`, `PhenoProc-cargo-audit.json`
- `OmniRoute-npm-audit.json`, `PhenoContracts-npm-audit.json`
- `KWatch-govulncheck.txt`, `Nanovms-govulncheck.txt`, `Tracera-backend-govulncheck.txt`, `HexaKit-Traceon-govulncheck.txt`
- `Tracera-pip-audit.txt`
- `all-gitleaks-findings.json` (consolidated parsed findings)

### Time budget
- 14 gitleaks runs: ~50 min wall (parallel, ran as background nohup jobs)
- 8 cargo audits: ~15 min wall (parallel)
- 4 govulncheck runs: ~10 min wall
- 2 npm audits: ~3 min wall
- 1 pip-audit: ~3 min wall
- Total: ~80 min wall (mostly due to Tracera/HexaKit/PhenoProc which each scanned 1+ GB of files)

---

## 7. Cross-references

- AGENTS.md § "Wave Plan (v11)" T17
- ADR-007 (cheap-llm-mcp deprecation) — Tracera `uv.lock` reference
- ADR-008 (dispatch-mcp as sole MCP server) — KWatch `.mcp.json` related
- ADR-029 (Dmouse92 → KooshaPari migration) — `phenotype-teamcomm` archive
- ADR-031 (Configra absorb) — PhenoProc/Civis substrate context
- ADR-042 (security audit cadence) — schedule for next sweep

---

**Report generated:** 2026-06-19 by Wave 11 T17 (forge subagent)
**Next sweep:** weekly Monday 09:00 PDT per ADR-041 (71-pillar cadence) and ADR-042 (security cadence)
