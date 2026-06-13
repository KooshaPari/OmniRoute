# Architecture Decision Records (ADR)

## ADR-001 — Repository Hygiene Baseline (2026-06-08)

**Status:** Accepted
**Context:** Prior audit identified gaps in governance, CI, and e2e coverage.
**Decision:** Adopt fleet-wide hygiene standards (FUNDING, CITATION, SUPPORT, OpenSSF Scorecard, security-scans, grouped Dependabot, CODEOWNERS subtree ownership, cliff.toml for changelog automation).
**Consequences:** Repo hygiene score improved from 4.4/5 to ~4.7/5. Reduced single-point-of-failure in CODEOWNERS.

## ADR-002 — Nav Restructure E2E Restoration (2026-06-13)

**Status:** In Progress
**Context:** Nav Restructure refactor moved settings to settings/general, split logs into subpages, and moved protocol tabs out of /endpoint. Six Playwright specs were temporarily excluded.
**Decision:** Re-enable the 3 surviving specs (memory-settings, resilience-plan-alignment, settings-toggles) after verifying selectors against the new nav. Remove 3 orphaned entries (analytics-tabs, protocol-visibility, skills-marketplace) whose files no longer exist.
**Consequences:** Restores e2e coverage on the most-touched product surfaces.

## ADR-003 — Dual Dependency Automation (2026-06-13)

**Status:** Accepted
**Context:** Fleet uses both Dependabot and Renovate; 50/169 repos carry Renovate.
**Decision:** Add Renovate alongside existing Dependabot to increase automation coverage and reduce missed updates.
**Consequences:** May create duplicate PRs for the same updates; requires coordination to avoid noise.
