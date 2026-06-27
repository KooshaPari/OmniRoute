# v18 T2 L18 Data Classification Taxonomy + DLP Hooks

**Date:** 2026-06-21
**Branch:** `chore/v18-71-pillar-cycle-8-p0-2026-06-21`
**Pillar:** L18 (Data Classification & DLP)
**Status:** v18 Wave A track 2 of 3

## Classification taxonomy (4 tiers)

| Tier | Label | Examples | At-rest encryption | In-transit | Audit | Retention |
|------|-------|----------|-------------------|-----------|-------|-----------|
| **T0 Public** | PUBLIC | Documentation, OSS source, public APIs | AES-128 | TLS 1.3 | none | unlimited |
| **T1 Internal** | INTERNAL | Design docs, internal Slack, telemetry metadata | AES-256 | TLS 1.3 | metadata only | 365d |
| **T2 Confidential** | CONFIDENTIAL | Customer data, secrets, API keys, PII | AES-256-GCM | TLS 1.3 + mTLS | full content | 730d (FedRAMP) |
| **T3 Restricted** | RESTRICTED | CUI, financial data, medical PHI, source of authority secrets | AES-256-GCM + HSM | mTLS only | full content + WORM | 2555d (IL5) |

## DLP hook points

5 enforcement points where data is inspected at boundary crossings:

1. **Egress proxy** (`pheno-port-adapter/egress/`) — outbound HTTP/gRPC inspected for T2/T3 patterns (SSN, credit-card regex, secrets via TruffleHog)
2. **Storage write hook** (`pheno-otel/storage_dlp.rs`) — every storage write classified and optionally tokenized (Vault-style)
3. **Log redaction** (`pheno-tracing/redactor.rs`) — log lines with T2/T3 patterns redacted before emission (regex + entropy)
4. **Email/Slack egress** (`phenotype-ops/communication/`) — outbound messages scanned, quarantined if T2/T3 detected
5. **Backup snapshot** (`pheno-port-adapter/backup.rs`) — backups classified per file; T3 encrypted with separate key material

## Per-tier handling rules

```rust
// Cargo deps pinned for DLP
// regex = "1.10"
// entropy = "0.4"

// T2/T3 patterns (illustrative)
const SSN_REGEX: &str = r"\b\d{3}-\d{2}-\d{4}\b";
const CC_REGEX: &str = r"\b(?:\d[ -]*?){13,16}\b";
const SECRET_REGEX: &str = r"\b[A-Za-z0-9+/]{40,}={0,2}\b"; // base64 entropy

pub enum Tier { T0, T1, T2, T3 }

pub fn classify(s: &str) -> Tier {
    if SSN_REGEX.is_match(s) || CC_REGEX.is_match(s) { return Tier::T2; }
    if entropy::shannon(s.as_bytes()) > 4.5 && SECRET_REGEX.is_match(s) { return Tier::T3; }
    Tier::T0
}

pub fn require_mtls(tier: Tier) -> bool { matches!(tier, Tier::T2 | Tier::T3) }
pub fn require_audit(tier: Tier) -> bool { matches!(tier, Tier::T2 | Tier::T3) }
pub fn retention_days(tier: Tier) -> u32 {
    match tier { Tier::T0 => u32::MAX, Tier::T1 => 365, Tier::T2 => 730, Tier::T3 => 2555 }
}
```

## Acceptance criteria

- [x] Taxonomy defined (4 tiers)
- [x] 5 hook points identified with concrete code paths
- [x] Per-tier handling rules (TLS, audit, retention)
- [ ] DLP hooks wired into 5 substrate services (T4 cross-cutting work)
- [ ] TruffleHog integration tested end-to-end (T3 evidence automation)
- [ ] Backup encryption with separate KMS keys for T3 (T3 evidence automation)

## References

- NIST SP 800-60 Vol 2 Rev 1: <https://csrc.nist.gov/publications/detail/sp/800-60/vol-2-rev-1/final>
- FedRAMP Data Classification: <https://www.fedramp.gov/assets/resources/documents/FedRAMP_Data_Classification_Guidance.pdf>
- ADR-046 (federation mTLS + OIDC)
- T1 FedRAMP gap list: `findings/2026-06-21-v18-T1-L17-fedramp-soc2-readiness.md`
