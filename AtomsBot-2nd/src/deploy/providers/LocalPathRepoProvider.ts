import { DeployContext, DeployLogs, RepoProvider } from '../Orchestrator';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
const pexec = promisify(execFile);

export class LocalPathRepoProvider implements RepoProvider {
  constructor(private path: string) {}

  async prepareWorkdir(_ctx: DeployContext, logs: DeployLogs): Promise<{ workdir: string; beforeSha?: string; headSha?: string }> {
    await logs.info(`Workdir: ${this.path}`);
    try {
      // Ensure path exists
      await stat(this.path);
    } catch (e: any) {
      await logs.error(`Local path not accessible: ${this.path} (${e?.code || ''} ${e?.message || e})`);
    }
    try {
      const headSha = (await pexec('git', ['rev-parse', 'HEAD'], { cwd: this.path })).stdout.trim();
      return { workdir: this.path, headSha };
    } catch {
      return { workdir: this.path };
    }
  }
}

