import { NextRequest, NextResponse } from 'next/server';
import { capThinkingBudget, getDefaultThinkingBudget } from '@/lib/modelCapabilities';

type TopUpThinkingBudgetBody = {
  currentBudget: number;
  model?: string;
  additionalTokens: number;
};

const topUpThinkingBudgetSchema = {
  safeParse(value: unknown):
    | { success: true; data: TopUpThinkingBudgetBody }
    | { success: false } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { success: false };
    }
    const body = value as Record<string, unknown>;
    if (typeof body.currentBudget !== 'number' || typeof body.additionalTokens !== 'number') {
      return { success: false };
    }
    if (body.model !== undefined && typeof body.model !== 'string') {
      return { success: false };
    }
    return {
      success: true,
      data: {
        currentBudget: body.currentBudget,
        additionalTokens: body.additionalTokens,
        model: body.model,
      },
    };
  },
};

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
