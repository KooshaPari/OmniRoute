import { DeployProvider, DeployContext, DeployLogs } from '../Orchestrator';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { attemptMakePreviewPublic } from '../utils/VercelProtection';

export class VercelCliProvider implements DeployProvider {
  constructor(private preferCli: boolean = true) {}

  async deploy(ctx: DeployContext, workdir: string, logs: DeployLogs): Promise<{ url?: string; id?: string; status: 'ready' | 'error'; error?: string }> {
    await logs.info('Using vercel CLI');
    await logs.status('Deploying via Vercel CLI…');
    // Treat Production as prod target; Staging/Development as preview
    const isProd = (ctx.env || '').toLowerCase() === 'production';
    const args: string[] = [];
    if (isProd) args.push('--prod');
    // Non-interactive
    args.push('--yes');
    // Prepare working directory (support monorepo subdir)
    const subdir = (ctx as any)?.appSubdir as string | undefined;
    const cwdActual = subdir ? join(workdir, subdir) : workdir;

    // Preflight health checks: presence of package.json and lockfile, chosen build script
    let preflightHardError: string | null = null;
    let engineNodeStr: string | undefined;
    try {
      const files = await fs.readdir(cwdActual);
      const hasPkg = files.includes('package.json');
      const hasNpmLock = files.includes('package-lock.json');
      const hasPnpmLock = files.includes('pnpm-lock.yaml');
      const hasYarnLock = files.includes('yarn.lock');
      const hasBunLock = files.includes('bun.lockb') || files.includes('bun.lock');
      if (!hasPkg) {
        const msg = 'Preflight: package.json not found. Abort.';
        await logs.error(msg);
        preflightHardError = msg;
      } else {
        try {
          const pkgRaw = await fs.readFile(join(cwdActual, 'package.json'), 'utf8');
          const pkg: any = JSON.parse(pkgRaw);
          const scripts = pkg?.scripts || {};
          const buildScript = scripts['vercel-build'] ? 'vercel-build' : (scripts['build'] ? 'build' : '(none)');
          engineNodeStr = pkg?.engines?.node;
          await logs.info(`Preflight: build script=${buildScript} engines.node=${engineNodeStr || '(unspecified)'}`);
          if (!engineNodeStr) {
            const msg = 'Preflight: engines.node missing in package.json. Abort.';
            await logs.error(msg);
            preflightHardError = preflightHardError || msg;
          }
        } catch {}
      }
      const locks = [hasNpmLock && 'package-lock.json', hasPnpmLock && 'pnpm-lock.yaml', hasYarnLock && 'yarn.lock', hasBunLock && 'bun.lockb/bun.lock']
        .filter(Boolean).join(', ');
      await logs.info(`Preflight: lockfiles=${locks || '(none)'}`);
      if ([hasNpmLock, hasPnpmLock, hasYarnLock].filter(Boolean as any).length > 1) {
        const msg = 'Preflight: Multiple lockfiles detected. Abort.';
        await logs.error(msg);
        preflightHardError = preflightHardError || msg;
      }
      if (!(hasNpmLock || hasPnpmLock || hasYarnLock || hasBunLock)) {
        const msg = 'Preflight: No lockfile detected (npm/pnpm/yarn/bun). Abort.';
        await logs.error(msg);
        preflightHardError = preflightHardError || msg;
      }
    } catch {}
    if (preflightHardError) return { status: 'error', error: preflightHardError };

    // Preflight: compare engines.node vs Vercel project runtime
    try {
      const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || '';
      const teamId = (ctx as any)?.vercel?.teamId as string | undefined;
      const projectId = (ctx as any)?.vercel?.projectId as string | undefined;
      const projectName = (ctx as any)?.vercel?.projectName as string | undefined;
      let runtimeNode: string | undefined = process.env.VERCEL_RUNTIME_NODE || undefined;
      if (!runtimeNode && token && (projectId || projectName)) {
        const idOrName = projectId || projectName!;
        const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
        const rs = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(idOrName)}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        if (rs.ok) {
          const body: any = await rs.json();
          // Attempt multiple fields that may carry the node version
          runtimeNode = body?.nodeVersion || body?.build?.nodeVersion || body?.framework?.nodeVersion || undefined;
          if (!runtimeNode && typeof body?.targets?.production?.nodeVersion === 'string') runtimeNode = body.targets.production.nodeVersion;
        }
      }
      // Last resort default, known common default on Vercel
      if (!runtimeNode) runtimeNode = '18.x';
      await logs.info(`Preflight: vercel.runtime.node=${runtimeNode}`);
      // Compare majors
      const parseMajor = (s?: string): number | null => {
        if (!s) return null;
        const m = String(s).match(/(\d{1,2})/);
        return m ? parseInt(m[1], 10) : null;
      };
      const engineMajor = parseMajor(engineNodeStr);
      const runtimeMajor = parseMajor(runtimeNode);
      if (engineMajor && runtimeMajor && engineMajor !== runtimeMajor) {
        const msg = `Preflight: engines.node (${engineMajor}) mismatches Vercel runtime (${runtimeMajor}). Abort.`;
        await logs.error(msg);
        return { status: 'error', error: msg };
      }
    } catch {}
    // Ensure CLI is linked via .vercel/project.json when token/team/project are provided
    try {
      const teamId = (ctx as any)?.vercel?.teamId as string | undefined;
      const projectId = (ctx as any)?.vercel?.projectId as string | undefined;
      const vercelDir = join(cwdActual, '.vercel');
      await fs.mkdir(vercelDir, { recursive: true });
      const projectJsonPath = join(vercelDir, 'project.json');
      const cfg: any = {};
      // Prefer explicit orgId if provided in context (resolved via API)
      const orgId = (ctx as any)?.vercel?.orgId as string | undefined;
      if (orgId && /^(team_|user_)/.test(String(orgId))) cfg.orgId = orgId;
      else if (teamId && /^(team_|user_)/.test(String(teamId))) cfg.orgId = teamId;
      if (projectId) { cfg.projectId = projectId; cfg.projectName = projectId; }
      // Only write if we have at least one field AND the file does not already exist
      // to avoid overwriting an existing project link.
      if (Object.keys(cfg).length > 0) {
        const exists = await fs.stat(projectJsonPath).then(() => true).catch(() => false);
        if (!exists) {
          await fs.writeFile(projectJsonPath, JSON.stringify(cfg, null, 2), 'utf8');
        }
      }

      // Verify-link: print .vercel/project.json if present; otherwise, attempt a safe link fallback
      let printed = false;
      try {
        const raw = await fs.readFile(projectJsonPath, 'utf8');
        await logs.info(`[vercel-link] .vercel/project.json:\n${raw}`);
        printed = true;
      } catch {}
      if (!printed) {
        try {
          await new Promise<void>((resolve) => {
            const envVars = { ...process.env } as any;
            if (orgId) envVars.VERCEL_ORG_ID = orgId;
            if (projectId) envVars.VERCEL_PROJECT_ID = projectId;
            const c = spawn('vercel', ['link', '--yes'], { cwd: cwdActual, env: envVars });
            const to = setTimeout(() => { try { c.kill('SIGKILL'); } catch {} ; resolve(); }, 15000);
            c.on('close', () => { clearTimeout(to); resolve(); });
            c.on('error', () => { clearTimeout(to); resolve(); });
          });
        } catch {}
        try {
          const raw2 = await fs.readFile(projectJsonPath, 'utf8');
          await logs.info(`[vercel-link] .vercel/project.json (after link):\n${raw2}`);
        } catch {
          await logs.info('[vercel-link] No .vercel/project.json found after link attempt');
        }
      }
    } catch {/* best effort */}
    await logs.info(`CLI params: cwd=${cwdActual} args=${args.join(' ') || '(none)'}`);
    const baseEnv = { ...process.env } as any;
    const orgId2 = (ctx as any)?.vercel?.orgId as string | undefined;
    const projectId2 = (ctx as any)?.vercel?.projectId as string | undefined;
    if (orgId2) baseEnv.VERCEL_ORG_ID = orgId2;
    if (projectId2) baseEnv.VERCEL_PROJECT_ID = projectId2;

