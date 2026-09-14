import test from "node:test";
import assert from "node:assert/strict";

const {
  listConfigureTargets,
  profileNameFromModel,
  resolveConfigureTargetOptions,
  rankPreferredModels,
  getModelPreferenceState,
} = await import("../../../bin/cli/commands/configure.mjs");

test("configure picker exposes setup-backed CLI targets (manifest declaration order)", () => {
  assert.deepEqual(listConfigureTargets(), [
    "claude",
    "codex",
    "aider",
    "goose",
    "opencode",
    "qwen",
    "cline",
    "continue",
    "kilo",
    "5dive",
  ]);
});

test("configure picker derives stable profile names from provider/model ids", () => {
  assert.equal(profileNameFromModel("glm/glm-5.2"), "glm52");
  assert.equal(profileNameFromModel("claude-sonnet-4.6"), "claudesonnet46");
});

test("configure picker materializes explicit remote/base-url targets", () => {
  assert.deepEqual(
    resolveConfigureTargetOptions({
      baseUrl: "https://relay.example.test/v1",
      apiKey: "sk_test",
      port: "2999",
    }),
    {
      baseUrl: "https://relay.example.test/v1",
      remote: "https://relay.example.test/v1",
      apiKey: "sk_test",
      port: "2999",
    }
  );
});

test("configure picker ranks favorites and recent model ids without leaking context data", () => {
  const ranked = rankPreferredModels("codex", ["glm/slow", "glm/fast", "qwen/recent"], {
    targets: { codex: { favorites: ["glm/fast"], recent: ["qwen/recent"] } },
  });
  assert.deepEqual(ranked, ["glm/fast", "qwen/recent", "glm/slow"]);
  assert.deepEqual(
    getModelPreferenceState("codex", {
      targets: { codex: { favorites: ["glm/fast"], recent: ["qwen/recent"] } },
    }),
    { favorites: ["glm/fast"], recent: ["qwen/recent"] }
  );
});

test("configure picker keeps preferences isolated per remote context", () => {
  const preferences = {
    targets: {},
    contexts: {
      local: { codex: { favorites: ["local/model"], recent: [] } },
      remote: { codex: { favorites: ["remote/model"], recent: [] } },
    },
  };
  assert.deepEqual(
    rankPreferredModels("codex", ["local/model", "remote/model"], preferences, "remote"),
    ["remote/model", "local/model"]
  );
  assert.deepEqual(getModelPreferenceState("codex", preferences, "local"), {
    favorites: ["local/model"],
    recent: [],
  });
});
