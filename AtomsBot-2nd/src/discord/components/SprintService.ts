import { PrismaClient, Sprint as DbSprint, GithubIssue as DbGithubIssue, JiraIssue as DbJiraIssue } from '@prisma/client';
import getDb from '../../database/config';
import { logger } from '../../logger';

export type SprintState = 'planned' | 'active' | 'completed' | 'canceled';

export interface CreateSprintInput {
  guildId: string;
  name: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  velocityTarget?: number | null;
  teamId?: string | null;
  githubMilestone?: string | null;
  jiraBoardId?: string | null;
  jiraSprintId?: string | null;
}

export interface SprintProgress {
  sprint: DbSprint;
  totals: {
    threads: number;
    issues: number; // github+jira unique
    open: number;
    closed: number;
    pointsTotal: number;
    pointsDone: number;
    pointsRemaining: number;
  };
}

class SprintService {
  private client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client || getDb();
  }

  private computeState(start?: Date | null, end?: Date | null): SprintState {
    const now = new Date();
    if (start && end) {
      if (now < start) return 'planned';
      if (now > end) return 'completed';
      return 'active';
    }
    if (start && now < start) return 'planned';
    return 'active';
  }

  async createSprint(input: CreateSprintInput): Promise<DbSprint> {
    const state = this.computeState(input.startDate || null, input.endDate || null);
    // Avoid duplicate error: check existing by (guildId, name)
    const existing = await this.client.sprint.findFirst({ where: { guildId: input.guildId, name: input.name } });
    if (existing) return existing;
    try {
      const sprint = await this.client.sprint.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          goal: input.goal || null,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          velocityTarget: input.velocityTarget || null,
          teamId: input.teamId || null,
          githubMilestone: input.githubMilestone || null,
          jiraBoardId: input.jiraBoardId || null,
          jiraSprintId: input.jiraSprintId || null,
          state,
        },
      });
      try { await this.client.sprintEvent.create({ data: { sprintId: sprint.id, type: 'created', entityType: 'system', entityId: '-', payload: null } as any }); } catch {}
      return sprint;
    } catch (e: any) {
      // Graceful fallback in case of race: return existing
      const dup = await this.client.sprint.findFirst({ where: { guildId: input.guildId, name: input.name } });
      if (dup) return dup;
      throw e;
    }
  }

  async editSprint(id: string, updates: Partial<CreateSprintInput> & { name?: string; state?: SprintState; }): Promise<DbSprint | null> {
    try {
      const sprint = await this.client.sprint.update({
        where: { id },
        data: {
          name: updates.name || undefined,
          goal: updates.goal === undefined ? undefined : (updates.goal ?? null),
          startDate: updates.startDate === undefined ? undefined : (updates.startDate ?? null),
          endDate: updates.endDate === undefined ? undefined : (updates.endDate ?? null),
          velocityTarget: updates.velocityTarget === undefined ? undefined : (updates.velocityTarget ?? null),
          teamId: updates.teamId === undefined ? undefined : (updates.teamId ?? null),
          githubMilestone: updates.githubMilestone === undefined ? undefined : (updates.githubMilestone ?? null),
          jiraBoardId: updates.jiraBoardId === undefined ? undefined : (updates.jiraBoardId ?? null),
          jiraSprintId: updates.jiraSprintId === undefined ? undefined : (updates.jiraSprintId ?? null),
          state: updates.state as any || undefined,
        },
      });
      try { await this.client.sprintEvent.create({ data: { id: `${id}:edited:${Date.now()}`, sprintId: id, type: 'edited', entityType: 'system', entityId: '-', payload: null } }); } catch {}
      return sprint;
    } catch {
      return null;
    }
  }

  async listSprints(guildId: string, state?: SprintState): Promise<DbSprint[]> {
    return this.client.sprint.findMany({
      where: { guildId, ...(state ? { state } : {}) },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async searchSprints(guildId: string, query: string, limit = 25): Promise<DbSprint[]> {
    const q = (query || '').trim();
    if (!q) return this.listActiveSprints(guildId, limit);
    // SQLite does not support `mode: 'insensitive'` in Prisma filter; basic contains works for ASCII.
    return this.client.sprint.findMany({
      where: { guildId, name: { contains: q } as any },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async listActiveSprints(guildId: string, limit = 25): Promise<DbSprint[]> {
    return this.client.sprint.findMany({ where: { guildId, state: 'active' }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }], take: limit });
  }

  async getById(id: string): Promise<DbSprint | null> {
    return this.client.sprint.findUnique({ where: { id } });
  }

  async getByName(guildId: string, name: string): Promise<DbSprint | null> {
    return this.client.sprint.findFirst({ where: { guildId, name } });
  }

  async setDefaultSprint(guildId: string, sprintId: string, autoAssignNewIssues?: boolean): Promise<void> {
    await this.client.guild.update({
      where: { id: guildId },
      data: {
        defaultSprintId: sprintId,
        autoAssignNewIssues: autoAssignNewIssues === undefined ? undefined : !!autoAssignNewIssues,
      },
    });
  }

  async getDefaultSprint(guildId: string): Promise<DbSprint | null> {
    const g = await this.client.guild.findUnique({ where: { id: guildId }, include: { defaultSprint: true } });
    return g?.defaultSprint || null;
  }

  async assignThread(threadId: string, sprintId: string, actorId?: string): Promise<boolean> {
    try {
      await this.client.thread.update({ where: { id: threadId }, data: { sprintId } });
      try { await this.client.sprintEvent.create({ data: { id: `${sprintId}:assigned:${threadId}:${Date.now()}`, sprintId, type: 'assigned', entityType: 'thread', entityId: threadId, payload: actorId || null } }); } catch {}
      // Best-effort GitHub label sync: add label sprint:<name>
      try {
        const sprint = await this.getById(sprintId);
        if (sprint) {
          const link = await this.client.threadGithubLink.findFirst({ where: { threadId }, include: { githubIssue: true } });
          const gh = link?.githubIssue;
          if (gh && gh.owner && gh.repo && gh.number) {
            const { octokit } = await import('../../github/githubActions');
            await octokit.rest.issues.addLabels({ owner: gh.owner, repo: gh.repo, issue_number: gh.number, labels: [`sprint:${sprint.name}`] });
            // Milestone mapping: find or create milestone by sprint.githubMilestone
            if (sprint.githubMilestone) {
              // List milestones (open + closed for safety)
              const { data: milestones } = await octokit.rest.issues.listMilestones({ owner: gh.owner, repo: gh.repo, state: 'all', per_page: 100 });
              let ms = milestones.find(m => (m.title || '').toLowerCase() === sprint.githubMilestone!.toLowerCase());
              if (!ms) {
                const created = await octokit.rest.issues.createMilestone({ owner: gh.owner, repo: gh.repo, title: sprint.githubMilestone });
                ms = created.data;
              }
              if (ms && ms.number) {
                await octokit.rest.issues.update({ owner: gh.owner, repo: gh.repo, issue_number: gh.number, milestone: ms.number });
              }
            }
          }
        }
      } catch (e) {
        try { logger.debug('Sprint GH sync (label) failed (benign)', { error: (e as any)?.message || e }); } catch {}
      }
      // Best-effort Jira sprint sync
      try {
        const sprint = await this.getById(sprintId);
        if (sprint?.jiraSprintId) {
          const link = await this.client.threadJiraLink.findFirst({ where: { threadId }, include: { jiraIssue: true } });
          const ji = link?.jiraIssue;
          if (ji?.key) {
            const { jiraService } = await import('../../jira/jiraClient');
            await jiraService.setIssueSprintField(ji.key, sprint.jiraSprintId as any);
          }
        }
      } catch (e) {
        try { logger.debug('Sprint Jira sync failed (benign)', { error: (e as any)?.message || e }); } catch {}
      }
      return true;
    } catch (e) {
      logger.warn('Failed to assign sprint', { threadId, sprintId, error: (e as any)?.message || e });
      return false;
    }
  }

  async unassignThread(threadId: string, actorId?: string): Promise<boolean> {
    try {
      // Capture previous sprint before clearing
      const prev = await this.client.thread.findUnique({ where: { id: threadId } });
      await this.client.thread.update({ where: { id: threadId }, data: { sprintId: null } });
      const prevSprintId = prev?.sprintId || undefined;
      if (prevSprintId) { try { await this.client.sprintEvent.create({ data: { id: `${prevSprintId}:unassigned:${threadId}:${Date.now()}`, sprintId: prevSprintId, type: 'unassigned', entityType: 'thread', entityId: threadId, payload: actorId || null } }); } catch {} }
      // Best-effort cleanups
      try {
        if (prevSprintId) {
          const sprint = await this.getById(prevSprintId);
          if (sprint) {
            // Remove GH label and milestone if matches
            const link = await this.client.threadGithubLink.findFirst({ where: { threadId }, include: { githubIssue: true } });
            const gh = link?.githubIssue;
            if (gh && gh.owner && gh.repo && gh.number) {
              const { octokit } = await import('../../github/githubActions');
              // Remove label if present
              try { await octokit.rest.issues.removeLabel({ owner: gh.owner, repo: gh.repo, issue_number: gh.number, name: `sprint:${sprint.name}` }); } catch {}
              // Clear milestone if it matches sprint.githubMilestone
              if (sprint.githubMilestone) {
                // Only clear if current milestone title matches sprint.githubMilestone
                try {
                  const issue = await octokit.rest.issues.get({ owner: gh.owner, repo: gh.repo, issue_number: gh.number });
                  const msTitle = issue.data.milestone?.title || '';
                  if (msTitle.toLowerCase() === sprint.githubMilestone.toLowerCase()) {
                    await octokit.rest.issues.update({ owner: gh.owner, repo: gh.repo, issue_number: gh.number, milestone: null as any });
                  }
                } catch {}
              }
            }
            // Clear Jira sprint field
            try {
              const linkJ = await this.client.threadJiraLink.findFirst({ where: { threadId }, include: { jiraIssue: true } });
              const ji = linkJ?.jiraIssue;
              if (ji?.key) {
                const { jiraService } = await import('../../jira/jiraClient');
                await jiraService.setIssueSprintField(ji.key, null);
              }
            } catch {}
          }
        }
      } catch {}
      return true;
    } catch (e) {
      logger.warn('Failed to unassign sprint', { threadId, error: (e as any)?.message || e });
      return false;
    }
  }

  async getGuildConfig(guildId: string): Promise<{ autoAssignNewIssues: boolean; defaultSprintId?: string | null; defaultSprint?: DbSprint | null; }> {
    const g = await this.client.guild.findUnique({ where: { id: guildId }, include: { defaultSprint: true } });
    return { autoAssignNewIssues: !!g?.autoAssignNewIssues, defaultSprintId: g?.defaultSprintId ?? null, defaultSprint: g?.defaultSprint || null };
  }

  async autoAssignNewThreadIfEnabled(guildId: string, threadId: string): Promise<boolean> {
    const cfg = await this.getGuildConfig(guildId);
    if (cfg.autoAssignNewIssues && cfg.defaultSprintId) {
      return await this.assignThread(threadId, cfg.defaultSprintId);
    }
    return false;
  }

  async getSprintForThread(threadId: string): Promise<DbSprint | null> {
    const t = await this.client.thread.findUnique({ where: { id: threadId }, include: { sprint: true } });
    return t?.sprint || null;
  }

  private parsePointsFromGithubLabels(labels?: string | null): number | null {
    if (!labels) return null;
    try {
      const arr = JSON.parse(labels) as Array<{ name: string }>;
      for (const l of arr) {
        const m = /^points\s*[:=]\s*(\d+)$/i.exec(l.name || '');
        if (m) return parseInt(m[1], 10) || 0;
      }
    } catch {}
    return null;
  }

  async getProgress(sprintId: string): Promise<SprintProgress | null> {
    const sprint = await this.getById(sprintId);
    if (!sprint) return null;
    const threads = await this.client.thread.findMany({ where: { sprintId }, include: { githubLinks: { include: { githubIssue: true } }, jiraLinks: { include: { jiraIssue: true } } } });

    // Unique issues counting
    const ghIssues: DbGithubIssue[] = [];
    const jiraIssues: DbJiraIssue[] = [] as any;
    for (const t of threads) {
      for (const l of t.githubLinks) if (l.githubIssue) ghIssues.push(l.githubIssue as any);
      for (const l of t.jiraLinks) if (l.jiraIssue) jiraIssues.push(l.jiraIssue as any);
    }
    const issueCount = ghIssues.length + jiraIssues.length || threads.length; // fallback to threads

    let open = 0, closed = 0;
    for (const gh of ghIssues) {
      if ((gh.state || '').toLowerCase() === 'closed') closed++; else open++;
    }
    // Jira status heuristic: consider Done/Closed/Resolved as closed
    for (const ji of jiraIssues) {
      const s = (ji.status || '').toLowerCase();
      if (s.includes('done') || s.includes('closed') || s.includes('resolve')) closed++; else open++;
    }
    if (ghIssues.length + jiraIssues.length === 0) {
      // Fallback: treat all threads as open
      open = threads.length;
      closed = 0;
    }

    let pointsTotal = 0;
    let pointsDone = 0;
    if (ghIssues.length + jiraIssues.length > 0) {
      // GH label based points + default weight 1 when missing
      for (const gh of ghIssues) {
        const pts = this.parsePointsFromGithubLabels((gh as any).labels || null);
        const weight = pts ?? 1;
        pointsTotal += weight;
        if ((gh.state || '').toLowerCase() === 'closed') pointsDone += weight;
      }
      // Jira: assume 1 point per issue unless enriched later
      for (const ji of jiraIssues) {
        const weight = 1;
        pointsTotal += weight;
        const s = (ji.status || '').toLowerCase();
        if (s.includes('done') || s.includes('closed') || s.includes('resolve')) pointsDone += weight;
      }
    } else {
      // No external issues: 1 point per thread
      pointsTotal = threads.length;
      pointsDone = 0;
    }

    const pointsRemaining = Math.max(0, pointsTotal - pointsDone);

    return {
      sprint,
      totals: {
        threads: threads.length,
        issues: issueCount,
        open,
        closed,
        pointsTotal,
        pointsDone,
        pointsRemaining,
      },
    };
  }
}

export const sprintService = new SprintService();
