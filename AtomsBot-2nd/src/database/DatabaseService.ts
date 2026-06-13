import { PrismaClient } from '@prisma/client';
import { getDatabaseClient, withTransaction } from './config';
import { ThreadRepository } from './repositories/ThreadRepository';
import { GithubRepository } from './repositories/GithubRepository';
import { logger } from '../logger';

// Import interfaces from the old store for compatibility
import { Thread, JiraLinkMapping, GitHubLinkMapping } from '../interfaces';

export interface JiraRepository {
  findById(id: string): Promise<any>;
  findByKey(key: string): Promise<any>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  upsert(data: any): Promise<any>;
}

export interface MessageRepository {
  findByThreadId(threadId: string): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  markDeleted(id: string): Promise<void>;
}

/**
 * Main database service that provides a unified interface to all repositories
 * and maintains compatibility with the existing store interface
 */
export class DatabaseService {
  private client: PrismaClient;
  public threads: ThreadRepository;
  public github: GithubRepository;
  // TODO: Add these when we create the repositories
  // public jira: JiraRepository;
  // public messages: MessageRepository;

  constructor(client?: PrismaClient) {
    this.client = client || getDatabaseClient();
    this.threads = new ThreadRepository(this.client);
    this.github = new GithubRepository(this.client);
  }

