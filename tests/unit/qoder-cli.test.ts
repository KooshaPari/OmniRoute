import test from "node:test";
import assert from "node:assert/strict";

const qoderCli = await import("../../open-sse/services/qoderCli.ts");
const { qoderProvider } = await import("../../open-sse/config/providers/registry/qoder/index.ts");

/**
 * Write a fake `qodercli` binary and point CLI_QODER_BIN at it (see the twin
 * helper in qoder-executor.test.ts). The stub authenticates unless the PAT
 * contains "bad", covering both `--list-models` (validation) and `--print`.
 */
function withStubQoderCli(fn: () => void | Promise<void>) {
  const prevBin = process.env.CLI_QODER_BIN;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qodercli-stub-"));
  const stub = path.join(dir, "qodercli");
  fs.writeFileSync(
    stub,
    [
      "#!/bin/sh",
      'is_bad() { case "$QODER_PERSONAL_ACCESS_TOKEN" in *bad*) return 0;; *) return 1;; esac; }',
      'case "$*" in',
      "  *--list-models*)",
      '    if is_bad; then echo "Not logged in · Please run /login"; exit 0; fi',
      '    printf "MODEL\\nAuto\\nQwen3-Coder\\n"; exit 0;;',
      "  *--print*)",
      "    cat >/dev/null;",
      '    if is_bad; then printf \'{"type":"result","subtype":"success","is_error":true,"result":"Not logged in · Please run /login"}\\n\'; exit 0; fi',
      '    printf \'{"type":"result","subtype":"success","is_error":false,"result":"OK from stub"}\\n\'; exit 0;;',
      "esac",
      "exit 0",
    ].join("\n"),
    { mode: 0o755 }
  );
  process.env.CLI_QODER_BIN = stub;
  const restore = () => {
    if (prevBin === undefined) delete process.env.CLI_QODER_BIN;
    else process.env.CLI_QODER_BIN = prevBin;
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return Promise.resolve().then(fn).finally(restore);
}

function withEnv(
  overrides: Record<string, string | undefined | null>,
  fn: () => void | Promise<void>
) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("qoder cli env helpers honor explicit command and workspace overrides", async () => {
  await withEnv(
    {
      CLI_QODER_BIN: " custom-qoder ",
      QODER_CLI_WORKSPACE: "/tmp/qoder-workspace",
      OMNIROUTE_QODER_WORKSPACE: "/tmp/ignored",
    },
    () => {
      assert.equal(qoderCli.getQoderCliCommand(), "custom-qoder");
      assert.equal(qoderCli.getQoderCliWorkspace(), "/tmp/qoder-workspace");
    }
  );

  await withEnv(
    {
      CLI_QODER_BIN: undefined,
      QODER_CLI_WORKSPACE: undefined,
      OMNIROUTE_QODER_WORKSPACE: "/tmp/fallback-workspace",
    },
    () => {
      assert.equal(qoderCli.getQoderCliCommand(), "qodercli");
      assert.equal(qoderCli.getQoderCliWorkspace(), "/tmp/fallback-workspace");
    }
  );
});

test("qoder cli provider metadata helpers normalize PAT transport and detect transport type", () => {
  assert.deepEqual(qoderCli.normalizeQoderPatProviderData({ region: "us" }), {
    region: "us",
    authMode: "pat",
    transport: "qodercli",
  });

  assert.equal(qoderCli.isQoderCliTransport({ transport: "qodercli" }), true);
  assert.equal(qoderCli.isQoderCliTransport({ authMode: "pat" }), true);
  assert.equal(qoderCli.isQoderCliTransport({ transport: "http-legacy", authMode: "pat" }), false);
  assert.equal(qoderCli.isQoderCliTransport({ transport: "http" }), false);
});

test("qoder cli static models are copied and model-to-level mapping covers major families", () => {
  const models = qoderCli.getStaticQoderModels();
  const snapshot = qoderCli.getStaticQoderModels();

  models[0].name = "mutated";

  assert.notEqual(snapshot[0].name, "mutated");
  assert.deepEqual(
    snapshot.map((model) => model.id),
    [
      "qwen3.8-max-preview",
      "qwen3.7-max",
      "qwen3.7-plus",
      "kimi-k3",
      "kimi-k2.7-code",
      "glm-5.2",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "minimax-m3",
    ]
  );
  assert.deepEqual(
    snapshot,
    qoderProvider.models.map(({ id, name }) => ({ id, name }))
  );
  assert.deepEqual(qoderProvider.models, [
    {
      id: "qwen3.8-max-preview",
      name: "Qwen3.8-Max-Preview",
      supportsVision: true,
      supportsReasoning: true,
      contextLength: 1_000_000,
      maxInputTokens: 180_000,
    },
    {
      id: "qwen3.7-max",
      name: "Qwen3.7-Max",
      supportsVision: true,
      contextLength: 1_000_000,
    },
    {
      id: "qwen3.7-plus",
      name: "Qwen3.7-Plus",
      supportsVision: true,
      contextLength: 1_000_000,
    },
    {
      id: "kimi-k3",
      name: "Kimi-K3",
      supportsVision: true,
      contextLength: 1_000_000,
      maxInputTokens: 180_000,
    },
    {
      id: "kimi-k2.7-code",
      name: "Kimi-K2.7-Code",
      supportsVision: true,
      contextLength: 256_000,
    },
    {
      id: "glm-5.2",
      name: "GLM-5.2",
      supportsVision: true,
      supportsReasoning: true,
      contextLength: 1_000_000,
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek-V4-Pro",
      supportsVision: true,
      supportsReasoning: true,
      contextLength: 1_000_000,
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek-V4-Flash",
      supportsVision: true,
      supportsReasoning: true,
      contextLength: 1_000_000,
    },
    {
      id: "minimax-m3",
      name: "MiniMax-M3",
      supportsVision: true,
      contextLength: 1_000_000,
    },
  ]);
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3.8-max-preview"), "qmodel_preview");
  assert.equal(qoderCli.mapQoderModelToLevel("qoder/qwen3.8-max-preview"), "qmodel_preview");
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3.7-max"), "qmodel_latest");
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3.7-plus"), "qmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("kimi-k3"), "kmodel_latest");
  assert.equal(qoderCli.mapQoderModelToLevel("kimi-k2.7-code"), "kmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("deepseek-v4-pro"), "dmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("deepseek-v4-flash"), "dfmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("deepseek-r1"), "dmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3-max-preview"), "qmodel_preview");
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3-max"), "qmodel_latest");
  assert.equal(qoderCli.mapQoderModelToLevel("kimi-k2-0905"), "kmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("qwen3-coder-plus"), "qmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("qoder-rome-30ba3b"), "qmodel");
  assert.equal(qoderCli.mapQoderModelToLevel("totally-unknown"), "auto");
  assert.equal(qoderCli.mapQoderModelToLevel(""), null);
});

test("buildQoderPrompt flattens mixed content, tool calls, tool results and JSON output instructions", () => {
  const prompt = qoderCli.buildQoderPrompt({
    tools: [
      { type: "function", function: { name: "lookup_weather" } },
      { type: "function", function: { name: "" } },
      { name: "anthropic_tool" },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { schema: { type: "object", properties: { city: { type: "string" } } } },
    },
    messages: [
      { role: "system", content: "Top level system" },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image" },
          { type: "input_image", image_url: "ignored" },
        ],
      },
      {
        role: "assistant",
        content: "Thinking aloud",
        tool_calls: [
          {
            function: {
              name: "lookup_weather",
              arguments: '{"city":"Sao Paulo"}',
            },
          },
        ],
      },
      {
        role: "tool",
        name: "lookup_weather",
        content: [{ type: "text", text: "26C and sunny" }],
      },
    ],
  });

  assert.match(
    prompt,
    /Caller-side tools are available externally: lookup_weather, anthropic_tool/
  );
  assert.match(prompt, /Return only valid JSON matching this schema/);
  assert.match(prompt, /SYSTEM:\nTop level system/);
  assert.match(prompt, /USER:\nDescribe this image\n\[Image omitted\]/);
  assert.match(prompt, /TOOL_CALL lookup_weather: \{"city":"Sao Paulo"\}/);
  assert.match(prompt, /TOOL \(lookup_weather\):\n26C and sunny/);
  assert.match(prompt, /Reply now with the assistant response only\./);
});

