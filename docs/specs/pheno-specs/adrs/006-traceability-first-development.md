# ADR-006: Traceability-First Development Model

## Status

**Accepted** - 2026-04-04

---

## Context

### The Traceability Crisis

Modern software systems suffer from a critical gap between specifications and implementations. Research consistently shows:

- **68%** of defects trace to requirements issues (NASA, 2019)
- **40%** of development time spent understanding existing code (IEEE)
- **60%** of organizations lack systematic traceability (ThoughtWorks, 2023)
- **$500B** annual cost of software defects (NIST, 2022)

In the Phenotype ecosystem, we observe:
- Specifications written but never linked to code
- Code changes without corresponding spec updates
- "Why" questions requiring archaeology through git history
- New team members struggling to understand design rationale

### Current State in Phenotype

| Aspect | Current State | Gap |
|--------|--------------|-----|
| Spec-to-code links | Manual, inconsistent | No systematic approach |
| Code annotations | Ad-hoc comments | No standard format |
| Coverage tracking | None | Unknown spec compliance |
| Impact analysis | Manual grep | No dependency graph |
| Change validation | None | Spec drift undetected |

### Requirements Analysis

**Functional Requirements:**
- FR-001: Link specifications to code implementations
- FR-002: Support multiple programming languages
- FR-003: Validate traceability completeness
- FR-004: Report coverage metrics
- FR-005: Query traceability graph

**Non-Functional Requirements:**
- NFR-001: Low annotation overhead (minimize boilerplate)
- NFR-002: Language-agnostic where possible
- NFR-003: CI/CD integration (validation gates)
- NFR-004: IDE support (navigation, completion)
- NFR-005: No runtime overhead

### Traceability Approaches Analysis

#### Approach 1: External Tracking

**Method**: Maintain traceability matrix in external system (spreadsheet, database).

```
Spec ID    | File Path        | Function
-----------|------------------|------------
SPEC-001   | src/auth.rs      | authenticate
SPEC-001   | src/token.rs     | generate_token
```

**Pros:**
- Simple to understand
- Language-agnostic
- Can track any relationship

**Cons:**
- Manual maintenance (guaranteed staleness)
- Separate from code (context switching)
- No IDE integration
- Scales poorly

**Verdict**: Rejected - manual maintenance unsustainable.

#### Approach 2: Git Commit Tracing

**Method**: Parse commit messages for spec references.

```bash
git commit -m "Implement SPEC-001 FR-002: Add PKCE support"
```

**Pros:**
- Natural workflow integration
- Historical traceability
- No code changes needed

**Cons:**
- Depends on commit message discipline
- Coarse-grained (file level at best)
- Difficult to query current state
- No fine-grained function links

**Verdict**: Rejected - insufficient granularity, discipline-dependent.

#### Approach 3: Code Annotations (Selected)

**Method**: Embed traceability metadata directly in source code via annotations/comments.

**Rust:**
```rust
#[trace_fr(spec = "SPEC-AUTH-001", fr = "FR-002")]
fn authenticate(request: AuthRequest) -> AuthResponse {
    // Implementation
}
```

**Go:**
```go
// FR: SPEC-AUTH-001 FR-002 - PKCE support
func GeneratePKCE() (*PKCEPair, error) {
    // Implementation
}
```

**TypeScript:**
```typescript
/**
 * @spec SPEC-AUTH-001
 * @fr FR-002
 * Implements PKCE extension
 */
function generatePKCE(): PKCEPair {
    // Implementation
}
```

**Pros:**
- Fine-grained (function/method level)
- IDE-friendly (hover to see spec)
- Language-idiomatic
- Parseable by tools
- Survives refactoring (when refactored with code)

**Cons:**
- Language-specific syntax
- Adds visual noise (minimal with practice)
- Requires team discipline

**Verdict**: Accepted - best balance of precision, usability, and maintainability.

#### Approach 4: Static Analysis

**Method**: Infer traceability through code analysis (AST matching, naming conventions).

**Pros:**
- No manual annotations
- Automatic detection

**Cons:**
- Brittle heuristics
- False positives/negatives
- Limited to simple patterns
- Cannot capture intent

**Verdict**: Rejected - insufficient accuracy for production use.

---

## Decision

We will implement a **Traceability-First Development Model** based on code annotations with comprehensive tooling support.

### 6.1 Core Principle

**Every implementation of a functional requirement must be traceable to its specification.**

This is not optional documentation — it is a first-class engineering requirement.

### 6.2 Annotation Specification

