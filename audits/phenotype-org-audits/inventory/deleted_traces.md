# Archive Salvage Map — Pre-Freeze Value Extraction Candidates

**Scope:** 29 archived repositories across Phenotype org. Document identifies reusable functions, modules, and patterns worth upstreaming before permanent freeze.

**Status:** Mapping only — no extraction yet. Candidates listed with priority (HIGH = genuinely useful; MEDIUM = reusable pattern; LOW = reference-only).

**Date:** 2026-04-24

---

## Archive Inventory

| Archive | LOC | Salvage Candidates | Status |
|---------|-----|-------------------|--------|
| colab | 7,769 | 3 HIGH | Config SDK with SQLite backend |
| pgai | 36,124 | 2 HIGH, 1 MEDIUM | CLI patterns, Datadog tracing |
| GDK | 7,611 | 1 HIGH | Quality metrics framework |
| DevHex | 329 | 1 HIGH | Hexagonal adapter registry pattern |
| KaskMan | 16,201 | 1 MEDIUM | Data persistence with backups |
| Pyron | 3,683 | 2 HIGH | Middleware chain + auth patterns |
| phenoEvaluation | 81,877 | 2 MEDIUM | Agent evaluation framework |
| pheno | 763 | 2 HIGH | Health check CLI patterns |
| phenotype-infrakit | 418 | 2 HIGH | Resource sampling, PATH resolution |
| PhenoLang-actual | 214,777 | 0 | Duplicate of AgilePlus (archive snapshot) |
| All others | ~1.7M | 0 | Dead code, v-env, build artifacts, or docs |

**Summary:**
- **Archives with salvage:** 9
- **Archives truly dead (0 candidates):** 20
- **Total candidates identified:** 16 HIGH + MEDIUM priority items

---

## HIGH-Priority Salvage Candidates

### 1. **colab** — Config SDK (7,769 LOC)

**Target Collection:** `phenotype-shared/crates/`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `ConfigStore` trait system | `pheno-core/src/lib.rs` | 150-200 | Generic KV store interface; supports SQLite + trait-based swappable backends |
| SQLite config adapter | `pheno-db/src/lib.rs` | 720 | Full SQLite config backend with WAL, auto-migration, audit trails, point-in-time restore |
| Encryption layer | `pheno-crypto/src/lib.rs` | ~180 | AES-256-GCM secret encryption; production-ready error handling |

**Priority:** HIGH — Config SDK addresses Phenotype-wide need; currently spread across agileplus-config + phenotype-config-core. Consolidation would unify `phenotype-shared` config story.

**Migration Plan:**
- Extract `pheno-core` → `phenotype-shared/crates/phenotype-config-core` (merge with existing)
- Extract `pheno-db` → `phenotype-shared/crates/phenotype-config-sqlite`
- Extract `pheno-crypto` → `phenotype-shared/crates/phenotype-secret-aes256`
- Deprecate colab after downstream adoption

---

### 2. **pheno** — Health Check CLI (763 LOC)

**Target Collection:** `phenotype-shared/crates/`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `HealthScanner` | `src/commands/health.rs` | 360 | Workspace scanner with multi-format output (table, JSON, markdown) |
| Health check trait pattern | `src/lib.rs` (implicit) | ~100 | Structured health check abstraction |

**Priority:** HIGH — Reusable health scanning pattern; currently replicated in AgilePlus (15+) and PhenoObservability. Centralizing would reduce duplication across 5+ repos.

**Migration Plan:**
- Extract health command framework → `phenotype-shared/crates/phenotype-health-cli`
- Reference in AgilePlus + PhenoObservability via `workspace = true` dependency
- Support custom health check registration via traits

---

### 3. **phenotype-infrakit** — Resource Sampling & PATH Resolver (418 LOC)

**Target Collection:** `phenotype-shared/crates/`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `ResourceSnapshot` | `phenotype-resources/src/lib.rs` | 304 | Native FD/memory/load sampling (no subprocess spawns on macOS/Linux) |
| `PathResolver` | `phenotype-path-resolve/src/lib.rs` | 82 | Fast PATH resolution with skip directory filtering; wraps `which` crate |

**Priority:** HIGH — Resource monitoring with zero subprocess overhead; critical for multi-agent sessions. Used implicitly in disk-budget-policy worktree coordination.

**Migration Plan:**
- Extract → `phenotype-shared/crates/phenotype-resource-monitor`
- Extract → `phenotype-shared/crates/phenotype-path-resolver`
- Use in AgilePlus quality gates + disk budget checks

