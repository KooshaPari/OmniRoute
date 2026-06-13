import { ForumChannel, Guild, ChannelType, PermissionFlagsBits } from "discord.js";
import { ForumConfig, TeamConfig } from "./ForumTypes";
import {
  FORUM_CONFIGURATIONS,
  TEAM_CONFIGURATIONS,
  ENVIRONMENT_CONFIG,
  validateConfigurations,
} from "./ForumConfig";
import { IssueData } from "./UnifiedIssueManager";
import type { ForumConfigProvider, ForumEnvConfig } from "./providers/ForumConfigProvider";
import { DbProvider } from "./providers/DbProvider";

/**
 * Forum Manager for handling multiple team-based forums
 */
export class ForumManager {
  private forums: Map<string, ForumConfig> = new Map();
  private teams: Map<string, TeamConfig> = new Map();
  private channelForumMap: Map<string, string> = new Map(); // channelId -> forumId
  private dbTeamIds: Set<string> = new Set();
  private dbForumIds: Set<string> = new Set();
  private overlaysActive = false;
  private provider?: ForumConfigProvider;
  private loaded = false;
  private env?: ForumEnvConfig;

  constructor(provider?: ForumConfigProvider) {
    this.provider = provider;
    this.initializeAutoCreate();
    this.initializeFromStaticConfig();
  }

  async load(guildId?: string): Promise<void> {
    if (!this.provider) {
      // No external provider; already initialized from static config
      this.loaded = true;
      return;
    }
    const [teams, forums, env] = await Promise.all([
      this.provider.getTeams(guildId),
      this.provider.getForums(guildId),
      this.provider.getEnv(guildId),
    ]);

    this.forums.clear();
    this.teams.clear();
    this.channelForumMap.clear();

    teams.forEach((t) => this.registerTeam({ ...t, forums: [...(t.forums || [])] }));
    forums.forEach((f) => this.registerForum(f));
    this.env = env;
    Object.entries(env?.FORUM_CHANNEL_IDS || {}).forEach(([fid, ch]) => {
      if (!ch) return;
      const f = this.getForum(fid);
      if (f) {
        (f as any).channelId = ch;
        this.channelForumMap.set(ch, fid);
      }
    });
    this.loaded = true;
  }

  /**
   * Initialize forums and teams from configuration
   */
  // Removed static configuration loading/validation. Everything is DB-backed.

  /**
   * Initialize auto-create functionality
   */
  private initializeAutoCreate(): void {
    // Auto-create functionality will be handled externally when client is ready
    // This avoids circular import issues
    console.log(
      "🏗️ ForumManager initialized - auto-create will be handled by discord.ts",
    );
  }

  /**
   * Load initial forums/teams from static configuration (used by tests and default flow)
   */
  private initializeFromStaticConfig(): void {
    try {
      const result = validateConfigurations();
      if (!result.valid) {
        console.warn("Forum configuration validation failed:", result.errors);
        for (const e of result.errors) {
          try { console.warn(`- ${e}`); } catch {}
        }
      }
    } catch {}

    // Load teams then forums to ensure references exist
    this.teams.clear();
    TEAM_CONFIGURATIONS.forEach((t) => this.registerTeam({ ...t, forums: [...(t.forums || [])] }));
    this.forums.clear();
    FORUM_CONFIGURATIONS.forEach((f) => this.registerForum({ ...f }));
    this.env = ENVIRONMENT_CONFIG as any;
    this.loaded = true; // mark loaded early to prevent recursive refresh
    // Map channel IDs from environment
    Object.entries(this.env?.FORUM_CHANNEL_IDS || {}).forEach(([fid, ch]) => {
      if (!ch) return;
      const f = this.forums.get(fid);
      if (f) {
        (f as any).channelId = ch;
        this.channelForumMap.set(ch, fid);
      }
    });
  }


  /**
   * Register a new forum configuration
   */
  registerForum(config: ForumConfig): void {
    if (!this.loaded) {
      // allow registration before load in some flows
    }
    this.forums.set(config.id, config);
    if ((config as any).channelId) {
      this.channelForumMap.set((config as any).channelId, config.id);
    }
  }

