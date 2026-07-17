---
title: Public Documentation Boundary
status: accepted-defaults
---

# Proposed public documentation boundary

This document defines the input and deployment gates for the fork-owned documentation build. It changes no deployment or navigation by itself.

## Identity and hosting defaults

- Canonical repository: `KooshaPari/OmniRoute`
- Product display name: `ArgisMonitor`, derived from the root package on current `main`
- Initial hosting target: GitHub Pages at `https://kooshapari.github.io/OmniRoute/`
- Deployment state: disabled; repository settings currently report no Pages site
- Governance and upstream attribution: secondary contribution/support and fork-lineage surfaces, outside the primary value proposition
- Wiki: deferred as a publication surface while repository settings report Wiki disabled

These are reversible defaults, not evidence of a live site. A custom domain, DNS, secrets, or another hosting provider requires a later approved decision.

## Public information architecture

1. **Evaluate**
   - product overview
   - verified capabilities
   - comparisons with dated sources
   - security/trust overview
2. **Quickstart**
   - prerequisites
   - local install
   - container install
   - first verified request
   - uninstall
3. **Journeys**
   - connect a provider
   - configure a client/IDE
   - create and test fallback
   - inspect usage and cost
   - diagnose failure
   - secure remote access
   - upgrade and rollback
4. **Concepts**
   - architecture and request lifecycle
   - providers, accounts, models
   - routing and resilience
   - authentication/authorization
   - protocols and extensions
5. **Reference**
   - generated OpenAPI
   - generated provider catalog
   - generated CLI/environment/feature flags
   - configuration schema
6. **Operations**
   - deployment
   - monitoring and SLOs
   - backup/recovery
   - security hardening
   - release and upgrade operations
7. **Contribute**
   - repository map
   - development setup
   - testing and quality gates
   - architecture decisions
   - contribution/security/support policies

## Included source classes

Public build inputs may include reviewed content from:

- `docs/getting-started/`
- `docs/guides/`
- `docs/architecture/`
- `docs/reference/`
- `docs/routing/`
- `docs/providers/`
- reviewed user-facing pages in `docs/frameworks/`
- reviewed operational pages in `docs/operations/` and `docs/ops/`
- reviewed security guidance in `docs/security/`
- `docs/openapi.yaml`
- approved root policies such as `CONTRIBUTING.md`, `SECURITY.md`, and `SUPPORT.md`

Inclusion requires an owner, audience, last-reviewed date, and passing link/content checks.

## Excluded from public navigation by default

Keep available in repository history or an explicitly internal/archive build, but do not feed primary public navigation:

- `docs/audits/`
- `docs/reports/`
- `docs/research/`
- session/worklog material
- raw findings
- active cutover plans
- OKRs, technical-debt ledgers, and transient status reports
- superseded ADRs without an archival banner
- security material that exposes operational secrets or abuse-enabling detail

Exclusion is not deletion.

## Required front matter

Every public page should declare:

```yaml
title: <human title>
audience: evaluate|user|operator|developer
owner: <team or role>
status: draft|reviewed|deprecated
lastReviewed: YYYY-MM-DD
sourceOfTruth: <code path, schema, or decision record when applicable>
journey: <manifest slug when applicable>
```

## Publication gates

- GitHub Pages is explicitly enabled for `KooshaPari/OmniRoute`
- the configured base path is `/OmniRoute/` and the default URL is verified after deployment
- no broken internal or external links
- no unresolved rich-media placeholders
- capability claims conform to `docs/reference/CAPABILITY_FACTS.md`
- examples execute against supported release artifacts
- generated references are current at the source commit
- secrets and private/internal URLs are absent
- accessibility checks cover headings, alt text, contrast, keyboard navigation, and reduced motion
- deprecated/superseded content has redirects or banners
- preview build succeeds before merge
- deployment commit and rollback instructions are recorded
- no custom domain, DNS, or secret is introduced by the docs change

## Journey evidence boundary

Journey media is published only when backed by a deterministic manifest containing persona, preconditions, fixtures, steps, assertions, viewport, redaction rules, and source commit. Generic feature screenshots may illustrate a page but must not be labeled journey evidence.

## Remaining owner decisions

- whether to replace the repository-coupled Pages URL with a verified owned custom domain
- whether GitHub Wiki should ever be enabled; until then, sync remains deferred
- preview provider beyond deterministic CI artifacts
- public metrics/privacy policy
- versioning and support window
- content ownership roles and review cadence
- which security/stealth material is appropriate for public navigation
