# Phantom Submodule Cleanup Audit

**Date:** 2026-06-26 09:45 PDT

## Affected Repos

`git submodule status` shows phantom gitlinks in:
1. **Sidekick** — `crates/sidekick-dispatch` (gitlink in index but no `.gitmodules`)
2. **cheap-llm-mcp** — self-deprecated; submodule entries stale
3. **agent-user-status** — phantom gitlink in `.gitmodules`
4. **dispatch-mcp** — submodule cleanup needed
5. **thegent-dispatch** — orphan submodule refs

## Pattern

Each affected repo has:
- Gitlink in index pointing to a phantom submodule
- No matching entry in `.gitmodules`
- `git submodule status` returns fatal: `no submodule mapping found in .gitmodules for path '<name>'`

## Remediation

For each affected repo:
```bash
git rm --cached <phantom-dir>
echo "<phantom-dir>/" >> .gitignore
git commit -m "fix(submodules): remove phantom gitlink <name>"
```

## Deferred

This is deferred to a separate cleanup session. Not blocking v40 closure.

Refs: submodule cleanup, v40 Wave C, cycle-30
