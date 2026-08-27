import assert from "node:assert/strict";
import test from "node:test";

import { getUsageForProvider } from "@omniroute/open-sse/services/usage.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Kiro and Amazon Q usage dispatch forwards each connection token and profile ARN", async () => {
  const requests: Array<{
    authorization: string | undefined;
    body: Record<string, unknown>;
    target: string | undefined;
  }> = [];

  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    requests.push({
      authorization: headers.Authorization,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      target: headers["x-amz-target"],
    });

    return new Response(
      JSON.stringify({
        subscriptionInfo: { subscriptionTitle: "Kiro Pro" },
        usageBreakdownList: [
          {
            resourceType: "AGENTIC_REQUEST",
            currentUsageWithPrecision: 1,
            usageLimitWithPrecision: 10,
          },
        ],
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  for (const connection of [
    { provider: "kiro" as const, accessToken: "kiro-token", profileArn: "arn:test:kiro" },
    {
      provider: "amazon-q" as const,
      accessToken: "amazon-q-token",
      profileArn: "arn:test:amazon-q",
    },
  ]) {
    const result = (await getUsageForProvider({
      provider: connection.provider,
      accessToken: connection.accessToken,
      providerSpecificData: { profileArn: connection.profileArn },
    })) as { quotas?: Record<string, { used: number }> };

    assert.equal(result.quotas?.agentic_request.used, 1);
  }

  assert.deepEqual(requests, [
    {
      authorization: "Bearer kiro-token",
      body: {
        origin: "AI_EDITOR",
        profileArn: "arn:test:kiro",
        resourceType: "AGENTIC_REQUEST",
      },
      target: "AmazonCodeWhispererService.GetUsageLimits",
    },
    {
      authorization: "Bearer amazon-q-token",
      body: {
        origin: "AI_EDITOR",
        profileArn: "arn:test:amazon-q",
        resourceType: "AGENTIC_REQUEST",
      },
      target: "AmazonCodeWhispererService.GetUsageLimits",
    },
  ]);
});
