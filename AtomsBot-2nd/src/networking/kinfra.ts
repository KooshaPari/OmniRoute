import path from 'path';
import { logger } from '../logger';
import os from 'os';
import { promises as fsp } from 'fs';
import { spawn, ChildProcessWithoutNullStreams, ChildProcess } from 'child_process';

/* KInfra networking helpers: dynamic port allocation + optional cloudflared tunnel */

import { Server } from 'http';
import type express from 'express';

export interface StartOptions {
  preferredPort?: number;
  respectEnvPort?: boolean; // if true, use process.env.PORT when present
  dynamicFallback?: boolean; // if preferred/ENV port busy, fall back to a free port
  enableTunnel?: boolean; // if true, attempt KInfra tunnel
  kinfraLibPath?: string; // override path to KInfra NodeJS library
}

export interface StartResult {
  server: Server;
  port: number;
  tunnelUrl?: string;
  expectedHost?: string;
}

export async function allocateFreePort(preferred?: number): Promise<number> {
  const net = await import('net');
  const tryBind = (port: number): Promise<number | null> => new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      try { tester.close(); } catch {}
      resolve(null);
    });
    tester.once('listening', () => {
      const addr = tester.address();
      const p = typeof addr === 'object' && addr ? (addr as any).port : port;
      tester.close(() => resolve(p));
    });
    try { tester.listen(port); } catch { resolve(null); }
  });

  if (preferred && preferred > 0) {
    const ok = await tryBind(preferred);
    if (ok) return preferred;
  }
  // Ask OS to pick a free port
  const picked = await tryBind(0);
  if (picked && picked > 0) return picked;
  throw new Error('Failed to allocate a free port');
}

export async function createKinfraTunnelIfEnabled(port: number, opts?: { kinfraLibPath?: string }): Promise<string | undefined> {
  // Only attempt when explicitly enabled
  if (process.env.ENABLE_KINFRA_TUNNEL !== 'true') return undefined;
  // If a named tunnel is configured, handle via named route instead
  if (process.env.TUNNEL_ID) return undefined;

  try {
    const libPath = opts?.kinfraLibPath || process.env.KINFRA_NODE_LIB || path.resolve(process.cwd(), 'KInfra/libraries/nodejs/dist/tunnel-manager.js');
    const mod = await import(libPath);
    const TunnelManager = mod.TunnelManager || mod.default;
    if (!TunnelManager) throw new Error('TunnelManager export not found in KInfra module');
    const manager = new TunnelManager();

    const domainEnv = process.env.TUNNEL_DOMAIN || 'kooshapari.com';
    const srvc = process.env.SRVC || process.env.SERVICE_SLUG || process.env.SERVICE_NAME || 'local';
    const expectedHost = `${srvc}.${domainEnv}`;
    const name = process.env.TUNNEL_NAME ? ` name=${process.env.TUNNEL_NAME}` : '';
    logger.info(`[NETWORK] Starting KInfra tunnel on port ${port} (${domainEnv})${name}`);
    logger.info(`[NETWORK] Expected public hostname: https://${expectedHost}`);

    const tun = await manager.createQuickTunnel({
      port,
      startupTimeout: 60000,
      protocol: 'http',
      // Intentionally pass through process env so KInfra can reuse configured named tunnel
      env: process.env as any,
    });

    if (tun?.url) logger.info(`[NETWORK] Tunnel ready: ${tun.url}`);
    else logger.info('[NETWORK] Tunnel started (named tunnel in use)');

    return tun?.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`[NETWORK] KInfra tunnel unavailable: ${msg}`);
    return undefined;
  }
}

