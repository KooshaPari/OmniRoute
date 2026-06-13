import { DeployProvider, DeployContext, DeployLogs } from '../Orchestrator';
import { attemptMakePreviewPublic } from '../utils/VercelProtection';

export class VercelApiProvider implements DeployProvider {
  constructor(
    private tokenGetter: () => Promise<string | undefined>,
    private teamIdGetter?: () => Promise<string | undefined>,
    private projectIdGetter?: () => Promise<string | undefined>,
    private projectNameGetter?: () => Promise<string | undefined>,
  ) {}

  async deploy(ctx: DeployContext, _workdir: string, logs: DeployLogs): Promise<{ url?: string; id?: string; status: 'ready'|'error'; error?: string }> {
    try {
      const token = await this.tokenGetter();
      if (!token) {
        await this.safeLog(logs.error, 'No Vercel token configured');
        return { status: 'error', error: 'Missing vercel token' };
      }

      let teamId: string | undefined;
      let projectId: string | undefined;
      let projectName: string | undefined;

      try {
        // Prefer getter for teamId if provided; fall back to context
        teamId = (await this.teamIdGetter?.()) || ctx.vercel?.teamId;
        // Prefer getter for project name/id if provided; fall back to context
        projectId = (await this.projectIdGetter?.()) || ctx.vercel?.projectId;
        projectName = (await this.projectNameGetter?.()) || (ctx as any)?.vercel?.projectName;
      } catch (error: any) {
        await this.safeLog(logs.error, `Vercel API exception: ${error?.message || error}`);
        return { status: 'error', error: error?.message || String(error) };
      }

      // If context is malformed and doesn't even expose a projectId field, treat as missing
      const hasCtxProjectIdField = ctx?.vercel && Object.prototype.hasOwnProperty.call(ctx.vercel, 'projectId');
      if (!hasCtxProjectIdField) {
        await this.safeLog(logs.error, 'No Vercel project configured');
        return { status: 'error', error: 'Missing projectId' };
      }

      // Normalize: if projectId is not a prj_* id, treat it as unset. We'll use projectName to target.
      if (projectId && !/^prj_/.test(projectId)) projectId = undefined;

      if (!projectId && !projectName) {
        // Fall back to repo name as project name if unset
        projectName = ctx?.repo?.name || undefined;
      }

      await this.safeLog(logs.info, 'Using Vercel API');
      await this.safeLog(logs.status, 'Creating deployment via API…');

      const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
      const target = (ctx.env || '').toLowerCase() === 'production' ? 'production' : 'preview';
      const body = {
        name: projectName || ctx?.repo?.name,
        target,
        gitSource: {
          type: 'github',
          ref: ctx.repo?.branch || 'main',
          repoId: `${ctx.repo?.owner || ''}/${ctx.repo?.name || ''}`
        },
        // Only include project when we have a real project id
        ...(projectId ? { project: projectId } : {}),
      };

      await this.safeLog(
        logs.info,
        `API params: teamId=${teamId || '-'} projectId=${projectId || '-'} projectName=${projectName || ctx?.repo?.name || '-'} repo=${ctx.repo?.owner || ''}/${ctx.repo?.name || ''} branch=${ctx.repo?.branch || ''} target=${target}`
      );

      const res = await fetch(`https://api.vercel.com/v13/deployments${qs}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        await this.safeLog(logs.error, `Vercel API error: ${res.status} ${errorText}`);
        if (/incorrect_git_source_info/i.test(errorText)) {
          await this.safeLog(logs.error, 'Hint: Ensure the Vercel project is connected to the correct GitHub repo, or adjust repo owner/name mapping.');
        }
        return { status: 'error', error: errorText || String(res.status) };
      }

      let created: any;
      try {
        created = await res.json();
      } catch (jsonError: any) {
        await this.safeLog(logs.error, `Vercel API exception: ${jsonError?.message || jsonError}`);
        return { status: 'error', error: jsonError?.message || String(jsonError) };
      }

      const id = created.id;
      let url: string | undefined = created.url ? `https://${created.url}` : undefined;

      // Short-circuit if deployment is already ready
      const initialState = (created?.readyState || created?.state || '').toString().toLowerCase();
      if (initialState === 'ready') {
        // Attempt to auto-unprotect preview before announcing ready
        try {
          if ((ctx as any)?.vercel?.autoUnprotect) {
            const teamOrUser = (ctx as any)?.vercel?.teamId;
            await (await import('../utils/VercelProtection')).attemptMakePreviewPublic({
              token,
              teamId: teamId,
              projectId: projectId,
              projectName: (ctx as any)?.vercel?.projectName || ctx.repo?.name,
              mode: (ctx as any)?.vercel?.unprotectMode || 'link',
              logs,
            });
          }
        } catch {}
        await this.safeLog(logs.status, 'Deployment ready');
        // Probe for public accessibility and suggest settings if protected
        try {
          if (url) {
            const res = await fetch(url, { method: 'GET' });
            const txt = await res.text().catch(() => '');
            const looksProtected = res.status === 401 || res.status === 403 || /login|protected|password/i.test(txt);
            if (looksProtected) {
              let settingsHint = 'https://vercel.com/dashboard';
              try {
                const teamOrUser = (ctx as any)?.vercel?.teamSlug || (ctx as any)?.vercel?.teamId || '';
                const projectName = (ctx as any)?.vercel?.projectName || ctx.repo?.name || '';
                if (teamOrUser && projectName) settingsHint = `https://vercel.com/${teamOrUser}/${projectName}/settings`;
              } catch {}
              await this.safeLog(logs.info, `Note: Deployment may be protected. To make public, disable Password Protection for Preview in project settings: ${settingsHint}`);
            }
          }
        } catch {}
        try {
          if ((ctx as any)?.vercel?.autoUnprotect) {
            await attemptMakePreviewPublic({
              token,
              teamId,
              projectId,
              projectName: (ctx as any)?.vercel?.projectName || ctx.repo?.name,
              mode: (ctx as any)?.vercel?.unprotectMode || 'link',
              logs,
            });
          }
        } catch {}
        return { status: 'ready', id, url };
      }

      // Poll status with proper error handling
      const poll = async (): Promise<string> => {
        try {
          const rs = await fetch(`https://api.vercel.com/v13/deployments/${id}${qs}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!rs.ok) {
            // Continue polling on HTTP errors
            return 'building';
          }

          let data: any;
          try {
            data = await rs.json();
          } catch {
            // Continue polling on JSON parse errors
            return 'building';
          }

          const status = data?.readyState || data?.state || 'building';
          url = url || (data?.url ? `https://${data.url}` : undefined);
          return status;
        } catch (error) {
          throw error;
        }
      };

      const attemptDelayMs = 5000;
      const maxAttempts = Math.ceil((15 * 60 * 1000) / attemptDelayMs); // 180 attempts

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const st = await poll();
          if (st === 'READY' || st === 'ready') {
            // Attempt to auto-unprotect preview before announcing ready
            try {
              if ((ctx as any)?.vercel?.autoUnprotect) {
                await (await import('../utils/VercelProtection')).attemptMakePreviewPublic({
                  token,
                  teamId: teamId,
                  projectId: projectId,
                  projectName: (ctx as any)?.vercel?.projectName || ctx.repo?.name,
                  mode: (ctx as any)?.vercel?.unprotectMode || 'link',
                  logs,
                });
              }
            } catch {}
            await this.safeLog(logs.status, 'Deployment ready');
            // Probe access as above
            try {
              if (url) {
                const res = await fetch(url, { method: 'GET' });
                const txt = await res.text().catch(() => '');
                const looksProtected = res.status === 401 || res.status === 403 || /login|protected|password/i.test(txt);
                if (looksProtected) {
                  let settingsHint = 'https://vercel.com/dashboard';
                  try {
                    const teamOrUser = (ctx as any)?.vercel?.teamSlug || (ctx as any)?.vercel?.teamId || '';
                    const projectName = (ctx as any)?.vercel?.projectName || ctx.repo?.name || '';
                    if (teamOrUser && projectName) settingsHint = `https://vercel.com/${teamOrUser}/${projectName}/settings`;
                  } catch {}
                  await this.safeLog(logs.info, `Note: Deployment may be protected. To make public, disable Password Protection for Preview in project settings: ${settingsHint}`);
                }
              }
            } catch {}
            try {
              if ((ctx as any)?.vercel?.autoUnprotect) {
                await attemptMakePreviewPublic({
                  token,
                  teamId,
                  projectId,
                  projectName: (ctx as any)?.vercel?.projectName || ctx.repo?.name,
                  mode: (ctx as any)?.vercel?.unprotectMode || 'link',
                  logs,
                });
              }
            } catch {}
            return { status: 'ready', id, url };
          }
          if (st === 'ERROR' || st === 'error') {
            await this.safeLog(logs.status, 'Deployment failed');
            return { status: 'error', id, url, error: 'vercel error' };
          }
        } catch (pollError: any) {
          await this.safeLog(logs.error, `Vercel API exception: ${pollError?.message || pollError}`);
          return { status: 'error', error: pollError?.message || String(pollError) };
        }

        if (process.env.NODE_ENV !== 'test') {
          await new Promise(r => setTimeout(r, attemptDelayMs));
        } else {
          // In tests, don't actually sleep; yield to event loop
          await Promise.resolve();
        }
      }

      await this.safeLog(logs.error, 'Vercel API deploy timed out');
      return { status: 'error', id, url, error: 'timeout' };

    } catch (e: any) {
      await this.safeLog(logs.error, `Vercel API exception: ${e?.message || e}`);
      return { status: 'error', error: e?.message || String(e) };
    }
  }

  private async safeLog(logFunc: (message: string) => Promise<void> | void, message: string): Promise<void> {
    try {
      await logFunc(message);
    } catch (_error) {
      // Ignore logging errors to prevent them from breaking the deployment
      // In a real application, you might want to use a fallback logging mechanism
    }
  }
}
