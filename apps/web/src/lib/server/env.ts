/**
 * Strict env access. Use this everywhere instead of process.env directly.
 */
import { env } from '$env/dynamic/private';
import { env as pub } from '$env/dynamic/public';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT_WEB: z.coerce.number().int().min(1).max(65535).default(5173),
  PORT_GATEWAY: z.coerce.number().int().min(1).max(65535).default(20128),
  PORT_TAURI_DEV: z.coerce.number().int().min(1).max(65535).default(1420),
  NODE_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  RUNTIME: z.enum(['bun', 'node']).default('bun'),
  PUBLIC_WEB_URL: z.url().default('http://localhost:5173'),
  PUBLIC_GATEWAY_URL: z.url().default('http://127.0.0.1:20128'),
  JWT_SECRET: z.string().min(16).default('dev-only-jwt-secret-CHANGE-ME-IN-PROD'),
  INITIAL_PASSWORD: z.string().min(1).default('CHANGEME'),
  DATABASE_URL: z.string().optional(),
  KBRIDGE_SOCKET: z.string().regex(/^\/[a-zA-Z0-9._/-]+$/u).default('/var/run/omniroute/gateway.sock'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export const config = EnvSchema.parse({ ...env, ...pub });
export type Config = z.infer<typeof EnvSchema>;
