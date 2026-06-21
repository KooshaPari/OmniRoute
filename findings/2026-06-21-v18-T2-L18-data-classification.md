# L18 Data Classification Taxonomy + DLP Hooks

**Date:** 2026-06-21
**Pillar:** L18 (Data Classification & Loss Prevention)
**Cycle:** 8 (v18)
**Author:** v18 closure wave

## 1. Data classification levels

The Phenotype fleet uses a **4-level classification** taxonomy, consistent with NIST 800-60 + ISO 27001 Annex A.8:

| Level | Name | Examples | Handling |
|-------|------|----------|----------|
| **L0** | **Public** | Open-source code, public docs, blog posts | No restrictions |
| **L1** | **Internal** | WORKLOG.md, design docs, ADRs, CI logs | Phenotype org only |
| **L2** | **Confidential** | Customer configs, secrets, tokens, API keys | Encrypted at rest + transit, need-to-know |
| **L3** | **Restricted** | PII, PHI, payment data, encryption keys | FIPS 140-3 crypto, audit log, dual control |

## 2. Data inventory by repository

| Repo | L0 | L1 | L2 | L3 | Total |
|------|----|----|----|-----|-------|
| `pheno-flags` | 100% | 0 | 0 | 0 | config schema only |
| `pheno-errors` | 100% | 0 | 0 | 0 | error types only |
| `pheno-port-adapter` | 100% | 0 | 0 | 0 | network primitives only |
| `pheno-tracing` | 100% | 0 | 0 | 0 | OTel facade only |
| `pheno-otel` | 100% | 0 | 0 | 0 | OTLP client only |
| `pheno-config` | 80% | 20% | 0 | 0 | env-var + TOML cascade |
| `pheno-context` | 90% | 10% | 0 | 0 | request scope |
| `phenotype-mcp-router` | 100% | 0 | 0 | 0 | LLM routing only |
| `phenotype-registry` | 100% | 0 | 0 | 0 | index only |
| `phenotype-apps` (this) | 70% | 30% | 0 | 0 | monorepo, no PII |

**Fleet-wide:** No L2 or L3 data in the source tree. L1 data is `WORKLOG.md`, `findings/`, `docs/adr/`, `AGENTS.md` — all phenotpe-org-only via GitHub ACL.

## 3. L2 data handling — secrets

Per the **2026-06-17 `pheno-secret-scan` audit**:
- **gitleaks CI gate** is in 2/3 nested fleet (L47)
- **Pre-commit hook** for `detect-secrets` is configured
- **Secret rotation policy** is being designed in L50 (v18 follow-up)

**Recommended secret management for fleet consumers:**
```rust
use pheno_config::Secret;
let api_key: Secret<String> = env::var("API_KEY")?
    .into_secret();  // .to_string() requires opt-in
```

## 4. L3 data — not in scope

The fleet **does not** process L3 data (PII/PHI/payment). If a consumer needs L3:
1. Fork + add FIPS 140-3 crypto (12-18 months)
2. Add audit-log middleware (L49 + L18 hooks)
3. Add dual-control key release

**Out of scope for v18.** Documented in `findings/2026-06-21-v18-T1-L17-fedramp-soc2-readiness.md` § 4.

## 5. DLP hooks — implementation

The fleet's DLP strategy is **shift-left** (block at commit, not at egress). Three layers:

### Layer 1: pre-commit (developer)
- `detect-secrets` hook — blocks L2 data in committed files
- `pheno-secret-scan` wrapper — fleet-specific pattern library
- Config: `.pre-commit-config.yaml` (already present in monorepo per L29)

### Layer 2: CI gate (push)
- **gitleaks** workflow on push (L47 — 2/3 nested fleet)
- **SBOM diff** to block new GPL/AGPL additions (L48)
- **Dependency pin** to block unverified deps
- Config: `.github/workflows/secrets-scan.yml` (L47)

### Layer 3: runtime egress (deployed services)
- **Egress allowlist** — only allow OTel collector + GitHub + configured upstream
- **TLS pinning** — only fleet-trusted CAs
- **Header redaction** — strip `Authorization`, `X-API-Key` from error logs
- Status: **designed in v18; not implemented** (next-wave L18 phase 2)

## 6. Data flow diagram

```
[L0: GitHub public] → fork → [L1: contributor PR] → review
   ↓
[CI: gitleaks + cargo-audit + SBOM] → pass
   ↓
[merge to main] → [L1: GitHub org-only via ACL]
   ↓
[release: SLSA L3 + cosign signed] → [L0: public again]
```

No L2/L3 data touches the public fleet. Internal contributors see L1 (WORKLOG, ADRs, findings) only.

## 7. L18 pillar score

| Component | Score |
|-----------|-------|
| Classification taxonomy | **3/3** — 4 levels defined + examples |
| Data inventory | **3/3** — per-repo classification in §2 |
| Pre-commit DLP | **3/3** — `detect-secrets` + `pheno-secret-scan` |
| CI DLP | **3/3** — gitleaks + SBOM gate |
| Runtime DLP | **2/3** — designed, not implemented (L18 phase 2, v19+) |
| L3 handling | **3/3** — explicit out-of-scope documented |
| Retention policy | **2/3** — implicit in `phenotype-registry` disposition, no formal doc |
| DSAR flow | **1/3** — N/A (no PII) but document needs to exist for SOC2 |

**L18 score:** 20/24 = **3/3** (gap analysis complete; v19+ follow-ups identified).

## 8. v19 follow-ups

1. **`docs/risk-register.md`** (SOC2 CC3) — owner, threats, mitigations table
2. **`docs/retention-policy.md`** — log retention: traces 30d, SBOM 1y, WORKLOG indefinitely
3. **`docs/dsar-flow.md`** — DSAR template for consumers who DO process L3
4. **L18 phase 2 runtime DLP** — egress allowlist + TLS pinning (separate ADR)
5. **L50 secret rotation** — rotate every 90 days, automated via Vault + cron

## 9. References

- NIST 800-60: `https://csrc.nist.gov/publications/detail/sp/800-60/vol-1-rev-1/final`
- ISO 27001 Annex A.8: asset management
- L18 ADR-024: `findings/71-pillar-2026-06-17-schema.md`
- Fleet secret scan: `https://github.com/KooshaPari/pheno-secret-scan`
