import type { ForumConfig, TeamConfig } from "../ForumTypes";
import type { ForumConfigProvider, ForumEnvConfig } from "./ForumConfigProvider";

export class DbProvider implements ForumConfigProvider {
  async getTeams(): Promise<TeamConfig[]> {
    try {
      const { settingsService } = await import("../../../settings/SettingsService").catch(() => ({ settingsService: { getTeamSettings: async () => null, getForumChannelId: async () => undefined } } as any));
      const list = await settingsService.listTeamSettings();
      return list.map((t: any) => ({
        id: t.id,
        name: t.name || t.id,
        description: t.description || "Configured via /setup team",
        color: t.color || 0x5865f2,
        emoji: t.emoji || "📁",
        forums: [],
        members: [],
      }));
    } catch {
      return [];
    }
  }

  async getForums(_guildId?: string): Promise<ForumConfig[]> {
    try {
      const { settingsService } = await import("../../../settings/SettingsService").catch(() => ({ settingsService: { getForumChannelId: async () => undefined, listTeamSettings: async () => [] } } as any));
      const list = await settingsService.listTeamSettings();
      const out: ForumConfig[] = [];
      let idx = 0;
      const priorityBase = 50;

      const makeForum = (team: TeamConfig, forumId: string | null | undefined, category: "bug-reports" | "feature-requests") => {
        if (!forumId) return;
        out.push({
          id: forumId,
          name: `${category === 'bug-reports' ? '🧰' : '💡'} ${team.name} ${category === 'bug-reports' ? 'Bug Reports' : 'Feature Requests'}`,
          description: `${team.name} ${category === 'bug-reports' ? 'bugs' : 'features'} forum`,
          category,
          team: team.id,
          priority: priorityBase + (idx++),
          tags: category === 'bug-reports'
            ? [ { name: 'bug', emoji: '🐛' }, { name: 'regression', emoji: '↩️' }, { name: 'performance', emoji: '⚡' } ]
            : [ { name: 'enhancement', emoji: '✨' }, { name: 'proposal', emoji: '💡' }, { name: 'integration', emoji: '🔗' } ],
          permissions: { allowedRoles: ['@everyone'], restrictedToTeam: false },
          autoAssign: [],
          labels: category === 'bug-reports' ? ['bug'] : ['enhancement'],
        } as ForumConfig);
      };

      const teams = list.map((t: any) => ({
        id: t.id,
        name: t.name || t.id,
        description: t.description || "Configured via /setup team",
        color: t.color || 0x5865f2,
        emoji: t.emoji || "📁",
        forums: [],
        members: [],
      } as TeamConfig));

      for (const t of list) {
        const team = teams.find((x: TeamConfig) => x.id === t.id)!;
        makeForum(team, (t as any).bugForumId || null, "bug-reports");
        makeForum(team, (t as any).featureForumId || null, "feature-requests");
      }
      return out;
    } catch {
      return [];
    }
  }

  async getEnv(guildId?: string): Promise<ForumEnvConfig> {
    try {
      const { settingsService } = await import("../../../settings/SettingsService").catch(() => ({ settingsService: { getAllTeamSettings: async () => [], listTeamSettings: async () => [] } } as any));
      const list = await settingsService.listTeamSettings();
      const map: Record<string, string> = {};
      for (const t of list) {
        for (const fid of [t.bugForumId, t.featureForumId]) {
          if (!fid) continue;
          try {
            const ch = guildId ? await settingsService.getForumChannelId(guildId, fid) : undefined;
            if (ch) map[fid] = ch;
          } catch {}
        }
      }
      return { FORUM_CHANNEL_IDS: map };
    } catch {
      return { FORUM_CHANNEL_IDS: {} };
    }
  }
}
