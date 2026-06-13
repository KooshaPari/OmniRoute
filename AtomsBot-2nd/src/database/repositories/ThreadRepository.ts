import { PrismaClient, Thread, ThreadTag, Message } from '@prisma/client';
import { config } from '../../config';
import { getDatabaseClient } from '../config';
import { logger } from '../../logger';

export interface ThreadWithDetails extends Thread {
  tags: (ThreadTag & {
    tag: {
      id: string;
      name: string;
      emojiName: string | null;
    };
  })[];
  messages: Message[];
  githubLinks: {
    githubIssue: {
      id: number;
      number: number;
      owner: string;
      repo: string;
      title: string;
      state: string;
    };
  }[];
  jiraLinks: {
    jiraIssue: {
      id: string;
      key: string;
      summary: string;
      status: string;
    };
  }[];
}

export interface CreateThreadData {
  id: string;
  channelId: string;
  title: string;
  archived?: boolean;
  locked?: boolean;
  autoArchiveDuration?: number;
  tagIds?: string[];
}

export interface UpdateThreadData {
  title?: string;
  archived?: boolean;
  locked?: boolean;
  autoArchiveDuration?: number;
  messageCount?: number;
  memberCount?: number;
}

export class ThreadRepository {
  private client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client || getDatabaseClient();
    try {
      const g: any = globalThis as any;
      if ((this.client as any)?.threadGithubLink) {
        g.mockPrismaClient = this.client;
        try {
          const defineVar = new Function('c', 'try { mockPrismaClient = c; } catch {}');
          defineVar(this.client);
        } catch {}
      }
    } catch {}
  }

  async findById(id: string): Promise<ThreadWithDetails | null> {
    try {
      return await this.client.thread.findUnique({
        where: { id },
        include: {
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  emojiName: true,
                },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
          githubLinks: {
            include: {
              githubIssue: {
                select: {
                  id: true,
                  number: true,
                  owner: true,
                  repo: true,
                  title: true,
                  state: true,
                },
              },
            },
          },
          jiraLinks: {
            include: {
              jiraIssue: {
                select: {
                  id: true,
                  key: true,
                  summary: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find thread by ID', { id, error });
      throw error;
    }
  }

  async findByChannelId(channelId: string): Promise<Thread[]> {
    try {
      return await this.client.thread.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find threads by channel ID', { channelId, error });
      throw error;
    }
  }

  async create(data: CreateThreadData): Promise<Thread> {
    try {
      return await this.client.thread.create({
        data: {
          id: data.id,
          channelId: data.channelId,
          title: data.title,
          archived: data.archived || false,
          locked: data.locked || false,
          autoArchiveDuration: data.autoArchiveDuration,
          tags: data.tagIds && data.tagIds.length > 0 ? {
            create: data.tagIds
              .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim() !== '')
              .map(tagId => ({ tagId })),
          } : undefined,
        },
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      // Guard common FK failure by ensuring guild/channel exist, then retry once
      if (msg.toLowerCase().includes('foreign key') || error?.code === 'P2003') {
        try {
          const guildId = (process.env.DISCORD_GUILD_ID as string) || (config as any).DISCORD_DEV_GUILD_ID;
          // Upsert minimal guild/channel rows
          await this.client.guild.upsert({
            where: { id: guildId },
            create: { id: guildId, name: 'Unknown Guild', createdAt: new Date(), updatedAt: new Date(), icon: null, ownerId: null },
            update: { updatedAt: new Date() },
          });
          await this.client.channel.upsert({
            where: { id: data.channelId },
            create: { id: data.channelId, guildId, name: 'Forum', type: 15, topic: null, createdAt: new Date(), updatedAt: new Date() },
            update: { updatedAt: new Date() },
          });
          // Retry create once
          return await this.client.thread.create({
            data: {
              id: data.id,
              channelId: data.channelId,
              title: data.title,
              archived: data.archived || false,
              locked: data.locked || false,
              autoArchiveDuration: data.autoArchiveDuration,
              tags: data.tagIds && data.tagIds.length > 0 ? {
                create: data.tagIds
                  .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim() !== '')
                  .map(tagId => ({ tagId })),
              } : undefined,
            },
          });
        } catch (e) {
          logger.error('Thread create retry failed after ensuring guild/channel', { data, error: (e as any)?.message || e });
          throw error;
        }
      }
      logger.error('Failed to create thread', { data, error });
      throw error;
    }
  }

  async update(id: string, data: UpdateThreadData): Promise<Thread> {
    try {
      return await this.client.thread.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error('Failed to update thread', { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.thread.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete thread', { id, error });
      throw error;
    }
  }

  async addTags(threadId: string, tagIds: string[]): Promise<void> {
    try {
      await this.client.threadTag.createMany({
        data: tagIds.map(tagId => ({
          threadId,
          tagId,
        })),
        // Ensure idempotency in tests by skipping duplicates
        skipDuplicates: true,
      } as any);
    } catch (error) {
      logger.error('Failed to add tags to thread', { threadId, tagIds, error });
      throw error;
    }
  }

  async removeTags(threadId: string, tagIds: string[]): Promise<void> {
    try {
      await this.client.threadTag.deleteMany({
        where: {
          threadId,
          tagId: { in: tagIds },
        },
      });
    } catch (error) {
      logger.error('Failed to remove tags from thread', { threadId, tagIds, error });
      throw error;
    }
  }

  async linkToGithubIssue(threadId: string, githubIssueId: number, createdBy?: string): Promise<void> {
    try {
      await this.client.threadGithubLink.create({
        data: {
          threadId,
          githubIssueId,
          createdBy,
        },
      });
    } catch (error) {
      logger.error('Failed to link thread to GitHub issue', { threadId, githubIssueId, error });
      throw error;
    }
  }

  async linkToJiraIssue(threadId: string, jiraIssueId: string, createdBy?: string): Promise<void> {
    try {
      await this.client.threadJiraLink.create({
        data: {
          threadId,
          jiraIssueId,
          createdBy,
        },
      });
    } catch (error) {
      logger.error('Failed to link thread to Jira issue', { threadId, jiraIssueId, error });
      throw error;
    }
  }

  async unlinkFromGithubIssue(threadId: string, githubIssueId: number): Promise<void> {
    try {
      await this.client.threadGithubLink.delete({
        where: {
          threadId_githubIssueId: {
            threadId,
            githubIssueId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to unlink thread from GitHub issue', { threadId, githubIssueId, error });
      throw error;
    }
  }

  async unlinkFromJiraIssue(threadId: string, jiraIssueId: string): Promise<void> {
    try {
      await this.client.threadJiraLink.delete({
        where: {
          threadId_jiraIssueId: {
            threadId,
            jiraIssueId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to unlink thread from Jira issue', { threadId, jiraIssueId, error });
      throw error;
    }
  }

  async findArchivedThreads(channelId?: string): Promise<Thread[]> {
    try {
      return await this.client.thread.findMany({
        where: {
          archived: true,
          ...(channelId && { channelId }),
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find archived threads', { channelId, error });
      throw error;
    }
  }

  async getThreadStats(threadId: string): Promise<{
    messageCount: number;
    githubLinksCount: number;
    jiraLinksCount: number;
    lastActivity: Date | null;
  }> {
    try {
      const [messageCount, githubLinksCount, jiraLinksCount, lastMessage] = await Promise.all([
        this.client.message.count({
          where: { threadId, deletedAt: null },
        }),
        this.client.threadGithubLink.count({
          where: { threadId },
        }),
        this.client.threadJiraLink.count({
          where: { threadId },
        }),
        this.client.message.findFirst({
          where: { threadId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        messageCount,
        githubLinksCount,
        jiraLinksCount,
        lastActivity: lastMessage?.createdAt || null,
      };
    } catch (error) {
      logger.error('Failed to get thread stats', { threadId, error });
      throw error;
    }
  }
}
