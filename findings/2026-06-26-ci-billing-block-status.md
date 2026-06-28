# CI Billing Block — Status

**Date:** 2026-06-26 09:45 PDT

## Status: BLOCKED (org-wide)

GitHub Actions billing blocked across the org (per `STATUS.md:6`). Workflows enrolled and configured but not running due to billing-tier limits.

## Affected Workflows (all org repos)

- `pillar-checks.yml` (workflow files ready, not running)
- `claude-code-review.yml`
- `dependabot.yml`
- `scorecard.yml`
- `trufflehog.yml`
- `release-attestation.yml` (SLSA L2)
- ~10 other workflows

## Current State

- All workflow files exist and are valid
- `on.schedule` triggers are configured (e.g., Monday 04:00 UTC weekly)
- `on.pull_request` triggers are configured
- Workflows don't execute due to billing block

## Recommended Action

**Sponsor call required** — this is an org-wide billing/admin action:
1. Verify billing tier and limits
2. Increase minutes/storage if at limit
3. Re-enable workflows org-wide

## Workaround (current session)

- Local execution of tools (inventory.sh, drift.sh, scorecard.sh, cliff-sync.sh, trend.sh)
- Manual CLI invocation of pillar checks
- CI gates will resume once billing restored

## Tracking

- Diagnosis: this file
- Resolution: pending sponsor decision
- Filed: not yet (sponsor call needed)

Refs: CI billing block, v40 Wave B, cycle-30
