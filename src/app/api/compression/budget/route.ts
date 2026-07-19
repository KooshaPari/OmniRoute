import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getDefaultThinkingBudget,
  topUpThinkingBudget,
} from "@omniroute/open-sse/services/thinkingBudget";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

const topUpBudgetSchema = z.object({
  currentBudget: z.number().finite().nonnegative(),
  model: z.string().min(1).optional(),
  additionalTokens: z.number().finite().int().nonnegative(),
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
    const budget = topUpThinkingBudget(currentBudget, model, additionalTokens);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to top up thinking budget" },
      { status: 500 },
    );
  }
}