  /**
   * Register a new team configuration
   */
  registerTeam(config: TeamConfig): void {
    if (!this.loaded) {
      // allow registration before load in some flows
    }
    this.teams.set(config.id, config);
  }

  /**
   * Sync additional teams and forums from the database overlays
   * - Adds DB-defined teams
   * - Creates minimal forum configs for bug/feature forums with DB mapping
   */
  async syncFromDb(guildId: string): Promise<void> {
    if (this.provider) {
      await this.load(guildId);
    }
  }

  /**
   * Get forum configuration by ID
   */
  getForum(forumId: string | null | undefined): ForumConfig | undefined {
    if (!forumId) return undefined;
    this.maybeRefreshFromStatic();
    return this.forums.get(forumId);
  }

  /**
   * Get team configuration by ID
   */
  getTeam(teamId: string | null | undefined): TeamConfig | undefined {
    if (!teamId) return undefined;
    this.maybeRefreshFromStatic();
    return this.teams.get(teamId);
  }

  /**
   * Get forum by channel ID
   */
  getForumByChannelId(channelId: string | null | undefined): ForumConfig | undefined {
    if (!channelId) return undefined;
    this.maybeRefreshFromStatic();
    const forumId = this.channelForumMap.get(channelId);
    if (forumId) return this.forums.get(forumId);
    // Fallback: attempt to locate by a channelId property on forums for test environments
    for (const f of this.forums.values()) {
      if ((f as any)?.channelId === channelId) return f;
    }
    return undefined;
  }

  /**
   * Get forums by category
   */
  getForumsByCategory(category: ForumConfig["category"]): ForumConfig[] {
    this.maybeRefreshFromStatic();
    return Array.from(this.forums.values())
      .filter((forum) => forum.category === category)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get forums by team
   */
  getForumsByTeam(teamId: string): ForumConfig[] {
    this.maybeRefreshFromStatic();
    const items = Array.from(this.forums.values())
      .filter((forum) => forum.team === teamId)
      .sort((a, b) => a.priority - b.priority);
    if (this.overlaysActive && this.dbForumIds.size > 0) {
      return items.filter(f => this.dbForumIds.has(f.id));
    }
    return items;
  }

  /**
   * Get all forums sorted by priority
   */
  getAllForums(): ForumConfig[] {
    this.maybeRefreshFromStatic();
    const items = Array.from(this.forums.values()).sort((a, b) => a.priority - b.priority);
    if (this.overlaysActive && this.dbForumIds.size > 0) {
      return items.filter(f => this.dbForumIds.has(f.id));
    }
    return items;
  }

  /**
   * Get all teams
   */
  getAllTeams(): TeamConfig[] {
    this.maybeRefreshFromStatic();
    const all = Array.from(this.teams.values());
    if (this.overlaysActive && this.dbTeamIds.size > 0) {
      return all.filter(t => this.dbTeamIds.has(t.id));
    }
    return all;
  }

  /**
   * Utility used by tests to pick a forum given a post-like object
   */
  selectAppropriateChannel(post: { type?: string; category?: string }, candidates: Array<{ id: string; category: string }>) {
    const cat = (post?.category || post?.type || '').toString().toLowerCase();
    const preferred = candidates.find(f => (f.category || '').toLowerCase().includes(cat));
    return preferred || candidates[0];
  }

  /**
   * Create a Discord forum channel for a forum configuration
   */
  async createDiscordForum(
    guild: Guild,
    forumConfig: ForumConfig,
  ): Promise<ForumChannel | null> {
    try {
      const forum = await guild.channels.create({
        name: forumConfig.name,
        type: ChannelType.GuildForum,
        topic: forumConfig.description,
        availableTags: forumConfig.tags.map((tag) => ({
          name: tag.name,
          emoji: tag.emoji ? { id: null, name: tag.emoji } : null,
          moderated: (tag as any).moderated || false,
        })),
        defaultReactionEmoji: { id: null, name: "👍" },
        rateLimitPerUser: 5, // 5 second slowmode
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.SendMessagesInThreads,
            ],
          },
        ],
      });

