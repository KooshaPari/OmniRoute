# ADR-004: Unified Specification Registry Architecture

## Status

**Accepted** - 2026-04-04

Supersedes: ADR-003 (partial - documentation approach only)

---

## Context

### The Problem

The Phenotype ecosystem has grown to encompass multiple repositories, languages, and teams. As of Q2 2026, we face significant challenges in specification management:

1. **Specification Fragmentation**: Feature specifications exist across multiple repositories (`AgilePlus/kitty-specs/`, individual repo docs, Notion pages)
2. **ADR Dispersal**: Architecture decisions are scattered in PR descriptions, wiki pages, and meeting notes
3. **API Contract Chaos**: OpenAPI specifications exist in some repos but not others, with varying quality
4. **Traceability Gaps**: No systematic way to trace from requirements to implementation across repositories
5. **Discovery Problem**: Engineers cannot easily find existing specifications when starting new work

### Scale of the Problem

| Metric | Current State | Impact |
|--------|--------------|--------|
| Active repositories | 25+ | Specifications scattered |
| Programming languages | 5 (Rust, Go, Python, TS, Zig) | Different doc formats |
| Engineering teams | 8 | Inconsistent practices |
| Open specifications | ~50 | Partially indexed |
| ADRs documented | ~15 | ~30 decisions undocumented |

### Requirements Analysis

Through interviews with leads across teams, we identified these requirements:

**Functional Requirements:**
- FR-001: Central index of all specifications
- FR-002: Cross-repository traceability
- FR-003: Support for multiple spec formats (Markdown, OpenAPI, ADRs)
- FR-004: Programmatic access (CLI, API)
- FR-005: Integration with existing workflows (Git, CI/CD)

**Non-Functional Requirements:**
- NFR-001: Low latency for common queries (<100ms)
- NFR-002: High availability (99.9% uptime not required - Git-based)
- NFR-003: Minimal maintenance overhead
- NFR-004: Language-agnostic design
- NFR-005: Version control integration (Git-native)

### Options Considered

#### Option 1: Monorepo Migration

**Approach**: Consolidate all specifications into a single monorepo.

**Pros:**
- Single source of truth
- Atomic changes across specs
- Simplified CI/CD

**Cons:**
- Massive migration effort
- Breaks repository boundaries
- Scale concerns (repo size)
- Permission/ownership complexity

**Verdict**: Rejected - too disruptive, doesn't respect service boundaries.

#### Option 2: Backstage Adoption

**Approach**: Deploy Spotify's Backstage as the developer portal.

**Pros:**
- Mature platform
- Rich plugin ecosystem
- Software Catalog feature
- Strong community

**Cons:**
- Heavy infrastructure (K8s, databases)
- Complex setup and maintenance
- Overkill for current needs
- Requires entity registration effort

**Verdict**: Rejected - too heavy for current scale, high operational burden.

#### Option 3: Notion/Confluence Centralization

**Approach**: Use SaaS documentation platform as the registry.

**Pros:**
- Excellent UX
- Rich editing features
- Search capabilities
- Access control

**Cons:**
- Vendor lock-in
- Poor code integration
- No Git versioning
- Limited programmatic access
- Subscription costs

**Verdict**: Rejected - doesn't align with docs-as-code philosophy.

#### Option 4: Git-Based Registry (Selected)

**Approach**: Create a dedicated `PhenoSpecs` repository with structured indexing.

**Pros:**
- Git-native (versioning, PR workflow)
- Low maintenance (static files)
- Language-agnostic
- CLI-friendly
- Scales with ecosystem
- Free (GitHub hosted)

**Cons:**
- Requires custom tooling
- No built-in UI (can be added later)
- Manual curation needed

**Verdict**: Accepted - best balance of simplicity, power, and alignment with our workflows.

### Research Basis

This decision is informed by:
- [RESEARCH.md](RESEARCH.md) - Analysis of 50+ documentation systems
- Industry case studies (Netflix, Monzo, Stripe)
- Internal survey of engineering teams
- Proof-of-concept implementation

---

## Decision

We will implement a **Unified Specification Registry** (`PhenoSpecs`) with the following architecture:

### 4.1 Repository Structure

```
PhenoSpecs/
├── specs/                    # Domain-organized specifications
│   ├── auth/
│   ├── crypto/
│   ├── api/
│   └── ...
├── adrs/                     # Architecture Decision Records
├── openapi/                  # API contract specifications
├── integrations/             # Cross-system integration specs
├── registry.yaml             # Central index (machine-readable)
├── catalog-info.yaml         # Backstage catalog descriptor
├── SPEC.md                   # System specification
├── RESEARCH.md               # SOTA research
└── README.md                 # Human entry point
```

### 4.2 Registry Schema

The `registry.yaml` serves as the central index:

