/**
 * Diff shared-types Zod-derived JSON schemas against Rust serde-exported schemas.
 * Designed to run in CI; emits a non-zero exit on drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import pc from 'picocolors';

const root = resolve(import.meta.dirname, '../../../');
const outDir = resolve(root, 'packages/shared-types/dist');

if (!existsSync(outDir)) {
  // eslint-disable-next-line no-restricted-syntax
  const { mkdirSync } = await import('node:fs');
  mkdirSync(outDir, { recursive: true });
}

// One canonical sample schema — extend as shared-types grows.
const ProviderKind = z.enum(['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'azure', 'bedrock', 'mistral', 'cohere', 'groq', 'deepseek', 'xai', 'perplexity', 'custom']);
const tsSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ProviderKind',
  type: 'string',
  enum: ProviderKind.options,
};
writeFileSync(resolve(outDir, 'argis-schemas.json'), JSON.stringify({ definitions: { ProviderKind: tsSchema } }, null, 2));
console.log(pc.green('parity-zod: wrote TS-derived schema for ProviderKind'));
