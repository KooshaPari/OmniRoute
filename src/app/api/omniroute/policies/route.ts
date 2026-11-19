import { NextResponse } from "next/server";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { loadRoutingPolicies } from "@/lib/routing/policyStore";

export const dynamic = "force-dynamic";

/** Read the file-backed routing policies and any validation errors. */
export async function GET(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const loaded = loadRoutingPolicies();
  return NextResponse.json({
    policies: loaded.policies,
    errors: loaded.errors,
    hasFile: loaded.exists,
  });
}