    const runOnce = async () => await new Promise<{ code: number|null; out: string; url?: string }>((resolve) => {
      const envVars = { ...baseEnv };
      const child = spawn('vercel', args, { cwd: cwdActual, env: envVars });
      let urlCaptured: string | undefined;
      let inspectUrl: string | undefined;
      let out = '';
      const urlRegex = /(https?:\/\/[^\s)]+vercel\.app[^\s)]*)/ig;
      child.stdout.on('data', (d) => {
        const s = d.toString(); out += s;
        let m; while ((m = urlRegex.exec(s)) !== null) urlCaptured = urlCaptured || m[1];
        const inspectMatch = s.match(/Inspect:\s*(https?:[^\s]+)/i);
        if (inspectMatch) inspectUrl = inspectMatch[1];
        if (out.length > 1600) { logs.info(out); out = ''; }
      });
      child.stderr.on('data', (d) => { const s = d.toString(); out += s; if (out.length > 1600) { logs.info(out); out = ''; } });
      child.on('error', async (e) => { const s = String(e); await logs.error(s); resolve({ code: 1, out: s }); });
      child.on('close', async (code) => { resolve({ code, out: (inspectUrl ? `Inspect: ${inspectUrl}\n` : '') + out, url: urlCaptured }); });
    });

    let first = await runOnce();
    let combinedOut = first.out;
    let url: string | undefined = first.url;
    if ((first.code ?? 1) !== 0 && /Project Settings are invalid/i.test(combinedOut)) {
      try {
        await logs.info('Vercel CLI reported invalid project settings; removing .vercel to re-link and retry.');
        const vercelDir = join(cwdActual, '.vercel');
        try { await fs.rm(vercelDir, { recursive: true, force: true }); } catch {}
      } catch {}
      const second = await runOnce();
      combinedOut += `\n\n(retry)\n${second.out}`;
      url = url || second.url;
      first = second;
    }

    // If failed, try to fetch build logs via Vercel API using captured Inspect URL
    if ((first.code ?? 1) !== 0) {
      try {
        const token = baseEnv.VERCEL_TOKEN || baseEnv.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
        const m = combinedOut.match(/Inspect:\s*(https?:[^\s]+)/i);
        const inspect = m ? m[1] : undefined;
        const id = inspect ? (inspect.split('/').pop() || '').split('?')[0] : '';
        const teamId = orgId2 || baseEnv.VERCEL_ORG_ID || (ctx as any)?.vercel?.teamId;
        if (token && id) {
          const qs = teamId ? `?teamId=${encodeURIComponent(teamId as string)}&limit=1000` : '?limit=1000';
          const rs = await fetch(`https://api.vercel.com/v13/deployments/${id}/events${qs}`, { headers: { Authorization: `Bearer ${token}` } });
          if (rs.ok) {
            const data: any = await rs.json();
            const events: any[] = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
            const lines = events
              .map((e: any) => e?.payload?.text || e?.text || e?.payload?.message || '')
              .filter((x: any) => typeof x === 'string' && x.trim());
            if (lines.length) {
              await logs.error(`vercel build logs (${lines.length} lines):`);
              // chunk output to avoid message limits
              let chunk = '';
              for (const line of lines) {
                if ((chunk + line + '\n').length > 1800) {
                  await logs.error(chunk);
                  chunk = '';
                }
                chunk += line + '\n';
              }
              if (chunk) await logs.error(chunk);
            }
          }
        }
      } catch {}
    }

    if (combinedOut) await logs.info(combinedOut);
    if ((first.code ?? 1) === 0) {
      // Attempt to auto-unprotect preview if enabled (before announcing ready)
      try {
        const auto = (ctx as any)?.vercel?.autoUnprotect as boolean | undefined;
        if (auto) {
          const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || '';
          await attemptMakePreviewPublic({
            token,
            teamId: (ctx as any)?.vercel?.teamId,
            projectId: (ctx as any)?.vercel?.projectId,
            projectName: (ctx as any)?.vercel?.projectName,
            mode: (ctx as any)?.vercel?.unprotectMode || 'link',
            logs,
          });
        }
      } catch {}
      await logs.status('Deployment ready');
      // Public accessibility probe and hint for making it public
      try {
        const m = combinedOut.match(/Inspect:\s*(https?:[^\s]+)/i);
        const inspect = m ? m[1] : '';
        if (url) {
          const res = await fetch(url, { method: 'GET' });
          const txt = await res.text().catch(() => '');
          const looksProtected = res.status === 401 || res.status === 403 || /login|protected|password/i.test(txt);
          if (looksProtected) {
            let settingsHint = 'https://vercel.com/dashboard';
            try {
              const u = new URL(inspect);
              const parts = u.pathname.split('/').filter(Boolean);
              if (parts.length >= 2) settingsHint = `https://vercel.com/${parts[0]}/${parts[1]}/settings`;
            } catch {}
            await logs.info(`Note: Deployment appears protected. To make public, disable Password Protection for Preview in project settings: ${settingsHint}`);
          }
        }
      } catch {}
      return { status: 'ready', url };
    } else {
      const msg = `vercel exited with code ${first.code}`;
      await logs.error(msg);
      return { status: 'error', error: msg };
    }
  }
}
