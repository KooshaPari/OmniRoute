import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { capThinkingBudget, getDefaultThinkingBudget } from "@/lib/modelCapabilities";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

const topUpBudgetSchema = z.object({
  currentBudget: z.number(),
  model: z.string().optional(),
  additionalTokens: z.number(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get("model") || undefined;
    const budget = getDefaultThinkingBudget(model);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get thinking budget" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(topUpBudgetSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { currentBudget, model, additionalTokens } = validation.data;
    const budget = capThinkingBudget(model ?? "", currentBudget + additionalTokens);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to top up thinking budget" },
      { status: 500 },
    );
  }
}
