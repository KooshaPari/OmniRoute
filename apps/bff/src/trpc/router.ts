import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

const ProviderSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  type: z.enum(['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'openrouter', 'custom']),
  config: z.record(z.string(), z.unknown()).default({}),
});

const ComboSchema = z.object({
  id: z.string(),
  name: z.string(),
  primary: z.string(),
  fallbacks: z.array(z.string()).default([]),
  strategy: z.enum(['first-success', 'round-robin', 'cost-optimized', 'latency-optimized']).default('first-success'),
});

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok', ts: new Date().toISOString() })),

  providers: router({
    list: publicProcedure.query(() => []),
    byId: publicProcedure.input(z.object({ id: z.string() })).query(({ input: _input }) => null),
    create: publicProcedure.input(ProviderSchema).mutation(({ input }) => ({ ok: true, provider: input })),
    delete: publicProcedure.input(z.object({ id: z.string() })).mutation(() => ({ ok: true })),
  }),

  combos: router({
    list: publicProcedure.query(() => []),
    byId: publicProcedure.input(z.object({ id: z.string() })).query(() => null),
    create: publicProcedure.input(ComboSchema).mutation(({ input }) => ({ ok: true, combo: input })),
    update: publicProcedure.input(ComboSchema).mutation(({ input }) => ({ ok: true, combo: input })),
    delete: publicProcedure.input(z.object({ id: z.string() })).mutation(() => ({ ok: true })),
  }),

  usage: router({
    list: publicProcedure.query(() => []),
    byModel: publicProcedure.query(() => []),
  }),

  cost: router({
    list: publicProcedure.query(() => []),
    byProvider: publicProcedure.query(() => []),
  }),

  keys: router({
    list: publicProcedure.query(() => []),
    create: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input: _input }) => ({ ok: true })),
    revoke: publicProcedure.input(z.object({ id: z.string() })).mutation(() => ({ ok: true })),
  }),

  flags: router({
    list: publicProcedure.query(() => [
      { key: 'new-dashboard', default: true, rollout: 100, userOverride: null },
      { key: 'beta-compression', default: false, rollout: 25, userOverride: null },
    ]),
    setOverride: publicProcedure.input(z.object({ key: z.string(), value: z.boolean().nullable() })).mutation(() => ({ ok: true })),
  }),
});

export type AppRouter = typeof appRouter;
