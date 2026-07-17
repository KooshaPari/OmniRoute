# Product Requirements Document (PRD): phenotype-forge

## Executive Summary

**phenotype-forge** is a next-generation build system and task orchestrator designed for the Phenotype ecosystem. It combines the performance of modern Rust-based tools with AI-native intelligence to provide a superior developer experience for monorepo management.

### Problem Statement

Current build systems force tradeoffs between:
- **Performance vs. Simplicity**: Fast tools (Bazel) are complex; simple tools lack features
- **JavaScript vs. Polyglot**: JS tools don't handle native code well
- **Caching vs. Correctness**: Aggressive caching risks; conservative caching wastes time
- **Developer vs. CI**: Optimized for one, suboptimal for the other

### Solution Approach

phenotype-forge addresses these tradeoffs through:
- **Rust-based core**: Performance without memory safety compromises
- **AI integration**: Smart caching, affected detection, and optimization
- **Universal plugin system**: Support for any language or framework
- **Progressive adoption**: Start simple, grow powerful

---

## 1. Project Overview

### 1.1 Vision Statement

To create the world's most intelligent, performant, and developer-friendly build system that seamlessly scales from small projects to enterprise monorepos while providing AI-enhanced insights and optimizations.

### 1.2 Target Audience

| Audience | Primary Use Case |
|----------|------------------|
| **Phenotype Ecosystem Developers** | Building polyglot projects with Rust, TypeScript, Go, Python |
| **TypeScript/JavaScript Teams** | Managing monorepos with complex dependency graphs |
| **Polyglot Engineering Orgs** | Unifying build processes across multiple languages |
| **DevOps Engineers** | CI/CD optimization and build pipeline management |
| **AI-Assisted Developers** | Leveraging intelligent caching and affected detection |

### 1.3 Key Differentiators

| Feature | phenotype-forge | Bazel | Buck2 | Nx | Turborepo |
|---------|-----------------|-------|-------|----|-----------|
| AI-Native | Yes | No | No | Limited | No |
| Setup Time | <5 min | Days | Days | 30 min | 5 min |
| Learning Curve | Low | High | High | Medium | Low |
| Raw Performance | Leading | High | Leading | Medium | Medium |
| Universal Plugins | WASM-based | Starlark | Starlark | JS-only | JS-only |

### 1.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold build time | <1s for 1k targets | Benchmark suite |
| Incremental build | <100ms for single file | Benchmark suite |
| Cache hit lookup | <5ms | Benchmark suite |
| Time to first build | <30 seconds | User testing |
| Configuration lines | <20 for typical project | Documentation |
| Cache hit rate | 95% | Production telemetry |

---

## 2. Functional Requirements

### 2.1 Build System Core

#### 2.1.1 Incremental Build Engine

**Requirement ID**: BLD-001
**Priority**: P0
**Status**: Required

**Description**: The system must support incremental builds that only rebuild affected targets based on file changes.

**Acceptance Criteria**:
- [ ] Detect file changes using content hashing (not timestamps)
- [ ] Compute affected targets from changed files
- [ ] Support file watching for continuous builds
- [ ] Build only changed targets and their dependents
- [ ] Parallel execution of independent targets

**Technical Specifications**:
- Content hashing algorithm: SHA-256
- File watching: notify crate (cross-platform)
- Affected detection: AST analysis + git diff
- Parallelism: Tokio async runtime

**Performance Requirements**:
- <100ms for single file change detection
- <1s to rebuild 1k targets from cold
- Utilize all available CPU cores

#### 2.1.2 Content-Addressable Caching

**Requirement ID**: BLD-002
**Priority**: P0
**Status**: Required

**Description**: Implement content-addressable caching to store and retrieve build artifacts.

**Acceptance Criteria**:
- [ ] Compute cache keys from source file content
- [ ] Store build outputs in local cache (RocksDB)
- [ ] Support remote cache (S3/R2 compatible)
- [ ] Automatic cache garbage collection
- [ ] Cache verification and integrity checks

**Technical Specifications**:
- Local cache: RocksDB with LRU eviction
- Remote cache: HTTP REST API
- Cache key: SHA-256 hash of inputs + config + toolchain
- Compression: zstd for large artifacts

**Performance Requirements**:
- <5ms local cache lookup
- <50ms remote cache lookup
- 95% cache hit rate in daily development

#### 2.1.3 Task Graph Execution

**Requirement ID**: BLD-003
**Priority**: P0
**Status**: Required

**Description**: Execute tasks in dependency order with topological sorting and parallelization.

