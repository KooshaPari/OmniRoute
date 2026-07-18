import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['admin', 'user', 'readonly']).default('user'),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