```yaml
registry_version: "1.0.0"
last_updated: "2026-04-04"

domains:
  auth:
    name: "Authentication & Authorization"
    owner: "team-security"
    repos: ["phenotype-auth-ts", "Authvault"]

specs:
  SPEC-AUTH-001:
    title: "OAuth 2.0 + PKCE Implementation"
    path: "specs/auth/oauth-pkce/spec.md"
    domain: auth
    status: implemented
    implements: [SPEC-CRYPTO-001]
    repos: ["phenotype-auth-ts"]
    frd: "specs/auth/oauth-pkce/frd.md"
    openapi: "openapi/auth-oauth.yaml"

adrs:
  ADR-001:
    title: "Hexagonal Architecture Adoption"
    path: "adrs/001-hexagonal-architecture.md"
    status: accepted
    date: "2024-01-15"
    tags: [architecture, patterns]
```

### 4.3 Traceability Model

Three-layer traceability architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Specification Layer                   │
│         (SPEC-XXX-NNN documents requirements)            │
├─────────────────────────────────────────────────────────┤
│                    Registry Layer                        │
│    (registry.yaml links specs to implementations)        │
├─────────────────────────────────────────────────────────┤
│                    Code Layer                            │
│  (Annotations in source code link to specifications)     │
└─────────────────────────────────────────────────────────┘
```

**Annotation Formats:**

Rust:
```rust
#[trace_fr(spec = "SPEC-AUTH-001", fr = "FR-002")]
fn authorize(request: AuthRequest) -> AuthResponse { }
```

Go:
```go
// FR: SPEC-AUTH-001 FR-002 - PKCE support
func GeneratePKCE() (*PKCEPair, error) { }
```

TypeScript:
```typescript
/**
 * @spec SPEC-AUTH-001
 * @fr FR-002
 * Implements PKCE extension
 */
function generatePKCE(): PKCEPair { }
```

### 4.4 CLI Tool Specification

The `phenospecs` CLI provides programmatic access:

```bash
# List specifications
phenospecs list --domain auth --status implemented

# Trace implementation
phenospecs trace SPEC-AUTH-001

# Check coverage
phenospecs coverage --format html --output ./report

# Validate registry integrity
phenospecs validate

# Search across all specs
phenospecs search "oauth pkce"
```

### 4.5 Integration Points

| System | Integration | Purpose |
|--------|-------------|---------|
| GitHub | PR templates | Require spec references |
| CI/CD | phenospecs validate | Registry integrity checks |
| AgilePlus | spec query | Work package spec linking |
| Backstage | catalog-info.yaml | Developer portal visibility |
| IDEs | spec-links extension | In-editor spec lookup |

---

## Consequences

### Positive Consequences

1. **Unified Discovery**: Engineers can find any spec via single query
2. **Cross-Repo Traceability**: Requirements traceable across repository boundaries
3. **Git-Native Workflow**: PR reviews, versioning, branching work naturally
4. **Low Operational Burden**: Static files require minimal infrastructure
5. **Scalability**: Grows with ecosystem without architecture changes
6. **Tooling Foundation**: Base for future automation (generators, validators)

### Negative Consequences

1. **Migration Effort**: Existing specs need cataloging in registry
2. **Curation Overhead**: Registry requires manual updates when specs change
3. **Custom Tooling**: Need to build/maintain phenospecs CLI
4. **Learning Curve**: Teams must adopt new annotation practices
5. **Fragmentation Risk**: Without governance, registry may become stale

### Mitigations

| Risk | Mitigation |
|------|------------|
| Migration effort | Phased approach: new specs first, then backfill |
| Curation overhead | CI checks enforce registry updates with spec changes |
| Custom tooling | Start simple, iterate based on usage |
| Learning curve | Documentation + team training sessions |
| Staleness | Automated validation in CI + regular audits |

---

## Related Decisions

- **ADR-001**: Hexagonal Architecture Adoption - Specifications describe hexagonal boundaries
- **ADR-003**: Spec-Driven Development via AgilePlus - PhenoSpecs enables SDD at scale
- **ADR-005**: Multi-Format Documentation Strategy - Registry unifies different formats

---

## References

1. [RESEARCH.md](RESEARCH.md) - State of the Art analysis
2. [SPEC.md](SPEC.md) - Detailed system specification
3. [registry.yaml](registry.yaml) - Implementation
4. [Backstage System Model](https://backstage.io/docs/features/software-catalog/system-model)
5. [Documentation as Code](https://www.writethedocs.org/guide/docs-as-code/) - Write the Docs

---

## Notes

This decision was discussed in the Platform Architecture meeting on 2026-03-28. All engineering leads approved the approach. Implementation begins immediately.

---

*Last updated: 2026-04-04*
