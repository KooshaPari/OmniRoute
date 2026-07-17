# phenoForge Charter

## 1. Mission Statement

**phenoForge** is a build system, package manager, and development environment orchestrator designed specifically for the Phenotype ecosystem. The mission is to provide a unified, fast, and reliable build experience that understands the unique requirements of Phenotype projects—enabling reproducible builds, efficient caching, and seamless cross-compilation across the diverse technologies used within the ecosystem.

The project exists to eliminate build friction by providing intelligent defaults, aggressive optimization, and first-class support for the polyglot nature of the Phenotype ecosystem—transforming build processes from painful bottlenecks into seamless accelerators of developer productivity.

---

## 2. Tenets (Unless You Know Better Ones)

### Tenet 1: Build Reproducibility

Same inputs, same outputs. Deterministic builds. Locked dependencies. Hermetic builds. Reproducible or nothing. Build outputs are a pure function of inputs—no environmental variations, no timing dependencies, no implicit state.

### Tenet 2. Aggressive Caching

Cache everything possible. Remote caching. Local caching. Cache hits fast. Cache keys precise. Build once, reuse everywhere. Cache is not an optimization; it's a fundamental strategy. Cache invalidation is correct or the cache is broken.

### Tenet 3. Fast Incremental Builds

Only build what changed. Dependency tracking. Fine-grained invalidation. Watch mode. Fast feedback. Developers shouldn't wait for the world to rebuild when they change one file. Incremental builds are the default, not an option.

### Tenet 4. Polyglot Support

Rust. TypeScript. Go. Python. Java. All first-class. Consistent interface. Language-appropriate defaults. No second-class citizens. Each language gets the same level of optimization and care. A unified interface across heterogeneous codebases.

### Tenet 5. Developer Experience

Clear error messages. Progress indication. IDE integration. Auto-completion. Debugging support. Pleasant to use. Build systems are tools developers use constantly—poor experience compounds. Every interaction should feel polished.

### Tenet 6. Cross-Compilation

Build for any target from any host. Cross-compilation easy. Target management. Toolchain management. Platform flexibility. Write once, build everywhere. Target diversity should not create friction.

### Tenet 7. Extensibility

Custom build rules. Custom toolchains. Plugin system. Integration points. Adaptable to unique needs. The build system is a platform. Extension points are first-class. Community contributions welcomed.

---

## 3. Scope & Boundaries

### In Scope

**Build System Core:**
- Build graph construction and validation
- Incremental build computation
- Parallel task execution with dependency ordering
- Fine-grained dependency tracking at file and symbol level
- Task orchestration and scheduling
- Build action sandboxing for hermeticity

**Package Management:**
- Dependency fetching from multiple registries
- Semantic version resolution with lock file management
- Private registry support for internal packages
- Package publishing with verification
- Vulnerability scanning integration
- Dependency deduplication and optimization

**Caching Infrastructure:**
- Local content-addressable build cache
- Remote distributed build cache
- Cache key calculation with content hashing
- Cache optimization and compression
- Intelligent cache eviction policies
- Cache hit rate analytics

**Language Integration:**
- Rust with Cargo integration and workspace support
- TypeScript/JavaScript with npm/pnpm/yarn compatibility
- Go with full modules support
- Python with pip/uv/rye integration
- Java with Maven/Gradle compatibility
- C/C++ with compiler abstraction

**Cross-Compilation:**
- Target triple management
- Toolchain auto-detection and configuration
- Cross-compilation rule definitions
- Platform-specific dependency handling
- Emulation support for testing

**Development Features:**
- Watch mode for continuous rebuild
- Hot reload for development servers
- Progress reporting and build analytics
- Parallel test execution
- Coverage integration
- Benchmark integration

### Out of Scope

- IDE editor features (integration only)
- Container image building (use Docker, BuildKit)
- Production deployment orchestration
- Source control operations (use Git)
- Package registry hosting (integrate with existing)

### Boundaries

- Build orchestration, not direct compilation
- Package management, not registry operation
- Caching infrastructure, not general storage
- Developer tool, not production runtime service

---

## 4. Target Users & Personas

### Primary Persona: Developer Drew

**Role:** Developer building daily across the Phenotype ecosystem
**Goals:** Fast incremental builds, clear error messages, reliable caching
**Pain Points:** Slow full rebuilds, unclear build failures, cache misses, inconsistent behavior
**Needs:** Sub-second incremental builds, actionable errors, warm remote cache
**Tech Comfort:** High, uses multiple languages daily

### Secondary Persona: CI/CD Engineer Casey

