#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

function homeJoin(...p: string[]) { return path.join(os.homedir(), ...p); }

async function main() {
  const [,, nameArg] = process.argv;
  const name = (nameArg || process.env.SRVC || 'local').toLowerCase();
  const pidPath = homeJoin('.cloudflared', 'pids', `${name}.pid`);

  try {
    const text = await fs.readFile(pidPath, 'utf8');
    const pid = parseInt(text.trim(), 10);
    if (!Number.isFinite(pid)) throw new Error('invalid pid');
    try {
      process.kill(pid, 0); // test
      process.kill(pid, 'SIGTERM');
      console.log(`[tunnel-down] Sent SIGTERM to PID ${pid} for ${name}`);
    } catch {
      console.log(`[tunnel-down] Process not running for ${name}`);
    }
    await fs.rm(pidPath, { force: true });
  } catch (e) {
    console.error(`[tunnel-down] No pid file for ${name}`, e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

main();

