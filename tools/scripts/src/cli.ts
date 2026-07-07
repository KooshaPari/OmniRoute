/**
 * argis — unified CLI for the argismonitor monorepo.
 * Usage: pnpm exec tsx src/cli.ts <command> [...args]
 *        bin/argis sync-env
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../');
const cmds: Record<string, { file: string; description: string }> = {
  'sync-env':     { file: 'sync-env.ts',         description: 'Sync .env from .env.example + Zod validation' },
  'parity':       { file: 'parity-check.ts',     description: 'Diff shared-types Zod ↔ backend-rust JSON schemas' },
  'codegen':      { file: 'codegen-app-type.ts', description: 'Synthesize Hono AppType export for sdk-js' },
  'seed':         { file: 'seed-dev.ts',         description: 'Seed local SQLite with dev fixtures' },
  'bench':        { file: 'bench-sse.ts',        description: 'Measure SSE first-token + total latency' },
  'parity-zod':   { file: 'parity-zod-rust.ts',  description: 'Compare Zod schemas against Rust serde via JSON Schema diff' },
};

function main(): void {
  const [, , cmd, ...args] = process.argv;
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log('argis — argismonitor dev tooling\n');
    for (const [name, { description }] of Object.entries(cmds)) console.log(`  ${name.padEnd(14)} ${description}`);
    return;
  }
  const c = cmds[cmd];
  if (!c) {
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
  }
  const file = resolve(root, 'tools/scripts/src', c.file);
  if (!existsSync(file)) {
    console.error(`script missing: ${file}`);
    process.exit(1);
  }
  const child = spawn('tsx', [file, ...args], { stdio: 'inherit', cwd: root });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
