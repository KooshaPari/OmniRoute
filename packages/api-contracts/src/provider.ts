import { z } from 'zod';

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  type: z.enum(['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'openrouter', 'custom']),
  config: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;
