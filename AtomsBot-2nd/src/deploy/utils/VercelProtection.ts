import { DeployLogs } from '../Orchestrator';

type UnprotectMode = 'link' | 'password' | undefined;

export async function attemptMakePreviewPublic(params: {
  token?: string | null;
  teamId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  mode?: UnprotectMode;
  logs: DeployLogs;
}): Promise<void> {
  const { token, teamId, projectId, projectName, mode, logs } = params;
  if (!token) { await safeLog(logs, 'info', 'Auto-unprotect skipped: no Vercel token'); return; }
  try {
    const qsTeam = teamId ? `?teamId=${encodeURIComponent(String(teamId))}` : '';
    // Resolve project id if only name provided
    let pid = (projectId && /^prj_/i.test(String(projectId))) ? String(projectId) : '';
    if (!pid && projectName) {
      const rs = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(String(projectName))}${qsTeam}`, { headers: { Authorization: `Bearer ${token}` } });
      if (rs.ok) {
        const body: any = await rs.json();
        pid = body?.id || '';
      }
    }
    if (!pid) { await safeLog(logs, 'info', 'Auto-unprotect skipped: could not resolve project id'); return; }

    // Try a small set of possible payloads. If any succeed (2xx), consider it done.
    const attempts: Array<{ url: string; body: any; note: string }> = [];
    const base = `https://api.vercel.com/v10/projects/${encodeURIComponent(pid)}`;
    // Password protection off for preview (common setting)
    attempts.push({ url: base, body: { passwordProtection: { preview: false } }, note: 'passwordProtection.preview=false' });
    // Some accounts might use a different field name (legacy)
    attempts.push({ url: base, body: { protection: { preview: false } }, note: 'protection.preview=false' });
    // For link protection semantics, try a permissive preview policy
    attempts.push({ url: base, body: { previewDeploymentProtection: 'public' }, note: 'previewDeploymentProtection=public' });

    await safeLog(logs, 'info', `Auto-unprotect: attempting to disable ${mode || 'protection'} for preview`);
    for (const a of attempts) {
      try {
        const res = await fetch(`${a.url}${qsTeam}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(a.body),
        });
        if (res.ok) { await safeLog(logs, 'info', `Auto-unprotect: success via ${a.note}`); return; }
        const txt = await res.text();
        await safeLog(logs, 'info', `Auto-unprotect attempt failed (${a.note}): ${res.status} ${txt}`);
      } catch (e: any) {
        await safeLog(logs, 'info', `Auto-unprotect error (${a.note}): ${e?.message || e}`);
      }
    }
    await safeLog(logs, 'info', 'Auto-unprotect: all attempts failed');
  } catch (e: any) {
    await safeLog(logs, 'info', `Auto-unprotect: exception ${e?.message || e}`);
  }
}

async function safeLog(logs: DeployLogs, level: 'info'|'error', msg: string) {
  try { await (level === 'info' ? logs.info(msg) : logs.error(msg)); } catch {}
}

