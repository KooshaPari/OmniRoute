import type { Summarizer, SummarizerOpts } from "./types.ts";

const COMPRESSED_MARKER_RE = /^\[COMPRESSED:/;
const INTENT_TRIGGERS =
  /^(?:request|fix|implement|add|remove|update|refactor|create|delete|change|build)\s*:/i;
const FILE_PATH_RE =
  /[\w./-]+\.(?:ts|tsx|js|jsx|py|md|json|sql|css|html|yaml|yml|sh|rb|go|rs|java|c|cpp|h|hpp)/g;
const ERROR_RE = /(?:Error|error|ERROR):\s*\S+|error\s+TS\d+|Exception:\s*\S+/g;

function extractIntents(messages: Array<{ role: string; content?: string | unknown[] }>): string[] {
  const intents: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = extractText(msg.content);
    if (!text) continue;
    const firstLine = text.split("\n")[0]?.trim();
    if (firstLine && INTENT_TRIGGERS.test(firstLine)) {
      intents.push(firstLine.slice(0, 120));
    } else if (intents.length === 0 && firstLine) {
      intents.push(firstLine.slice(0, 120));
    }
  }
  return intents;
}

function extractFilePaths(
  messages: Array<{ role: string; content?: string | unknown[] }>
): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    const text = extractText(msg.content);
    if (!text) continue;
    const matches = text.match(FILE_PATH_RE);
    if (matches) {
      for (const m of matches) paths.add(m);
    }
  }
  return [...paths].slice(0, 20);
}

function extractErrors(messages: Array<{ role: string; content?: string | unknown[] }>): string[] {
  const errors: string[] = [];
  for (const msg of messages) {
    const text = extractText(msg.content);
    if (!text) continue;
    const matches = text.match(ERROR_RE);
    if (matches) {
      for (const m of matches) errors.push(m.slice(0, 150));
    }
  }
  return errors.slice(0, 10);
}

function extractLastDecision(
  messages: Array<{ role: string; content?: string | unknown[] }>
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      const text = extractText(messages[i].content);
      if (text) return text;
    }
  }
  return "";
}

function trimCodeFences(text: string): string {
  const fenceRe = /```[a-z]*\n([\s\S]*?)\n```/g;
  return text.replace(fenceRe, (_match, code: string) => {
    const lines = code.split("\n");
    if (lines.length <= 4) return _match;
    const head = lines.slice(0, 3).join("\n");
    const tail = lines[lines.length - 1];
    return "```" + head + "\n…\n" + tail + "\n```";
  });
}

function extractText(content?: string | unknown[]): string {
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

export class RuleBasedSummarizer implements Summarizer {
  summarize(messages: unknown[], opts?: SummarizerOpts): string {
    const maxLen = opts?.maxLen ?? 2000;
    const preserveCode = opts?.preserveCode ?? true;

    const typed = messages as Array<{ role: string; content?: string | unknown[] }>;

    const filtered = typed.filter((msg) => {
      const text = extractText(msg.content);
      if (!text || text.trim().length === 0) return false;
      return !COMPRESSED_MARKER_RE.test(text);
    });

    if (filtered.length === 0) return "";

    const intents = extractIntents(filtered);
    const files = extractFilePaths(filtered);
    const errors = extractErrors(filtered);
    const decision = extractLastDecision(filtered);

    const parts: string[] = ["[COMPRESSED:summary]"];

    if (intents.length > 0) {
      parts.push(`Intents: ${intents.join("; ")}.`);
    }
    if (files.length > 0) {
      parts.push(`Files touched: ${files.join(", ")}.`);
    }
    if (errors.length > 0) {
      parts.push(`Errors: ${errors.join("; ")}.`);
    }
    if (decision) {
      const processed = preserveCode ? trimCodeFences(decision) : decision;
      parts.push(`Last decision: ${processed.slice(0, 200)}.`);
    }

    let result = parts.join(" ");
    if (result.length > maxLen) {
      result = result.slice(0, maxLen - 3) + "...";
    }

    return result;
  }
}

export function createSummarizer(): Summarizer {
  return new RuleBasedSummarizer();
}
