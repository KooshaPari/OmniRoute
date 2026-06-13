# Discord Interactions: Single-Template Policy and Ephemeral Flags

## Overview
This project standardizes Discord interactions around:
- Single-template flows
  - Feature Requests: one main feature request modal
  - Bug Reports: only the "General Bug Report" template (no template picker)
- Ephemeral responses via `flags: MessageFlags.Ephemeral` (Discord-recommended)
- Guarded reply behavior: prefer `reply` if not replied/deferred, otherwise `followUp`

## Policies
- Feature Requests
  - Always launch the single feature request modal.
  - Modal submissions are routed to `FeatureRequestWorkflow`.
- Bug Reports
  - Always launch the `general-bug` template directly.
  - Other bug templates have been removed to reduce code paths and confusion.

## Implementation Notes
- Use `flags: MessageFlags.Ephemeral` for all ephemeral replies and follow-ups.
- Before replying, check `interaction.replied || interaction.deferred`.
  - If true: use `interaction.followUp({ ..., flags: MessageFlags.Ephemeral })`
  - Else: `interaction.reply({ ..., flags: MessageFlags.Ephemeral })`
- Modal submissions
  - `discordHandlers` routes `form_*` submissions to `ModalFormManager`.
  - `ModalFormManager` acknowledges submissions, validates inputs, and handles errors with guarded replies.
  - For multi-step forms, a "Continue" button is used to avoid chained modal issues.

## Developer Tips
- Avoid reintroducing `ephemeral: true`. Use `flags: MessageFlags.Ephemeral`.
- Prefer small, focused templates; remove/avoid unused variants.
- Add debug logs for critical branches (proceed, modal show/submit, errors).

## Testing
- Run focused tests:
  - `npx vitest run src/discord/components/tests/forumSelectionUI.test.ts`
  - `npx vitest run src/discord/discordHandlers.test.ts`
  - `npx vitest run src/discord/framework/tests/replyGuard.test.ts`