**Role:** CI/CD pipeline maintainer optimizing build infrastructure
**Goals:** Reproducible builds, effective remote caching, fast CI pipelines
**Pain Points:** CI build flakes, cache misses between CI runs, slow pipelines
**Needs:** Hermetic builds, remote cache population, deterministic outputs
**Tech Comfort:** Very high, CI infrastructure expert

### Tertiary Persona: Release Engineer Rick

**Role:** Release manager handling multi-platform releases
**Goals:** Reliable release builds, cross-platform compilation, reproducible artifacts
**Pain Points:** Platform-specific build issues, inconsistent release artifacts
**Needs:** Cross-compilation support, reproducible builds, artifact verification
**Tech Comfort:** High, release process expert

### Quaternary Persona: Platform Engineer Pia

**Role:** Platform team standardizing build processes across organization
**Goals:** Consistent build experience, enforceable standards, custom rules
**Pain Points:** Inconsistent build processes across teams, lack of customization
**Needs:** Extensible rules, organization-wide configuration, custom toolchains
**Tech Comfort:** Very high, platform tooling expert

### Quinary Persona: New Contributor Nina

**Role:** New contributor to Phenotype project
**Goals:** Easy setup, clear documentation, fast first build
**Pain Points:** Complex setup, unclear build requirements, long initial builds
**Needs:** Simple installation, clear getting started guide, fast onboarding
**Tech Comfort:** Medium, learning the ecosystem

---

## 5. Success Criteria (Measurable)

### Performance Metrics

- **Incremental Build Speed:** <1 second for single file changes
- **Cache Hit Rate:** 85%+ for CI builds with warm cache
- **Remote Cache Latency:** <100ms cache hit from remote
- **Cold Build Performance:** Within 10% of native build tools
- **Parallel Efficiency:** 90%+ CPU utilization during parallel builds

### Reliability Metrics

- **Reproducibility:** 99.9%+ reproducible builds (bit-identical outputs)
- **Flake Rate:** <0.5% flaky build rate in CI
- **Success Rate:** 99.5%+ successful builds (excluding code errors)
- **Recovery Time:** <30 seconds from incremental build failure
- **Cache Consistency:** Zero cache corruption incidents

### Developer Experience Metrics

- **Setup Time:** <5 minutes from install to first successful build
- **Error Clarity:** 95%+ of build errors have actionable messages
- **Documentation Coverage:** 100% of features documented with examples
- **IDE Integration:** Working integration for VS Code, JetBrains, Vim
- **Satisfaction Score:** 4.5/5+ developer satisfaction rating

### Adoption Metrics

- **Ecosystem Coverage:** 100% of Phenotype projects using phenoForge
- **Language Support:** All 5+ target languages fully supported
- **Platform Coverage:** Linux, macOS, Windows fully supported
- **Remote Cache Adoption:** 80%+ of CI builds using remote cache

---

## 6. Governance Model

### Component Organization

```
phenoForge/
├── core/                # Build graph and execution
│   ├── graph/           # Dependency graph construction
│   ├── scheduler/       # Task scheduling and parallelization
│   ├── executor/        # Build action execution
│   ├── sandbox/         # Hermetic build sandboxing
│   └── incrementality/  # Incremental build computation
├── cache/               # Caching system
│   ├── local/           # Local content-addressable cache
│   ├── remote/          # Remote cache client
│   ├── keys/            # Cache key calculation
│   ├── eviction/        # Cache eviction policies
│   └── analytics/       # Cache hit rate analytics
├── fetch/               # Package fetching
│   ├── registry/        # Registry clients
│   ├── resolution/      # Version resolution
│   ├── locking/         # Lock file management
│   └── verification/    # Package verification
├── rules/               # Build rules
│   ├── builtin/         # Built-in language rules
│   ├── custom/          # Custom rule framework
│   └── plugins/         # Plugin rule loading
├── toolchain/           # Toolchain management
│   ├── detection/       # Toolchain auto-detection
│   ├── installation/    # Toolchain installation
│   ├── cross/           # Cross-compilation support
│   └── management/      # Toolchain versioning
├── config/              # Configuration
│   ├── parsing/         # Config file parsing
│   ├── validation/      # Configuration validation
│   └── defaults/        # Sensible defaults
├── cli/                 # CLI interface
│   ├── commands/        # Command implementations
│   ├── output/          # Output formatting
│   └── progress/        # Progress reporting
└── ide/                 # IDE integration
    ├── lsp/             # Language server protocol
    ├── sync/            # IDE synchronization
    └── debug/           # Debugging support
```

### Development Process

