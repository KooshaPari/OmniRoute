import { PrismaClient, GithubIssue } from '@prisma/client';
import { getDatabaseClient } from '../config';
import { logger } from '../../logger';

export interface CreateGithubIssueData {
  id: number;
  number: number;
  owner: string;
  repo: string;
  title: string;
  body?: string;
  state: string;
  locked?: boolean;
  assigneeLogin?: string;
  labels?: string[];
  milestoneTitle?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface UpdateGithubIssueData {
  title?: string;
  body?: string;
  state?: string;
  locked?: boolean;
  assigneeLogin?: string;
  labels?: string[];
  milestoneTitle?: string;
  updatedAt: Date;
  closedAt?: Date;
}

export class GithubRepository {
  private client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client || getDatabaseClient();
  }

  async findById(id: number): Promise<GithubIssue | null> {
    try {
      return await this.client.githubIssue.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find GitHub issue by ID', { id, error });
      throw error;
    }
  }

  async findByNumber(owner: string, repo: string, number: number): Promise<GithubIssue | null> {
    try {
      return await this.client.githubIssue.findUnique({
        where: {
          owner_repo_number: {
            owner,
            repo,
            number,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find GitHub issue by number', { owner, repo, number, error });
      throw error;
    }
  }

  async findByRepository(owner: string, repo: string, state?: string): Promise<GithubIssue[]> {
    try {
      return await this.client.githubIssue.findMany({
        where: {
          owner,
          repo,
          ...(state && { state }),
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find GitHub issues by repository', { owner, repo, state, error });
      throw error;
    }
  }

  async create(data: CreateGithubIssueData): Promise<GithubIssue> {
    try {
      return await this.client.githubIssue.create({
        data: {
          ...data,
          labels: data.labels ? JSON.stringify(data.labels) : null,
        },
      });
    } catch (error) {
      logger.error('Failed to create GitHub issue', { data, error });
      throw error;
    }
  }

  async upsert(data: CreateGithubIssueData): Promise<GithubIssue> {
    try {
      return await this.client.githubIssue.upsert({
        where: {
          owner_repo_number: {
            owner: data.owner,
            repo: data.repo,
            number: data.number,
          },
        },
        create: {
          ...data,
          labels: data.labels ? JSON.stringify(data.labels) : null,
        },
        update: {
          title: data.title,
          body: data.body,
          state: data.state,
          locked: data.locked,
          assigneeLogin: data.assigneeLogin,
          labels: data.labels ? JSON.stringify(data.labels) : null,
          milestoneTitle: data.milestoneTitle,
          updatedAt: data.updatedAt,
          closedAt: data.closedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to upsert GitHub issue', { data, error });
      throw error;
    }
  }

  async update(id: number, data: UpdateGithubIssueData): Promise<GithubIssue> {
    try {
      return await this.client.githubIssue.update({
        where: { id },
        data: {
          ...data,
          labels: data.labels ? JSON.stringify(data.labels) : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to update GitHub issue', { id, data, error });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await this.client.githubIssue.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete GitHub issue', { id, error });
      throw error;
    }
  }

  async findLinkedToThread(threadId: string): Promise<GithubIssue[]> {
    try {
      const links = await this.client.threadGithubLink.findMany({
        where: { threadId },
        include: { githubIssue: true },
      });
      return links.map(link => link.githubIssue);
    } catch (error) {
      logger.error('Failed to find GitHub issues linked to thread', { threadId, error });
      throw error;
    }
  }

  async findByAssignee(assigneeLogin: string): Promise<GithubIssue[]> {
    try {
      return await this.client.githubIssue.findMany({
        where: { assigneeLogin },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find GitHub issues by assignee', { assigneeLogin, error });
      throw error;
    }
  }

  async findByState(state: string, owner?: string, repo?: string): Promise<GithubIssue[]> {
    try {
      return await this.client.githubIssue.findMany({
        where: {
          state,
          ...(owner && { owner }),
          ...(repo && { repo }),
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find GitHub issues by state', { state, owner, repo, error });
      throw error;
    }
  }

  async findByLabels(labels: string[], owner?: string, repo?: string): Promise<GithubIssue[]> {
    try {
      // Note: This is a simple implementation. For more complex label queries,
      // consider using full-text search or JSON operators in PostgreSQL
      const issues = await this.client.githubIssue.findMany({
        where: {
          ...(owner && { owner }),
          ...(repo && { repo }),
        },
        orderBy: { updatedAt: 'desc' },
      });

      return issues.filter(issue => {
        if (!issue.labels) return false;
        try {
          const issueLabels = JSON.parse(issue.labels) as string[];
          return labels.some(label => issueLabels.includes(label));
        } catch {
          // Malformed labels JSON - ignore this issue for label filtering
          return false;
        }
      });
    } catch (error) {
      logger.error('Failed to find GitHub issues by labels', { labels, owner, repo, error });
      throw error;
    }
  }

  async getRepositoryStats(owner: string, repo: string): Promise<{
    total: number;
    open: number;
    closed: number;
    locked: number;
    withAssignee: number;
  }> {
    try {
      const [total, open, closed, locked, withAssignee] = await Promise.all([
        this.client.githubIssue.count({ where: { owner, repo } }),
        this.client.githubIssue.count({ where: { owner, repo, state: 'open' } }),
        this.client.githubIssue.count({ where: { owner, repo, state: 'closed' } }),
        this.client.githubIssue.count({ where: { owner, repo, locked: true } }),
        this.client.githubIssue.count({
          where: {
            owner,
            repo,
            assigneeLogin: { not: null },
          },
        }),
      ]);

      return { total, open, closed, locked, withAssignee };
    } catch (error) {
      logger.error('Failed to get repository stats', { owner, repo, error });
      throw error;
    }
  }

  async searchIssues(query: string, owner?: string, repo?: string): Promise<GithubIssue[]> {
    try {
      // Simple text search - in production, consider using full-text search
      return await this.client.githubIssue.findMany({
        where: {
          ...(owner && { owner }),
          ...(repo && { repo }),
          OR: [
            { title: { contains: query } },
            { body: { contains: query } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to search GitHub issues', { query, owner, repo, error });
      throw error;
    }
  }

  // Helper method to parse labels from JSON string
  getLabelsArray(issue: GithubIssue): string[] {
    if (!issue.labels) return [];
    try {
      return JSON.parse(issue.labels) as string[];
    } catch {
      return [];
    }
  }
}