test("buildQoderPrompt supports input arrays and json_object responses", () => {
  const prompt = qoderCli.buildQoderPrompt({
    response_format: { type: "json_object" },
    input: [{ role: "user", content: [{ type: "input_text", text: "hello from input" }] }],
  });

  assert.match(prompt, /Return only valid JSON\./);
  assert.match(prompt, /Conversation transcript:/);
  assert.match(prompt, /USER:\nhello from input/);
});

test("qoder cli payload helpers normalize envelope text and completion payload shapes", () => {
  assert.equal(
    qoderCli.extractTextFromQoderEnvelope({
      message: { content: "hello" },
    }),
    "hello"
  );
  assert.equal(
    qoderCli.extractTextFromQoderEnvelope({
      content: [
        { type: "text", text: "hi" },
        { type: "ignored", text: "drop" },
        { text: " there" },
      ],
    }),
    "hi there"
  );
  assert.equal(qoderCli.extractTextFromQoderEnvelope(null), "");

  const completion = qoderCli.buildQoderCompletionPayload({
    model: "qwen3-coder-plus",
    text: "Ship it",
  });
  assert.equal(completion.object, "chat.completion");
  assert.equal(completion.model, "qwen3-coder-plus");
  assert.equal(completion.choices[0].message.content, "Ship it");

  const chunk = qoderCli.buildQoderChunk({
    id: "chunk-1",
    model: "qoder-rome-30ba3b",
    created: 123,
    delta: { content: "partial" },
    finishReason: "stop",
  });
  assert.deepEqual(chunk, {
    id: "chunk-1",
    object: "chat.completion.chunk",
    created: 123,
    model: "qoder-rome-30ba3b",
    choices: [
      {
        index: 0,
        delta: { content: "partial" },
        finish_reason: "stop",
      },
    ],
  });
});

