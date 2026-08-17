import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const registrySource = readFileSync(resolve(repoRoot, "open-sse/config/audioRegistry.ts"), "utf8");

test("audio translation registry has one canonical declaration", () => {
  assert.equal(registrySource.match(/export const AUDIO_TRANSLATION_PROVIDERS\b/g)?.length, 1);
});