**New Language Support:**
- Language ecosystem research
- Build tool integration design
- Rule implementation
- Incrementality analysis
- Testing across platforms
- Documentation and examples

**New Build Rules:**
- Reproducibility testing protocol
- Performance benchmarking
- Incremental behavior verification
- Documentation requirements
- Migration guide if replacing existing

**Cache System Changes:**
- Backward compatibility assessment
- Cache invalidation testing
- Migration testing for cache format changes
- Performance impact validation
- Documentation updates

---

## 7. Charter Compliance Checklist

### For New Language Support

- [ ] Build tool integration working
- [ ] Incremental builds functional
- [ ] Caching enabled and tested
- [ ] Cross-compilation supported (if applicable)
- [ ] Documentation complete with examples
- [ ] Tests pass on all target platforms

### For New Build Rules

- [ ] Reproducibility verified across platforms
- [ ] Performance benchmarked vs. alternatives
- [ ] Incremental behavior tested
- [ ] Documentation complete
- [ ] Backward compatibility maintained or migration provided

### For Cache Changes

- [ ] Backward compatibility assessed
- [ ] Invalidation tested thoroughly
- [ ] Migration tested (if format changes)
- [ ] Performance validated
- [ ] Documentation updated

### For CLI Changes

- [ ] Help text updated
- [ ] Shell completion updated
- [ ] Error messages clear and actionable
- [ ] Documentation updated
- [ ] Breaking changes noted with migration

---

## 8. Decision Authority Levels

### Level 1: Maintainer Authority

**Scope:** Bug fixes, rule improvements, performance optimizations, documentation
**Process:** Maintainer approval
**Examples:** Cache eviction tuning, error message improvement

### Level 2: Feature Authority

**Scope:** New build rules, new CLI features, new toolchain support
**Process:** Technical review, reproducibility verification
**Examples:** New language integration, new CLI command

### Level 3: Architecture Authority

**Scope:** Core build graph changes, cache architecture changes, rule API changes
**Process:** Written ADR, compatibility assessment, steering approval
**Examples:** New build graph algorithm, cache format v2, rule API change

### Level 4: Language Support Authority

**Scope:** New language ecosystem support, major toolchain changes
**Process:** Deep ecosystem analysis, long-term support commitment, steering approval
**Examples:** New programming language support, major Cargo/Gradle version

### Level 5: Strategic Authority

**Scope:** Project direction, commercial model, major ecosystem partnerships
**Process:** Executive decision with technical input
**Examples:** Enterprise features, cloud service integration, vendor partnerships

---

## 9. Security & Compliance Considerations

### Build Security

- Hermetic builds prevent supply chain attacks
- Sandbox execution of build actions
- No network access during builds (unless explicitly allowed)
- Reproducible builds enable verification

### Cache Security

- Cache entries signed for integrity
- Remote cache access controlled
- No sensitive data in cache keys
- Cache poisoning detection

### Supply Chain

- Dependency vulnerability scanning
- Lock file integrity verification
- Reproducible dependency fetching
- Audit logging for package operations

### Compliance

- SBOM generation for builds
- License compliance checking
- Build provenance tracking
- Audit trails for compliance reporting

---

## 10. Operational Guidelines

### Cache Management

- Regular cache health checks
- Cache size monitoring and limits
- Cache warming for CI optimization
- Cache eviction policies tuned to workload

### Performance Optimization

- Profile-guided optimization based on real builds
- Critical path analysis for build graphs
- Resource utilization monitoring
- Performance regression detection in CI

### Release Process

- Semantic versioning with clear compatibility guarantees
- Beta channels for early adopters
- Migration guides for breaking changes
- Long-term support for major versions

---

## 11. Integration Points

### Phenotype Ecosystem

- **AgilePlus:** Build and release tracking
- **pheno-credentials:** Secure credential injection during builds
- **pheno-caching:** Shared caching infrastructure
- **cliproxy:** CLI integration for build commands
- **phenodocs:** Documentation building and deployment

### External Integrations

- **GitHub Actions:** CI integration
- **GitLab CI:** Alternative CI integration
- **Jenkins:** Enterprise CI integration
- **Nix:** Reproducibility collaboration
- **Bazel:** Large-scale build inspiration

### Registry Integration

- **crates.io:** Rust package registry
- **npm registry:** JavaScript packages
- **PyPI:** Python packages
- **Go proxy:** Go modules
- **Maven Central:** Java artifacts
- **Private registries:** Organization-specific packages

---

*This charter governs phenoForge, the build system. Fast, reliable, reproducible builds accelerate development.*

*Last Updated: April 2026*
*Next Review: July 2026*