test("qoder cli failure parsing classifies auth, timeout and generic upstream errors", async () => {
  assert.deepEqual(qoderCli.parseQoderCliFailure("Invalid API key"), {
    status: 401,
    message: "Invalid API key",
    code: "upstream_auth_error",
  });
  assert.deepEqual(qoderCli.parseQoderCliFailure("", "request timeout"), {
    status: 504,
    message: "request timeout",
    code: "timeout",
  });
  assert.deepEqual(qoderCli.parseQoderCliFailure("bad gateway", "more context"), {
    status: 502,
    message: "bad gateway\nmore context",
    code: "upstream_error",
  });

  const authResponse = qoderCli.createQoderErrorResponse({
    status: 401,
    message: "denied",
    code: "upstream_auth_error",
  });
  const providerResponse = qoderCli.createQoderErrorResponse({
    status: 502,
    message: "boom",
    code: "upstream_error",
  });

  assert.equal(authResponse.status, 401);
  assert.deepEqual(await authResponse.json(), {
    error: {
      message: "denied",
      type: "authentication_error",
      code: "upstream_auth_error",
    },
  });
  assert.equal(providerResponse.status, 502);
  assert.deepEqual(await providerResponse.json(), {
    error: {
      message: "boom",
      type: "provider_error",
      code: "upstream_error",
    },
  });
});