async function waitForHealth(base: string, totalTimeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  const to = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let delay = 500;
  while (Date.now() - start < totalTimeoutMs) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${base.replace(/\/$/, '')}/healthz`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return true;
    } catch {}
    await to(delay);
    delay = Math.min(delay * 1.5, 2000);
  }
  return false;
}

function dnsSafeSlug(v: string) {
  return (v || 'local')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

async function ensureNamedTunnelRoute(port: number): Promise<{ expectedHost: string; configPath: string; child?: ChildProcessWithoutNullStreams }> {
  const domainEnv = (process.env.TUNNEL_DOMAIN || 'kooshapari.com').toLowerCase();
  const rawSrvc = (process.env.SRVC || process.env.SERVICE_SLUG || process.env.SERVICE_NAME || 'local') + '';
  const srvc = dnsSafeSlug(rawSrvc);
  const prefix = dnsSafeSlug(((process.env.TUNNEL_PATH_PREFIX || srvc) + ''));
  const expectedHost = `${srvc}.${domainEnv}`;
  const tunnelId = process.env.TUNNEL_ID as string;
  const home = os.homedir();
  const cfDir = path.join(home, '.cloudflared');
  const credsFile = path.join(cfDir, `${tunnelId}.json`);
  const cfgPath = path.join(cfDir, `config-${srvc}.yml`);

  await ensureDir(cfDir);
  const withPath = String(process.env.TUNNEL_PATH_ROUTE || '').toLowerCase() === 'true';
  let yaml = `tunnel: ${tunnelId}\n`+
    `credentials-file: ${credsFile}\n`+
    `ingress:\n`+
    `  - hostname: ${expectedHost}\n`+
    `    service: http://localhost:${port}\n`;
  if (withPath) {
    yaml += `  - hostname: ${domainEnv}\n`+
            `    path: /${prefix}/*\n`+
            `    service: http://localhost:${port}\n`;
  }
  yaml += `  - service: http_status:404\n`;
  await fsp.writeFile(cfgPath, yaml, 'utf8');

  logger.info(`[NETWORK] Ensuring named route: https://${expectedHost} -> http://localhost:${port}`);
  if (withPath) {
    logger.info(`[NETWORK] Ensuring path route: https://${domainEnv}/${prefix}/* -> http://localhost:${port}`);
  }

  // Start/refresh cloudflared for this route
  let child: ChildProcessWithoutNullStreams | undefined;
  try {
    // Force non-null stdio by inheriting; avoids null streams type
    child = spawn('cloudflared', ['tunnel', '--config', cfgPath, 'run'], { stdio: 'pipe' }) as unknown as ChildProcessWithoutNullStreams;
    process.once('exit', () => { try { child?.kill(); } catch {} });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`[NETWORK] Failed to spawn cloudflared for ${expectedHost}: ${msg}`);
  }

  return { expectedHost, configPath: cfgPath, child };
}
// Note: direct cloudflared fallback removed per requirements; KInfra is the single source of truth.


export async function startExpressOnFreePort(app: express.Express, options: StartOptions = {}): Promise<StartResult> {
  const preferEnv = options.respectEnvPort ?? true;
  const dynamicFallback = options.dynamicFallback ?? true;

  // If FORCE_DYNAMIC_PORT is set, ignore env/option and always pick a free port
  const forceDynamic = process.env.FORCE_DYNAMIC_PORT === 'true';

  let preferred: number | undefined = forceDynamic ? undefined : options.preferredPort;
  if (!forceDynamic && preferEnv && process.env.PORT) {
    const envNum = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(envNum)) preferred = preferred ?? envNum;
  }

  // Resolve a usable port
  let port = await allocateFreePort(preferred);

  // Start server
  const server: Server = await new Promise((resolve, reject) => {
    const srv = app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(srv);
    });
    // If port becomes busy between allocation and listen, optionally fall back
    srv.on('error', async (error: any) => {
      if (error?.code === 'EADDRINUSE' && dynamicFallback) {
        try {
          port = await allocateFreePort();
          const srv2 = app.listen(port, (err?: Error) => {
            if (err) reject(err); else resolve(srv2);
          });
        } catch (e) {
          reject(e);
        }
      } else {
        reject(error);
      }
    });
  });

  // Optional tunnel: prefer named tunnel (TUNNEL_ID) else KInfra quick tunnel
  let expectedHost: string | undefined;
  if (options.enableTunnel) {
    if (process.env.TUNNEL_ID) {
      void (async () => {
        const domainEnv = (process.env.TUNNEL_DOMAIN || 'kooshapari.com').toLowerCase();
        const rawSrvc = (process.env.SRVC || process.env.SERVICE_SLUG || process.env.SERVICE_NAME || 'local') + '';
        const srvc = dnsSafeSlug(rawSrvc);
        const prefix = dnsSafeSlug(((process.env.TUNNEL_PATH_PREFIX || srvc) + ''));
        const withPath = String(process.env.TUNNEL_PATH_ROUTE || '').toLowerCase() === 'true';
        const { expectedHost: host } = await ensureNamedTunnelRoute(port);
        expectedHost = host;
        logger.info(`[NETWORK] Expected public hostname: https://${host}`);
        const ok = await waitForHealth(`https://${host}`);
        if (ok) logger.info(`[NETWORK] Reachable: https://${host}/healthz`);
        else logger.warn(`[NETWORK] Health probe timed out: https://${host}/healthz`);
        if (withPath) {
          const pathBase = `https://${domainEnv}/${prefix}`;
          const ok2 = await waitForHealth(pathBase);
          if (ok2) logger.info(`[NETWORK] Reachable (path): ${pathBase}/healthz`);
          else logger.warn(`[NETWORK] Health probe timed out (path): ${pathBase}/healthz`);
        }
      })();
    } else {
      void (async () => {
        const url = await createKinfraTunnelIfEnabled(port, { kinfraLibPath: options.kinfraLibPath });
        if (url) {
          const ok = await waitForHealth(url);
          if (ok) logger.info(`[NETWORK] Reachable: ${url.replace(/\/$/, '')}/healthz`);
          else logger.warn(`[NETWORK] Health probe timed out: ${url.replace(/\/$/, '')}/healthz`);
        }
      })();
    }
  }

  // Do not await tunnel; return immediately
  return { server, port, expectedHost };
}
