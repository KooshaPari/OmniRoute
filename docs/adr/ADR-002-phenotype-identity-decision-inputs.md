# ADR-002: Fork identity and publication defaults

- Status: Accepted — conservative, reversible defaults
- Decision owner: repository owner
- Scope: naming, URLs, governance disclosure, and upstream attribution
- Out of scope: inventing or acquiring a brand/domain, DNS, deployment, package renaming, or changing upstream history

## Context

The fork currently mixes fork, Phenotype, and upstream OmniRoute signals. Public claims and links cannot be normalized safely until the owner selects an identity model and approves owned URLs.

## Decision 1 — canonical product and organization naming

### Option A: OmniRoute by Phenotype

**Consequences:** preserves product recognition and package continuity; requires a clear “by Phenotype” lockup and a written rule distinguishing product from organization.

### Option B: Phenotype OmniRoute

**Consequences:** makes organization ownership prominent; likely requires coordinated package, UI, documentation, and release-copy updates while retaining upstream attribution.

### Option C: new product name under Phenotype

**Consequences:** strongest differentiation but highest migration cost; requires trademark/package/domain checks, redirects, compatibility aliases, and a deprecation period.

### Owner must record

- Canonical product display name:
- Canonical organization display name:
- CLI/package names retained or migrated:
- Compatibility/deprecation period:
- Legal/trademark review required:

## Decision 2 — canonical URLs

### Option A: subpath on an existing approved Phenotype domain

Lower operational surface; URL structure and deployment base path become coupled.

### Option B: dedicated documentation subdomain

Clear docs identity and flexible hosting; requires approved domain, DNS, certificates, and ownership/renewal controls.

### Option C: GitHub Pages as the initial canonical surface

Fast and repository-coupled; weaker product identity and subject to Pages constraints. A later custom-domain move needs redirects.

### Owner must record

- Product homepage:
- Documentation:
- API/reference:
- Status:
- Support/issues:
- Security reporting:
- Redirect policy:
- Domain owner and renewal contact:

No URL is canonical until ownership and operational responsibility are verified.

## Decision 3 — governance disclosure placement

### Option A: concise README notice plus full governance document

Transparent without dominating product onboarding. Requires a maintained governance page and link.

### Option B: full disclosure near the top of README

Maximum visibility but materially affects product positioning and first-use comprehension.

### Option C: governance document linked from contributing/support surfaces

Least intrusive, but may under-disclose repository operating assumptions.

### Owner must record

- Selected placement:
- Required wording constraints:
- Review cadence and owner:
- Which claims require human verification:

## Decision 4 — upstream attribution

### Option A: visible README “Fork lineage” section plus docs notice

Balances discoverability and product focus; should link to upstream repository and explain divergence.

### Option B: concise README footer plus detailed `docs/FORK.md`

Reduces front-page prominence while preserving durable attribution.

### Option C: persistent site/release footer attribution

Strong cross-surface consistency; requires template and release automation changes.

### Mandatory regardless of option

- Preserve license and copyright notices.
- Do not imply upstream endorsement.
- Document fork point, sync policy, local divergence, and vulnerability/reporting ownership.
- Keep upstream links distinct from fork support and release links.

## Decision record

- Canonical repository: `KooshaPari/OmniRoute`
- Selected naming option: use current-main SSOT without a rename — product display name `ArgisMonitor`, root package `argismonitor`, scoped packages `@argismonitor/*`, and retained `omniroute` CLI compatibility aliases
- Canonical organization display name: `KooshaPari` as repository owner; Phenotype governance context is secondary disclosure, not part of the primary product value proposition
- Selected URL option: Option C, default GitHub Pages target `https://kooshapari.github.io/OmniRoute/`
- Product/repository fallback URL: `https://github.com/KooshaPari/OmniRoute`
- API/reference URL: `https://kooshapari.github.io/OmniRoute/reference/` after Pages is enabled and that route is verified
- Support/issues URL: `https://github.com/KooshaPari/OmniRoute/issues`
- Security reporting: repository `SECURITY.md`; no external security URL is inferred
- Redirect policy: no redirects until an owned replacement URL is approved and tested
- Selected disclosure option: Option C; link governance from contribution/support surfaces outside the primary value proposition
- Selected attribution option: Option B; concise secondary README attribution plus a durable fork-lineage document
- Wiki strategy: deferred/retired as a publication surface while repository settings report Wiki disabled; reconsider only after explicit enablement
- Rationale: these values are already present in current main or mechanically derived from the canonical repository. GitHub Pages is repository-coupled, reversible, and requires no invented domain. No live-site claim is made before enablement and verification.
- Approved by: repository-owner directive to apply conservative reversible defaults
- Approval date: 2026-07-14
- Follow-up issues: enable and validate GitHub Pages; add secondary governance/fork-lineage surfaces; reconcile repository/package metadata; decide whether Wiki should ever be enabled
- Revisit trigger: repository or package rename, verified custom-domain ownership, GitHub Pages limitations, or explicit Wiki enablement

## Implementation gate

The defaults above authorize documentation and metadata preparation, not deployment. Pages remains disabled until repository settings enable it and a current-main build passes publication, link, accessibility, provenance, and rollback gates. DNS, secrets, package renaming, redirects, and release publication require separate approval. Capability claims must follow `docs/reference/CAPABILITY_FACTS.md`.

## Rollback

Revert the commit that records these defaults. Because this decision does not enable Pages, configure DNS, add secrets, deploy content, rename packages, or enable Wiki, rollback has no external-state cleanup. If Pages is enabled later, disable that external setting separately before reverting the URL record.
