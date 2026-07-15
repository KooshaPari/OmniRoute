/**
 * OpenAI to Kiro Request Translator
 * Converts OpenAI Chat Completions format to Kiro/AWS CodeWhisperer format
 */
import { register } from "../registry.ts";
import { FORMATS } from "../formats.ts";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";

function parseToolInput(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
<<<<<<< Updated upstream
 * Recursively sanitize JSON Schema for Kiro API.
 * Kiro returns 400 "Improperly formed request" if:
 * - `required` is an empty array []
 * - `additionalProperties` is present anywhere
 */
function normalizeKiroToolSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }

  const result: Record<string, unknown> = {};
  const src = schema as Record<string, unknown>;

  for (const [key, value] of Object.entries(src)) {
    // Skip empty required arrays — Kiro rejects them
    if (key === "required" && Array.isArray(value) && value.length === 0) {
      continue;
    }
    // Skip additionalProperties — Kiro doesn't support it
    if (key === "additionalProperties") {
      continue;
    }
    // Recursively process nested objects
    if (
      key === "properties" &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      const sanitizedProps: Record<string, unknown> = {};
      for (const [propName, propValue] of Object.entries(value as Record<string, unknown>)) {
        sanitizedProps[propName] = normalizeKiroToolSchema(propValue);
      }
      result[key] = sanitizedProps;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = normalizeKiroToolSchema(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? normalizeKiroToolSchema(item)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

function serializeToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content || "(no output)";
  }
  if (!Array.isArray(content)) {
    if (content !== null && content !== undefined) {
      try {
        return JSON.stringify(content);
      } catch {
        return "(no output)";
      }
    }
    return "(no output)";
  }
  const parts: string[] = [];
  for (const block of content as Array<Record<string, unknown>>) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && typeof block.text === "string") {
      if (block.text) parts.push(block.text);
    } else if (block.type === "image" || block.type === "image_url") {
      const src = block.source as Record<string, unknown> | undefined;
      const mediaType = src?.media_type ?? block.media_type ?? "image";
      parts.push(`[image: ${mediaType}]`);
    } else {
      try {
        const str = JSON.stringify(block);
        if (str && str !== "{}") parts.push(str);
      } catch {
        // skip unserializable block
      }
    }
  }
  return parts.join("\n") || "(no output)";
}

/**
 * Wrap system-prompt content in <system-reminder> tags before it is merged into
 * a Kiro user message. Kiro/CodeWhisperer has no `system` role, so without this
 * the system prompt would appear as raw user text (issue #2306).
 */
function wrapSystemReminder(text: string): string {
  return `<system-reminder>\n${text}\n</system-reminder>`;
}

/**
=======
>>>>>>> Stashed changes
 * Convert OpenAI messages to Kiro format
 * Rules: system/tool/user -> user role, merge consecutive same roles
 */