#### Language-Specific Formats

**Rust (Procedural Macro):**
```rust
// Required: spec identifier
// Optional: specific FR, repo override
#[trace(spec = "SPEC-AUTH-001")]
#[trace(spec = "SPEC-AUTH-001", fr = "FR-002")]
#[trace(spec = "SPEC-AUTH-001", fr = "FR-002", repo = "custom/repo")]

// Usage on functions, methods, impl blocks
#[trace(spec = "SPEC-AUTH-001")]
pub fn authenticate(req: AuthRequest) -> Result<AuthResponse, AuthError> {
    // Implementation
}

// Usage on modules (traces all contained items)
#[trace(spec = "SPEC-AUTH-001")]
mod oauth {
    // All items in this module are traced to SPEC-AUTH-001
}
```

**Go (Comment Convention):**
```go
// Single line: "FR: <spec-id> <fr-id> [description]"
// FR: SPEC-AUTH-001 FR-002 - PKCE support
func GeneratePKCE() (*PKCEPair, error) {
    // Implementation
}

// Multi-line for complex cases
// FR: SPEC-AUTH-001 FR-002,FR-003
// Implements PKCE and token rotation
// See: specs/auth/oauth-pkce/spec.md
func GeneratePKCEWithRotation() (*PKCEPair, *Token, error) {
    // Implementation
}
```

**TypeScript/JavaScript (JSDoc Tags):**
```typescript
/**
 * @spec SPEC-AUTH-001
 * @fr FR-002
 * @description Implements PKCE extension for OAuth 2.0
 */
function generatePKCE(): PKCEPair {
    // Implementation
}

// Inline for simple cases
// @spec SPEC-AUTH-001 FR-002
const generatePKCE = (): PKCEPair => {
    // Implementation
};
```

**Python (Decorators):**
```python
from phenotype.traceability import trace

@trace(spec="SPEC-AUTH-001", fr="FR-002")
def generate_pkce() -> PKCEPair:
    """Generate PKCE pair for OAuth flow."""
    # Implementation
    pass
```

#### Annotation Semantics

| Field | Required | Description |
|-------|----------|-------------|
| `spec` | Yes | Specification identifier (e.g., "SPEC-AUTH-001") |
| `fr` | No | Functional requirement ID(s), comma-separated |
| `repo` | No | Override for repository name (default: git origin) |
| `path` | No | Override for file path (default: relative path) |

### 6.3 Tooling Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Traceability System                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Parse     │  │   Index     │  │   Query     │             │
│  │  (Extract)  │  │  (Store)    │  │  (Retrieve) │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                    │
│         ▼                ▼                ▼                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Registry Index                         │  │
│  │  (YAML/JSON with spec → code mappings)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CLI Interface                            │  │
│  │  (phenospecs trace, phenospecs coverage, etc.)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 6.4 CLI Specification

```bash
# Parse and index traceability from repository
phenospecs trace scan [--repo <path>] [--output registry.fragment.yaml]

# Query traceability information
phenospecs trace query <spec-id> [--format tree|list|json]
phenospecs trace query <spec-id> <fr-id>

# Check coverage (spec → code linkage)
phenospecs coverage [--spec <spec-id>] [--format html|json|table]

# Validate traceability (check for issues)
phenospecs trace validate [--strict]
# Checks:
# - All FRs have at least one implementation
# - No orphaned annotations (spec doesn't exist)
# - No duplicate FR implementations (warn)
# - Annotation format correctness

# Report untraced specifications
phenospecs trace untraced [--domain <domain>]

# Generate traceability matrix
phenospecs trace matrix --output matrix.html

# Watch mode for development
phenospecs trace watch [--repo <path>]
```

### 6.5 IDE Integration

**VS Code Extension (spec-links):**

```json
// Features
{
  "hover": "Show spec details on hover over annotation",
  "definition": "Go to spec from annotation",
  "diagnostics": "Validate annotations in real-time",
  "completion": "Suggest spec IDs when typing",
  "lens": "Code lens showing coverage status"
}
```

**IntelliJ Plugin:**
- Line markers for traced code
- Spec reference navigation
- Coverage highlighting

### 6.6 CI/CD Integration

**GitHub Actions:**
```yaml
- name: Traceability Check
  uses: phenotype/spec-links-action@v1
  with:
    fail-on-uncovered: true
    coverage-threshold: 80
    report-format: pr-comment
```

**GitLab CI:**
```yaml
traceability:
  script:
    - phenospecs trace validate --strict
    - phenospecs coverage --threshold 80
  artifacts:
    reports:
      coverage_report: coverage.json
```

