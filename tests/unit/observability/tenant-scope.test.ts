/**
 * tests/unit/observability/tenant-scope.test.ts
 *
 * PR-007 tenant-scope tests. Verifies the task-spec API surface:
 *   - runWithTenant exposes the tenant id inside the callback
 *   - currentTenantId returns undefined outside any scope
 *   - nested scopes shadow the outer tenant
 *   - currentTenantAttributes returns { tenant_id } inside a scope and
 *     an empty object outside
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runWithTenant,
  currentTenantId,
  currentTenantAttributes,
} from "../../../src/lib/observability/tenantScope";

test("tenant-scope: runWithTenant sets the active tenant id", () => {
  const result = runWithTenant("tenant-a", () => currentTenantId());
  assert.equal(result, "tenant-a");
});

test("tenant-scope: currentTenantId returns undefined outside any scope", () => {
  // No runWithTenant wrapping this call.
  assert.equal(currentTenantId(), undefined);
});

test("tenant-scope: nested scopes shadow the outer tenant", () => {
  const observed: Array<string | undefined> = [];
  runWithTenant("outer-tenant", () => {
    observed.push(currentTenantId());
    runWithTenant("inner-tenant", () => {
      observed.push(currentTenantId());
    });
    observed.push(currentTenantId()); // back to outer after inner exits
  });
  observed.push(currentTenantId()); // back to undefined after outer exits
  assert.deepEqual(observed, ["outer-tenant", "inner-tenant", "outer-tenant", undefined]);
});

test("tenant-scope: currentTenantAttributes returns span attrs inside, {} outside", () => {
  // Outside scope — empty object.
  assert.deepEqual(currentTenantAttributes(), {});
  // Inside scope — { tenant_id }.
  const attrs = runWithTenant("scope-attrs-tenant", () => currentTenantAttributes());
  assert.deepEqual(attrs, { tenant_id: "scope-attrs-tenant" });
});

test("tenant-scope: scope propagates across async boundaries", async () => {
  const observed = await runWithTenant("async-tenant", async () => {
    // Yield once — Node's async context tracking should carry the frame.
    await Promise.resolve();
    return currentTenantId();
  });
  assert.equal(observed, "async-tenant");
});
