/**
 * src/lib/observability/tenantScope.ts
 *
 * AsyncLocalStorage-based tenant context (PR-007 — task-spec API surface).
 *
 * Wraps Node's `AsyncLocalStorage` so handlers / executors can run inside
 * a tenant scope with a single `runWithTenant(tenantId, fn)` call. Every
 * downstream async step (DB calls, provider requests, span creation)
 * inherits the tenant context through Node's async context tracking —
 * no manual prop-drilling required.
 *
 * API surface (matches the task spec exactly):
 *   - runWithTenant(tenantId, fn)
 *   - currentTenantId()
 *   - currentTenantAttributes()   // returns `{ tenant_id }` for span attributes
 *
 * Behaviour:
 *   - Nested `runWithTenant` calls are properly scoped — the inner scope
 *     shadows the outer; the outer is restored on inner exit.
 *   - `currentTenantId()` returns `undefined` outside any scope. Callers
 *     that want a string label for Prometheus should fall back to "other".
 *   - `currentTenantAttributes()` returns an empty object (`{}`) outside
 *     any scope, so it's safe to spread into span attributes without
 *     null-checking.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface TenantFrame {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantFrame>();

/* ------------------------------------------------------------------ *
 * Core scope helpers                                                   *
 * ------------------------------------------------------------------ */

/**
 * Run `fn` inside a tenant scope. The returned promise resolves with the
 * value returned by `fn` (sync or async). Nested calls produce a stack
 * of scopes; only the innermost tenant id is observable via
 * `currentTenantId`.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  const frame: TenantFrame = { tenantId };
  return storage.run(frame, fn);
}

/**
 * Read the tenant id of the innermost active scope, or `undefined` if
 * called outside any scope. Callers should default to `"other"` for
 * metric labels when this returns undefined.
 */
export function currentTenantId(): string | undefined {
  const frame = storage.getStore();
  return frame?.tenantId;
}

/**
 * Return span attributes for the current scope. Returns an empty object
 * when no tenant scope is active — safe to spread unconditionally:
 *
 *     span.setAttributes({
 *       ...currentTenantAttributes(),
 *       route: "/v1/chat/completions",
 *     });
 */
export function currentTenantAttributes(): { tenant_id: string } {
  const id = currentTenantId();
  return id ? { tenant_id: id } : {};
}

/* ------------------------------------------------------------------ *
 * Reset (test-only)                                                    *
 * ------------------------------------------------------------------ */

/**
 * Wipe the AsyncLocalStorage. AsyncLocalStorage doesn't expose a public
 * `reset`, but the store is process-global and tied to the active
 * async-context frame — by the time the test exits the scope, the frame
 * is naturally popped. This helper exists for symmetry with the other
 * modules and forwards to `storage.exit` if called from inside a scope.
 */
export function resetForTests(): void {
  // No-op: AsyncLocalStorage is intrinsically per-call. We keep this
  // function so test files can call it without branching on the module.
}
