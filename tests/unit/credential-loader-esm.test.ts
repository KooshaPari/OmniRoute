import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("credential loader resolves legacy data directory through its ESM dataPaths import", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-credential-loader-"));
  const home = path.join(root, "home");
  const legacyDataDir = path.join(home, ".omniroute");
  const originalEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };

  fs.mkdirSync(legacyDataDir, { recursive: true });
  fs.writeFileSync(
    path.join(legacyDataDir, "provider-credentials.json"),
    JSON.stringify({ gemini: { clientId: "external-client-id" } }),
    "utf8"
  );

  try {
    delete process.env.DATA_DIR;
    process.env.HOME = home;
    process.env.USERPROFILE = home;

    const { loadProviderCredentials } = await import(
      `../../open-sse/config/credentialLoader.ts?esm-regression=${Date.now()}`
    );
    const providers = { gemini: { clientId: "default-client-id" } };

    loadProviderCredentials(providers);

    assert.equal(providers.gemini.clientId, "external-client-id");
  } finally {
    if (originalEnv.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = originalEnv.HOME;
    if (originalEnv.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalEnv.USERPROFILE;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
