import { NextResponse } from "next/server";
import { getExhaustedTargetSkipReason } from "@omniroute/open-sse/services/combo/comboPredicates.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

type ResolvedComboTargetShape = Parameters<typeof getExhaustedTargetSkipReason>[0];

/**
 * Parse a comma-separated query value into a ReadonlySet<string>.
 *
 * Empty / missing values yield an empty set so `getExhaustedTargetSkipReason`
 * can be exercised with the no-exhaustion inputs without sending any query
 * params. Whitespace around each entry is trimmed; empty entries
 * (e.g. trailing commas) are skipped, since `getExhaustedTargetSkipReason`
 * keys `exhaustedConnections` on `provider:connectionId` pairs and a stray
 * empty key would silently match the target. (#1731v2)
 */
function parseStringSet(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(entries);
}

/**
 * GET /api/combos/exhaustion/skip-reason
 *
 * Thin management-auth wrapper around the pure
 * `getExhaustedTargetSkipReason` predicate from
 * `open-sse/services/combo/comboPredicates.ts`. Returns the same
 * skip-reason string the in-process combo dispatchers (handleComboChat /
 * handleRoundRobinCombo) log before falling through to the next target, so
 * operators can debug "why did this combo target get skipped?" by replaying
 * the input the dispatcher saw.
 *
 * Query params:
 *   model               (required)  — ResolvedComboTarget.modelStr
 *   provider            (required)  — ResolvedComboTarget.provider
 *   connectionId        (optional)  — ResolvedComboTarget.connectionId
 *   exhaustedProviders  (optional, CSV) — entries of the #1731 exhaustedProviders set
 *   exhaustedConnections (optional, CSV) — entries of the #1731v2 exhaustedConnections set
 *
 * Response: `{ model, provider, connectionId, exhaustedProviders, exhaustedConnections, reason }`
 *   `reason` is the same string the dispatcher would have logged, or `null`
 *   when nothing in the supplied sets matches the target.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return NextResponse.json({ error: "Invalid request URL" }, { status: 400 });
  }

  const model = url.searchParams.get("model")?.trim() ?? "";
  const provider = url.searchParams.get("provider")?.trim() ?? "";
  const connectionIdRaw = url.searchParams.get("connectionId");
  const connectionId = connectionIdRaw === null ? null : connectionIdRaw.trim();

  if (!model) {
    return NextResponse.json(
      { error: "Missing required query parameter 'model'" },
      { status: 400 }
    );
  }
  if (!provider) {
    return NextResponse.json(
      { error: "Missing required query parameter 'provider'" },
      { status: 400 }
    );
  }

  const exhaustedProviders = parseStringSet(url.searchParams.get("exhaustedProviders"));
  const exhaustedConnections = parseStringSet(url.searchParams.get("exhaustedConnections"));

  // Build the smallest target shape `getExhaustedTargetSkipReason` actually
  // reads. The function only consumes `provider`, `modelStr`, and
  // `connectionId` (#1731 / #1731v2) — see comboPredicates.ts. The remaining
  // fields are populated so the returned object is a self-describing record
  // operators can feed back into the diagnostic UI.
  const target: ResolvedComboTargetShape = {
    kind: "model",
    stepId: "skip-reason-diagnostic",
    executionKey: "skip-reason-diagnostic",
    modelStr: model,
    provider,
    providerId: null,
    connectionId: connectionId && connectionId.length > 0 ? connectionId : null,
    weight: 1,
    label: null,
  };

  const reason = getExhaustedTargetSkipReason(target, exhaustedProviders, exhaustedConnections);

  return NextResponse.json({
    model,
    provider,
    connectionId: target.connectionId,
    exhaustedProviders: Array.from(exhaustedProviders),
    exhaustedConnections: Array.from(exhaustedConnections),
    reason,
  });
}
