import { NextRequest, NextResponse } from 'next/server';
import { getDefaultThinkingBudget, topUpThinkingBudget } from '@omniroute/open-sse/services/thinkingBudget';

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
    const body = await request.json();
    const { currentBudget, model, additionalTokens } = body;
    if (typeof currentBudget !== 'number' || typeof additionalTokens !== 'number') {
      return NextResponse.json(
        { error: 'currentBudget and additionalTokens are required numbers' },
        { status: 400 }
      );
    }
    const budget = topUpThinkingBudget(currentBudget, model, additionalTokens);
    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to top up thinking budget' },
      { status: 500 }
    );
  }
}