---

### 4. **Pyron** — Middleware Chain & Auth Patterns (3,683 LOC)

**Target Collection:** `phenotype-shared/crates/` (Rust) or `@phenotype/middleware` (cross-language)

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `AuthMiddleware` + `MiddlewarePort` trait | `src/phenotype_middleware/infrastructure/builtin.py` | 632 | Type-safe middleware chain with async/await support; bearer token validation pattern |
| Compression, tracing, retry middleware | Same file | ~400 | Production-ready middleware implementations (gzip, datadog, exponential backoff) |
| Request/Response types | `src/phenotype_middleware/domain/__init__.py` | ~80 | Structured HTTP abstraction for middleware stack |

**Priority:** HIGH — Middleware patterns replicated across heliosApp, agileplus-grpc, cliproxy. Centralizing enables consistent error handling, tracing, auth across ecosystem.

**Migration Plan:**
- Port Rust equivalents → `phenotype-shared/crates/phenotype-middleware-core`
- Keep Python reference implementation in Pyron (frozen)
- Generate Go stubs from Rust crate + trait objects

---

### 5. **pgai** — CLI Patterns & Environment Handling (1,676 LOC fragment)

**Target Collection:** `phenotype-shared/crates/`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `TimeDurationParamType` | `projects/pgai/pgai/cli.py` (lines 47-68) | 22 | Reusable Click parameter type for duration parsing (e.g., "5m" → 300s) |
| `get_log_level()` + env helper pattern | Same file (lines 71-78) | 8 | Portable log-level parsing from env with fallback; used across 4+ repos |
| Structlog + Datadog tracing init | Same file (lines 20-44) | 25 | Production logging stack setup pattern; reused in phenotype-middleware |

**Priority:** HIGH — CLI helpers appear in 6+ projects (pgai, phench, phenotype-cli). De-duplication saves ~150 LOC per project.

**Migration Plan:**
- Extract → `@phenotype/cli-helpers` (TypeScript/Python) or `phenotype-cli-core` (Rust)
- Provide as reusable Click extensions or argparse wrappers
- Consolidate logging init across all CLI tools

---

### 6. **GDK** — Quality Metrics Framework (971 LOC)

**Target Collection:** `phenotype-shared/crates/phenotype-quality-metrics`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `QualityMetricsAnalyzer` + dimensional scoring | `src/quality_metrics.rs` | 971 | Multi-dimensional quality scoring (correctness, maintainability, security, perf, reliability, usability) with historical trend analysis |

**Priority:** HIGH — Quality gates in AgilePlus, quality-gate.sh, and task quality use ad-hoc scoring. GDK's framework provides production-ready abstraction.

**Migration Plan:**
- Extract → `phenotype-shared/crates/phenotype-quality-metrics`
- Integrate into `task quality:full` target
- Provide as library for CI/CD quality gates across all repos

---

## MEDIUM-Priority Salvage Candidates

### 7. **DevHex** — Hexagonal Adapter Registry Pattern (329 LOC)

**Target Collection:** `phenotype-shared/crates/phenotype-adapter-registry`

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `Registry<T>` generic factory pattern | `pkg/domain/registry.go` | ~35 | Type-safe backend factory registry with panic-on-duplicate fail semantics |
| `Environment` port + adapter interfaces | `pkg/domain/environment.go` + `pkg/adapters/docker/adapter.go` | ~96 | Template for hexagonal adapter pattern; used for Docker/Podman/Nix/native abstractions |

**Priority:** MEDIUM — Reusable template for devenv-abstraction pattern; appears in 2-3 projects (HeliosLab, KDesktopVirt). Provides reference for go-nippon hexagonal refactor.

**Migration Plan:**
- Keep as frozen reference in `.archive/DevHex`
- Create Rust equivalent → `phenotype-shared/crates/phenotype-adapter-registry`
- Document in architecture governance

---

### 8. **KaskMan** — Persistent Data Store with Backups (1,212 LOC fragment)

**Target Collection:** `@phenotype/persistence` or reference-only

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `RnDDataStore` file-based persistence | `src/rnd-module/RnDDataStore.js` | ~200 | Multi-file JSON store with automatic backup rotation, compression options |

**Priority:** MEDIUM — Useful pattern for agents needing local persistence (worktree data, telemetry snapshots). Replicated ad-hoc in phench, agileplus-cli.

**Migration Plan:**
- Keep as reference; low demand for extraction
- Document in `.archive/KaskMan/` for future agent persistence needs

