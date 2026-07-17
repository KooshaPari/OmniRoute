# AGENTS.md - Agent Rules for Portalis

## Agent Roles

### Primary Agents

| Agent | Responsibility | Allowed Operations |
|-------|---------------|-------------------|
| FORGE | Code implementation | Write, Patch, Shell |
| AGENT | Task execution | Shell, Search, Read |
| MUSE | Documentation | Write, Read |

## Governance Rules

### Mandatory Checks

1. **FR Traceability**
   - All tests MUST reference FR-XXX-NNN
   - Use: @pytest.mark.traces_to() / #[trace_to()] / tracesTo()

2. **AI Attribution**
   - .phenotype/ai-traceability.yaml MUST exist
   - MUST be updated on every AI-generated change

3. **CI/CD Compliance**
   - .github/workflows/traceability.yml MUST pass
   - No merges with drift > 90%

4. **Code Quality**
   - All code MUST have corresponding tests
   - Minimum 80% coverage for new code

### Prohibited Actions

- ❌ Delete without read first
- ❌ Modify without FR reference
- ❌ Skip validation on merge

## File Operations

### Allowed Patterns

- Read → Patch (sequential)
- Write (new files only)
- Shell (non-destructive)

### Forbidden Patterns

- Write (overwrite without read)
- Shell (rm -rf, destructive)

## Repository-Specific Rules

### Portalis Specific

- [Add repo-specific rules here]

## Validation

Run before any commit:
```bash
python3 validate_governance.py
```

Must pass all checks before PR.

---

Last Updated: 2026-04-04
