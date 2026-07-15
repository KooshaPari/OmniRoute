# ADR-002: Phenotype identity decision inputs

- Status: Proposed decision template
- Decision owner: repository owner
- Scope: naming, URLs, governance disclosure, and upstream attribution
- Out of scope: choosing a brand, acquiring a domain, DNS, deployment, or changing upstream history

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

- Selected naming option:
- Selected URL option:
- Selected disclosure option:
- Selected attribution option:
- Rationale:
- Approved by:
- Approval date:
- Follow-up issues:
- Revisit trigger:

## Implementation gate

README, repository metadata, website, docs deployment, package renaming, or redirects must not encode a final identity until this record is approved. Capability claims must follow `docs/reference/CAPABILITY_FACTS.md`.
