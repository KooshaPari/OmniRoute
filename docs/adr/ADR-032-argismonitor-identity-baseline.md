# ADR-032: ArgisMonitor identity baseline

- Status: Accepted
- Decision owner: repository owner
- Scope: naming, URLs, governance disclosure, and upstream attribution
- Decision date: 2026-07-14
- Out of scope: repository/package/workspace renames, DNS, deployment, compatibility-alias removal, or changing upstream history

## Context

The fork mixes fork, Phenotype, and upstream OmniRoute signals. The repository owner approved a conservative baseline derived from current `main`, without inventing a new name, domain, or capability claim.

## Decision 1 — canonical product and organization naming

### Option A: OmniRoute by Phenotype

**Consequences:** preserves product recognition and package continuity; requires a clear “by Phenotype” lockup and a written rule distinguishing product from organization.

### Option B: Phenotype OmniRoute

**Consequences:** makes organization ownership prominent; likely requires coordinated package, UI, documentation, and release-copy updates while retaining upstream attribution.

### Option C: new product name under Phenotype

**Consequences:** strongest differentiation but highest migration cost; requires trademark/package/domain checks, redirects, compatibility aliases, and a deprecation period.

### Accepted baseline

- Canonical product display name: `ArgisMonitor`
- Canonical repository: `KooshaPari/OmniRoute`
- Root package: `argismonitor`; scoped packages remain `@argismonitor/*`
- CLI: `argismonitor` is canonical; the `omniroute` alias remains supported for one major release after this decision
- Internal `OMNIROUTE_*` identifiers and existing compatibility paths are unchanged
- No trademark conclusion is made by this ADR

## Decision 2 — canonical URLs

### Option A: subpath on an existing approved Phenotype domain

Lower operational surface; URL structure and deployment base path become coupled.

### Option B: dedicated documentation subdomain

Clear docs identity and flexible hosting; requires approved domain, DNS, certificates, and ownership/renewal controls.

### Option C: GitHub Pages as the initial canonical surface

Fast and repository-coupled; weaker product identity and subject to Pages constraints. A later custom-domain move needs redirects.

### Accepted baseline

- Product/repository: `https://github.com/KooshaPari/OmniRoute`
- Documentation target: `https://kooshapari.github.io/OmniRoute/`
- API/reference target: `https://kooshapari.github.io/OmniRoute/reference/`
- Support/issues: `https://github.com/KooshaPari/OmniRoute/issues`
- Security reporting: `https://github.com/KooshaPari/OmniRoute/security/advisories/new`
- Redirect policy: none until a replacement URL is owned and verified
- Domain owner/renewal: not applicable to the default GitHub Pages URL

The Pages URLs are approved targets, not live-site claims. Repository settings currently report Pages disabled.

## Decision 3 — governance disclosure placement

### Option A: concise README notice plus full governance document

Transparent without dominating product onboarding. Requires a maintained governance page and link.

### Option B: full disclosure near the top of README

Maximum visibility but materially affects product positioning and first-use comprehension.

### Option C: governance document linked from contributing/support surfaces

Least intrusive, but may under-disclose repository operating assumptions.

### Accepted baseline

- Placement: concise secondary README section plus detailed `docs/FORK.md`
- Governance/upstream attribution stays outside the primary value proposition
- Owner: repository owner; review at each major release or identity/hosting change
- Capability claims continue to require `docs/reference/CAPABILITY_FACTS.md` evidence

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

- Selected naming option: current-main `ArgisMonitor` identity; no rename
- Selected URL option: Option C, repository-coupled GitHub Pages
- Selected disclosure option: Option C, outside the primary value proposition
- Selected attribution option: Option B, secondary README summary plus `docs/FORK.md`
- Wiki: explicitly retired as a publication surface while repository Wiki is disabled
- Rationale: every selected identifier exists on current `main` or is mechanically derived from `KooshaPari/OmniRoute`; the defaults are reversible and require no DNS or secret
- Approved by: repository owner
- Approval date: 2026-07-14
- Revisit trigger: next major release, repository/package rename, verified custom-domain ownership, Pages limitation, or explicit Wiki enablement

## Implementation gate

This decision authorizes metadata and documentation alignment, not deployment. Pages must remain disabled until its build, link, accessibility, provenance, base-path, and rollback gates pass. Wiki remains retired. Capability claims must follow `docs/reference/CAPABILITY_FACTS.md`.

## Per-surface rollback

| Surface | Change | Rollback |
|---|---|---|
| ADR/index | Accept ADR-032 and resolve the ADR-002 collision | Revert ADR-032 and its index row |
| README/FORK/support/security | Align fork identity, attribution, and owned repository links | Revert the affected documentation files |
| Package metadata | Point repository/homepage metadata at the approved repository/Pages target | Revert metadata only; package names and aliases are untouched |
| Docs contract | Record disabled Pages target and publication gates | Revert contract metadata; no deployed state exists |
| Wiki workflow | Retire automatic sync while Wiki is disabled | Revert only after Wiki is explicitly enabled and initialized |

No rollback requires DNS, secret cleanup, package migration, alias deletion, or repository rename because this decision performs none of those actions.
