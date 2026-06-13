import { SyncStrategy, DeployContext, DeployLogs } from '../Orchestrator';
import { Octokit } from '@octokit/rest';

export class GitHubFastForwardSync implements SyncStrategy {
  constructor(private tokenGetter: () => Promise<string | undefined>) {}

  async maybeSync(ctx: DeployContext, logs: DeployLogs): Promise<{ synced: boolean; beforeSha?: string; afterSha?: string; commits?: Array<{ sha: string; title: string; author?: string }> }> {
    try {
      const token = await this.tokenGetter();
      if (!token) return { synced: false };
      const octokit = new Octokit({ auth: token });
      const base = ctx.repo.baseBranch || 'production';
      const head = ctx.repo.headBranch || 'main';
      const { data } = await octokit.repos.compareCommitsWithBasehead({ owner: ctx.repo.owner, repo: ctx.repo.name, basehead: `${base}...${head}` });
      const aheadBy = data.ahead_by || 0; // commits head is ahead of base
      const behindBy = data.behind_by || 0;
      const commits = (data.commits || []).map(c => ({ sha: c.sha?.slice(0,7) || '', title: c.commit?.message?.split('\n')[0] || '', author: c.commit?.author?.name }));
      if (aheadBy > 0 && behindBy === 0) {
        await logs.info(`Fast-forward possible: ${aheadBy} commit(s) from ${head} into ${base}`);
        // Perform fast-forward via merge API with merge_method: 'merge' and strict conditions
        // Safer: create PR and merge immediately
        const pr = await octokit.pulls.create({ owner: ctx.repo.owner, repo: ctx.repo.name, base, head, title: `FF ${base} <- ${head}` });
        try {
          await octokit.pulls.merge({ owner: ctx.repo.owner, repo: ctx.repo.name, pull_number: pr.data.number, merge_method: 'merge' });
        } catch {
          // fallback close PR silently
          try { await octokit.pulls.update({ owner: ctx.repo.owner, repo: ctx.repo.name, pull_number: pr.data.number, state: 'closed' }); } catch {}
          await logs.error('Fast-forward merge failed');
          return { synced: false, commits };
        }
        await logs.status(`Fast-forwarded ${base} with ${aheadBy} commit(s) from ${head}`);
        const after = (await octokit.repos.getBranch({ owner: ctx.repo.owner, repo: ctx.repo.name, branch: base })).data.commit?.sha?.slice(0,7);
        return { synced: true, afterSha: after, commits };
      }
      // No safe FF
      return { synced: false, commits };
    } catch (e: any) {
      await logs.error(`Sync check failed: ${e?.message || e}`);
      return { synced: false };
    }
  }
}
