# Deactivation/Reconciliation State Machine Contract (G7.6 Pre-work)

## State Diagram

```
IDLE ──activateKillSwitch──→ DEGRADED
  ↑                                │
  └──deactivateKillSwitch──────────┘

States:
  IDLE:      forcedTToT1 = false, tierOverrides = {}, envTierOverrides = {}
  DEGRADED:  forcedTToT1 = true,  tierOverrides = { all_edges → T1 }
```

## Transitions

### activateKillSwitchDegradation()

1. Set `forcedTToT1 = true`
2. Call `clearTierOverrides()` — wipe previous reconcile state
3. Call `reconcileAllEdges({ killSwitchActive: true, cpuPressure: 0, memPressure: 0 })` — force all edges to T1

### deactivateKillSwitchDegradation()

1. Set `forcedTToT1 = false`
2. Call `clearTierOverrides()` — wipe T1 overrides
3. Call `reconcileAllEdges({ killSwitchActive: false, cpuPressure: 0, memPressure: 0 })` — re-resolve edges to their defaults

## Bug (current)

`deactivateKillSwitchDegradation()` does NOT call `reconcileAllEdges()` — it only sets `forcedTToT1 = false` and clears overrides, but never re-resolves edges. This leaves stale T1 overrides in `tierOverrides` for the current test's `getEdgeTier()` call.

## Fix (3 lines)

```ts
export function deactivateKillSwitchDegradation(): void {
  forcedTToT1 = false;
  clearTierOverrides();
  reconcileAllEdges({ killSwitchActive: false, cpuPressure: 0, memPressure: 0 });  // ← add this
}
```

## Contract

- `activateKillSwitchDegradation()` → after call, `isKillSwitchDegradationActive() === true` AND every edge's `resolveTier()` returns T1
- `deactivateKillSwitchDegradation()` → after call, `isKillSwitchDegradationActive() === false` AND every edge's `resolveTier()` returns its original `edge.defaultTier`
- `__resetEdgeCacheForTests()` → clears `forcedTToT1`, `globalDispatchEdgesCache`, `envTierOverrides`
