import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { applyCompression } from "@omniroute/open-sse/services/compression/strategySelector";
import type { CompressionMode } from "@omniroute/open-sse/services/compression/types";

const PreviewRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.union([z.string(), z.array(z.unknown())]),
      })
    )
    .min(1),
  mode: z.enum(["off", "lite", "standard", "aggressive", "ultra"]),
});

function countTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);
}

function messagesToText(messages: Array<{ role: string; content: unknown }>): string {
  return messages
    .map((m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role}: ${content}`;
    })
    .join("\n");
}

export async function POST(req: Request) {
  const policy = await enforceApiKeyPolicy(req, "settings");
  if (policy.rejection) return policy.rejection;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { messages, mode } = parsed.data;
  const originalText = messagesToText(messages);
  const originalTokens = countTokens(originalText);

  try {
    const start = Date.now();
    const requestBody = { messages };
    const result = await applyCompression(requestBody as Record<string, unknown>, mode);
    const durationMs = Date.now() - start;

    const compressedMessages = (result.body.messages ?? messages) as Array<{
      role: string;
      content: unknown;
    }>;
    const compressedText = messagesToText(compressedMessages);
    const compressedTokens = countTokens(compressedText);
    const tokensSaved = Math.max(0, originalTokens - compressedTokens);
    const savingsPct = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;
    const techniquesUsed: string[] = result.stats?.techniquesUsed ?? [];

    return NextResponse.json({
      original: originalText,
      compressed: compressedText,
      originalTokens,
      compressedTokens,
      tokensSaved,
      savingsPct,
      techniquesUsed,
      durationMs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/compression/preview]", msg);
    return NextResponse.json({ error: "Compression failed", details: msg }, { status: 500 });
  }
}