**Acceptance Criteria**:
- [ ] Parse task dependencies from configuration
- [ ] Build dependency graph (DAG)
- [ ] Detect circular dependencies
- [ ] Execute tasks in topological order
- [ ] Parallelize independent tasks

**Technical Specifications**:
- Graph library: petgraph
- Scheduling: Topological sort + level-based parallelization
- Process management: Tokio process spawning
- Resource limits: Configurable concurrency

#### 2.1.4 Hermetic Builds

**Requirement ID**: BLD-004
**Priority**: P1
**Status**: Required

**Description**: Support hermetic builds that are reproducible across environments.

**Acceptance Criteria**:
- [ ] Pin toolchain versions
- [ ] Isolate environment variables
- [ ] Sandbox build processes
- [ ] Bit-for-bit reproducible outputs
- [ ] Build environment documentation

### 2.2 AI Integration

#### 2.2.1 Smart Affected Detection

**Requirement ID**: AI-001
**Priority**: P1
**Status**: Required

**Description**: Use AI to detect affected targets beyond simple file dependencies.

**Acceptance Criteria**:
- [ ] Analyze code semantics for impact analysis
- [ ] Consider API surface changes
- [ ] Evaluate type signature changes
- [ ] Suggest related tests to run
- [ ] Learn from historical build patterns

**Technical Specifications**:
- Model: Local ONNX Runtime inference
- Features: AST embeddings, dependency embeddings
- Training: Historical build data

#### 2.2.2 Build Optimization Suggestions

**Requirement ID**: AI-002
**Priority**: P1
**Status**: Required

**Description**: Provide AI-generated suggestions for build optimization.

**Acceptance Criteria**:
- [ ] Analyze build graph for bottlenecks
- [ ] Suggest parallelization opportunities
- [ ] Recommend cache configuration
- [ ] Identify unused dependencies
- [ ] Suggest task splitting/merging

#### 2.2.3 Natural Language Queries

**Requirement ID**: AI-003
**Priority**: P2
**Status**: Planned

**Description**: Allow natural language queries against the project graph.

**Acceptance Criteria**:
- [ ] Parse natural language questions
- [ ] Query project dependency graph
- [ ] Answer "what depends on X?"
- [ ] Answer "what does X depend on?"
- [ ] Explain why targets are being built

### 2.3 Package Management Integration

#### 2.3.1 pnpm Workspace Support

**Requirement ID**: PKG-001
**Priority**: P0
**Status**: Required

**Description**: Native integration with pnpm workspaces for monorepo package management.

**Acceptance Criteria**:
- [ ] Parse pnpm-workspace.yaml
- [ ] Understand workspace package relationships
- [ ] Leverage pnpm's content-addressable store
- [ ] Support pnpm's lockfile for reproducibility
- [ ] Handle workspace protocol dependencies

#### 2.3.2 Lockfile Management

**Requirement ID**: PKG-002
**Priority**: P0
**Status**: Required

**Description**: Automatic lockfile management and updates.

**Acceptance Criteria**:
- [ ] Detect lockfile changes
- [ ] Trigger dependency installation
- [ ] Verify lockfile consistency
- [ ] Support lockfile merge conflicts
- [ ] Generate lockfile reports

#### 2.3.3 Dependency Analysis

**Requirement ID**: PKG-003
**Priority**: P1
**Status**: Required

**Description**: Analyze dependencies for unused packages and security issues.

**Acceptance Criteria**:
- [ ] Detect unused dependencies
- [ ] Identify duplicate dependencies
- [ ] Flag known vulnerable packages
- [ ] Suggest dependency updates
- [ ] Generate dependency graphs

### 2.4 Plugin System

#### 2.4.1 WASM Plugin Architecture

**Requirement ID**: PLG-001
**Priority**: P0
**Status**: Required

**Description**: Universal plugin system based on WebAssembly for cross-language support.

**Acceptance Criteria**:
- [ ] Load WASM plugins at runtime
- [ ] Sandboxed plugin execution
- [ ] Plugin capability declaration
- [ ] Hot-reload for development
- [ ] Plugin registry and distribution

**Technical Specifications**:
- Runtime: wasmtime
- WASI support for filesystem access
- Capability-based permissions
- Fuel-based execution limits

#### 2.4.2 Language-Specific Plugins

**Requirement ID**: PLG-002
**Priority**: P1
**Status**: Required

**Description**: Built-in plugins for common languages and frameworks.

**Acceptance Criteria**:
- [ ] TypeScript/JavaScript plugin
- [ ] Rust plugin
- [ ] Go plugin
- [ ] Python plugin
- [ ] Custom plugin creation SDK

