import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { PolicyEngine } from "@/domain/policyEngine";
import { loadRoutingPolicies, validatePolicies } from "@/lib/routing/policyStore";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    model: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    policies: z.array(z.unknown()).optional(),
  })
  .passthrough();

/**
 * Evaluate routing policies without calling an upstream provider.
 *
 * Body policies take precedence over `<DATA_DIR>/routing-policies.json` when
 * present, which makes the endpoint usable for dry runs before persisting.
 */
export async function POST(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const bodyPolicies = parsed.data.policies ? validatePolicies(parsed.data.policies) : null;
  const loaded = bodyPolicies ?? loadRoutingPolicies();
  const engine = new PolicyEngine({ celEnabled: true });
  engine.loadPolicies(loaded.policies);

  const result = engine.evaluate({
    ...(parsed.data.context ?? {}),
    model: parsed.data.model,
    ...(parsed.data.metadata ? { metadata: parsed.data.metadata } : {}),
  });

  return NextResponse.json({
    ...result,
    policyCount: loaded.policies.length,
    policyErrors: loaded.errors,
    celErrors: engine.getCelErrors(),
    conditionalErrors: engine.getConditionalErrors(),
    liveRequestExecuted: false,
  });
}
