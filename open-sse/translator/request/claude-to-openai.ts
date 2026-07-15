import { register } from "../registry.ts";
import { FORMATS } from "../formats.ts";
import { adjustMaxTokens } from "../helpers/maxTokensHelper.ts";

type JsonRecord = Record<string, unknown>;
const TOOL_CHOICE_ANY = ["a", "n", "y"].join("");

function normalizeOpenAIReasoningEffort(effort: unknown): string | undefined {
  if (typeof effort !== "string") return undefined;
  const normalized = effort.toLowerCase();
  if (normalized === "max") return "xhigh";
  return normalized || undefined;
}

// Convert Claude request to OpenAI format
<<<<<<< Updated upstream
export function claudeToOpenAIRequest(model, body, stream, credentials: unknown = null) {
  // #2069 — when the routed provider honors OpenAI-format cache_control breakpoints
  // (DashScope/alibaba, etc.) and the upstream caller requested preservation, keep
  // the client's cache_control markers on system + message text blocks instead of
  // collapsing them away during the Claude→OpenAI conversion.
  const preserveCacheControl =
    credentials !== null &&
    typeof credentials === "object" &&
    !Array.isArray(credentials) &&
    (credentials as JsonRecord)._preserveCacheControl === true;

=======
export function claudeToOpenAIRequest(model, body, stream) {
>>>>>>> Stashed changes
  const result: {
    model: string;
    messages: JsonRecord[];
    stream: unknown;
    [key: string]: unknown;
  } = {
    model: model,
    messages: [],
    stream: stream,
  };

  // Max tokens
  if (body.max_tokens) {
    result.max_tokens = adjustMaxTokens(body);
  }

  // Temperature
  if (body.temperature !== undefined) {
    result.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    result.top_p = body.top_p;
  }
  if (body.stop_sequences !== undefined) {
    result.stop = body.stop_sequences;
  }

  // System message
  if (body.system) {
<<<<<<< Updated upstream
    // When preserving cache_control for a caching-capable provider, and the client
    // tagged any system block, keep the array-of-blocks shape so the breakpoint
    // survives (DashScope reads cache_control off content blocks). Otherwise fall
    // back to the joined-string form expected by generic OpenAI providers (#2069).
    const systemHasCacheControl =
      preserveCacheControl &&
      Array.isArray(body.system) &&
      body.system.some((s) => s && typeof s === "object" && s.cache_control !== undefined);
=======
    const systemContent = Array.isArray(body.system)
      ? body.system.map((s) => s.text || "").join("\n")
      : body.system;
>>>>>>> Stashed changes

    const systemContent = systemHasCacheControl
      ? body.system.map((s) => {
          // body.system may be a mixed array — handle string elements (and
          // null/non-object) defensively so we never drop text or throw.
          if (typeof s === "string") return { type: "text", text: stripAnthropicBillingHeader(s) };
          const rawText = s && typeof s === "object" ? (s as JsonRecord).text || "" : "";
          const block: JsonRecord = { type: "text", text: stripAnthropicBillingHeader(rawText) };
          if (s && typeof s === "object" && (s as JsonRecord).cache_control !== undefined) {
            block.cache_control = (s as JsonRecord).cache_control;
          }
          return block;
        })
      : Array.isArray(body.system)
        ? body.system
            .map((s) => stripAnthropicBillingHeader(s.text || ""))
            .filter(Boolean)
            .join("\n")
        : stripAnthropicBillingHeader(body.system);

    if (systemHasCacheControl || systemContent) {
      result.messages.push({
        role: "system",
        content: systemContent,
      });
    }
  }

  // Convert messages
  if (body.messages && Array.isArray(body.messages)) {
    for (let i = 0; i < body.messages.length; i++) {
      const msg = body.messages[i];
      const converted = convertClaudeMessage(msg, preserveCacheControl);
      if (converted) {
        // Handle array of messages (multiple tool results)
        if (Array.isArray(converted)) {
          result.messages.push(...converted);
        } else {
          result.messages.push(converted);
        }
      }
    }
  }

  // Fix missing tool responses - OpenAI requires every tool_call to have a response
  fixMissingToolResponses(result.messages);

  // Tools
  if (body.tools && Array.isArray(body.tools)) {
    const normalizedTools = body.tools
      .map((tool) => {
        const name = typeof tool.name === "string" ? tool.name.trim() : "";
        if (!name) return null; // skip tools with empty/invalid name

        return {
          type: "function",
          function: {
            name,
            description: typeof tool.description === "string" ? tool.description : "", // fix: never null (#276)
            parameters: tool.input_schema || { type: "object", properties: {} },
          },
        };
      })
      .filter(
        (
          tool
        ): tool is {
          type: "function";
          function: { name: string; description: string; parameters: unknown };
        } => Boolean(tool)
      );

    if (normalizedTools.length > 0) {
      result.tools = normalizedTools;
    }
  }

  // Tool choice
  if (body.tool_choice) {
    result.tool_choice = convertToolChoice(body.tool_choice);
  }

  // Reasoning effort: map Claude-side thinking controls to OpenAI reasoning_effort.
  // Priority: output_config.effort (Claude Code) > thinking.budget_tokens (Claude native).
  // Budget buckets match the reverse mapping in thinkingBudget.ts::setCustomBudget.
  const outputEffort = normalizeOpenAIReasoningEffort(body.output_config?.effort) || "";
  if (outputEffort) {
    result.reasoning_effort = outputEffort;
  } else if (body.thinking?.type === "enabled" && typeof body.thinking.budget_tokens === "number") {
    const budget = body.thinking.budget_tokens;
    if (budget <= 0) {
      // disabled — leave reasoning_effort unset
    } else if (budget <= 1024) {
      result.reasoning_effort = "low";
    } else if (budget <= 10240) {
      result.reasoning_effort = "medium";
    } else if (budget < 131072) {
      result.reasoning_effort = "high";
    } else {
      result.reasoning_effort = "xhigh";
    }
  }

  return result;
}

// Fix missing tool responses - add empty responses for tool_calls without responses
function fixMissingToolResponses(messages) {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCallIds = msg.tool_calls.map((tc) => tc.id);

      // Collect all tool response IDs that IMMEDIATELY follow this assistant message
      const respondedIds = new Set();
      let insertPosition = i + 1;
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === "tool" && nextMsg.tool_call_id) {
          respondedIds.add(nextMsg.tool_call_id);
          insertPosition = j + 1;
        } else {
          break;
        }
      }

      // Find missing responses and insert them
      const missingIds = toolCallIds.filter((id) => !respondedIds.has(id));

      if (missingIds.length > 0) {
        const missingResponses = missingIds.map((id) => ({
          role: "tool",
          tool_call_id: id,
          content: "[No response received]",
        }));
        messages.splice(insertPosition, 0, ...missingResponses);
        i = insertPosition + missingResponses.length - 1;
      }
    }
  }
}

