#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

function homeJoin(...p: string[]) { return path.join(os.homedir(), ...p); }

async function main() {
  const pidsDir = homeJoin('.cloudflared', 'pids');
  try {
    const entries = await fs.readdir(pidsDir);
    if (!entries.length) {
      console.log('[tunnel-status] No tunnel PID files');
      return;
    }
    for (const f of entries) {
      if (!f.endsWith('.pid')) continue;
      const name = f.replace(/\.pid$/, '');
      const txt = await fs.readFile(path.join(pidsDir, f), 'utf8');
      const pid = parseInt(txt.trim(), 10);
      let running = false;
      try {
        process.kill(pid, 0);
        running = true;
      } catch {}
      console.log(`${name}: PID ${pid} ${running ? '(running)' : '(stale)'}`);
    }
  } catch {
    console.log('[tunnel-status] No pids directory');
  }
}

main();

