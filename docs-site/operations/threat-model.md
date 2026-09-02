---
title: Threat Model
---

# Threat Model

## Adversaries

- **A1**: External attacker, no credentials, probes public endpoints.
- **A2**: Authenticated user, valid API key, attempts prompt injection.
- **A3**: Insider with read access to audit logs.

## Assets

- OpenAI-compatible request/response bodies (contain user data)
- API keys
- Provider manifest (contains baseURLs)
- Audit log

## Mitigations

| Asset | Threat | Mitigation |
|-------|--------|------------|
| API keys | A1 brute force | Rate limit + lockout after 10 fails |
| Request body | A2 injection | Output redaction, prompt template guard |
| Audit log | A3 tampering | Hash chain (see ADR-001 §Audit) |
| Manifest | supply chain | Manifest is type-checked at startup |
