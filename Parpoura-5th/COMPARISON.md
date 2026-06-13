# Comparison Matrix

## Feature Comparison

This document compares **parpour** with similar tools in the spec-first planning and architecture space.

| Repository | Purpose | Key Features | Language/Framework | Maturity | Comparison |
|------------|---------|--------------|-------------------|----------|------------|
| **parpour (this repo)** | Spec-first planning | Deterministic specs, Architecture docs, Development guides | Markdown/Task | Stable | Spec-first approach |
| [Arc42](https://github.com/arc42/arc42) | Architecture documentation | Template-based, Structured approach | Markdown | Stable | Industry standard |
| [ADR](https://github.com/joelparkergit/adr-tools) | Architecture decision records | Markdown ADRs, Tools | Shell | Stable | Decision tracking |
| [MKDocs](https://github.com/mkdocs/mkdocs) | Documentation sites | Static site generator, Search | Python | Stable | Documentation platform |
| [VuePress](https://github.com/vuejs/vuepress) | Documentation | Vue-based, Markdown | JavaScript | Stable | Documentation platform |
| [VitePress](https://github.com/vuejs/vitepress) | Documentation | Vite-based, Markdown | TypeScript | Stable | Modern alternative |

## Detailed Feature Comparison

### Documentation Structure

| Feature | parpour | Arc42 | ADR | MkDocs | VitePress |
|---------|---------|-------|-----|--------|-----------|
| Architecture Docs | ✅ | ✅ | ❌ | ✅ | ✅ |
| Spec Templates | ✅ | ✅ | ❌ | ❌ | ❌ |
| Decision Records | ✅ | ✅ | ✅ | ❌ | ❌ |
| Development Guides | ✅ | ✅ | ❌ | ✅ | ✅ |
| Roadmap | ✅ | ❌ | ❌ | ❌ | ✅ |

### Canonical Specs

| Spec | parpour | Arc42 | ADR Tools |
|------|---------|-------|----------|
| TECHNICAL_SPEC.md | ✅ | ✅ (via template) | ❌ |
| PLAN.md | ✅ | ❌ | ❌ |
| FUNCTIONAL_REQUIREMENTS.md | ✅ | ❌ | ❌ |
| USER_JOURNEYS.md | ✅ | ❌ | ❌ |
| SPECS_INDEX.md | ✅ | ❌ | ❌ |

### Build & Documentation

| Feature | parpour | MkDocs | VuePress | VitePress |
|---------|---------|--------|----------|-----------|
| Static Site Generation | ✅ | ✅ | ✅ | ✅ |
| Search | Via VitePress | ✅ (built-in) | ✅ | ✅ |
| Doc Index | ✅ | ❌ | ❌ | ❌ |
| Custom Theme | ✅ (via phenotype-design) | ✅ | ✅ | ✅ |

## Unique Value Proposition

parpour provides:

1. **Spec-First Approach**: Deterministic specs drive development
2. **Canonical Structure**: Consistent documentation hierarchy across projects
3. **Deterministic Planning**: Venture/control-plane systems focus
4. **Phenotype Integration**: Part of the Phenotype ecosystem

## Repository Structure

```
parpour/
├── docs/
│   ├── wiki/              # Architecture and domain knowledge
│   ├── development-guide/ # Engineering workflows
│   ├── document-index/    # Generated inventory
│   ├── api/              # Interface docs
│   └── roadmap/          # Delivery milestones
├── TECHNICAL_SPEC.md
├── PLAN.md
├── FUNCTIONAL_REQUIREMENTS.md
├── USER_JOURNEYS.md
└── SPECS_INDEX.md
```

## When to Use What

| Use Case | Recommended Tool |
|----------|-----------------|
| Deterministic venture/control-plane specs | parpour |
| General architecture documentation | Arc42 |
| Architecture decision tracking | ADR Tools |
| Documentation sites | MkDocs, VitePress |

## References

- Arc42: [arc42/arc42](https://github.com/arc42/arc42)
- ADR Tools: [joelparker_git/adr-tools](https://github.com/joelparker_git/adr-tools)
- MkDocs: [mkdocs/mkdocs](https://github.com/mkdocs/mkdocs)
- VitePress: [vuejs/vitepress](https://github.com/vuejs/vitepress)
