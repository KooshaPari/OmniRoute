import { NextRequest, NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";
import pino from "pino";
import { processPR } from "@/lib/engine";
import { ReviewRequest, ReviewEvent, Tool } from "@/lib/types";

const logger = pino({ name: "unified-review:webhook" });
const webhooks = new Webhooks({ secret: process.env.GITHUB_WEBHOOK_SECRET || "dev-secret" });

export const dynamic = "force-dynamic";

function mapEventName(action: string): ReviewEvent | null {
  switch (action) {
    case "opened": return "opened";
    case "synchronize": return "synchronize";
    case "reopened": return "reopened";
    case "labeled": return "labeled";
    case "review_requested": return "review_requested";
    default: return null;
  }
}

async function handlePullRequestEvent(payload: any) {
  const pr = payload.pull_request;
  if (!pr) return null;
  const event = mapEventName(payload.action);
  if (!event) return null;

  const req: ReviewRequest = {
    pr: {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      number: pr.number,
      head_sha: pr.head.sha,
      base_sha: pr.base.sha,
    },
    event,
  };

  // Honor user override via reviewer:<tool> label
  const reviewerLabel = (pr.labels || []).find((l: any) => l.name?.startsWith("reviewer:"));
  if (reviewerLabel) {
    req.preferred_tool = reviewerLabel.name.replace("reviewer:", "") as Tool;
  }

  try {
    const result = await processPR(req);
    logger.info({ pr: pr.number, tool: result.tool, status: result.status }, "Webhook processed");
    return result;
  } catch (err) {
    logger.error({ err, pr: pr.number }, "Webhook processing failed");
    return null;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256") || "";
  const body = await request.text();

  let verified = false;
  try {
    verified = await webhooks.verify(body, signature);
  } catch (err) {
    logger.warn({ err }, "Webhook signature verification failed");
  }

  if (!verified && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") || "";
  let payload: any;
  try { payload = JSON.parse(body); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (event === "pull_request") {
    const result = await handlePullRequestEvent(payload);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: true, ignored: event });
}

export async function GET() {
  return NextResponse.json({ status: "ready", endpoint: "webhook" });
}
