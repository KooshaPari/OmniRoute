# PRD: craft — Schema-First Code Generation Tool

## Overview
`craft` is a schema-first code generation CLI. It reads a YAML/JSON schema describing data entities and generates type-safe implementations in Rust, TypeScript, and Go from a single source of truth.

## Problem Statement
Teams maintaining polyglot codebases (Rust services, TypeScript frontends, Go tools) must manually keep data models synchronized across languages. A schema change in one language requires coordinated updates in 3+ places. `craft` automates this.

## Goals
1. Single schema definition drives multi-language output
2. Customizable templates per language and output type
3. Watch mode for development (regenerate on schema change)
4. Incremental generation (only regenerate changed entities)
5. Plugin system for custom generators

## Epics

### E1: Schema Language
- E1.1: YAML and JSON schema format
- E1.2: Entity definitions (fields, types, constraints)
- E1.3: Relationship definitions (has-one, has-many, belongs-to)
- E1.4: Enum definitions
- E1.5: Import/extension (schema composition)

### E2: Code Generators
- E2.1: Rust: structs, enums, serde impls, builder patterns
- E2.2: TypeScript: interfaces, types, Zod/model schemas
- E2.3: Go: structs, json tags, validation methods
- E2.4: SQL: CREATE TABLE DDL
- E2.5: OpenAPI 3.1: schema components

### E3: CLI
- E3.1: `craft generate` — one-shot generation
- E3.2: `craft watch` — file-watch and regenerate
- E3.3: `craft validate` — validate schema without generating
- E3.4: `craft diff` — show what would change

### E4: Template System
- E4.1: Handlebars-based templates for each generator
- E4.2: User-overridable templates per project
- E4.3: Template inheritance and partials

### E5: Plugin System
- E5.1: Plugin trait for custom generators
- E5.2: Plugin discovery via `craft.config.yaml`
- E5.3: Plugin versioning and compatibility checks
