#!/usr/bin/env node
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildDispatchRequest, buildReconcilePayload, decodeBase64Json } from "./core.ts";
import { parseLabels, safeJsonParse, shouldSkipPullRequest } from "./core.ts";
import { getDispatchDecision, isDuplicateEvent } from "./core.ts";
import {
  collectBotComments,
  collectCheckRuns,
  collectFiles,
  collectReviewThreads,
  readCurrentHeadSha,
  readPullRequest,
} from "./github.ts";
import type { NormalizedFeedback, PullRequestPayload } from "./core.ts";

type Args = Record<string, string | boolean>;

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
  if (command === "collect") {
    await collect(args);
  } else if (command === "dispatch") {
    await dispatch(args);
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function collect(args: Args): Promise<void> {
  const repository =
    stringArg(args, "repository") ?? stringArg(args, "repo") ?? env("PR_RECONCILE_REPOSITORY");
  if (!repository) throw new Error("collect requires --repository or PR_RECONCILE_REPOSITORY");

  const event = readEvent(stringArg(args, "event-path"));
  const prNumber = numberArg(args, "pr") ?? inferPullRequestNumber(event);
  if (!prNumber) throw new Error("could not infer pull request number");

  const pr = readPullRequest(repository, prNumber, event);
  const labels = parseLabels(pr.labels);
  const attemptCount =
    numberArg(args, "run-attempt") ?? Number(env("PR_RECONCILE_RUN_ATTEMPT") ?? 1);
  const maxAttempts = numberArg(args, "max-attempts") ?? 5;
  const skip = shouldSkipPullRequest({
    draft: Boolean(pr.draft),
    labels,
    isFork: Boolean(pr.head.repo?.fork || pr.head.repo?.full_name !== pr.base.repo?.full_name),
    authorAssociation: pr.author_association,
    attemptCount,
    maxAttempts,
  });

  const pullRequest: PullRequestPayload = {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    author: pr.user?.login ?? "unknown",
    labels,
    draft: Boolean(pr.draft),
    isFork: Boolean(pr.head.repo?.fork || pr.head.repo?.full_name !== pr.base.repo?.full_name),
    authorAssociation: pr.author_association,
  };

  const feedback = skip.skip
    ? []
    : dedupeFeedback([
        ...collectBotComments(repository, prNumber),
        ...collectReviewThreads(repository, prNumber),
        ...collectCheckRuns(repository, pullRequest.headSha),
      ]);

  const payload = buildReconcilePayload({
    repository,
    pullRequest,
    attempt: {
      count: attemptCount,
      max: maxAttempts,
    },
    files: skip.skip ? [] : collectFiles(repository, prNumber),
    feedback: skip.skip
      ? [
          {
            id: `skip:${skip.reason}`,
            kind: "bot_comment",
            source: "pr-reconcile",
            severity: "informational",
            summary: `Skipped reconciliation: ${skip.reason}`,
            body: `PR reconciliation was skipped before dispatch because: ${skip.reason}`,
          },
        ]
      : feedback,
    eventId: inferEventId(args, event),
  });

  writeJson(stringArg(args, "output"), payload);
}

async function dispatch(args: Args): Promise<void> {
  const payloadPath = stringArg(args, "payload");
  if (!payloadPath) throw new Error("dispatch requires --payload");
  const payload = safeJsonParse(fs.readFileSync(payloadPath, "utf8"));
  if (!payload) throw new Error(`invalid JSON payload: ${payloadPath}`);

  const webhookUrl = stringArg(args, "webhook-url") ?? env("KILO_RECONCILE_WEBHOOK_URL");
  const preflight = getDispatchDecision({
    dryRun: Boolean(args["dry-run"]),
    webhookConfigured: Boolean(webhookUrl),
  });
  if (!preflight.dispatch) {
    console.log(
      JSON.stringify(
        {
          dispatched: false,
          dryRun: Boolean(args["dry-run"]),
          reason: preflight.reason,
          payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
        },
        null,
        2
      )
    );
    return;
  }

  const payloadValue = payload as {
    repository?: string;
    pullRequest?: { number?: number; headSha?: string };
    eventId?: string;
  };
  if (
    !payloadValue.repository ||
    !payloadValue.pullRequest?.number ||
    !payloadValue.pullRequest.headSha
  ) {
    console.log(
      JSON.stringify({ dispatched: false, reason: "invalid_payload_provenance" }, null, 2)
    );
    return;
  }
  const eventId = payloadValue.eventId;
  const duplicate = eventId ? isDuplicateEvent(eventId, readSeenEventIds()) : false;
  const currentHeadSha = readCurrentHeadSha(
    payloadValue.repository,
    payloadValue.pullRequest?.number
  );
  const decision = getDispatchDecision({
    duplicate,
    expectedHeadSha: payloadValue.pullRequest?.headSha,
    actualHeadSha: currentHeadSha,
  });
  if (!decision.dispatch) {
    console.log(JSON.stringify({ dispatched: false, reason: decision.reason }, null, 2));
    return;
  }

  const token = stringArg(args, "token") ?? env("KILO_RECONCILE_WEBHOOK_TOKEN");
  const request = buildDispatchRequest({ webhookUrl, token, payload });
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`dispatch failed: ${response.status} ${body.slice(0, 500)}`);
  }
  console.log(JSON.stringify({ dispatched: true, status: response.status }, null, 2));
}

function dedupeFeedback(feedback: NormalizedFeedback[]): NormalizedFeedback[] {
  const seen = new Set<string>();
  return feedback.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readSeenEventIds(): readonly string[] {
  const encoded = env("PR_RECONCILE_SEEN_EVENT_IDS");
  if (!encoded) return [];
  const parsed = safeJsonParse<unknown>(encoded);
  if (Array.isArray(parsed))
    return parsed.filter((value): value is string => typeof value === "string");
  return encoded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readEvent(eventPath?: string): unknown {
  if (eventPath && fs.existsSync(eventPath)) {
    return safeJsonParse(fs.readFileSync(eventPath, "utf8"));
  }
  const encoded = env("PR_RECONCILE_EVENT_JSON_B64");
  return encoded ? decodeBase64Json(encoded) : null;
}

function inferPullRequestNumber(event: unknown): number | null {
  const value = event as {
    pull_request?: { number?: number };
    issue?: { number?: number; pull_request?: unknown };
    workflow_run?: { pull_requests?: Array<{ number?: number }> };
  };
  return (
    value?.pull_request?.number ??
    (value?.issue?.pull_request ? value.issue.number : undefined) ??
    value?.workflow_run?.pull_requests?.[0]?.number ??
    null
  );
}

function inferEventId(args: Args, event: unknown): string | undefined {
  const explicit = stringArg(args, "event-id") ?? env("PR_RECONCILE_EVENT_ID");
  if (explicit) return explicit;
  const value = event as {
    delivery_id?: string;
    workflow_run?: { id?: number };
  };
  return (
    value?.delivery_id ?? (value?.workflow_run?.id ? String(value.workflow_run.id) : undefined)
  );
}

function writeJson(output: string | undefined, value: unknown): void {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json);
  } else {
    process.stdout.write(json);
  }
}

function parseArgs(argv: string[]): Args {
  const parsed: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function stringArg(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function numberArg(args: Args, key: string): number | undefined {
  const value = stringArg(args, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function usage(): void {
  console.log(
    "Usage: node --import tsx scripts/pr-reconcile/cli.ts collect --repository owner/repo --pr 123 --output payload.json\n" +
      "       node --import tsx scripts/pr-reconcile/cli.ts dispatch --payload payload.json --webhook-url https://..."
  );
}