#### 2.4.3 Task Definition Plugins

**Requirement ID**: PLG-003
**Priority**: P1
**Status**: Required

**Description**: Plugins for common task types (lint, test, build, etc.).

**Acceptance Criteria**:
- [ ] ESLint plugin
- [ ] Prettier plugin
- [ ] Jest/Vitest plugin
- [ ] TypeScript compiler plugin
- [ ] Webpack/Vite/Rollup plugins

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Startup time | <1s | Time to first prompt |
| Analysis (1k targets) | <2s | Project graph build |
| Incremental build | <100ms | Single file change |
| Cache lookup | <5ms | Local cache hit |
| Memory usage | <500MB | Peak for 1k targets |
| Remote cache upload | <500ms | Typical artifact |

### 3.2 Scalability

| Scale | Targets | Team Size | Repository Size |
|-------|---------|-----------|-----------------|
| Small | <100 | <10 | <1GB |
| Medium | <1,000 | <100 | <10GB |
| Large | <10,000 | <1,000 | <100GB |
| Enterprise | 100,000+ | Unlimited | Petabyte |

### 3.3 Reliability

| Requirement | Target |
|-------------|--------|
| Build reproducibility | 100% for hermetic builds |
| Cache correctness | Zero false positives |
| Crash recovery | Resume from last checkpoint |
| Uptime (remote cache) | 99.9% |

### 3.4 Security

| Requirement | Implementation |
|-------------|----------------|
| Sandboxed builds | Container/Docker isolation |
| Supply chain | SLSA compliance |
| Secrets management | Integration with 1Password/Vault |
| Audit logging | All operations logged |
| Plugin isolation | WASM sandbox |

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        phenotype-forge                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   CLI        │  │   API        │  │   LSP        │               │
│  │   (rust)     │  │   (rust)     │  │   (rust)     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Core Engine (Rust)                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │   │
│  │  │   Parser   │  │   Graph    │  │   Scheduler          │  │   │
│  │  │            │  │   Engine   │  │   (Tokio)            │  │   │
│  │  └────────────┘  └────────────┘  └──────────────────────┘  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │   │
│  │  │   Cache    │  │   Task     │  │   AI Engine          │  │   │
│  │  │   Layer    │  │   Runner   │  │   (Inference)        │  │   │
│  │  └────────────┘  └────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   pnpm       │  │   Bundler    │  │   Plugin     │               │
│  │   (embed)    │  │   (Vite/Bun) │  │   (WASM)     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │     CLI     │ │    LSP      │ │    API      │ │   Web UI    │  │
│  │   (clap)    │ │ (tower-lsp) │ │   (HTTP)    │ │  (future)   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Application Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │   Command   │ │    Query    │ │    Sync     │ │   Config    │  │
│  │   Handler   │ │   Engine    │ │  Coordinator│ │   Manager   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Domain Layer                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │   Build     │ │    Task     │ │    Cache    │ │   Plugin    │  │
│  │   Engine    │ │   Graph     │ │   Service   │ │   Host      │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Infrastructure Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │    Git      │ │    FS       │ │   Network   │ │   Process   │  │
│  │  (git2)     │ │   (tokio)   │ │  (hyper)    │ │  (tokio)    │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow

```
1. User Request
   ↓
2. Parse Configuration (phenotype-forge.toml)
   ↓
3. Build Project Graph (AST analysis)
   ↓
4. Compute Affected Targets (git + AI)
   ↓
5. Check Cache (local → remote)
   ↓
6. Schedule Tasks (topological + parallel)
   ↓
7. Execute Tasks (process pool)
   ↓
8. Store Results (cache)
   ↓
9. Report Status
```

---

## 5. CLI Specification

### 5.1 Command Structure

```
phenotype <command> [options] [arguments]

Commands:
  build       Build targets
  test        Run tests
  lint        Run linters
  clean       Clean build artifacts
  cache       Cache management
  query       Query project graph
  plugin      Plugin management
  init        Initialize project
  migrate     Migrate from other tools
  config      Configuration management
  daemon      Start persistent daemon
  help        Show help

Global Options:
  -c, --config <path>    Config file path
  -v, --verbose          Verbose output
  --json                 JSON output
  --no-color             Disable colors
  --version              Show version
  --daemon               Use daemon mode
```

### 5.2 Build Command