// Convert single Claude message - returns single message or array of messages
function convertClaudeMessage(msg, preserveCacheControl = false) {
  const role = msg.role === "user" || msg.role === "tool" ? "user" : "assistant";

  // Simple string content
  if (typeof msg.content === "string") {
    return { role, content: msg.content };
  }

  // Array content
  if (Array.isArray(msg.content)) {
    const parts = [];
    const toolCalls = [];
    const toolResults = [];
    let reasoningContent = null;

    for (const block of msg.content) {
      switch (block.type) {
        case "text": {
          const textPart: JsonRecord = { type: "text", text: block.text };
          // #2069 — carry the client's cache_control breakpoint through to
          // caching-capable OpenAI-format providers (DashScope/alibaba, etc.).
          if (preserveCacheControl && block.cache_control !== undefined) {
            textPart.cache_control = block.cache_control;
          }
          parts.push(textPart);
          break;
        }

        case "image":
          if (block.source?.type === "base64") {
            parts.push({
              type: "image_url",
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`,
              },
            });
          } else if (block.source?.type === "url" && typeof block.source.url === "string") {
            parts.push({
              type: "image_url",
              image_url: {
                url: block.source.url,
              },
            });
          }
          break;

        case "thinking":
          reasoningContent = block.thinking || block.text || "";
          break;

        case "redacted_thinking":
          if (reasoningContent == null) {
            reasoningContent = "";
          }
          break;

        case "tool_use":
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments:
                typeof block.input === "string"
                  ? block.input
                  : JSON.stringify(block.input || {}),
            },
          });
          break;

        case "tool_result":
          let resultContent = "";
          if (typeof block.content === "string") {
            resultContent = block.content;
          } else if (Array.isArray(block.content)) {
            // Keep text in the tool message; lift any images out as a following user
            // turn (OpenAI `tool` messages can't carry images). Without this, an
            // image-only tool_result is JSON.stringify'd → base64 as text, which
            // causes "input exceeds the context window" errors in OpenAI-protocol
            // upstreams (port of decolua/9router#2123 by alican532).
            const textParts: string[] = [];
            let hasImage = false;
            for (const c of block.content) {
              if (c.type === "text") {
                textParts.push(c.text);
              } else if (c.type === "image" && c.source?.type === "base64") {
                parts.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${c.source.media_type};base64,${c.source.data}`,
                  },
                });
                hasImage = true;
              }
            }
            resultContent =
              textParts.join("\n") ||
              (hasImage ? "[tool returned an image; see attached]" : JSON.stringify(block.content));
          } else if (block.content) {
            resultContent = JSON.stringify(block.content);
          }

          toolResults.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: resultContent,
          });
          break;
      }
    }

    // If has tool results, return array of tool messages
    if (toolResults.length > 0) {
      if (parts.length > 0) {
        const textContent = parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
        return [...toolResults, { role: "user", content: textContent }];
      }
      return toolResults;
    }

    // If has tool calls, return assistant message with tool_calls
    if (toolCalls.length > 0) {
      const result: JsonRecord = { role: "assistant" };
      if (parts.length > 0) {
        result.content = parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
      }
      result.tool_calls = toolCalls;
      if (reasoningContent !== null) {
        result.reasoning_content = reasoningContent;
      }
      return result;
    }

    // Return content
    if (parts.length > 0) {
      const result: JsonRecord = {
        role,
        content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
      };
      if (reasoningContent !== null && role === "assistant") {
        result.reasoning_content = reasoningContent;
      }
      return result;
    }

    // Empty content array
    if (msg.content.length === 0) {
      const result: JsonRecord = { role, content: "" };
      if (reasoningContent !== null && role === "assistant") {
        result.reasoning_content = reasoningContent;
      }
      return result;
    }

    if (reasoningContent !== null && role === "assistant") {
      return { role, content: "", reasoning_content: reasoningContent };
    }
  }

  return null;
}

// Convert tool choice
function convertToolChoice(choice) {
  if (!choice) return "auto";
  if (typeof choice === "string") return choice;

  switch (choice.type) {
    case "auto":
      return "auto";
    case TOOL_CHOICE_ANY:
      return "required";
    case "tool":
      return { type: "function", function: { name: choice.name } };
    default:
      return "auto";
  }
}

// Register
register(FORMATS.CLAUDE, FORMATS.OPENAI, claudeToOpenAIRequest, null);
