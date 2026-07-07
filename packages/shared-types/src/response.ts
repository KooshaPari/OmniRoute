/**
 * ChatResponse + streaming ChatChunk.
 */
import { z } from 'zod';
import { ToolCall } from './request.ts';
import { MicroCents, Cost } from './money.ts';
import { ModelId, ISODateString } from './primitives.ts';

export const StopReason = z.enum(['stop', 'length', 'tool_calls', 'content_filter', 'error', 'canceled']);
export type StopReason = z.infer<typeof StopReason>;

export const Usage = z.object({
  promptTokens: z.number().int().min(0).max(10_000_000),
  completionTokens: z.number().int().min(0).max(10_000_000),
  totalTokens: z.number().int().min(0).max(20_000_000),
  cachedTokens: z.number().int().min(0).max(10_000_000).default(0),
  costMicroCents: MicroCents.optional(),
}).readonly();
export type Usage = z.infer<typeof Usage>;

export const ChatChoice = z.object({
  index: z.number().int().min(0).max(15),
  message: z.object({
    role: z.literal('assistant'),
    content: z.string().nullable(),
    toolCalls: z.array(ToolCall).max(64).optional(),
    refusal: z.string().nullable().optional(),
  }).readonly(),
  finishReason: StopReason,
  logprobs: z.unknown().nullable().optional(),
}).readonly();
export type ChatChoice = z.infer<typeof ChatChoice>;

export const ChatResponse = z.object({
  id: z.string().min(1).max(128),
  object: z.literal('chat.completion'),
  created: z.number().int().min(0),
  model: z.string(),
  providerId: z.string().optional(),
  comboName: z.string().optional(),
  choices: z.array(ChatChoice).min(1).max(16),
  usage: Usage,
  systemFingerprint: z.string().max(64).optional(),
}).readonly();
export type ChatResponse = z.infer<typeof ChatResponse>;

export const ChatChunkDelta = z.object({
  role: z.literal('assistant').optional(),
  content: z.string().nullable().optional(),
  toolCalls: z.array(z.object({
    index: z.number().int().min(0),
    id: z.string().optional(),
    type: z.literal('function').optional(),
    function: z.object({ name: z.string().optional(), arguments: z.string().optional() }).readonly().optional(),
  })).max(64).optional(),
}).readonly();
export type ChatChunkDelta = z.infer<typeof ChatChunkDelta>;

export const ChatChunkChoice = z.object({
  index: z.number().int().min(0).max(15),
  delta: ChatChunkDelta,
  finishReason: StopReason.nullable(),
}).readonly();
export type ChatChunkChoice = z.infer<typeof ChatChunkChoice>;

export const ChatChunk = z.object({
  id: z.string().min(1).max(128),
  object: z.literal('chat.completion.chunk'),
  created: z.number().int().min(0),
  model: z.string(),
  providerId: z.string().optional(),
  choices: z.array(ChatChunkChoice).min(1).max(16),
  usage: Usage.optional(),
}).readonly();
export type ChatChunk = z.infer<typeof ChatChunk>;

/** Re-export for convenience. */
export type ChatResponseCost = Cost;
export const ChatResponseCreated = ISODateString;