function convertMessages(messages, tools, model) {
  let history = [];
  let currentMessage = null;

  let pendingUserContent = [];
  let pendingAssistantContent = [];
  let pendingToolResults = [];
  let currentRole = null;

  const flushPending = () => {
    if (currentRole === "user") {
<<<<<<< Updated upstream
      // Kiro accepts an empty user `content` when the turn carries toolResults or
      // images (the agentic tool-loop case), so the "(empty)" placeholder is only
      // needed for a genuinely bare turn. Without this check, a trailing
      // tool-result-only turn (no follow-up user text) would get the literal
      // "(empty)" injected as if the user had typed it, which can confuse Kiro.
      // See decolua/9router#2183 for the same bug class.
      const text = pendingUserContent.join("\n\n").trim();
      const hasContext = pendingToolResults.length > 0 || pendingImages.length > 0;
      const content = text || (hasContext ? "" : "(empty)");
=======
      const content = pendingUserContent.join("\n\n").trim() || "continue";
>>>>>>> Stashed changes
      const userMsg: {
        userInputMessage: {
          content: string;
          modelId: string;
          userInputMessageContext?: {
            toolResults?: Array<Record<string, unknown>>;
            tools?: Array<Record<string, unknown>>;
          };
        };
      } = {
        userInputMessage: {
          content: content,
          modelId: "",
        },
      };

      if (pendingToolResults.length > 0) {
        userMsg.userInputMessage.userInputMessageContext = {
          toolResults: pendingToolResults,
        };
      }

      // Add tools to first user message
      if (tools && tools.length > 0 && history.length === 0) {
        if (!userMsg.userInputMessage.userInputMessageContext) {
          userMsg.userInputMessage.userInputMessageContext = {};
        }
        userMsg.userInputMessage.userInputMessageContext.tools = tools.map((t) => {
          const name = t.function?.name || t.name;
          let description = t.function?.description || t.description || "";

          if (!description.trim()) {
            description = `Tool: ${name}`;
          }

          return {
            toolSpecification: {
              name,
              description,
              inputSchema: {
                json: t.function?.parameters || t.parameters || t.input_schema || {},
              },
            },
          };
        });
      }

      history.push(userMsg);
      currentMessage = userMsg;
      pendingUserContent = [];
      pendingToolResults = [];
    } else if (currentRole === "assistant") {
      const content = pendingAssistantContent.join("\n\n").trim() || "...";
      const assistantMsg = {
        assistantResponseMessage: {
          content: content,
        },
      };
      history.push(assistantMsg);
      pendingAssistantContent = [];
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    let role = msg.role;

    // Normalize: system/tool -> user
    if (role === "system" || role === "tool") {
      role = "user";
    }

    // If role changes, flush pending
    if (role !== currentRole && currentRole !== null) {
      flushPending();
    }
    currentRole = role;

    if (role === "user") {
      // Extract content
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((c) => c.type === "text" || c.text)
          .map((c) => c.text || "");
        content = textParts.join("\n");

        // Check for tool_result blocks
        const toolResultBlocks = msg.content.filter((c) => c.type === "tool_result");
        if (toolResultBlocks.length > 0) {
          toolResultBlocks.forEach((block) => {
            const text = Array.isArray(block.content)
              ? block.content.map((c) => c.text || "").join("\n")
              : typeof block.content === "string"
                ? block.content
                : "";

            pendingToolResults.push({
              toolUseId: block.tool_use_id,
              status: "success",
              content: [{ text: text }],
            });
          });
        }
      }

      // Handle tool role (from normalized)
      if (msg.role === "tool") {
        const toolContent = typeof msg.content === "string" ? msg.content : "";
        pendingToolResults.push({
          toolUseId: msg.tool_call_id,
          status: "success",
          content: [{ text: toolContent }],
        });
      } else if (content) {
        // #2306: Kiro/CodeWhisperer has no `system` role, so system messages are
        // normalized to `user`. Wrap their content in <system-reminder> tags so
        // the model can tell the system prompt apart from real user input instead
        // of treating the full Claude Code prompt as something the user typed.
        pendingUserContent.push(msg.role === "system" ? wrapSystemReminder(content) : content);
      }
    } else if (role === "assistant") {
      // Extract text content and tool uses
      let textContent = "";
      let toolUses = [];

      if (Array.isArray(msg.content)) {
        const textBlocks = msg.content.filter((c) => c.type === "text");
        textContent = textBlocks
          .map((b) => b.text)
          .join("\n")
          .trim();

        const toolUseBlocks = msg.content.filter((c) => c.type === "tool_use");
        toolUses = toolUseBlocks;
      } else if (typeof msg.content === "string") {
        textContent = msg.content.trim();
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        toolUses = msg.tool_calls;
      }

      if (textContent) {
        pendingAssistantContent.push(textContent);
      }

      // Store tool uses in last assistant message
      if (toolUses.length > 0) {
        if (pendingAssistantContent.length === 0) {
          // pendingAssistantContent.push("Call tools");
        }

        // Flush to create assistant message with toolUses
        flushPending();

        const lastMsg = history[history.length - 1];
        if (lastMsg?.assistantResponseMessage) {
          lastMsg.assistantResponseMessage.toolUses = toolUses.map((tc) => {
            if (tc.function) {
              return {
                toolUseId: tc.id || uuidv4(),
                name: tc.function.name,
                input: parseToolInput(tc.function.arguments),
              };
            } else {
              return {
                toolUseId: tc.id || uuidv4(),
                name: tc.name,
                input: parseToolInput(tc.input),
              };
            }
          });
        }

        currentRole = null;
      }
    }
  }

  // Flush remaining
  if (currentRole !== null) {
    flushPending();
  }

<<<<<<< Updated upstream
  // Kiro requires currentMessage to be a user turn. If the request ends with a
  // user turn, move that final turn into currentMessage. If it ends with an
  // assistant/tool turn, synthesize a neutral filler ("...") instead of the
  // literal "Continue", which Kiro can read as a real instruction (#5231).
  if (history.length > 0 && history[history.length - 1].userInputMessage) {
    currentMessage = history.pop();
  } else {
    currentMessage = {
      userInputMessage: {
        content: "...",
        modelId: model,
      },
    };
  }

  // Promote the tools schema to currentMessage. Tools may have been attached
  // to any user turn in history (e.g. when the first message was assistant or
  // had an undefined role, the first user flush lands further down). Scan the
  // whole history so we never lose the schema.
  if (!currentMessage?.userInputMessage?.userInputMessageContext?.tools) {
    const carrier = history.find((item) => item?.userInputMessage?.userInputMessageContext?.tools);
    if (carrier?.userInputMessage?.userInputMessageContext?.tools) {
      if (!currentMessage.userInputMessage.userInputMessageContext) {
        currentMessage.userInputMessage.userInputMessageContext = {};
      }
      currentMessage.userInputMessage.userInputMessageContext.tools =
        carrier.userInputMessage.userInputMessageContext.tools;
    }
  }

  // Fallback: if the schema was never attached to any user turn (e.g. the
  // input contained no user messages and currentMessage is a synthesized
  // neutral-filler turn), attach the provided tools directly to currentMessage so
  // Kiro still sees the schema it needs to validate assistant.toolUses in
  // history.
=======
  // If last message in history is userInputMessage, use it as currentMessage
  if (history.length > 0 && history[history.length - 1].userInputMessage) {
    currentMessage = history.pop();
  }

  const firstHistoryItem = history[0];
>>>>>>> Stashed changes
  if (
    firstHistoryItem?.userInputMessage?.userInputMessageContext?.tools &&
    !currentMessage?.userInputMessage?.userInputMessageContext?.tools
  ) {
    if (!currentMessage.userInputMessage.userInputMessageContext) {
      currentMessage.userInputMessage.userInputMessageContext = {};
    }
    currentMessage.userInputMessage.userInputMessageContext.tools =
      firstHistoryItem.userInputMessage.userInputMessageContext.tools;
  }

  // Clean up history for Kiro API compatibility
  history.forEach((item) => {
    if (item.userInputMessage?.userInputMessageContext?.tools) {
      delete item.userInputMessage.userInputMessageContext.tools;
    }

    if (
      item.userInputMessage?.userInputMessageContext &&
      Object.keys(item.userInputMessage.userInputMessageContext).length === 0
    ) {
      delete item.userInputMessage.userInputMessageContext;
    }

    if (item.userInputMessage && !item.userInputMessage.modelId) {
      item.userInputMessage.modelId = model;
    }
  });

  return { history, currentMessage };
}