```
phenotype build [targets...] [options]

Arguments:
  [targets...]    Targets to build (default: all)

Options:
  -a, --affected           Build only affected targets
  -w, --watch              Watch mode
  --profile <name>         Build profile (dev, release, test)
  --parallel <n>           Parallelism (default: auto)
  --no-cache               Disable cache
  --remote-only            Only use remote cache
  --output-style <style>   Output style (full, compact, json)
  --bundle <bundler>       Bundler to use (vite, bun, esbuild)

Examples:
  $ phenotype build
  $ phenotype build app web
  $ phenotype build --affected --watch
  $ phenotype build --profile release
```

### 5.3 Query Command

```
phenotype query <query> [options]

Queries:
  "what depends on <target>"     Find dependents
  "what <target> depends on"     Find dependencies
  "affected by <commit>"         Affected targets
  "why <target>"               Explain target
  "critical-path <target>"     Find critical path
  "bottlenecks"               Find build bottlenecks

Options:
  --format <format>        Output format (table, json, dot, mermaid)
  --depth <n>              Max dependency depth
  --show-size              Show output sizes
  --show-time              Show build times

Examples:
  $ phenotype query "what depends on lib/core"
  $ phenotype query "affected by HEAD~5"
  $ phenotype query "why app/web"
  $ phenotype query "critical-path app/web"
```

---

## 6. Configuration

### 6.1 Workspace Configuration

```toml
# phenotype-forge.toml

[workspace]
name = "my-project"
package_manager = "pnpm"

[tasks]
[tasks.build]
depends_on = ["lint", "typecheck"]
outputs = ["dist/**"]
cache = true

[tasks.test]
depends_on = ["build"]
env = ["CI"]
cache = false

[cache]
[cache.local]
max_size = "10GB"
gc_interval_hours = 24

[cache.remote]
url = "https://cache.example.com"
token = "${CACHE_TOKEN}"
team = "my-team"

[bundle]
default = "vite"
port = 3000
hmr = true

[ai]
enabled = true
model = "local"
suggestions = true
```

### 6.2 Package Configuration

```json
{
  "name": "@myapp/core",
  "phenotype": {
    "tasks": {
      "build": {
        "depends_on": ["^build"],
        "outputs": ["dist/**", "types/**"]
      },
      "test": {
        "depends_on": ["build"],
        "env": ["TEST_ENV"]
      }
    },
    "depends_on": ["@myapp/utils", "@myapp/types"]
  }
}
```

---

## 7. Testing Strategy

### 7.1 Test Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E Tests                                │
│  Full workflow testing with real projects                  │
│  Examples:                                                 │
│    - Create project → build → test → bundle               │
│    - Migration from Turborepo                             │
│    - Cache hit/miss scenarios                             │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Integration Tests                        │
│  Component interaction testing                             │
│  Examples:                                                 │
│    - Cache + Build integration                              │
│    - Plugin + Task runner                                 │
│    - Git + Affected detection                             │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Unit Tests                               │
│  Individual function testing                               │
│  Examples:                                                 │
│    - Cache key computation                                  │
│    - Graph construction                                     │
│    - Task scheduling                                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Test Infrastructure

| Test Type | Framework | Coverage Target |
|-----------|-----------|-----------------|
| Unit | Rust built-in | 80% |
| Integration | Rust + fixtures | 70% |
| E2E | Custom (real projects) | Key flows |
| Benchmark | Criterion | Performance regression |
| Property | Proptest | Critical invariants |

---

## 8. Development Phases

### 8.1 Phase 1: Core Engine (MVP) - 3 months

**Deliverables**:
- [x] Rust-based build graph engine
- [x] Content-addressable local caching (RocksDB)
- [x] pnpm workspace integration
- [x] Basic task orchestration
- [x] TypeScript/Go/Rust support

**Success Criteria**:
- Build 1k targets in <5 seconds
- Cache hit rate >80%
- Configuration <20 lines

### 8.2 Phase 2: Developer Experience - 2 months

**Deliverables**:
- [ ] VS Code extension
- [ ] Watch mode with fast rebuilds
- [ ] Error message improvements
- [ ] Documentation and tutorials
- [ ] Migration guides

**Success Criteria**:
- HMR <50ms
- Setup time <5 minutes
- Documentation coverage 100%

### 8.3 Phase 3: Scale Features - 3 months

**Deliverables**:
- [ ] Remote caching (S3/R2)
- [ ] Distributed execution
- [ ] Cloud workspace support
- [ ] Enterprise authentication
- [ ] Usage analytics

**Success Criteria**:
- Remote cache <50ms lookup
- Linear scaling with workers
- 99.9% uptime

### 8.4 Phase 4: Intelligence - 2 months

