# F-01: File Decomposition Plan

## Status: Partially Complete

### What Was Already Done (prior to this session)
- `chatCore.ts` (6145 lines) was already decomposed into:
  - `sse/handlers/chat.ts` (2223 lines)
  - `sse/handlers/chatForkState.ts` (403 lines)
  - `sse/handlers/chatHelpers.ts` (1164 lines)
  - `sse/handlers/chatAdmission.ts` (340 lines)
  - Plus other handler modules via commit `9f6e4d79ca`

### Remaining Files Over 500 Lines

| File | Lines | Priority | Risk |
|------|-------|----------|------|
| `src/sse/services/auth.ts` | 3423 | HIGH | MEDIUM - many internal dependencies |
| `src/sse/handlers/chat.ts` | 2223 | MEDIUM | HIGH - core message flow |
| `src/sse/handlers/chatHelpers.ts` | 1164 | LOW | LOW - helper functions |
| `src/mitm/manager.ts` | 806 | LOW | LOW - self-contained |

### auth.ts Decomposition Strategy (3423 lines)

**Current structure (62 functions):**
- Lines 1-232: Types, imports, constants
- Lines 233-593: Quota helpers + P2C scoring (~360 lines)
- Lines 631-909: Credential selection helpers (~280 lines)
- Lines 926-1167: Provider pool, lease management (~240 lines)
- Lines 1167-2199: `getProviderCredentials` (1032 lines - core function)
- Lines 2199-2598: `getProviderCredentialsWithQuotaPreflight` (~400 lines)
- Lines 2598-3420: Exhaustion/recovery (~820 lines)
- Lines 3421-3423: Re-exports from sub-modules

**Proposed extraction (safe, low-risk):**

1. **`authQuota.ts`** (~360 lines)
   - Quota normalization helpers
   - P2C connection scoring
   - Headroom calculations
   - Dependencies: `resolveQuotaLimitPolicy`, `evaluateQuotaLimitPolicy`, `getQuotaWindowStatus`, `getQuotaCache`, `isQuotaExhaustedForRequest`

2. **`authExhaustion.ts`** (~820 lines)
   - `buildExhaustionOptions`, `markAccountUnavailable`, `clearAccountError`, `clearRecoveredProviderState`
   - Dependencies: DB operations, connection views
   - Self-contained section with clear boundary

3. **`authCredentialSelection.ts`** (~700 lines)
   - Credential search pool, lease management, materialization
   - Dependencies: DB operations, connection views

**Why not done yet:**
- The quota section depends on 6+ internal functions (`isFreeModel`, `isClaudeExtraUsageAllowed`, `toCodexScopedQuotaWindowName`, etc.)
- The exhaustion section depends on DB operations and connection views
- A wrong extraction could break credential selection (the most critical path)
- Safe decomposition requires: (a) tracing all internal dependencies, (b) creating re-export barrel, (c) updating all callers, (d) full test suite verification

### chat.ts Decomposition Strategy (2223 lines)

Already partially decomposed. The remaining 2223 lines handle:
- Message routing and streaming
- Session management
- Error handling

**Recommended:** Leave as-is until auth.ts is stable. The chat.ts file is complex but functional.

### chatHelpers.ts (1164 lines)

Helper functions for chat.ts. Could be split by concern but low impact.

### manager.ts (806 lines)

MITM proxy manager. Self-contained, low priority.

### Recommendation

1. auth.ts decomposition is the highest impact but also highest risk
2. Should be done in a dedicated session with full test suite verification
3. The quota section (lines 233-593) is the safest extraction candidate
4. The exhaustion section (lines 2598-3420) is the second safest
5. The core `getProviderCredentials` function should NOT be split - it's complex but cohesive

### Test Verification

After any decomposition:
```bash
npx eslint src/ --quiet
npx vitest run
npx tsx benches/dispatch/provider-routing.bench.ts
```
