# ADR-ECO-012: Zero-shot scorecard thresholds

## Status
Accepted

## Context
Agent sessions (Cursor/forge) must optimize toward zero-shot/zero-loop disposition execution.

## Decision
Adopt scorecard in [ZERO_SHOT_ORCHESTRATION.md](../rationalization/ZERO_SHOT_ORCHESTRATION.md): ≤1 apex prompt, 0 loops, 0 post-merge CI failures, <4h row relocation.

## Consequences
Session `EVIDENCE.md` logs metrics per lane. Failed scorecard triggers SSOT patch before session close.
