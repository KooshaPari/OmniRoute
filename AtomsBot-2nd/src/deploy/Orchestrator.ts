export type DeployContext = {
  guildId: string;
  env: 'Production' | 'Staging' | string;
  repo: { owner: string; name: string; branch: string; baseBranch?: string; headBranch?: string };
  forumThreadId?: string;
  vercel: { projectId?: string; teamId?: string };
  userId?: string;
};

export type DeployLogs = {
  info: (line: string) => Promise<void> | void;
  error: (line: string) => Promise<void> | void;
  status: (line: string) => Promise<void> | void; // posts to thread when available
};

export interface RepoProvider {
  prepareWorkdir(ctx: DeployContext, logs: DeployLogs): Promise<{ workdir: string; beforeSha?: string; headSha?: string }>;
}

export interface SyncStrategy {
  maybeSync(ctx: DeployContext, logs: DeployLogs): Promise<{ synced: boolean; beforeSha?: string; afterSha?: string; commits?: Array<{ sha: string; title: string; author?: string }> }>;
}

export interface DeployProvider {
  deploy(ctx: DeployContext, workdir: string, logs: DeployLogs): Promise<{ url?: string; id?: string; status: 'ready'|'error'; error?: string }>;
}

export class DeployOrchestrator {
  constructor(private repo: RepoProvider, private deploy: DeployProvider, private sync?: SyncStrategy) {}

  async run(ctx: DeployContext, logs: DeployLogs): Promise<{ url?: string; id?: string; status: 'ready'|'error'; error?: string; beforeSha?: string; afterSha?: string }> {
    await logs.info(`Starting deploy for ${ctx.repo.owner}/${ctx.repo.name}@${ctx.repo.branch} (${ctx.env})`);
    const prep = await this.repo.prepareWorkdir(ctx, logs);
    let beforeSha = prep.beforeSha;
    let afterSha = prep.headSha;
    if (this.sync) {
      const s = await this.sync.maybeSync(ctx, logs);
      if (s.synced) { beforeSha = s.beforeSha || beforeSha; afterSha = s.afterSha || afterSha; }
    }
    const out = await this.deploy.deploy(ctx, prep.workdir, logs);
    return { ...out, beforeSha, afterSha };
  }
}

