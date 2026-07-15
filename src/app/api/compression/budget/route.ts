import { NextRequest, NextResponse } from 'next/server';
import { capThinkingBudget, getDefaultThinkingBudget } from '@/lib/modelCapabilities';
import { z } from 'zod';

const topUpThinkingBudgetSchema = z.object({
  currentBudget: z.number(),
  model: z.string().optional(),
  additionalTokens: z.number(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') || undefined;
    const budget = getDefaultThinkingBudget(model);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get thinking budget' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = topUpThinkingBudgetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'currentBudget and additionalTokens are required numbers' },
        { status: 400 }
      );
    }
    const { currentBudget, model, additionalTokens } = parsed.data;
    const budget = capThinkingBudget(model ?? '', currentBudget + additionalTokens);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to top up thinking budget' },
      { status: 500 }
    );
  }
}
