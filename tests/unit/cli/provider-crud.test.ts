import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProviderPayload,
  findConnectionFromResponse,
  redactProviderResponse,
  resolveProviderCredential,
  runProviderAddCommand,
} from "../../../bin/cli/commands/provider-crud.mjs";

test("provider payload separates management auth from provider credential", () => {
  const payload = buildProviderPayload(
    "glm",
    {
      name: "work",
      defaultModel: "glm/glm-5.2",
      priority: "2",
      providerSpecificData: '{"region":"global"}',
      apiKey: "management-token-that-must-not-be-used",
    },
    "provider-secret"
  );

  assert.deepEqual(payload, {
    provider: "glm",
    name: "work",
    apiKey: "provider-secret",
    defaultModel: "glm/glm-5.2",
    priority: 2,
    providerSpecificData: { region: "global" },
  });
});

test("provider selector resolves id, prefix, name, and provider", () => {
  const body = {
    connections: [
      { id: "abc-123", name: "Work GLM", provider: "glm" },
      { id: "def-456", name: "OpenAI", provider: "openai" },
    ],
  };

  assert.equal(findConnectionFromResponse(body, "abc-123")?.name, "Work GLM");
  assert.equal(findConnectionFromResponse(body, "def")?.name, "OpenAI");
  assert.equal(findConnectionFromResponse(body, "work glm")?.id, "abc-123");
  assert.equal(findConnectionFromResponse(body, "openai")?.id, "def-456");
  assert.equal(findConnectionFromResponse(body, "missing"), null);
});

test("provider credential can be resolved from a validated environment name", async () => {
  const previous = process.env.TEST_PROVIDER_SECRET;
  process.env.TEST_PROVIDER_SECRET = "secret-from-env";
  try {
    assert.equal(
      await resolveProviderCredential({ credentialEnv: "TEST_PROVIDER_SECRET" }, { prompt: false }),
      "secret-from-env"
    );
    await assert.rejects(
      resolveProviderCredential({ credentialEnv: "bad-name;rm" }, { prompt: false }),
      /valid env name/
    );
  } finally {
    if (previous === undefined) delete process.env.TEST_PROVIDER_SECRET;
    else process.env.TEST_PROVIDER_SECRET = previous;
  }
});

test("dry-run credential resolution never prompts or requires a secret", async () => {
  assert.equal(await resolveProviderCredential({}, { prompt: false }), undefined);
  assert.deepEqual(buildProviderPayload("glm", { name: "work" }, undefined), {
    provider: "glm",
    name: "work",
  });
});

test("negated --no-credential is treated as a control flag, not the literal string", async () => {
  assert.equal(
    await resolveProviderCredential({ credential: false }, { prompt: false }),
    undefined
  );
  assert.deepEqual(buildProviderPayload("ollama", { name: "local" }, undefined), {
    provider: "ollama",
    name: "local",
  });
});

test("provider JSON output redacts raw credentials recursively", () => {
  const redacted = redactProviderResponse({
    connection: {
      id: "conn-1",
      apiKey: "provider-secret",
      providerSpecificData: { client_secret: "oauth-secret" },
      credentialRef: "omniroute-cli:context:remote",
    },
    token: "management-secret",
  });

  assert.deepEqual(redacted, {
    connection: {
      id: "conn-1",
      apiKey: { present: true, length: 15 },
      providerSpecificData: { client_secret: { present: true, length: 12 } },
      credentialRef: "omniroute-cli:context:remote",
    },
    token: { present: true, length: 17 },
  });
});

test("provider OAuth dry-run never starts a browser or mutates the server", async () => {
  assert.equal(
    await runProviderAddCommand("openai", { oauth: true, dryRun: true, silent: true }),
    0
  );
});

test("provider add dry-run redacts provider-specific secrets", async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(" "));
  try {
    assert.equal(
      await runProviderAddCommand("glm", {
        dryRun: true,
        yes: true,
        json: true,
        providerSpecificData: JSON.stringify({ client_secret: "oauth-secret" }),
      }),
      0
    );
  } finally {
    console.log = originalLog;
  }
  const serialized = output.join("\n");
  assert.ok(!serialized.includes("oauth-secret"));
  assert.match(serialized, /client_secret/);
});
