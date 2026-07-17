# ADR: craft — Schema-First Code Generation

## ADR-001: YAML/JSON Schema over Custom DSL

**Status**: Accepted

**Context**: Code generation tools often define custom DSLs (Prisma schema, GraphQL SDL). Should craft use an existing format or define its own?

**Decision**: YAML and JSON schema formats. No custom DSL in v1.

**Rationale**: YAML/JSON have universal tooling (syntax highlighting, linting, validation). A custom DSL requires parser implementation and editor plugins. YAML is human-friendly enough for entity definitions.

**Consequences**: Schema is less terse than a purpose-built DSL. Advanced features (relationships, mixins) are more verbose. A DSL migration path can be added in v2.

---

## ADR-002: Handlebars Templates over Code-in-Code Generation

**Status**: Accepted

**Context**: Generators can use string interpolation, AST manipulation, or template engines. Choices: hardcoded string concatenation, Handlebars, Tera (Rust), Jinja2.

**Decision**: Handlebars templates for all language generators.

**Rationale**: Handlebars is available in both Rust (handlebars-rust) and TypeScript (handlebars.js). Templates are user-overridable without modifying craft source. Familiar to most engineers.

**Consequences**: Template logic is more limited than full code generation ASTs. For complex cases (e.g., conditional imports), templates may become complex. Acceptable for v1 scope.

---

## ADR-003: Manifest File for Stale Cleanup

**Status**: Accepted

**Context**: When an entity is removed from the schema, its generated files should be deleted. Without tracking, stale files accumulate.

**Decision**: craft writes `.craft-manifest.json` on every generation, listing all output files. On next run, files in the previous manifest that are not in the current run are deleted.

**Rationale**: Deterministic stale cleanup without scanning the entire output directory. Manifest is human-readable for debugging.

**Consequences**: `.craft-manifest.json` must be committed to version control or craft must regenerate from scratch in CI.
