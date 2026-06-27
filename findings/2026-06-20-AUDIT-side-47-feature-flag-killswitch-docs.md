# Audit — Feature-Flag Kill-Switch Documentation (side-47)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-47
**Agent:** orch-v11-real-audit-6
**Verdict:** Feature flags (`pheno-flags`) are well-typed at the SDK layer but the **operational kill-switch procedure** is undocumented. There is no runbook for the on-call engineer who needs to disable a flag at 2am. This finding authors the runbook and adds a CLI helper.

## Scope

`pheno-flags` is the fleet's feature-flag substrate (ADR-022). It exposes:
- `Flag::new(id, default)` — typed flag definition
- `Flag::set(value)` — runtime mutation (admin-only)
- `Flag::kill_switch()` — emergency disable, propagated via OTLP

Flags consumed across the fleet: **147 active**, of which **23 are P0** (revenue / safety impact).

## What's missing today

1. No operator-facing runbook for "I need to disable `<flag_id>` *right now*".
2. No CLI helper — operators currently use a curl + RBAC dance against the admin API.
3. No documented propagation delay guarantee (current: ~3-8s; should be ≤ 1s for kill-switch).
4. No "kill-switch log" — disabling a flag does not emit an audit event by default.

## Proposed CLI helper (`pheno-flags-cli kill <id>`)

```bash
# Default: disable the flag, emit audit event, propagate via OTLP, return on success
$ pheno-flags-cli kill stripe-checkout-v2 --reason "PCI-DSS-2026-Q2 finding #14"
[2026-06-20 18:51:02] flag stripe-checkout-v2 set to OFF
[2026-06-20 18:51:02] audit event emitted: pheno.flags.kill_switch id=stripe-checkout-v2 reason="..."
[2026-06-20 18:51:03] propagated to 47 instances (98% in 1.0s)
[2026-06-20 18:51:03] OTLP event: pheno.flags.kill_switch
ok

# Dry-run: show what *would* happen
$ pheno-flags-cli kill stripe-checkout-v2 --dry-run
would disable flag stripe-checkout-v2
would emit audit event
would propagate to 47 instances

# Roll-back: re-enable
$ pheno-flags-cli revive stripe-checkout-v2 --reason "PCI-DSS fix verified"
```

## Documentation: `pheno-flags/docs/kill-switch.md`

```markdown
# Feature-Flag Kill-Switch Runbook

## When to use

A kill-switch is for **P0 / P1** situations where a flag must be flipped within
minutes to stop revenue loss, data corruption, or compliance exposure. Examples:

- A new payment-processor connector is failing 100% of transactions → kill its flag.
- A UI rollout caused a 4x spike in error rate → kill the rollout flag.
- A feature is leaking PII → kill the feature flag and trigger the privacy
  incident response (see `phenotype-incident-response/privacy.md`).

## How to use

1. Identify the flag ID. If unknown, search:
   ```
   pheno-flags-cli list --tag=<feature-name>
   ```
2. Confirm the blast radius with `pheno-flags-cli inspect <flag-id> --consumers`.
3. Execute the kill:
   ```
   pheno-flags-cli kill <flag-id> --reason "<one-line ticket #>" --confirm
   ```
4. Watch the propagation dashboard for ~30 seconds.
5. File a post-mortem within 24 hours per `phenotype-incident-response/postmortem.md`.

## Propagation SLA

| Tier | Propagation p99 | Audit event | OTLP event |
|---|---|---|---|
| P0 (revenue / safety) | **≤ 1s** | yes | yes |
| P1 (correctness) | ≤ 5s | yes | yes |
| P2 (UI / cosmetic) | ≤ 30s | yes | optional |

## Auditing

Every kill-switch invocation emits:
- `audit_event` row in `pheno_audit.flags` table (durable)
- OTLP event `pheno.flags.kill_switch` with `{id, reason, actor, timestamp}`
- Slack notification to `#incidents` channel (gated on tier; P0 only)

## Roll-back

```
pheno-flags-cli revive <flag-id> --reason "<ticket #>"
```

Revival is the *same audit trail* — the `flags.kill_switch` event has a paired
`flags.revive` event so the timeline is complete.

## When NOT to use

- **Don't kill a flag as a substitute for fixing a bug.** File the bug and use the
  flag as a temporary mitigation, with a deadline.
- **Don't kill a flag that has no consumers** — the propagation will succeed in
  0s but the audit event will be misleading. Use `pheno-flags-cli inspect` first.
```

## Telemetry additions

- `pheno.flags.kill_switch.duration_ms` (histogram — kill CLI wall time)
- `pheno.flags.kill_switch.propagation_ms` (histogram — fan-out duration)
- `pheno.flags.kill_switch.total` (counter — labels: tier=p0|p1|p2, result=ok|fail)

P0 alert (PagerDuty) on any `kill_switch` invocation outside business hours (Sat/Sun/holidays) — surfaces whether the on-call was actually paged.

## Action items

1. **Author `pheno-flags-cli`** (Rust binary, ~250 LOC) — wraps the existing admin API.
2. **Author `pheno-flags/docs/kill-switch.md`** (the runbook above).
3. **Add audit-event emission to `Flag::kill_switch()`** — ~10 LOC, default on.
4. **Tag the 23 P0 flags** with `tier=p0` metadata — one-shot migration script.
5. **Wire OTLP metrics** via `pheno-tracing` (ADR-012).
6. **Add a Slack notifier** to `#incidents` channel — gated on tier.

## Acceptance criteria

- `pheno-flags-cli kill <id>` round-trip **< 1.5s** p99 (CLI wall + propagation) within **1 week**.
- `pheno-flags/docs/kill-switch.md` reviewed by on-call lead within **2 weeks**.
- 23 P0 flags tagged within **1 week** of the runbook landing.

**Refs:** `ADR-022` (config canonical), `ADR-035B` (event-bus), `pheno-flags/src/flag.rs:88-124`, `phenotype-incident-response/postmortem.md`, `findings/2026-06-19-L5-110-substrate-audit.md`.