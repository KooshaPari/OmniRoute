import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAntigravityClientProfile,
  type AntigravityClientProfile,
} from "../../src/shared/constants/antigravityClientProfile.ts";
import { validateProviderSpecificData } from "../../src/shared/validation/providerSpecificData.ts";
import {
  applyAntigravityClientProfileHeaders,
  getAntigravityClientProfile,
} from "../../open-sse/services/antigravityClientProfile.ts";
import { getAntigravityEnvelopeUserAgent } from "../../open-sse/services/antigravityIdentity.ts";
import {
  clearAntigravityVersionCaches,
  seedAntigravityCliVersionCache,
  seedAntigravityIdeVersionCache,
} from "../../open-sse/services/antigravityVersion.ts";

test.afterEach(() => {
  clearAntigravityVersionCaches();
});

test("normalizeAntigravityClientProfile maps persisted legacy profiles to CLI", () => {
  assert.equal(normalizeAntigravityClientProfile("cli"), "cli");
  assert.equal(normalizeAntigravityClientProfile("CLI"), "cli");
  assert.equal(normalizeAntigravityClientProfile("ide"), "ide");
  assert.equal(normalizeAntigravityClientProfile(undefined), "ide");
  assert.equal(normalizeAntigravityClientProfile(null), "ide");
  assert.equal(normalizeAntigravityClientProfile("harness"), "cli");
  assert.equal(normalizeAntigravityClientProfile("sdk"), "cli");
  assert.equal(normalizeAntigravityClientProfile(""), "ide");
  assert.equal(normalizeAntigravityClientProfile(42), "ide");
});

function validateClientProfile(value: unknown): string[] {
  const messages: string[] = [];
  const ctx = {
    addIssue: (issue: { message: string }) => messages.push(issue.message),
  } as unknown as Parameters<typeof validateProviderSpecificData>[1];

  validateProviderSpecificData({ clientProfile: value }, ctx);
  return messages;
}

test("provider-specific validation rejects legacy Antigravity client profiles", () => {
  assert.deepEqual(validateClientProfile("ide"), []);
  assert.deepEqual(validateClientProfile("CLI"), []);
  assert.deepEqual(validateClientProfile(undefined), []);
  assert.deepEqual(validateClientProfile(null), []);

  for (const invalid of ["harness", "sdk", "", 42]) {
    assert.deepEqual(validateClientProfile(invalid), [
      "providerSpecificData.clientProfile must be ide or cli",
    ]);
  }
});

test("getAntigravityClientProfile preserves legacy CLI identity for persisted values", () => {
  assert.equal(
    getAntigravityClientProfile({ providerSpecificData: { clientProfile: "cli" } }),
    "cli"
  );
  assert.equal(getAntigravityClientProfile({ providerSpecificData: {} }), "ide");
  assert.equal(
    getAntigravityClientProfile({ providerSpecificData: { clientProfile: "harness" } }),
    "cli"
  );
});

function assertIdentityHeadersAbsent(headers: Record<string, string>): void {
  const normalized = new Headers(headers);
  for (const name of [
    "x-client-name",
    "x-client-version",
    "x-machine-id",
    "x-vscode-sessionid",
    "X-Goog-Api-Client",
    "Client-Metadata",
  ]) {
    assert.equal(normalized.get(name), null, `${name} must be removed`);
  }
}

function applyProfile(profile: AntigravityClientProfile): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    "X-Client-Name": "legacy-name",
    "x-client-version": "4.2.0",
    "X-Machine-Id": "legacy-machine",
    "x-vscode-sessionid": "legacy-session",
    "X-Goog-Api-Client": "legacy-api-client",
    "client-metadata": "legacy-metadata",
  };

  applyAntigravityClientProfileHeaders(
    headers,
    { connectionId: `connection-${profile}`, providerSpecificData: { clientProfile: profile } },
    { project: "project-1" }
  );
  return headers;
}

