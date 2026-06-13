import { DeployContext, DeployLogs, RepoProvider } from '../Orchestrator';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const pexec = promisify(execFile);

export class LocalCloneRepoProvider implements RepoProvider {
  constructor(private ttlDays: number = 3) {}

  async prepareWorkdir(ctx: DeployContext, logs: DeployLogs): Promise<{ workdir: string; beforeSha?: string; headSha?: string }> {
    const base = join(tmpdir(), 'atomsbot-deploys-ctx');
    const dir = await mkdtemp(`${base}-`);
    await logs.info(`Workdir: ${dir}`);
    // Minimal clone (shallow/branch only)
    const remote = `https://github.com/${ctx.repo.owner}/${ctx.repo.name}.git`;
    try {
      await pexec('git', ['init'], { cwd: dir });
      await pexec('git', ['remote', 'add', 'origin', remote], { cwd: dir });
      await pexec('git', ['fetch', '--depth=50', 'origin', ctx.repo.branch], { cwd: dir });
      await pexec('git', ['checkout', '--detach', `origin/${ctx.repo.branch}`], { cwd: dir });
      const headSha = (await pexec('git', ['rev-parse', 'HEAD'], { cwd: dir })).stdout.trim();
      return { workdir: dir, headSha };
    } catch (e: any) {
      await logs.error(`git clone failed: ${e?.message || e}`);
      return { workdir: dir };
    }
  }
}
