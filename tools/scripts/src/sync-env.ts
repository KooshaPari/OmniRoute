/**
 * Reads .env.example, validates against a Zod schema, writes .env if missing.
 * Idempotent. Exits non-zero if .env is invalid.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import pc from 'picocolors';

const EnvSchema = z.object({
  PORT_WEB: z.coerce.number().int().default(5173),
  PORT_GATEWAY: z.coerce.number().int().default(20128),
  PORT_TAURI_DEV: z.coerce.number().int().default(1420),
  NODE_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  RUNTIME: z.enum(['bun', 'node']).default('bun'),
  PUBLIC_WEB_URL: z.url().default('http://localhost:5173'),
  PUBLIC_GATEWAY_URL: z.url().default('http://127.0.0.1:20128'),
  JWT_SECRET: z.string().min(16).default('dev-only-jwt-secret-CHANGE-ME-IN-PROD'),
  INITIAL_PASSWORD: z.string().min(1).default('CHANGEME'),
  DATABASE_URL: z.string().optional(),
  KBRIDGE_SOCKET: z.string().regex(/^\/[a-zA-Z0-9._/-]+$/u).default('/var/run/omniroute/gateway.sock'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
}).passthrough();

const root = resolve(import.meta.dirname, '../../../');
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

if (!existsSync(examplePath)) {
  console.error(pc.red(`sync-env: ${examplePath} not found`));
  process.exit(1);
}

const exampleText = readFileSync(examplePath, 'utf8');
const exampleLines = exampleText.split('\n').filter((l) => l && !l.startsWith('#'));

const exampleEnv: Record<string, string> = {};
for (const line of exampleLines) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/u.exec(line);
  if (m) exampleEnv[m[1]] = m[2];
}

if (!existsSync(envPath)) {
  writeFileSync(envPath, exampleText);
  console.log(pc.green(`sync-env: wrote ${envPath} from .env.example`));
}

const envText = readFileSync(envPath, 'utf8');
const envLines = envText.split('\n');
const current: Record<string, string> = {};
for (const line of envLines) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/u.exec(line);
  if (m) current[m[1]] = m[2];
}

let added = 0;
for (const [k, v] of Object.entries(exampleEnv)) {
  if (!(k in current)) {
    envLines.push(`${k}=${v}`);
    added += 1;
  }
}
if (added > 0) {
  writeFileSync(envPath, envLines.join('\n'));
  console.log(pc.green(`sync-env: appended ${added} new keys from .env.example`));
}

const parsed = EnvSchema.safeParse(current);
if (!parsed.success) {
  console.error(pc.red('sync-env: .env validation failed'));
  console.error(parsed.error.format());
  process.exit(1);
}
console.log(pc.green(`sync-env: ${envPath} validated OK`));
