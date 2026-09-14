import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCliTarget } from "../../../bin/cli/commands/run.mjs";

const originalFetch = globalThis.fetch;
const originalPath = process.env.PATH;

async function makeFakeCli(name: string, body: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "omniroute-run-cli-"));
  const file = path.join(dir, name);
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
  await chmod(file, 0o755);
  return { dir, file };
}

async function withReachableOmniRoute<T>(run: () => Promise<T>): Promise<T> {
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("run executes a generic target with isolated env and propagates its exit code", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX fake executable; Windows shim behavior is covered by launch tests");
    return;
  }

  const capture = await mkdtemp(path.join(os.tmpdir(), "omniroute-run-capture-"));
  const capturePath = path.join(capture, "aider.json");
  const fake = await makeFakeCli(
    "aider",
    `const fs = await import("node:fs");
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
  argv: process.argv.slice(2),
  base: process.env.OPENAI_API_BASE,
  key: process.env.OPENAI_API_KEY,
}));
process.exit(7);`
  );
  process.env.PATH = `${fake.dir}${path.delimiter}${originalPath || ""}`;
  process.env.CAPTURE_PATH = capturePath;

  try {
    const code = await withReachableOmniRoute(() =>
      runCliTarget(
        "aider",
        { remote: "https://relay.example.test", apiKey: "sk_private", model: "glm/glm-5.2" },
        ["--message", "reply OK"]
      )
    );
    assert.equal(code, 7);
    const result = JSON.parse(await readFile(capturePath, "utf8"));
    assert.deepEqual(result.argv.slice(0, 2), ["--model", "openai/glm/glm-5.2"]);
    assert.deepEqual(result.argv.slice(2), ["--message", "reply OK"]);
    assert.equal(result.base, "https://relay.example.test");
    assert.equal(result.key, "sk_private");
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env.CAPTURE_PATH;
    await rm(fake.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(capture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("run gives Gemini an isolated GEMINI_CLI_HOME forcing api-key auth and removes it", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX fake executable; Windows shim behavior is covered by launch tests");
    return;
  }

  const capture = await mkdtemp(path.join(os.tmpdir(), "omniroute-run-gemini-capture-"));
  const capturePath = path.join(capture, "gemini.json");
  const fake = await makeFakeCli(
    "gemini",
    `const fs = await import("node:fs");
const path = await import("node:path");
const home = process.env.GEMINI_CLI_HOME;
const settings = JSON.parse(fs.readFileSync(path.join(home, ".gemini", "settings.json"), "utf8"));
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
  home,
  argv: process.argv.slice(2),
  baseUrl: process.env.GOOGLE_GEMINI_BASE_URL,
  key: process.env.GEMINI_API_KEY,
  defaultAuth: process.env.GEMINI_DEFAULT_AUTH_TYPE,
  selectedType: settings.security?.auth?.selectedType,
}));`
  );
  process.env.PATH = `${fake.dir}${path.delimiter}${originalPath || ""}`;
  process.env.CAPTURE_PATH = capturePath;

  try {
    const code = await withReachableOmniRoute(() =>
      runCliTarget(
        "gemini",
        { remote: "https://relay.example.test", apiKey: "sk_private", model: "glm/glm-5.2" },
        ["-p", "reply OK"]
      )
    );
    assert.equal(code, 0);
    const result = JSON.parse(await readFile(capturePath, "utf8"));
    assert.deepEqual(result.argv, ["--model", "glm/glm-5.2", "-p", "reply OK"]);
    assert.equal(result.baseUrl, "https://relay.example.test");
    assert.equal(result.key, "sk_private");
    assert.equal(result.defaultAuth, "gemini-api-key");
    assert.equal(result.selectedType, "gemini-api-key");
    assert.equal(existsSync(result.home), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env.CAPTURE_PATH;
    await rm(fake.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(capture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("run gives Qwen an isolated temporary home and removes it after exit", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX fake executable; Windows shim behavior is covered by launch tests");
    return;
  }

  const capture = await mkdtemp(path.join(os.tmpdir(), "omniroute-run-qwen-capture-"));
  const capturePath = path.join(capture, "qwen.json");
  const fake = await makeFakeCli(
    "qwen",
    `const fs = await import("node:fs");
const path = await import("node:path");
const home = process.env.QWEN_HOME;
const settings = JSON.parse(fs.readFileSync(path.join(home, "settings.json"), "utf8"));
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
  home,
  argv: process.argv.slice(2),
  model: settings.model?.name,
  baseUrl: settings.model?.baseUrl,
}));`
  );
  process.env.PATH = `${fake.dir}${path.delimiter}${originalPath || ""}`;
  process.env.CAPTURE_PATH = capturePath;

  try {
    const code = await withReachableOmniRoute(() =>
      runCliTarget(
        "qwen",
        { remote: "https://relay.example.test", apiKey: "sk_private", model: "glm/glm-5.2" },
        ["-p", "reply OK"]
      )
    );
    assert.equal(code, 0);
    const result = JSON.parse(await readFile(capturePath, "utf8"));
    assert.deepEqual(result.argv, ["--model", "glm/glm-5.2", "-p", "reply OK"]);
    assert.equal(result.model, "glm/glm-5.2");
    assert.equal(result.baseUrl, "https://relay.example.test/v1");
    assert.equal(existsSync(result.home), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env.CAPTURE_PATH;
    await rm(fake.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(capture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
