/**
 * ChatRequest = canonical OpenAI-style chat completions payload.
 */
import { z } from 'zod';
import { ModelId, ISODateString } from './primitives.ts';

export const Role = z.enum(['system', 'user', 'assistant', 'tool', 'developer']);
export type Role = z.infer<typeof Role>;

export const TextPart = z.object({ type: z.literal('text'), text: z.string().min(1).max(128_000) }).readonly();
export const ImageUrlPart = z.object({
  type: z.literal('image_url'),
  imageUrl: z.object({ url: z.url(), detail: z.enum(['auto', 'low', 'high']).default('auto') }).readonly(),
}).readonly();
export const AudioPart = z.object({ type: z.literal('input_audio'), audio: z.object({ data: z.string(), format: z.enum(['wav', 'mp3']) }) }).readonly();
export const ContentPart = z.discriminatedUnion('type', [TextPart, ImageUrlPart, AudioPart]);
export type ContentPart = z.infer<typeof ContentPart>;

export const ChatMessage = z.object({
  role: Role,
  content: z.union([z.string().min(1).max(128_000), z.array(ContentPart).min(1).max(64)]),
  name: z.string().max(64).optional(),
  toolCallId: z.string().max(64).optional(),
}).readonly();
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ToolFunction = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/u),
  description: z.string().min(1).max(2048),
  parameters: z.record(z.string(), z.unknown()),
  strict: z.boolean().default(false),
}).readonly();
export type ToolFunction = z.infer<typeof ToolFunction>;

export const ChatTool = z.object({
  type: z.literal('function'),
  function: ToolFunction,
}).readonly();
export type ChatTool = z.infer<typeof ChatTool>;

export const ToolCall = z.object({
  id: z.string().min(1).max(64),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }).readonly(),
}).readonly();
export type ToolCall = z.infer<typeof ToolCall>;

export const ResponseFormat = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text') }).readonly(),
  z.object({ type: z.literal('json_object') }).readonly(),
  z.object({ type: z.literal('json_schema'), jsonSchema: z.object({ name: z.string(), schema: z.record(z.string(), z.unknown()), strict: z.boolean().default(false) }).readonly() }).readonly(),
]);
export type ResponseFormat = z.infer<typeof ResponseFormat>;

export const ChatRequest = z.object({
  model: z.string().min(1).max(256),
  messages: z.array(ChatMessage).min(1).max(2048),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(16).default(1),
  maxTokens: z.number().int().min(1).max(1_000_000).optional(),
  stop: z.union([z.string(), z.array(z.string()).max(8)]).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  user: z.string().max(64).optional(),
  tools: z.array(ChatTool).max(128).optional(),
  toolChoice: z.union([z.enum(['none', 'auto', 'required']), z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) })]).optional(),
  responseFormat: ResponseFormat.optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  stream: z.boolean().default(false),
}).readonly();
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatRequestEnvelope = z.object({
  request: ChatRequest,
  /** Optional routing hints — provider preferences, cost ceiling, etc. */
  routing: z.object({
    comboName: z.string().optional(),
    preferredProviders: z.array(z.string()).max(16).optional(),
    maxCostMicroCents: z.bigint().min(0n).optional(),
    deadlineMs: z.number().int().min(100).max(600_000).optional(),
  }).readonly().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
}).readonly();
export type ChatRequestEnvelope = z.infer<typeof ChatRequestEnvelope>;

export const ModelIdSchema = ModelId;
export const ChatRequestTimestamp = z.object({ sentAt: ISODateString }).readonly();