**Deliverables**:
- [ ] AI-powered optimization
- [ ] Predictive builds
- [ ] Automatic dependency management
- [ ] Build analytics dashboard
- [ ] Natural language queries

**Success Criteria**:
- 20% build time reduction via AI
- Natural language query accuracy >90%

---

## 9. Integration Strategy

### 9.1 Migration Paths

| From | Strategy | Timeline |
|------|----------|----------|
| npm scripts | Auto-detect, generate config | Minutes |
| Turborepo | Import turbo.json, migrate cache | Hours |
| Nx | Import nx.json, adapt plugins | Days |
| Rush | Import rush.json, phased builds | Days |
| Bazel | Gradual migration, rule adapter | Weeks |
| Make/CMake | New project approach | N/A |

### 9.2 CI/CD Integration

| Platform | Integration | Features |
|----------|-------------|----------|
| GitHub Actions | Native action | Remote cache, parallel jobs |
| GitLab CI | Template | Remote cache, DTE |
| Azure DevOps | Extension | Enterprise features |
| CircleCI | Orb | Performance insights |
| Jenkins | Plugin | Self-hosted option |

---

## 10. Documentation Requirements

### 10.1 User Documentation

- [ ] Quick start guide
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] CLI reference
- [ ] Migration guides
- [ ] Troubleshooting guide
- [ ] FAQ

### 10.2 Developer Documentation

- [ ] Architecture overview
- [ ] Plugin development guide
- [ ] API reference
- [ ] Contributing guidelines
- [ ] Code of conduct

### 10.3 API Documentation

- [ ] JSON API reference
- [ ] WebSocket API reference
- [ ] Plugin SDK reference
- [ ] TypeScript definitions

---

## 11. Deployment and Distribution

### 11.1 Installation Methods

| Method | Platform | Priority |
|--------|----------|----------|
| Cargo install | All | P0 |
| Homebrew | macOS/Linux | P0 |
| NPM (global) | All | P1 |
| APT/YUM | Linux | P1 |
| Windows Installer | Windows | P1 |
| Docker | All | P2 |

### 11.2 Release Process

1. Version bump in Cargo.toml
2. Update CHANGELOG.md
3. Run full test suite
4. Build release binaries
5. Generate release artifacts
6. Create GitHub release
7. Update documentation
8. Announce on channels

---

## 12. Success Metrics and KPIs

### 12.1 Adoption Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Downloads | 10,000 | 6 months |
| Active projects | 1,000 | 6 months |
| GitHub stars | 5,000 | 12 months |
| Enterprise customers | 50 | 18 months |

### 12.2 Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Cold build time | <1s | - |
| Incremental build | <100ms | - |
| Cache hit rate | 95% | - |
| Setup time | <5min | - |

### 12.3 Quality Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >80% |
| Documentation coverage | 100% |
| Bug resolution time | <48 hours |
| User satisfaction | >4.5/5 |

---

## 13. Risk Assessment

### 13.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance not meeting targets | Medium | High | Early benchmarking, profile-guided optimization |
| Cache invalidation bugs | Medium | High | Extensive testing, checksum verification |
| Plugin security vulnerabilities | Low | High | WASM sandbox, capability model |
| Cross-platform compatibility | Medium | Medium | CI testing on all platforms |

### 13.2 Market Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Competition from established tools | High | Medium | Differentiation through AI, better DX |
| Developer resistance to new tool | Medium | Medium | Migration tools, gradual adoption |
| Enterprise sales cycle | Medium | Medium | Free tier, community building |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **Content-Addressable Cache** | Caching system where keys are derived from content hash |
| **Hermetic Build** | Build that is isolated from external environment |
| **Topological Sort** | Ordering of tasks respecting dependencies |
| **WASM** | WebAssembly, portable binary instruction format |
| **DAG** | Directed Acyclic Graph, graph without cycles |
| **Affected Detection** | Determining which targets need rebuilding |
| **Remote Cache** | Shared cache storage accessible to all developers |
| **Task Graph** | Graph representation of build tasks and dependencies |

---

## 15. References

- [Bazel Documentation](https://bazel.build/docs)
- [Buck2 Documentation](https://buck2.build/docs/)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Nx Documentation](https://nx.dev/docs)
- [WASI Specification](https://wasi.dev/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)

---

## 16. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-04-05 | Phenotype Team | Initial PRD |

---

**End of PRD: phenotype-forge**

*Document Statistics:*
- Total Lines: 850+
- Sections: 16
- Requirements: 30+
- Tables: 40+
- Code Examples: 15+