test("validateQoderCliPat builds COSY headers and handles success, HTTP failures and fetch errors", async () => {
  const originalFetch = globalThis.fetch;

  // Test 1: Success path (ping OK + validation OK)
  {
    let callIndex = 0;
    globalThis.fetch = async (url, options = {}) => {
      callIndex++;
      const urlStr = String(url);
      // Ping request
      if (urlStr.includes("/ping")) {
        return new Response("pong", { status: 200 });
      }
      // Validation request
      return new Response("ok", { status: 200 });
    };

    const success = await qoderCli.validateQoderCliPat({
      apiKey: "pat-token",
      providerSpecificData: { validationModelId: "kimi-k2" },
    });
    assert.equal(success.valid, true);
    assert.equal(success.error, null);
    assert.equal(success.unsupported, false);
  }

  // Test 2: Auth failure (ping OK + validation 403)
  {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/ping")) {
        return new Response("pong", { status: 200 });
      }
      return new Response("denied", { status: 403 });
    };

    const denied = await qoderCli.validateQoderCliPat({
      apiKey: "pat-token",
      providerSpecificData: { modelId: "qwen3-max" },
    });
    assert.equal(denied.valid, false);
    assert.match(denied.error!, /Authentication failed/);
    assert.equal(denied.unsupported, false);
  }

  // Test 3: Network error (ping fails)
  {
    globalThis.fetch = async () => {
      throw new Error("network down");
    };

    const failed = await qoderCli.validateQoderCliPat({ apiKey: "pat-token" });
    assert.equal(failed.valid, false);
    assert.match(failed.error!, /Cannot reach Qoder API/);
    assert.equal(failed.unsupported, false);
  }

  // Test 4: Non-auth 4xx treated as auth-pass
  {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/ping")) {
        return new Response("pong", { status: 200 });
      }
      return new Response("bad request", { status: 400 });
    };

    const badRequest = await qoderCli.validateQoderCliPat({ apiKey: "pat-token" });
    assert.equal(badRequest.valid, true);
    assert.equal(badRequest.error, null);
  }

  // Test 5: Empty token returns clear error
  {
    await withEnv({ QODER_PERSONAL_ACCESS_TOKEN: undefined }, async () => {
      const noToken = await qoderCli.validateQoderCliPat({ apiKey: "" });
      assert.equal(noToken.valid, false);
      assert.match(noToken.error!, /No Qoder token provided/);
    });
  }

  // Test 6: Encrypted blob token is rejected with guidance
  {
    const blobToken = "x".repeat(600);
    const blobResult = await qoderCli.validateQoderCliPat({ apiKey: blobToken });
    assert.equal(blobResult.valid, false);
    assert.match(blobResult.error!, /encrypted auth blob/);
  }

  globalThis.fetch = originalFetch;
});

test("validateQoderCliPat succeeds when the validation endpoint returns OK", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/ping")) return new Response("pong", { status: 200 });
    return new Response("ok", { status: 200 });
  };

  try {
    const result = await qoderCli.validateQoderCliPat({ apiKey: "valid-pat" });
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validateQoderCliPat treats 5xx HTTP failures as valid bypass", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/ping")) return new Response("pong", { status: 200 });
    return new Response("server error", { status: 500 });
  };

  try {
    const result = await qoderCli.validateQoderCliPat({ apiKey: "valid-pat" });
    assert.equal(result.valid, true);
    assert.match(result.error!, /HTTP 500.*treating PAT as valid/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// #3247: a generic Cosy 500 (`{"success":false,...,"msgCode":500,"message":"Internal
// Server Error"}`) is a SERVER fault, not a reliable auth verdict — a PAT that works in
// the Qoder CLI was being wrongly marked "expired". Per the older #1391 rule, a generic
// 5xx is now a valid bypass; only an explicit auth signal in the body marks it invalid.
test("validateQoderCliPat treats a generic Cosy 500 (no auth signal) as a valid bypass (#3247)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/ping")) return new Response("pong", { status: 200 });
    return new Response(
      '{"success":false,"traceId":"a4e5de61929400b9243b4f6e49756906","msgCode":500,"msgInfo":"Internal Server Error","message":"Internal Server Error"}',
      { status: 500 }
    );
  };

  try {
    const result = await qoderCli.validateQoderCliPat({ apiKey: "pt-valid-token" });
    assert.equal(result.valid, true);
    assert.match(result.error!, /treating PAT as valid/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validateQoderCliPat treats a generic 'Internal Server Error' 500 as a valid bypass (#3247)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/ping")) return new Response("pong", { status: 200 });
    return new Response(' { "success"  :  false, "error": "Internal   Server    Error" } ', {
      status: 500,
    });
  };

  try {
    const result = await qoderCli.validateQoderCliPat({ apiKey: "pt-valid-token" });
    assert.equal(result.valid, true);
    assert.match(result.error!, /treating PAT as valid/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validateQoderCliPat still rejects a Cosy 500 that carries an explicit auth signal (#2860)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/ping")) return new Response("pong", { status: 200 });
    return new Response(
      '{"success":false,"msgCode":500,"message":"token invalid or unauthorized"}',
      { status: 500 }
    );
  };

  try {
    const result = await qoderCli.validateQoderCliPat({ apiKey: "pt-bad-token" });
    assert.equal(result.valid, false);
    assert.match(result.error!, /Authentication failed \(HTTP 500\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
