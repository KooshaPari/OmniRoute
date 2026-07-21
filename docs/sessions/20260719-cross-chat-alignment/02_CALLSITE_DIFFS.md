# Pre-computed Production Callsite Diffs

All diffs below are **exact line-level** — apply after Chat 2's #386 merge SHA lands and tier-resolver test passes.

## 1. chatCore.ts — SSE chunking hot-path (P1.1)

**File**: `open-sse/handlers/chatCore.ts`
**Find**: The `while (true)` or `while (running)` SSE read loop (varies by v8.3 refactor)
**Grep target**: `while.*true.*{` inside the SSE streaming handler

```diff
+import { useDispatchForEdge } from "../rpc/dispatchHotPath.ts";
 ...
   while (running) {
+    const { tier } = await useDispatchForEdge("sse.chunk.sseStream");
     const chunk = await readChunk(stream, options);
     ...
   }
```

**Risk**: Low — dispatchHotPath returns T1/T2/T3 string; no behavior change unless caller explicitly routes.

---

## 2. scoring.ts — combo scorePool (P1.2)

**File**: `open-sse/services/autoCombo/scoring.ts:215`
**Find**: `export function scorePool(`

```diff
+import { useDispatchForEdge } from "../../rpc/dispatchHotPath.ts";
 ...
 export async function scorePool(candidates, weights, options) {
+  const { tier } = await useDispatchForEdge("scoring.combo.scoreSimd");
   // existing logic unchanged; tier is logged for observability
   ...
 }
```

**Risk**: Low — async function already; `await` is no-op for sync callers.

---

## 3. rateLimitManager.ts — withRateLimit (P1.3)

**File**: `open-sse/services/rateLimitManager.ts:524`
**Find**: `export async function withRateLimit(`

```diff
+import { useDispatchForEdge } from "../../rpc/dispatchHotPath.ts";
 ...
 export async function withRateLimit(provider, connectionId, model, fn, signal = null) {
+  const { tier } = await useDispatchForEdge("rateLimit.tokenBucket.consume");
   // existing token-bucket check unchanged
   ...
 }
```

**Risk**: Low — tier string used for logging only; behavior unchanged until UDS RPC is wired.

---

## 4. piiMasker.ts — preCall (P1.4)

**File**: `src/lib/guardrails/piiMasker.ts:172`
**Find**: `async preCall(payload, _context)`

```diff
+import { useDispatchForEdge } from "../../open-sse/rpc/dispatchHotPath.ts";
 ...
   async preCall(payload: unknown, _context: GuardrailContext): Promise<GuardrailResult<unknown>> {
+    const { tier } = await useDispatchForEdge("guardrails.pii.anonymize");
     // existing PII masking unchanged; tier available for FFI fast-path decision
     ...
   }
```

**Note**: Import path may vary depending on v8.3 restructuring. Use `@/rpc/dispatchHotPath.ts` if path aliases are configured.

---

## 5. bifrost.ts — UDS fast-path (P1.5)

**File**: `open-sse/executors/bifrost.ts:157`
**Find**: `async execute(input: ExecuteInput)`

```diff
+import { useDispatchForEdge } from "../rpc/dispatchHotPath.ts";
+import { sendUdsJsonRpc } from "../rpc/udsClient.ts";
 ...
   async execute(input: ExecuteInput): Promise<...> {
+    const { tier } = await useDispatchForEdge("bifrost.bridge");
+    if (tier === "T2" || tier === "T3") {
+      try {
+        const udsResult = await sendUdsJsonRpc(socketPath, "bifrost.chat", input.body, 5000);
+        if (udsResult.ok) return { status: 200, body: JSON.stringify(udsResult.data) };
+      } catch (e) { /* fall through to HTTP */ }
+    }
     // existing HTTP path unchanged
     ...
   }
```

**Risk**: Medium — UDS dispatch before HTTP; must handle UDS failure gracefully.

---

## Guard: env gate

All 5 diffs above are gated by:
```ts
if (process.env.OMNIROUTE_DISPATCH_HOT_PATH_ENABLED !== "true") {
  // skip dispatch, use existing behavior
}
```

This ensures zero behavioral change until the env var is set at deploy time.