---

### 9. **phenoEvaluation** — Agent Evaluation Framework (81,877 LOC)

**Target Collection:** Reference only (too domain-specific)

| Candidate | Location | LOC | Description |
|-----------|----------|-----|-------------|
| `TerminusAgent` base class + trajectory tracking | `src/harbor/agents/terminus_2/terminus_2.py` | 1,838 | Agent lifecycle, step tracking, LLM context management |
| Tmux session management for agent sandboxing | `src/harbor/agents/terminus_2/tmux_session.py` | ~150 | Terminal multiplexer abstraction for isolated agent execution |

**Priority:** MEDIUM — Rich reference for agent evaluation patterns; not a direct reusable library (too coupled to Harbor evaluation domain). Keep archived for future evaluation framework rebuild.

---

## LOW-Priority Candidates (Reference Only)

- **kitty-specs** — Spec stubs; migrate specs to AgilePlus kitty-specs/ (frozen reference)
- **phenodocs** — TypeScript node_modules; extract VitePress config patterns if needed
- **PhenoLang-actual** — Duplicate snapshot of AgilePlus; no unique code
- **PhenoRuntime** — Stub NATS/MinIO crates; too minimal to extract
- **All others** — Dev artifacts, venv, build outputs, or consolidated into active repos

---

## Salvage Execution Plan (Phases)

### Phase 1: Inventory & Extraction (1-2 weeks)

1. Extract 6 HIGH-priority candidates into `phenotype-shared/crates/`:
   - `phenotype-config-core` (merge colab + existing)
   - `phenotype-config-sqlite` (colab pheno-db)
   - `phenotype-secret-aes256` (colab pheno-crypto)
   - `phenotype-health-cli` (pheno)
   - `phenotype-resource-monitor` (phenotype-infrakit)
   - `phenotype-path-resolver` (phenotype-infrakit)
   - `phenotype-middleware-core` (Pyron ports)
   - `phenotype-quality-metrics` (GDK)

2. Create `@phenotype/cli-helpers` npm package (pgai patterns)

3. Update MEMORY.md with extraction impact (LOC saved per repo)

### Phase 2: Downstream Integration (2-3 weeks)

1. Update AgilePlus, PhenoObservability, heliosApp to depend on extracted crates
2. Remove in-tree duplicates (health checks, config loaders, middleware)
3. Verify all tests pass; update CI to test extracted crates

### Phase 3: Freeze & Documentation (1 week)

1. Mark all archives as frozen (`.archive/` immutable)
2. Document in GOVERNANCE.md why each archive is frozen
3. Create migration guide for future archaeologists

---

## Impact Summary

| Category | Count | LOC Impact |
|----------|-------|------------|
| Archives with salvage | 9/29 | ~70K LOC (0.7%) |
| High-priority extractions | 6 | ~2.5K LOC (reusable) |
| Medium-priority (reference) | 3 | ~2K LOC (patterns) |
| Truly dead archives | 20 | ~1.8M LOC (venv, build, docs) |

**Realizable impact:**
- **Duplication reduced:** ~3-5K LOC (health checks, config, CLI helpers duplicated across 5+ repos)
- **Standardization gained:** Consistent middleware, quality metrics, auth patterns across ecosystem
- **Knowledge preserved:** 9 archives remain as frozen reference implementations

---

## Dead Archives (0 Candidates)

- canvasApp, colab (extraction), FixitRs, go-nippon, koosha-portfolio, KWatch, pgai (extraction), kitty-specs, phenodocs, phenotype-config-ts, phenotype-docs-engine, phenotype-gauge, phenotype-middleware-py, phenotype-nexus, phenotype-types, phenotype-vessel, PhenoProject, RIP-Fitness-App, Tossy

**Why frozen:**
- Build artifacts & venv bloat (canvasApp, FixitRs, koosha-portfolio, KWatch)
- Stub/deprecated versions (phenotype-config-ts, phenotype-gauge, phenotype-nexus)
- Documentation snapshots (phenodocs, kitty-specs)
- Pre-extraction originals (colab, pgai, pheno after extraction)

---

## Recommendation

**Proceed with Phase 1 extraction immediately after this mapping.** The 6 HIGH-priority candidates address real duplication across 8+ active repos and support the Phenotype Org Cross-Project Reuse Protocol.

**Conservative freeze timeline:** After Phase 2 integration completes (3-4 weeks), mark `.archive/` as immutable in all workflows — no new archives without explicit board decision.