test("content header application emits IDE and CLI identities and strips fake headers", () => {
  seedAntigravityIdeVersionCache("2.1.1");
  seedAntigravityCliVersionCache("1.1.1");

  const ideHeaders = applyProfile("ide");
  const cliHeaders = applyProfile("cli");

  assert.match(ideHeaders["User-Agent"], /^antigravity\/ide\/2\.1\.1 /);
  assert.match(ideHeaders["User-Agent"], / darwin\/arm64$| windows\/amd64$| linux\/[^ ]+$/);
  assert.match(
    cliHeaders["User-Agent"],
    /^antigravity\/cli\/1\.1\.1 \(aidev_client; os_type=.+; arch=.+; auth_method=consumer\)$/
  );
  assertIdentityHeadersAbsent(ideHeaders);
  assertIdentityHeadersAbsent(cliHeaders);
  assert.equal(ideHeaders["x-goog-user-project"], "project-1");
  assert.equal(cliHeaders["x-goog-user-project"], "project-1");
});

test("antigravityUserAgent matches Antigravity Manager platform fingerprints", () => {
  assert.equal(
    antigravityUserAgent("4.2.0", "darwin"),
    "Antigravity/4.2.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/142.0.7444.175 Electron/39.2.3"
  );
  assert.equal(
    antigravityUserAgent("4.2.0", "win32"),
    "Antigravity/4.2.0 (Windows NT 10.0; Win64; x64) Chrome/142.0.7444.175 Electron/39.2.3"
  );
  assert.equal(
    antigravityUserAgent("4.2.0", "linux"),
    "Antigravity/4.2.0 (X11; Linux x86_64) Chrome/142.0.7444.175 Electron/39.2.3"
  );
});

test("deriveAntigravityMachineId uses the raw system machine id like Antigravity Manager", () => {
  let systemMachineId: string | null = null;
  try {
    systemMachineId = machineIdSync(true);
  } catch {
    systemMachineId = null;
  }
  if (!systemMachineId) return;

  assert.equal(deriveAntigravityMachineId(), systemMachineId);
});

test("antigravityHarnessUserAgent uses Go harness platform and arch names", () => {
  assert.equal(
    antigravityHarnessUserAgent("2.1.1", "darwin", "arm64"),
    "antigravity/2.1.1 darwin/arm64"
  );
  assert.equal(
    antigravityHarnessUserAgent("2.1.1", "win32", "x64"),
    "antigravity/2.1.1 windows/amd64"
  );
  assert.equal(
    antigravityHarnessUserAgent("2.1.1", "linux", "x64"),
    "antigravity/2.1.1 linux/amd64"
  );
});

test("getAntigravityBootstrapHeaders uses SDK loadCodeAssist harness fingerprint", () => {
  seedAntigravityVersionCache("2.1.1");

  const headers = getAntigravityBootstrapHeaders("harness", "token");

  assert.equal(headers.Authorization, "Bearer token");
  assert.equal(
    headers["User-Agent"],
    `${antigravityHarnessUserAgent("2.1.1")} google-api-nodejs-client/10.3.0`
  );
  assert.equal(headers["X-Goog-Api-Client"], "gl-node/22.21.1");
  assert.equal(headers["Client-Metadata"], undefined);
});

test("applyAntigravityClientProfileHeaders uses harness fingerprint when configured", () => {
  seedAntigravityVersionCache("4.2.0");
  const headers: Record<string, string> = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    "x-client-name": "antigravity",
    "x-vscode-sessionid": "old-session",
  };

  applyAntigravityClientProfileHeaders(
    headers,
    { connectionId: "conn-2", providerSpecificData: { clientProfile: "harness" } },
    { project: "project-2" }
  );

  assert.equal(headers["User-Agent"], antigravityHarnessUserAgent("4.2.0"));
  assert.equal(headers["X-Goog-Api-Client"], undefined);
  assert.equal(headers["x-client-name"], undefined);
  assert.equal(headers["x-vscode-sessionid"], undefined);
  assert.equal(headers["x-goog-user-project"], "project-2");
});
