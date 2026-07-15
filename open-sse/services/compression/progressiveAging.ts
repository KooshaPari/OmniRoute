import type { AgingThresholds, Summarizer } from "./types.ts";
import { DEFAULT_AGGRESSIVE_CONFIG } from "./types.ts";
import { applyLiteCompression } from "./lite.ts";
import { cavemanCompress } from "./caveman.ts";

const COMPRESSED_MARKER_RE = /^\[COMPRESSED:/;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface ChatMessage {
  role: string;
  content?: string | Array<{ type: string; text?: string }>;
}

function extractText(content?: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (p): p is { type: string; text?: string } =>
          typeof p === "object" && p !== null && "text" in p
      )
      .map((p) => p.text ?? "")
      .join("\n");
  }
  return "";
}

function setContent(msg: ChatMessage, newContent: string): ChatMessage {
  if (typeof msg.content === "string") {
    return { ...msg, content: newContent };
  }
  return { ...msg, content: [{ type: "text", text: newContent }] };
}

export function applyAging(
  messages: unknown[],
  thresholds?: AgingThresholds,
  summarizer?: Summarizer
): { messages: unknown[]; saved: number } {
  const t = thresholds ?? DEFAULT_AGGRESSIVE_CONFIG.thresholds;
  const sum = summarizer ?? {
    summarize: (msgs: unknown[]) => {
      const typed = msgs as ChatMessage[];
      const last = typed.filter((m) => m.role === "assistant").pop();
      return last ? extractText(last.content).slice(0, 200) : "";
    },
  };

  const typed = messages as ChatMessage[];
  if (typed.length === 0) return { messages: [], saved: 0 };

  const totalMessages = typed.length;
  const result: ChatMessage[] = [];
  let saved = 0;

  for (let i = 0; i < typed.length; i++) {
    const msg = typed[i];
    const text = extractText(msg.content);

    if (COMPRESSED_MARKER_RE.test(text)) {
      result.push(msg);
      continue;
    }

    const distanceFromEnd = totalMessages - 1 - i;

    if (distanceFromEnd <= t.verbatim) {
      result.push(msg);
    } else if (distanceFromEnd <= t.light) {
      const compressed = applyLiteCompression({ messages: [msg] });
      if (compressed?.body?.messages?.[0]?.content) {
        const newContent =
          typeof compressed.body.messages[0].content === "string"
            ? compressed.body.messages[0].content
            : extractText(compressed.body.messages[0].content);
        const tagged = `[COMPRESSED:aging:light] ${newContent}`;
        saved += estimateTokens(text) - estimateTokens(tagged);
        result.push(setContent(msg, tagged));
      } else {
        result.push(msg);
      }
    } else if (distanceFromEnd <= t.moderate) {
      const compressed = cavemanCompress({ messages: [msg] });
      if (compressed?.body?.messages?.[0]?.content) {
        const newContent =
          typeof compressed.body.messages[0].content === "string"
            ? compressed.body.messages[0].content
            : extractText(compressed.body.messages[0].content);
        const tagged = `[COMPRESSED:aging:moderate] ${newContent}`;
        saved += estimateTokens(text) - estimateTokens(tagged);
        result.push(setContent(msg, tagged));
      } else {
        result.push(msg);
      }
    } else {
      if (msg.role === "assistant") {
        const summary = sum.summarize([msg]);
        const tagged = `[COMPRESSED:aging:fullSummary] ${summary}`;
        saved += estimateTokens(text) - estimateTokens(tagged);
        result.push(setContent(msg, tagged));
      } else if (msg.role === "user") {
        const firstLine = text.split("\n")[0]?.slice(0, 120) ?? "";
        const tagged = `[COMPRESSED:aging:fullSummary] ${firstLine}`;
        saved += estimateTokens(text) - estimateTokens(tagged);
        result.push(setContent(msg, tagged));
      } else {
        result.push(msg);
      }
    }
  }

  return { messages: result, saved: Math.max(0, saved) };
}
