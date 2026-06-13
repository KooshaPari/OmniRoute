import type { ForumConfig, TeamConfig } from "../ForumTypes";
import type { ForumConfigProvider, ForumEnvConfig } from "./ForumConfigProvider";

export class StaticProvider implements ForumConfigProvider {
  private teams: TeamConfig[];
  private forums: ForumConfig[];
  private env: ForumEnvConfig;

  constructor(opts: { teams: TeamConfig[]; forums: ForumConfig[]; env?: ForumEnvConfig }) {
    this.teams = opts.teams || [];
    this.forums = opts.forums || [];
    this.env = opts.env || { FORUM_CHANNEL_IDS: {} };
  }

  async getTeams(): Promise<TeamConfig[]> {
    return this.teams;
  }

  async getForums(): Promise<ForumConfig[]> {
    return this.forums;
  }

  async getEnv(): Promise<ForumEnvConfig> {
    return this.env;
  }
}

