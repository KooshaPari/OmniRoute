import { z } from "zod";

export const selfHealingSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    windowSize: z.number().int().min(5).max(4000).optional(),
    warnThreshold: z.number().min(1).max(20).optional(),
    criticalThreshold: z.number().min(1).max(20).optional(),
    minSamplesForDetection: z.number().int().min(2).max(1000).optional(),
    retentionSeconds: z.number().int().min(60).max(604800).optional(),
    playbookEnabled: z.boolean().optional(),
    minSignalsPerDispatch: z.number().int().min(1).max(20).optional(),
    interActionCooldownMs: z.number().int().min(0).max(86400000).optional(),
  })
  .strict();
