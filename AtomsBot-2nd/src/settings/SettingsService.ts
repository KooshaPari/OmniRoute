import { PrismaClient } from '@prisma/client';

export class SettingsService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  // Forum channel mapping
  async setForumChannelId(guildId: string, forumId: string, channelId: string) {
    await this.prisma.forumChannelConfig.upsert({
      where: { guildId_forumId: { guildId, forumId } as any },
      create: { guildId, forumId, channelId },
      update: { channelId },
    });
  }

  async getForumChannelId(guildId: string, forumId: string): Promise<string | undefined> {
    const row = await this.prisma.forumChannelConfig.findUnique({
      where: { guildId_forumId: { guildId, forumId } as any },
    });
    return row?.channelId || undefined;
  }

  async listForumMappings(guildId: string): Promise<Array<{ forumId: string; channelId: string }>> {
    const rows = await this.prisma.forumChannelConfig.findMany({ where: { guildId } });
    return rows.map(r => ({ forumId: r.forumId, channelId: r.channelId }));
  }

  // Team settings (minimal for now)
  async upsertTeamSettings(id: string, data: Partial<{
    name: string;
    description: string | null;
    color: number | null;
    emoji: string | null;
    bugForumId: string | null;
    featureForumId: string | null;
    bugForumChannelId: string | null;
    featureForumChannelId: string | null;
    githubOwner: string | null;
    githubRepo: string | null;
    githubLabelPrefix: string | null;
    jiraProjectKey: string | null;
    jiraBoardId: string | null;
    roleId: string | null;
    linearTeamId: string | null;
    linearProjectId: string | null;
    ghProjectsOrg: string | null;
    ghProjectsId: string | null;
    ghProjectsNumber: string | null;
    pmProvider: string | null;
    pmSync: boolean | null;
    pmConflictPolicy: string | null;
    codaDocId: string | null;
    codaIssuesTableId: string | null;
    codaCommentsTableId: string | null;
    codaUsersTableId: string | null;
    codaIssueKeyColumn: string | null;
    codaIssueTitleColumn: string | null;
    codaIssueStatusColumn: string | null;
    codaIssuePriorityColumn: string | null;
    codaIssueAssigneeColumn: string | null;
    codaIssueUpdatedAtColumn: string | null;
  }>) {
    const existing = await this.prisma.teamSettings.findUnique({ where: { id } });
    if (!existing) {
      await this.prisma.teamSettings.create({
        data: {
          id,
          name: data.name || id,
          description: data.description ?? null,
          color: data.color ?? null,
          emoji: data.emoji ?? null,
          bugForumId: data.bugForumId ?? null,
          featureForumId: data.featureForumId ?? null,
          bugForumChannelId: data.bugForumChannelId ?? null,
          featureForumChannelId: data.featureForumChannelId ?? null,
          githubOwner: data.githubOwner ?? null,
          githubRepo: data.githubRepo ?? null,
          githubLabelPrefix: data.githubLabelPrefix ?? null,
          jiraProjectKey: data.jiraProjectKey ?? null,
          jiraBoardId: data.jiraBoardId ?? null,
          linearTeamId: data.linearTeamId ?? null,
          linearProjectId: data.linearProjectId ?? null,
          ghProjectsOrg: data.ghProjectsOrg ?? null,
          ghProjectsId: data.ghProjectsId ?? null,
          ghProjectsNumber: data.ghProjectsNumber ?? null,
          pmProvider: data.pmProvider ?? null,
          pmSync: data.pmSync ?? null,
          pmConflictPolicy: data.pmConflictPolicy ?? null,
          codaDocId: data.codaDocId ?? null,
          codaIssuesTableId: data.codaIssuesTableId ?? null,
          codaCommentsTableId: data.codaCommentsTableId ?? null,
          codaUsersTableId: data.codaUsersTableId ?? null,
          codaIssueKeyColumn: data.codaIssueKeyColumn ?? null,
          codaIssueTitleColumn: data.codaIssueTitleColumn ?? null,
          codaIssueStatusColumn: data.codaIssueStatusColumn ?? null,
          codaIssuePriorityColumn: data.codaIssuePriorityColumn ?? null,
          codaIssueAssigneeColumn: data.codaIssueAssigneeColumn ?? null,
          codaIssueUpdatedAtColumn: data.codaIssueUpdatedAtColumn ?? null,
        },
      });
    } else {
      await this.prisma.teamSettings.update({
        where: { id },
        data: {
          ...data,
        } as any,
      });
    }
  }

  async setTeamRoleId(id: string, roleId: string | null) {
    await this.prisma.teamSettings.update({ where: { id }, data: { roleId } });
  }

  async getTeamSettings(id: string) {
    return this.prisma.teamSettings.findUnique({ where: { id } });
  }

  async listTeamSettings() {
    return this.prisma.teamSettings.findMany();
  }

  async removeTeamSettings(id: string) {
    await this.prisma.teamSettings.delete({ where: { id } });
  }

  async setTeamCodaMapping(id: string, mapping: { docId?: string | null; issuesTableId?: string | null; commentsTableId?: string | null; usersTableId?: string | null; columns?: { key?: string | null; title?: string | null; status?: string | null; priority?: string | null; assignee?: string | null } }) {
    await this.prisma.teamSettings.update({
      where: { id },
      data: {
        codaDocId: mapping.docId ?? null,
        codaIssuesTableId: mapping.issuesTableId ?? null,
        codaCommentsTableId: mapping.commentsTableId ?? null,
        codaUsersTableId: mapping.usersTableId ?? null,
        codaIssueKeyColumn: mapping.columns?.key ?? undefined,
        codaIssueTitleColumn: mapping.columns?.title ?? undefined,
        codaIssueStatusColumn: mapping.columns?.status ?? undefined,
        codaIssuePriorityColumn: mapping.columns?.priority ?? undefined,
        codaIssueAssigneeColumn: mapping.columns?.assignee ?? undefined,
      },
    });
  }

  async getTeamCodaMapping(id: string): Promise<{ docId?: string | null; issuesTableId?: string | null; commentsTableId?: string | null; usersTableId?: string | null; columns?: { key?: string | null; title?: string | null; status?: string | null; priority?: string | null; assignee?: string | null; updatedAt?: string | null } } | null> {
    const row = await this.prisma.teamSettings.findUnique({ where: { id }, select: { codaDocId: true, codaIssuesTableId: true, codaCommentsTableId: true, codaUsersTableId: true, codaIssueKeyColumn: true, codaIssueTitleColumn: true, codaIssueStatusColumn: true, codaIssuePriorityColumn: true, codaIssueAssigneeColumn: true, codaIssueUpdatedAtColumn: true } as any });
    if (!row) return null;
    return { docId: (row as any).codaDocId, issuesTableId: (row as any).codaIssuesTableId, commentsTableId: (row as any).codaCommentsTableId, usersTableId: (row as any).codaUsersTableId, columns: { key: (row as any).codaIssueKeyColumn, title: (row as any).codaIssueTitleColumn, status: (row as any).codaIssueStatusColumn, priority: (row as any).codaIssuePriorityColumn, assignee: (row as any).codaIssueAssigneeColumn, updatedAt: (row as any).codaIssueUpdatedAtColumn } } as any;
  }
}

export const settingsService = new SettingsService();
