# CLAUDE.md - AI Context for Portalis

## Repository Overview

**Name:** Portalis
**Type:** Phenotype Ecosystem Component
**AI Attribution:** AI-Generated with Human Review

## Purpose

This repository is part of the Phenotype organization ecosystem, implementing
[describe specific purpose here based on repository name and function].

## Key Concepts

- [ ] Concept 1: [Description]
- [ ] Concept 2: [Description]
- [ ] Concept 3: [Description]

## Architecture

### Components
- Component A: [Description]
- Component B: [Description]

### Data Flow
1. Input → Processing → Output
2. [Additional flow steps]

## Development Guidelines

### Code Style
- Follow language-specific conventions
- Maintain traceability to FRs (FR-XXX-NNN format)
- Include tests with FR annotations

### FR Traceability
All code changes must reference Feature Requirements:
- Use @pytest.mark.traces_to("FR-XXX-NNN") for Python
- Use #[trace_to("FR-XXX-NNN")] for Rust
- Use tracesTo("FR-XXX-NNN") for Go/TypeScript

## Testing

### Test Framework
- [Framework name and version]

### Running Tests
```bash
# Run all tests
[command]

# Run with FR traceability check
./AgilePlus/bin/ptrace analyze --path . --lang auto
```

## Dependencies

- [Dependency 1]: [Purpose]
- [Dependency 2]: [Purpose]

## Related Repositories

- [repo-name]: [Relationship]

## AI Development Notes

- This repository uses AI-assisted development
- All AI-generated code is traceable via .phenotype/ai-traceability.yaml
- See AGENTS.md for specific agent rules

Last Updated: 2026-04-04