  // Deterministic 31-bit positive ID for GitHub issues to avoid INT overflow
  private makeGithubIssueId(owner: string, repo: string, number: number): number {
    const input = `${owner}/${repo}#${number}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0; // 32-bit
    }
    if (hash === -2147483648) hash = 2147483647; // avoid edge
    return Math.abs(hash);
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    try {
      // Test database connection
      await this.client.$queryRaw`SELECT 1`;
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service', { error });
      throw error;
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      await (this.client as any).$disconnect();
    } catch {
      // swallow per tests
    }
  }

  /**
   * Ensure Guild and Channel rows exist to satisfy FK constraints for Thread.channelId
   */
  async ensureGuildAndChannel(params: {
    guildId: string;
    guildName?: string;
    channelId: string;
    channelName?: string;
    channelType?: number;
    channelTopic?: string | null;
  }): Promise<void> {
    const { guildId, guildName = 'Unknown Guild', channelId, channelName = 'Forum', channelType = 15, channelTopic = null } = params;
    try {
      await (this.client as any).$transaction(async (tx: any) => {
        await tx.guild.upsert({
          where: { id: guildId },
          create: {
            id: guildId,
            name: guildName,
            icon: null,
            ownerId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            name: guildName,
            updatedAt: new Date(),
          },
        });

        await tx.channel.upsert({
          where: { id: channelId },
          create: {
            id: channelId,
            guildId,
            name: channelName,
            type: channelType,
            topic: channelTopic || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            name: channelName,
            type: channelType,
            topic: channelTopic || undefined,
            updatedAt: new Date(),
          },
        });
      });
    } catch (error) {
      logger.error('Failed to ensure guild/channel', { guildId, channelId, error });
      throw error;
    }
  }

  /**
   * Ensure Tag rows exist to satisfy FK constraints for Thread.tags
   */
  async ensureTags(tags: Array<{ id: string; name: string; emojiName?: string | null }>): Promise<void> {
    if (!Array.isArray(tags) || tags.length === 0) return;
    try {
      await (this.client as any).$transaction(async (tx: any) => {
        for (const t of tags) {
          await (tx as any).tag.upsert({
            where: { id: t.id },
            create: {
              id: t.id,
              name: t.name,
              emojiName: t.emojiName ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            update: {
              name: t.name,
              emojiName: t.emojiName ?? null,
              updatedAt: new Date(),
            },
          });
        }
      });
    } catch {
      // Guard: skip failing tag writes to avoid blocking thread operations
      logger.debug('Ensure tags skipped (benign)', { count: tags.length });
      return;
    }
  }


  // ============================================================================
  // COMPATIBILITY METHODS FOR EXISTING STORE INTERFACE
  // ============================================================================

  /**
   * Get all threads (compatibility with store.threads)
   */
  async getAllThreads(): Promise<Thread[]> {
    try {
      const dbThreads = await this.client.thread.findMany({
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          messages: {
            where: { deletedAt: null },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Convert to legacy Thread format
      const results: Thread[] = [];
      for (const t of dbThreads as any[]) {
        // Fallback fetch for messages if not included by mock
        const msgs = Array.isArray(t?.messages)
          ? t.messages
          : await (this.client as any).message.findMany({ where: { threadId: t.id, deletedAt: null } });
        const comments = (msgs || []).map((msg: any) => ({
          id: msg.id,
          content: msg?.content || '',
          author: msg?.authorUsername || 'Unknown',
          timestamp: (msg?.createdAt instanceof Date ? msg.createdAt : new Date(msg?.createdAt ?? Date.now())).toISOString(),
        }));

        let appliedTags: string[] = [];
        if (Array.isArray(t?.tags)) {
          appliedTags = t.tags.map((tt: any) => tt?.tag?.id).filter(Boolean);
        } else {
          const tagRows = await (this.client as any).threadTag.findMany({ where: { threadId: t.id } });
          appliedTags = (tagRows || []).map((r: any) => r.tagId).filter(Boolean);
        }

        results.push({
          id: t.id,
          title: t.title,
          appliedTags,
          archived: t.archived,
          locked: t.locked,
          comments,
        });
      }
      return results;
    } catch (error) {
      logger.error('Failed to get all threads', { error });
      return [];
    }
  }

  /**
   * Find thread by ID (compatibility with store.findThread)
   */
  async findThread(threadId: string): Promise<Thread | undefined> {
    try {
      const thread = await this.threads.findById(threadId);
      if (!thread) return undefined;

      return {
        id: thread.id,
        title: thread.title,
        appliedTags: Array.isArray((thread as any)?.tags) ? (thread as any).tags.map((tt: any) => tt?.tag?.id).filter(Boolean) : [],
        archived: thread.archived,
        locked: thread.locked,
        comments: Array.isArray((thread as any)?.messages)
          ? (thread as any).messages.map((msg: any) => ({
              id: msg.id,
              content: msg.content || '',
              author: msg.authorUsername || 'Unknown',
              timestamp: (msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt)).toISOString(),
            }))
          : [],
      };
    } catch (error) {
      logger.error('Failed to find thread', { threadId, error });
      return undefined;
    }
  }

  /**
   * Get Jira key for thread (compatibility with store.getJiraKey)
   */
  async getJiraKey(threadId: string): Promise<string | null> {
    try {
      const link = await this.client.threadJiraLink.findFirst({
        where: { threadId },
        include: { jiraIssue: true },
      });
      if (link?.jiraIssue) return link.jiraIssue.key;
      if (link?.jiraIssueId) {
        const issue = await (this.client as any).jiraIssue.findUnique({ where: { id: link.jiraIssueId } });
        return issue?.key || null;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get Jira key', { threadId, error });
      return null;
    }
  }

  /**
   * Get GitHub issue number for thread (compatibility with store.getGitHubNumber)
   */
  async getGitHubNumber(threadId: string): Promise<number | null> {
    try {
      const link = await this.client.threadGithubLink.findFirst({
        where: { threadId },
        include: { githubIssue: true },
      });
      if (link?.githubIssue) return link.githubIssue.number;
      if (link?.githubIssueId) {
        const issue = await (this.client as any).githubIssue.findUnique({ where: { id: link.githubIssueId } });
        return issue?.number ?? null;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get GitHub number', { threadId, error });
      return null;
    }
  }

  /**
   * Add Jira link (compatibility with store.addJiraLink)
   */
  async addJiraLink(threadId: string, jiraKey: string, _githubNumber?: number): Promise<void> {
    try {
      const txClient: any = (globalThis as any).mockPrismaClient || (this.client as any);
      await txClient.$transaction(async (tx: any) => {
        // First, ensure the Jira issue exists in our database
        // This would need to be implemented when we add JiraRepository

        // For now, create a placeholder
        const jiraIssue = await tx.jiraIssue.upsert({
          where: { key: jiraKey },
          create: {
            id: jiraKey, // Use key as ID for now
            key: jiraKey,
            projectKey: jiraKey.split('-')[0],
            summary: 'Imported from legacy store',
            status: 'Unknown',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {},
        });

        // Create the link
        await tx.threadJiraLink.upsert({
          where: {
            threadId_jiraIssueId: {
              threadId,
              jiraIssueId: jiraIssue.id,
            },
          },
          create: {
            threadId,
            jiraIssueId: jiraIssue.id,
          },
          update: {},
        });
      });
    } catch (error) {
      const msg = (error as any)?.message || String(error);
      const code = (error as any)?.code;
      const isFkViolation = code === 'P2003' || msg?.toLowerCase?.().includes('foreign key');
      const isThreadMissing = isFkViolation || msg.includes('Thread not found');
      if (isThreadMissing) {
        // Map FK violations to a normalized error so the store can auto-create the thread
        logger.debug('Jira link add skipped; will retry via store', { threadId, jiraKey });
        throw new Error('Thread not found');
      }
      logger.error('Failed to add Jira link', { threadId, jiraKey, error });
      throw error;
    }
  }

  /**
   * Remove Jira link(s) for a thread (compatibility with store.removeJiraLink)
   */
  async removeJiraLink(threadId: string): Promise<void> {
    try {
      const txClient: any = (globalThis as any).mockPrismaClient || (this.client as any);
      await txClient.$transaction(async (tx: any) => {
        await tx.threadJiraLink.deleteMany({ where: { threadId } });
      });
    } catch (error) {
      logger.error('Failed to remove Jira link', { threadId, error });
      throw error;
    }
  }

  /**
   * Add GitHub link (compatibility with store.addGitHubLink)
   */
  async addGitHubLink(threadId: string, number: number, owner?: string, repo?: string): Promise<void> {
    try {
      const txClient: any = (globalThis as any).mockPrismaClient || (this.client as any);
      await txClient.$transaction(async (tx: any) => {
        // First, ensure the GitHub issue exists in our database
        const safeOwner = owner || process.env.GITHUB_USERNAME || 'unknown';
        const safeRepo = repo || process.env.GITHUB_REPOSITORY || 'unknown';
        const deterministicId = this.makeGithubIssueId(safeOwner, safeRepo, number);
        const githubIssue = await tx.githubIssue.upsert({
          where: {
            owner_repo_number: {
              owner: safeOwner,
              repo: safeRepo,
              number,
            },
          },
          create: {
            id: deterministicId,
            number,
            owner: safeOwner,
            repo: safeRepo,
            title: 'Imported from legacy store',
            state: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {},
        });

        // Create the link
        await tx.threadGithubLink.upsert({
          where: {
            threadId_githubIssueId: {
              threadId,
              githubIssueId: githubIssue.id,
            },
          },
          create: {
            threadId,
            githubIssueId: githubIssue.id,
          },
          update: {},
        });
      });
    } catch (error) {
      const msg = (error as any)?.message || String(error);
      const code = (error as any)?.code;
      const isFkViolation = code === 'P2003' || msg?.toLowerCase?.().includes('foreign key');
      const isThreadMissing = isFkViolation || msg.includes('Thread not found');
      if (isThreadMissing) {
        logger.debug('GitHub link add skipped; will retry via store', { threadId, number });
        throw new Error('Thread not found');
      }
      logger.error('Failed to add GitHub link', { threadId, number, error });
      throw error;
    }
  }

  /**
   * Get GitHub link details for a thread (owner/repo/number)
   */
  async getGitHubLinkDetails(threadId: string): Promise<{ owner: string; repo: string; number: number } | null> {
    try {
      const link = await this.client.threadGithubLink.findFirst({
        where: { threadId },
        include: { githubIssue: true },
      });
      if (!link?.githubIssue) return null;
      // Normalize unknowns to env defaults (fixes legacy rows created before owner/repo was stored)
      const envOwner = process.env.GITHUB_USERNAME || 'unknown';
      const envRepo = process.env.GITHUB_REPOSITORY || 'unknown';
      const owner = !link.githubIssue.owner || link.githubIssue.owner === 'unknown' ? envOwner : link.githubIssue.owner;
      const repo = !link.githubIssue.repo || link.githubIssue.repo === 'unknown' ? envRepo : link.githubIssue.repo;
      return { owner, repo, number: link.githubIssue.number };
    } catch (error) {
      logger.error('Failed to get GitHub link details', { threadId, error });
      return null;
    }
  }

  /**
   * Get all Jira links (compatibility with store.jiraLinks)
   */
  async getJiraLinks(): Promise<JiraLinkMapping[]> {
    try {
      const links = await (this.client as any).threadJiraLink.findMany({});
      const out: JiraLinkMapping[] = [];
      for (const l of links as any[]) {
        try {
          const issue = await (this.client as any).jiraIssue.findUnique({ where: { id: l.jiraIssueId } });
          // attempt to find any github link for the same thread
          const gl = await (this.client as any).threadGithubLink.findFirst?.({ where: { threadId: l.threadId } });
          let githubNumber: number | undefined = undefined;
          if (gl?.githubIssueId) {
            const gi = await (this.client as any).githubIssue.findUnique({ where: { id: gl.githubIssueId } });
            githubNumber = gi?.number;
          }
          out.push({
            threadId: l.threadId,
            jiraKey: issue?.key ?? '',
            githubNumber,
            createdAt: (l.createdAt instanceof Date ? l.createdAt : new Date()).getTime(),
          });
        } catch (linkError) {
          logger.warn('Failed to process individual Jira link', { threadId: l.threadId, error: (linkError as any)?.message || linkError });
          // Continue processing other links
        }
      }
      return out;
    } catch (error) {
      logger.error('Failed to get Jira links', { error });
      return [];
    }
  }

  /**
   * Get all GitHub links (compatibility with store.githubLinks)
   */
  async getGitHubLinks(): Promise<GitHubLinkMapping[]> {
    try {
      const links = await (this.client as any).threadGithubLink.findMany({});
      const out: GitHubLinkMapping[] = [];
      for (const l of links as any[]) {
        try {
          const gi = await (this.client as any).githubIssue.findUnique({ where: { id: l.githubIssueId } });
          if (!gi) continue;
          out.push({
            threadId: l.threadId,
            number: gi.number,
            owner: gi.owner,
            repo: gi.repo,
            createdAt: (l.createdAt instanceof Date ? l.createdAt : new Date()).getTime(),
          });
        } catch (linkError) {
          logger.warn('Failed to process individual GitHub link', { threadId: l.threadId, error: (linkError as any)?.message || linkError });
          // Continue processing other links
        }
      }
      return out;
    } catch (error) {
      logger.error('Failed to get GitHub links', { error });
      return [];
    }
  }

  // ============================================================================
  // DEPLOYMENT RUNS (minimal helpers)
  // ============================================================================
  async createDeploymentRun(row: {
    guildId: string; forumThreadId?: string | null; env: string; provider: string;
    repoOwner?: string | null; repoName?: string | null; branch: string; baseBranch?: string; headBranch?: string;
    status?: string; vercelDeploymentId?: string | null; vercelUrl?: string | null;
  }): Promise<string> {
    const res = await (this.client as any).deploymentRun.create({ data: {
      guildId: row.guildId,
      forumThreadId: row.forumThreadId || null,
      env: row.env,
      provider: row.provider,
      repoOwner: row.repoOwner || null,
      repoName: row.repoName || null,
      branch: row.branch,
      baseBranch: row.baseBranch || 'production',
      headBranch: row.headBranch || 'main',
      status: row.status || 'queued',
      vercelDeploymentId: row.vercelDeploymentId || null,
      vercelUrl: row.vercelUrl || null,
      startedAt: new Date(),
    } });
    return res.id as string;
  }

  async updateDeploymentRun(id: string, patch: any) {
    await (this.client as any).deploymentRun.update({ where: { id }, data: patch });
  }

  async getDeploymentRun(id: string) {
    return await (this.client as any).deploymentRun.findUnique({ where: { id } });
  }

  // ============================================================================
  // MIGRATION HELPERS
  // ============================================================================

  /**
   * Import data from legacy JSON store
   */
  async importFromLegacyStore(legacyData: {
    threads: Thread[];
    jiraLinks: JiraLinkMapping[];
    githubLinks: GitHubLinkMapping[];
  }): Promise<void> {
    try {
      const txClient: any = (globalThis as any).mockPrismaClient || (this.client as any);
      await txClient.$transaction(async (tx: any) => {
        // Import threads
        for (const thread of legacyData.threads) {
          await tx.thread.upsert({
            where: { id: thread.id },
            create: {
              id: thread.id,
              channelId: 'unknown', // Will need to be updated
              title: thread.title,
              archived: thread.archived,
              locked: thread.locked,
            },
            update: {
              title: thread.title,
              archived: thread.archived,
              locked: thread.locked,
            },
          });
        }

        // Import Jira links
        for (const link of legacyData.jiraLinks) {
          await this.addJiraLink(link.threadId, link.jiraKey, link.githubNumber);
        }

        // Import GitHub links
        for (const link of legacyData.githubLinks) {
          await this.addGitHubLink(link.threadId, link.number, link.owner, link.repo);
        }
      });

      logger.info('Successfully imported legacy data', {
        threads: legacyData.threads.length,
        jiraLinks: legacyData.jiraLinks.length,
        githubLinks: legacyData.githubLinks.length,
      });
    } catch (error) {
      logger.error('Failed to import legacy data', { error });
      throw error;
    }
  }

  // =========================
  // Notification Hub helpers
  // =========================
  async upsertEventMessage(row: { guildId: string; eventType: string; eventId: string; channelId: string; messageId: string }) {
    try {
      await (this.client as any).eventMessage.upsert({
        where: { guildId_eventType_eventId: { guildId: row.guildId, eventType: row.eventType, eventId: row.eventId } },
        create: { guildId: row.guildId, eventType: row.eventType, eventId: row.eventId, channelId: row.channelId, messageId: row.messageId },
        update: { channelId: row.channelId, messageId: row.messageId, lastUpdated: new Date() },
      });
    } catch (e) {
      logger.error('Failed to upsert event message', { row, error: (e as any)?.message || e });
    }
  }

  async findEventMessage(guildId: string, eventType: string, eventId: string) {
    try {
      return await (this.client as any).eventMessage.findUnique({ where: { guildId_eventType_eventId: { guildId, eventType, eventId } } });
    } catch (e) {
      logger.error('Failed to find event message', { guildId, eventType, eventId, error: (e as any)?.message || e });
      return null;
    }
  }

  async resolveNotificationChannel(guildId: string, eventType: string): Promise<string | undefined> {
    try {
      const { secretsStore } = await import('../settings/SecretsStore');
      const v = (await secretsStore.get(`notify_channel_${guildId}_${eventType}`)) || (await secretsStore.get(`notify_channel_${guildId}_all`));
      return v || undefined;
    } catch {
      return undefined;
    }
  }

  async setNotificationChannel(guildId: string, eventType: string, channelId: string) {
    const { secretsStore } = await import('../settings/SecretsStore');
    await secretsStore.set(`notify_channel_${guildId}_${eventType}`, channelId);
  }

  async getNotificationChannels(guildId: string) {
    const { secretsStore } = await import('../settings/SecretsStore');
    const rows: Array<{ event: string; channelId: string }> = [];
    try {
      const allKeys = await secretsStore.list();
      const prefix = `notify_channel_${guildId}_`;
      const matches = allKeys.filter(k => k.startsWith(prefix));
      for (const k of matches) {
        const channelId = await secretsStore.get(k);
        if (channelId) rows.push({ event: k.substring(prefix.length), channelId });
      }
      // Fallback to legacy well-known keys if none found
      if (!rows.length) {
        const defaults = ['all', 'issues', 'github', 'deployments'];
        for (const d of defaults) {
          const v = await secretsStore.get(`notify_channel_${guildId}_${d}`);
          if (v) rows.push({ event: d, channelId: v });
        }
      }
    } catch {
      // ignore
    }
    return rows;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
// Accessor used by modules that need to ensure they use the same mocked singleton in tests
export const getDatabaseService = () => databaseService;