### 6.7 Coverage Model

**Coverage Levels:**

| Level | Definition | Target |
|-------|------------|--------|
| Spec Coverage | % of specs with ≥1 code annotation | 100% |
| FR Coverage | % of FRs with ≥1 implementation | 100% |
| Line Coverage | % of traced code lines (optional) | N/A |

**Coverage Report:**
```yaml
summary:
  total_specs: 50
  traced_specs: 48
  coverage: 96%
  
details:
  SPEC-AUTH-001:
    status: complete
    frs:
      FR-001: 3 implementations
      FR-002: 2 implementations
      FR-003: 0 implementations ⚠️
      
  SPEC-AUTH-002:
    status: partial
    frs:
      FR-001: 0 implementations ❌
```

### 6.8 Workflow Integration

**Spec-Driven Development with Traceability:**

```
1. SPECIFICATION PHASE
   ├─ Create/Update spec.md (with FRs)
   ├─ Update registry.yaml
   └─ PR: spec changes only
       └─ CI: Validate spec format

2. IMPLEMENTATION PHASE
   ├─ Write code with trace annotations
   ├─ phenospecs trace scan
   └─ PR: code + registry.fragment.yaml
       └─ CI: Validate traceability
           ├─ All FRs have implementations
           ├─ Annotations are valid
           └─ Coverage ≥ threshold

3. VERIFICATION PHASE
   ├─ phenospecs coverage report
   └─ CI: Coverage check gates merge
```

---

## Consequences

### Positive Consequences

1. **Root Cause Analysis**: Trace defects back to requirements
2. **Change Impact**: Understand what specs are affected by code changes
3. **Onboarding Speed**: New engineers follow spec links to understand code
4. **Compliance**: Demonstrate requirements coverage for audits
5. **Refactoring Confidence**: Know what requirements must be preserved
6. **Documentation Living**: Specs stay current because code links to them

### Negative Consequences

1. **Annotation Overhead**: Additional code to write (minimal with good tooling)
2. **Learning Curve**: Team must learn annotation conventions
3. **Discipline Required**: Annotations must be maintained during refactoring
4. **Tooling Dependency**: Build/validation depends on spec-links tool

### Mitigations

| Concern | Mitigation |
|---------|------------|
| Overhead | IDE autocomplete for spec IDs |
| Learning | Training + documentation |
| Discipline | CI validation prevents merge of untraced code |
| Dependency | Tool is open source, simple format (fallback to grep) |

---

## Migration Strategy

### Phase 1: New Code (Immediate)
- All new features require traceability annotations
- CI gates enforce coverage

### Phase 2: Active Code (Month 1-3)
- Annotate code actively being modified
- Focus on critical paths (auth, security, core APIs)

### Phase 3: Backlog (Month 3-6)
- Backfill annotations for stable, important code
- Lower priority for experimental/temporary code

### Phase 4: Enforcement (Month 6+)
- 100% coverage required for all production code
- Exceptions require ADR with justification

---

## Related Decisions

- **ADR-004**: Unified Specification Registry - Traceability requires the registry
- **ADR-005**: Multi-Format Documentation - Trace annotations reference specs
- **ADR-001**: Hexagonal Architecture - Annotations on domain layer primarily

---

## References

1. [NASA Software Safety Guidebook](https://www.nasa.gov/) - Defect traceability research
2. [IEEE 830-1998] - Software Requirements Specifications
3. [ThoughtWorks Tech Radar](https://www.thoughtworks.com/radar) - Living documentation trends
4. [NIST Software Errors](https://www.nist.gov/) - Economic impact of software defects
5. [RESEARCH.md](../RESEARCH.md) - Traceability approaches analysis

---

## Success Metrics

| Metric | Baseline | 6-Month Target | 12-Month Target |
|--------|----------|--------------|-----------------|
| Spec Coverage | 0% | 50% | 100% |
| FR Coverage | 0% | 60% | 100% |
| CI Violations | N/A | <5/week | 0 |
| Team Adoption | 0% | 80% | 100% |
| Onboarding Time | 2 weeks | 1 week | 3 days |

---

## Notes

This decision represents a fundamental shift in how we approach software development. Traceability is not an afterthought or documentation burden — it is a first-class engineering practice that enables quality, maintainability, and team velocity at scale.

The annotation-based approach was chosen because it places traceability information closest to the code it describes, making it more likely to be maintained and more useful for developers.

---

*Last updated: 2026-04-04*