/**
 * Build Kiro payload from OpenAI format
 */
export function buildKiroPayload(model, body, stream, credentials) {
<<<<<<< Updated upstream
  // Reject the Anthropic-only `[1m]` context beta before it reaches Bedrock —
  // Kiro cannot honor it and a forwarded `kr/*[1m]` id is malformed upstream.
  if (hasUnsupportedKiroContextSuffix(model)) {
    throw new Error(KIRO_UNSUPPORTED_CONTEXT_1M_MESSAGE);
  }

  // Normalize model name: Claude Code sends dashes (claude-sonnet-4-6),
  // Kiro API expects dots (claude-sonnet-4.6). Convert trailing version segment.
  // The minor group is bounded to 1-2 digits so date-suffixed ids (e.g.
  // claude-opus-4-20250514) are never mistaken for a dash-separated minor
  // version and corrupted into claude-opus-4.20250514 (upstream 9router #2270).
  const normalizedModel = model.replace(
    /^(claude-(?:opus|sonnet|haiku|3-\d+)-\d+)-(\d{1,2})$/,
    "$1.$2"
  );
=======
>>>>>>> Stashed changes
  const messages = body.messages || [];
  const tools = body.tools || [];
  const maxTokens = body.max_tokens ?? body.max_completion_tokens ?? 32000;
  const temperature = body.temperature;
  const topP = body.top_p;

  const { history, currentMessage } = convertMessages(messages, tools, model);

  const profileArn = credentials?.providerSpecificData?.profileArn || "";

  let finalContent = currentMessage?.userInputMessage?.content || "";
  const timestamp = new Date().toISOString();
  finalContent = `[Context: Current time is ${timestamp}]\n\n${finalContent}`;

  const payload: {
    conversationState: {
      chatTriggerType: string;
      conversationId: string;
      currentMessage: {
        userInputMessage: {
          content: string;
          modelId: string;
          origin: string;
          userInputMessageContext?: Record<string, unknown>;
        };
      };
      history: unknown[];
    };
    profileArn?: string;
    inferenceConfig?: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
    };
  } = {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: uuidv4(), // We must override this with deterministic ID
      currentMessage: {
        userInputMessage: {
          content: finalContent,
          modelId: model,
          origin: "AI_EDITOR",
          ...(currentMessage?.userInputMessage?.userInputMessageContext && {
            userInputMessageContext: currentMessage.userInputMessage.userInputMessageContext,
          }),
        },
      },
      history: history,
    },
  };

  // Determistic session caching for Kiro
  const NAMESPACE_KIRO = "34f7193f-561d-4050-bc84-9547d953d6bf";
  const firstContent =
    history.length > 0 && history[0].userInputMessage?.content
      ? history[0].userInputMessage.content
      : finalContent;

  // Use uuidv5 with the hash of the system prompt / first message to maintain AWS Builder ID context cache
  payload.conversationState.conversationId = uuidv5(
    (firstContent || "").substring(0, 4000),
    NAMESPACE_KIRO
  );

  if (profileArn) {
    payload.profileArn = profileArn;
  }

  if (maxTokens || temperature !== undefined || topP !== undefined) {
    payload.inferenceConfig = {};
    if (maxTokens) payload.inferenceConfig.maxTokens = maxTokens;
    if (temperature !== undefined) payload.inferenceConfig.temperature = temperature;
    if (topP !== undefined) payload.inferenceConfig.topP = topP;
  }

  return payload;
}

register(FORMATS.OPENAI, FORMATS.KIRO, buildKiroPayload, null);
