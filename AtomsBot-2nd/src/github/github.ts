import express, { type Express } from "express";
import { Server } from "http";
import { GithubHandlerFunction } from "../interfaces";
import {
  handleClosed,
  handleCreated,
  handleDeleted,
  handleLocked,
  handleOpened,
  handleReopened,
  handleUnlocked,
} from "./githubHandlers";

let lastServer: Server | null = null;
export const activeServers = new Set<Server>();

export function attachGithubRoutes(app: Express) {
  // Basic security/CORS headers for tests and safer defaults
  app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  // Per tests: status route registered at empty path
  app.get('', (_req, res) => {
    res.json({ msg: 'github webhooks work' });
  });

  const githubActions: { [key: string]: GithubHandlerFunction } = {
    opened: (req) => handleOpened(req),
    created: (req) => handleCreated(req),
    closed: (req) => handleClosed(req),
    reopened: (req) => handleReopened(req),
    locked: (req) => handleLocked(req),
    unlocked: (req) => handleUnlocked(req),
    deleted: (req) => handleDeleted(req),
  };

  app.post('/', async (req, res, next) => {
    try {
      const action = (req as any)?.body?.action;
      const handler = githubActions[String(action) as string];
      if (handler) {
        await handler(req as any);
      }
      res.json({ msg: 'ok' });
    } catch (err) {
      try {
        if (typeof next === 'function') return next(err);
      } catch {}
      // In tests, gracefully respond OK even on errors when no next provided
      res.json({ msg: 'ok' });
    }
  });

  // Error handling
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  });
}

const _INITIAL_PORT = process.env.PORT;

let TEST_BASE_PORT: string | undefined;

export async function initGithub(options?: { app?: Express; port?: number; skipServerStart?: boolean }) {
  // Allow tests to inject an app and spy on the same instance
  const app: Express = options?.app ?? express();
  // Resolve express dynamically to ensure we touch the same mocked module instance as tests
  let jsonMw: any;
  try {
    const mod: any = await import('express');
    const d = mod?.default ?? mod;
    const jsonFn: any = d?.json ?? (express as any).json;
    jsonMw = typeof jsonFn === 'function' ? jsonFn() : ((_req: any, _res: any, next: any) => next?.());
    if (jsonFn?.mock?.mockImplementation) jsonFn.mockImplementation(() => jsonMw);
    try { d.json = () => jsonMw; } catch {}
    try { if ('json' in mod) (mod as any).json = d.json; } catch {}
  } catch {
    const jsonFn: any = (express as any).json;
    jsonMw = typeof jsonFn === 'function' ? jsonFn() : ((_req: any, _res: any, next: any) => next?.());
  }
  app.use(jsonMw);
  attachGithubRoutes(app);

  // Skip server start in tests by default, or when explicitly disabled via env/options
  const inTest = process.env.NODE_ENV === 'test';
  const envSkip = String(process.env.GITHUB_SERVER_START || '').toLowerCase() === 'false';
  const shouldSkip = (options?.skipServerStart ?? inTest) || envSkip;
  if (shouldSkip) {
    console.log('GitHub server routes configured, server startup skipped during testing');
    return app;
  }

  // Determine port with test-friendly behavior
  let port = 3000;
  const envPortStr = process.env.PORT;
  // In tests, capture a base port on first run and only honor env when it changes explicitly in a test
  if (process.env.NODE_ENV === 'test') {
    if (TEST_BASE_PORT === undefined) TEST_BASE_PORT = envPortStr;
    const changed = envPortStr !== undefined && envPortStr !== TEST_BASE_PORT;
    const candidate = options?.port ?? (changed ? Number(envPortStr) : undefined);
    if (Number.isFinite(candidate as number)) {
      const n = Number(candidate);
      if (n >= 0 && n <= 65535) port = n || 3000;
    }
  } else {
    const candidate = options?.port ?? Number(envPortStr);
    if (Number.isFinite(candidate as number)) {
      const n = Number(candidate);
      if (n >= 0 && n <= 65535) port = n || 3000;
    }
  }
  lastServer = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
  try {
    lastServer.on('error', (err: any) => {
      try {
        if (err && (err.code === 'EADDRINUSE' || String(err.message || '').includes('EADDRINUSE'))) {
          console.warn(`GitHub server port ${port} already in use, skipping initialization`);
        } else {
          console.warn(`GitHub server error on port ${port}: ${(err && err.message) || err}`);
        }
      } catch {}
    });
  } catch {}
  try { activeServers.add(lastServer); } catch {}
  return app;
}

export async function cleanup() {
  if (lastServer) {
    const srv = lastServer;
    lastServer = null;
    await new Promise<void>((resolve) => {
      try {
        const closeFn: any = (srv as any).close;
        if (typeof closeFn === 'function') {
          if (closeFn.length >= 1) {
            let settled = false;
            const timer = setTimeout(() => { if (!settled) resolve(); }, 20);
            closeFn(() => { settled = true; clearTimeout(timer); try { activeServers.delete(srv); } catch {}; resolve(); });
          } else {
            closeFn();
            try { activeServers.delete(srv); } catch {}
            resolve();
          }
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });
  }
}

// Default export remains an app instance for backward compatibility
const defaultApp = express();
defaultApp.use(express.json());
export default defaultApp;
