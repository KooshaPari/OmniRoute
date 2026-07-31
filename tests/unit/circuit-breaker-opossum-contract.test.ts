import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const tsx = fileURLToPath(new URL("../../node_modules/.bin/tsx", import.meta.url));

test("opossum primary flag preserves the CircuitBreaker request-path contract", () => {
  const probe = [
    'import { getCircuitBreaker, resetAllCircuitBreakers } from "./src/shared/utils/circuitBreaker.ts";',
    'const breaker = getCircuitBreaker("opossum-primary-contract");',
    'for (const method of ["canExecute", "getStatus", "getRetryAfterMs", "reset"]) {',
    '  if (typeof breaker[method] !== "function") throw new Error(`missing ${method}`);',
    '}',
    'resetAllCircuitBreakers();',
  ].join("\n");

  assert.doesNotThrow(() => {
    execFileSync(tsx, ["--eval", probe], {
      cwd: projectRoot,
      env: { ...process.env, CIRCUIT_BREAKER_OPOSSUM_PRIMARY: "1" },
      stdio: "pipe",
    });
  });
});
