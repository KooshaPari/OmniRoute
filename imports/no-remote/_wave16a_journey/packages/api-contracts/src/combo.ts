import { z } from 'zod';

export const ComboSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  primary: z.string(),
  fallbacks: z.array(z.string()).default([]),
  strategy: z.enum(['first-success', 'round-robin', 'cost-optimized', 'latency-optimized']).default('first-success'),
  createdAt: z.string().datetime().optional(),
});

export type Combo = z.infer<typeof ComboSchema>;
