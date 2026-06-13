#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

function homeJoin(...p: string[]) {
  return path.join(os.homedir(), ...p);
}

function dnsSafeSlug(v: string) {
  return (v || 'local')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  const [,, nameArg, portArg] = process.argv;
  const tunnelId = process.env.TUNNEL_ID || process.env.TUNNEL_ID?.trim();
  const domain = (process.env.TUNNEL_DOMAIN || 'kooshapari.com').toLowerCase();
  const name = dnsSafeSlug(nameArg || process.env.SRVC || 'local');
  const port = parseInt(portArg || process.env.PORT || '3000', 10);

  if (!tunnelId) {
    console.error('[tunnel-add] TUNNEL_ID env is required');
    process.exit(1);
  }
  if (!Number.isFinite(port)) {
    console.error('[tunnel-add] invalid port');
    process.exit(1);
  }

  const cfDir = homeJoin('.cloudflared');
  const credsFile = homeJoin('.cloudflared', `${tunnelId}.json`);
  const cfgPath = homeJoin('.cloudflared', `config-${name}.yml`);
  const pidsDir = homeJoin('.cloudflared', 'pids');
  const pidPath = path.join(pidsDir, `${name}.pid`);

  await ensureDir(cfDir);
  await ensureDir(pidsDir);

  const withPath = String(process.env.TUNNEL_PATH_ROUTE || '').toLowerCase() === 'true';
  const prefixRaw = (process.env.TUNNEL_PATH_PREFIX || name) + '';
  const prefix = dnsSafeSlug(prefixRaw);

  // Compose config YAML with optional path-based routing on apex domain
  let yaml = `tunnel: ${tunnelId}\n`+
    `credentials-file: ${credsFile}\n`+
    `ingress:\n`+
    `  - hostname: ${name}.${domain}\n`+
    `    service: http://localhost:${port}\n`;
  if (withPath) {
    yaml += `  - hostname: ${domain}\n`+
            `    path: /${prefix}/*\n`+
            `    service: http://localhost:${port}\n`;
  }
  yaml += `  - service: http_status:404\n`;

  await fs.writeFile(cfgPath, yaml, 'utf8');

  // Start cloudflared in background
  const child = spawn('cloudflared', ['tunnel', '--config', cfgPath, 'run'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  await fs.writeFile(pidPath, String(child.pid ?? ''), 'utf8');

  console.log(`[tunnel-add] Started ${name}.${domain} -> http://localhost:${port}`);
  if (withPath) console.log(`[tunnel-add] Path route https://${domain}/${prefix}/* -> http://localhost:${port}`);
  console.log(`[tunnel-add] PID ${child.pid} | config ${cfgPath}`);
}

main().catch((e) => {
  console.error('[tunnel-add] error:', e);
  process.exit(1);
});
