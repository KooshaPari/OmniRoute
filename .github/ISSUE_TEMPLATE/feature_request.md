<!--
  Feature Request — OmniRoute
  ===========================
  Use this template to propose a new feature, improvement, or significant
  refactor. For bug reports use `bug_report.yml`. For scoped coverage work
  use `test_coverage_task.yml`.
-->

## Summary

<!-- A one-paragraph description of the feature. What user-facing or
     operational change does this unlock? -->

## Problem / Motivation

<!-- What pain point or limitation does this address? Link any related
     issues, discussions, or upstream PRs. -->

## Proposed Solution

<!-- Describe the desired behavior. Include code samples, API shapes,
     config snippets, or UI mockups where helpful. -->

### Alternatives Considered

<!-- What other approaches were considered, and why is this the preferred
     one? -->

## Impact

<!-- Which surfaces does this touch? Mark all that apply. -->

- [ ] API surface (`src/app/api/**`)
- [ ] Provider executor (`open-sse/executors/**`)
- [ ] MCP server / A2A skills
- [ ] Database schema (requires a new migration)
- [ ] Web UI / dashboard
- [ ] Electron desktop app
- [ ] Documentation (`docs/**`)
- [ ] Other (describe below)

## Validation Plan

<!-- Which commands, tests, or manual steps must pass before this
     can be merged? -->

- [ ] `npm run lint`
- [ ] `npm run typecheck:core`
- [ ] `npm run test:unit`
- [ ] `npm run test:coverage` (coverage gate >= 60%)
- [ ] Manual smoke test of the affected surface
- [ ] New automated test added (if behavior is testable)

## Backwards Compatibility

<!-- Does this change break any existing config, API contract, or
     persisted data? If so, describe the migration path. -->

- [ ] Fully backwards compatible
- [ ] Requires a feature flag or opt-in
- [ ] Requires a migration (describe)

## Additional Context

<!-- Links to design docs, related ADRs, external references, or
     screenshots. -->
