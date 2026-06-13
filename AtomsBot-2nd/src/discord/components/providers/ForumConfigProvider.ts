import type { ForumConfig, TeamConfig } from "../ForumTypes";

export interface ForumEnvConfig {
  FORUM_CHANNEL_IDS: Record<string, string>;
}

export interface ForumConfigProvider {
  getTeams(guildId?: string): Promise<TeamConfig[]>;
  getForums(guildId?: string): Promise<ForumConfig[]>;
  getEnv(guildId?: string): Promise<ForumEnvConfig>;
}

