# ADR-093: SIEM Integration Specification

**Date:** 2026-06-22
**Status:** Accepted
**Authors:** release-engineering circle
**Pillar:** L46 (security observability)
**Cycle:** v25 (71-pillar cycle 15)

## Context

The Phenotype fleet emits OTel logs, metrics, and traces via `pheno-otel`
and `pheno-events` (per ADR-012 and ADR-016). The SOC2 auditor (per L51
evidence automation) requires a documented path from these emissions to a
SIEM system for long-term retention, alerting, and forensic analysis.

This ADR specifies the canonical SIEM integration shape: what data is
emitted, how it reaches the SIEM, what field mapping is expected, and
what detection rules are baseline-on.

## Decision

The canonical SIEM integration is **two-stream**:

1. **Security events** (auth, access, threat signals) — push via OTel
   logs to a Splunk or Elastic index with a 1-year retention floor.
2. **Application events** (workflow runs, dependabot alerts, scorecard
   reports) — push via OTel logs to a cheaper index with a 90-day
   retention floor.

Both streams flow through the same OTel collector; the routing decision
is made by the `pheno-otel` exporter config (per ADR-012).

## Stream 1: Security events

| Field | Type | Source | Example |
|-------|------|--------|---------|
| `event.type` | string | manual or `pheno-errors` diagnostic | `auth.failed` |
| `event.outcome` | string | `success` / `failure` / `unknown` | `failure` |
| `actor.id` | string | GitHub user ID | `12345` |
| `actor.email` | string | GitHub email (when public) | `user@example.com` |
| `source.ip` | string | request source | `203.0.113.42` |
| `source.repo` | string | GitHub repo | `KooshaPari/phenotype-apps` |
| `http.request.method` | string | HTTP method | `POST` |
| `url.path` | string | URL path | `/repos/.../security-advisories` |
| `user_agent.original` | string | request UA | `gh-cli/2.x` |
| `severity` | enum | manual | `high` / `medium` / `low` / `info` |
| `rule.name` | string | matching detection rule | `brute-force-attempt` |
| `rule.id` | string | rule id | `RULE-001` |
| `event.start` | timestamp | event start | `2026-06-22T10:00:00Z` |
| `event.end` | timestamp | event end | `2026-06-22T10:05:00Z` |

## Stream 2: Application events

Same OTel envelope, but the `event.dataset` field is `app.<repo>.<workflow>`
(e.g. `app.phenotype-apps.ci`). Retention is 90 days.

## Detection rules (baseline)

The following detection rules are pre-deployed in the SIEM. They are
the minimum SOC2 baseline; each tenant can extend.

| ID | Name | Stream | Query | Severity |
|----|------|--------|-------|----------|
| RULE-001 | brute-force-attempt | 1 | `event.type=auth.failed AND count > 5 in 5m by actor.id` | high |
| RULE-002 | secret-leak-push | 1 | `event.type=vcs.push AND rule.name=secret-detected` | critical |
| RULE-003 | dep-cve-disclosed | 1 | `event.type=dependabot.alert AND severity >= high` | high |
| RULE-004 | workflow-failure-spike | 2 | `event.type=workflow.run AND event.outcome=failure AND count > 3 in 1h by source.repo` | medium |
| RULE-005 | unsigned-commit-push | 1 | `event.type=vcs.push AND commit.signature=null` | medium |
| RULE-006 | branch-protection-bypass | 1 | `event.type=vcs.push AND bypass_actor != null` | critical |
| RULE-007 | force-push-to-default | 1 | `event.type=vcs.push AND force=true AND branch=main` | high |
| RULE-008 | workflow-token-leak | 1 | `event.type=workflow.log AND log contains "ghp_" or "glpat-"` | critical |

## Reference implementations

See `docs/siem/splunk-reference.md` and `docs/siem/elastic-reference.md` for
the per-vendor reference architecture (collector config, index naming,
sample search queries).

## Consequences

- **Positive:** SOC2 auditor has a clear ingestion + detection path; all
  fleet events are queryable from a single pane of glass.
- **Positive:** L46 (security observability) is now at 3.0 (was 2.5 in
  the v24 audit); v25 plan target hit.
- **Negative:** SIEM vendor lock-in — the field mapping is OTel-standard
  but the detection-rule DSLs are Splunk SPL / Elastic KQL. Future
  migration to a different SIEM requires rewriting the rules.
- **Negative:** Operational cost of maintaining the SIEM ingest path
  (~1-2 person-days per quarter for rule tuning).

## Alternatives considered

- **Cloud-native logs only (CloudTrail, GitHub Audit Log).** Rejected
  because it omits application-level events (workflow runs, dependabot
  alert details); CC7 (system operations) coverage would be incomplete.
- **Custom Kafka + ELK.** Rejected because the operational cost of
  running a custom log pipeline exceeds the SOC2 value delivered.
- **Splunk only or Elastic only.** Rejected in favor of two-stream
  spec that lets each tenant pick the cheaper vendor for stream 2.

## Cross-references

- ADR-012 — `pheno-tracing` OTLP adoption
- ADR-016 — fork-only-not-rewrite policy (SIEM vendors stay vendored)
- ADR-024 — 71-pillar audit framework
- ADR-041 — refresh cadence (weekly Monday 09:00 PDT)
- ADR-046 — federation mTLS + OIDC
- v25 plan — `plans/2026-06-22-v25-71-pillar-cycle-15-p1.md`
