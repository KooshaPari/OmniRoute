# Journey Traceability Standard

- **Status:** Draft
- **Date:** 2026-04-30

## Purpose

Every repo in the Phenotype ecosystem should carry visible journey evidence for
the flows it documents. A journey is not just prose. It is a traceable bundle of:

- the page that explains the flow
- keyframe images that show the important states
- a recording that shows the full interaction
- metadata that ties the evidence back to a repo, run, and purpose

This standard makes those artifacts consistent across repos so docs, audits, and
handoffs all point to the same evidence shape.

## Canonical Pattern

Use the hwLedger pattern as the reference implementation:

- `ShotGallery` for keyframes
- `RecordingEmbed` for the full recording
- `cli-journeys/keyframes/<journey>/frame-###.png` for frame assets
- a stable `tape` id for the recording reference
- renderer components sourced from `phenotype-journeys`

If a repo vendors the viewer package, keep that vendoring pattern documented in
the repo itself so the journey page remains reproducible.

Example:

```md
<ShotGallery
  title="plan - help, run, and VRAM breakdown"
  :shots='[
    {"src":"/cli-journeys/keyframes/plan-help/frame-005.png","caption":"hwledger plan --help"},
    {"src":"/cli-journeys/keyframes/plan-deepseek/frame-003.png","caption":"Typical plan output: VRAM breakdown + architecture detection"}
  ]' />

<RecordingEmbed tape="plan-deepseek" kind="cli" caption="CLI plan: DeepSeek-V3 -> live architecture detection + colored VRAM bands" />
```

## Required Artifacts

Each documented journey should include:

1. A short page section describing the user intent and expected outcome.
2. At least one `ShotGallery` block when the journey has visible UI or CLI
   state transitions.
3. At least one `RecordingEmbed` when the flow is worth replaying end-to-end.
4. Stable asset names that can be re-used from docs, audits, and changelogs.
5. A link back to the repo or work item that produced the evidence.

## Asset Layout

Recommended storage pattern:

- keyframes under `/cli-journeys/keyframes/<journey>/frame-###.png`
- recordings referenced by stable tape id, for example `plan-deepseek`
- doc pages colocated with the feature docs that explain the journey

If a repo does not have a docs-site, use the equivalent canonical docs folder
and keep the same naming rules.

## Metadata Contract

Every journey page should carry enough context for later traceability:

- repo name
- journey id
- flow name
- owner or team
- related issue, ADR, PR, or worklog reference
- capture date
- environment used for the capture

Keep this data close to the journey page so it is visible with the evidence.

## Minimum Acceptance Criteria

A repo is considered to have journey traceability only when:

- the repo docs include the flow narrative and the evidence bundle
- the keyframes show the important state transitions, not just the happy path
- the recording can be replayed or re-embedded from the stable tape id
- the docs point to the source of truth for the capture, not just a screenshot dump

## Adoption Checklist

For each repo:

1. Identify the top user-visible or operator-visible flows.
2. Add one journey page per flow in the repo docs.
3. Capture keyframes for the important states.
4. Record a replay and register its tape id.
5. Add the evidence to the docs page with `ShotGallery` and `RecordingEmbed`.
6. Link the page from the repo README or docs index.

## Suggested Rollout Order

Start where the docs surface is already central:

1. `phenodocs` - docs hub; highest leverage for propagating the standard.
2. `PhenoHandbook` - patterns registry; good home for reusable journey examples.
3. `PhenoProject` - workspace-level docs and worklogs.
4. Product repos with active docs sites or docs portals.
5. Smaller repos and supporting tools after the central hubs are covered.

## Exceptions

If a journey cannot yet be captured, document the blocker explicitly and link the
open issue or missing dependency. Do not silently omit the evidence.

## Related

- `docs/governance/agent-local-parity.md`
- `docs/governance/security-policy.md`
- `hwLedger/docs-site/reference/cli.md`
- `hwLedger/vendor/phenotype-journeys/README.md`