      // Update the forum configuration with the channel ID
      (forumConfig as any).channelId = forum.id;
      this.channelForumMap.set(forum.id, forumConfig.id);

      console.log(`Created Discord forum: ${forumConfig.name} (${forum.id})`);
      return forum;
    } catch (error) {
      console.error(
        `Failed to create Discord forum for ${forumConfig.name}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Auto-create all configured forums in a guild
   */
  async autoCreateForums(guild: Guild): Promise<void> {
    this.maybeRefreshFromStatic();
    const autoCfg = (this.env || (ENVIRONMENT_CONFIG as any)).FORUM_CREATION as any;
    if (!autoCfg?.autoCreateForums) {
      console.log("Auto-creation of forums is disabled");
      return;
    }
    console.log("Auto-creating Discord forums...");
    const forums = this.getAllForums();
    let first = true;
    for (const forum of forums) {
      const channelId = (forum as any).channelId as string | undefined;
      if (!channelId) {
        if (!first) {
          await new Promise((res) => setTimeout(res, 1000));
        }
        first = false;
        try {
          await this.createDiscordForum(guild, forum);
        } catch {
          // continue creating others
        }
      }
    }
  }

  /**
   * Create a unified issue in a forum with GitHub and Jira integration
   */
  async createUnifiedIssue(
    forumId: string,
    _issueData: Omit<IssueData, "forum">,
  ): Promise<any> {
    const forum = this.getForum(forumId);
    if (!forum) {
      throw new Error(`Forum ${forumId} not found`);
    }

    // Get the Discord forum channel - we'll get the guild from the client when available
    if (!(forum as any).channelId) {
      throw new Error("Forum channel not configured");
    }

    // For now, we'll return a placeholder since we can't access the client directly
    // This method will need to be called with proper guild context from the calling code
    throw new Error(
      "createUnifiedIssue requires guild context - use UnifiedIssueManager directly instead",
    );
  }

  private maybeRefreshFromStatic(): void {
    // Only load from static config if this instance hasn't been initialized yet
    if (!this.loaded) {
      this.initializeFromStaticConfig();
      return;
    }
    // If this is the singleton instance and maps are empty (e.g., tests modified configs after import), repopulate
    if ((this as any)._isSingleton && this.forums.size === 0 && TEAM_CONFIGURATIONS && FORUM_CONFIGURATIONS) {
      this.initializeFromStaticConfig();
    }
  }

  /**
   * Get forum statistics
   */
  getStatistics(): {
    totalForums: number;
    totalTeams: number;
    forumsByCategory: Record<string, number>;
    forumsByTeam: Record<string, number>;
  } {
    const forums = this.getAllForums();
    const teams = this.getAllTeams();

    const forumsByCategory: Record<string, number> = {};
    const forumsByTeam: Record<string, number> = {};

    forums.forEach((forum) => {
      forumsByCategory[forum.category] =
        (forumsByCategory[forum.category] || 0) + 1;
      forumsByTeam[forum.team] = (forumsByTeam[forum.team] || 0) + 1;
    });

    return {
      totalForums: forums.length,
      totalTeams: teams.length,
      forumsByCategory,
      forumsByTeam,
    };
  }
}

// Singleton factory and reset for tests
let _forumManager: ForumManager | null = null;

export function createForumManager(provider?: ForumConfigProvider) {
  return new ForumManager(provider);
}

// Export a live-binding to the current singleton instance so tests can swap it.
export let forumManager: ForumManager = (() => {
  _forumManager = new ForumManager();
  ( _forumManager as any)._isSingleton = true;
  return _forumManager;
})();

export function resetForumManager(provider?: ForumConfigProvider) {
  _forumManager = new ForumManager(provider);
  forumManager = _forumManager; // update live export binding so importers see the new instance
  return _forumManager;
}
