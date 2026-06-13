import fs from 'fs/promises';
import path from 'path';
// import { Collection } from 'discord.js';
import { octokit, repoCredentials } from '../github/githubActions';
import { jiraService } from '../jira/jiraClient';
import { logger } from '../logger';
import { cacheService } from '../cache/redis';

export type TeamName = string;

export interface UserLinkEntry {
  discordId: string;
  discordTag?: string | null;
  github?: string | null; // GitHub login
  jira?: string | null;   // Jira email or accountId depending on project config
  linear?: string | null; // Linear user id or email
  coda?: string | null;   // Coda user identifier (from users table)
  atoms?: string | null;  // Atoms user id
  team?: TeamName | null;
  // Generic bag for future providers to avoid schema churn
  identities?: Record<string, string | null> | null;
}

interface DirectoryData {
  users: UserLinkEntry[];
  teams: TeamName[];
  version: number;
  updatedAt: number;
}

const DATA_DIR = process.env.NODE_ENV === 'test' ? '.data/test' : '.data';
const FILE_PATH = path.join(DATA_DIR, 'user-links.json');

class UserDirectory {
  private data: DirectoryData = { users: [], teams: [], version: 1, updatedAt: Date.now() };
  // ephemeral drafts keyed by Discord user performing the linking
  private drafts = new Map<string, Partial<UserLinkEntry>>();
  // TTLs (seconds)
  private DISCORD_TTL = parseInt(process.env.USER_CACHE_TTL_DISCORD || '900', 10); // 15m
  private GITHUB_TTL = parseInt(process.env.USER_CACHE_TTL_GITHUB || '900', 10);   // 15m
  private JIRA_TTL = parseInt(process.env.USER_CACHE_TTL_JIRA || '900', 10);       // 15m
  private LINEAR_TTL = parseInt(process.env.USER_CACHE_TTL_LINEAR || '900', 10);   // 15m
  private ATOMS_TTL = parseInt(process.env.USER_CACHE_TTL_ATOMS || '900', 10);     // 15m
  private CODA_TTL = parseInt(process.env.USER_CACHE_TTL_CODA || '900', 10);       // 15m

  async init(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(FILE_PATH, 'utf-8');
      this.data = JSON.parse(raw);
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        await this.persist();
      } else {
        logger.warn(`UserDirectory: init failed; starting fresh: ${e?.message || e}`);
      }
    }
  }

  private async persist(): Promise<void> {
    this.data.updatedAt = Date.now();
    await fs.writeFile(FILE_PATH, JSON.stringify(this.data, null, 2));
  }

  getAll(): UserLinkEntry[] {
    return [...this.data.users];
  }

  getTeams(): TeamName[] {
    return [...this.data.teams];
  }

  addTeam(name: TeamName) {
    const n = name.trim();
    if (!n) return;
    if (!this.data.teams.includes(n)) {
      this.data.teams.push(n);
      void this.persist();
    }
  }

  removeTeam(name: TeamName) {
    const idx = this.data.teams.indexOf(name);
    if (idx >= 0) {
      this.data.teams.splice(idx, 1);
      // Null out team for entries that referenced it
      this.data.users = this.data.users.map(u => (u.team === name ? { ...u, team: null } : u));
      void this.persist();
    }
  }

  upsert(entry: UserLinkEntry) {
    const idx = this.data.users.findIndex(u => u.discordId === entry.discordId);
    if (idx >= 0) {
      const prev = this.data.users[idx];
      this.data.users[idx] = { ...prev, ...entry, identities: { ...(prev.identities || {}), ...(entry.identities || {}) } };
    } else {
      this.data.users.push({ ...entry, identities: entry.identities || null });
    }
    void this.persist();
  }

  findByDiscordId(id: string): UserLinkEntry | undefined {
    return this.data.users.find(u => u.discordId === id);
  }

  setDraft(authorDiscordId: string, partial: Partial<UserLinkEntry>) {
    const prev = this.drafts.get(authorDiscordId) || {};
    this.drafts.set(authorDiscordId, { ...prev, ...partial });
  }

  getDraft(authorDiscordId: string): Partial<UserLinkEntry> | undefined {
    return this.drafts.get(authorDiscordId);
  }

  clearDraft(authorDiscordId: string) {
    this.drafts.delete(authorDiscordId);
  }

  setIdentityDraft(authorDiscordId: string, providerId: string, value: string | null | undefined) {
    const prev = this.drafts.get(authorDiscordId) || {};
    const identities = { ...(prev.identities || {}) } as Record<string, string | null>;
    identities[providerId] = value ?? null;
    this.drafts.set(authorDiscordId, { ...prev, identities });
  }

  // Candidate fetching with caching
  async getDiscordCandidates(guild: { id?: string; members: any }, opts?: { forceRefresh?: boolean, limit?: number }): Promise<Array<{ id: string; label: string }>> {
    const guildId = (guild as any)?.id || 'unknown-guild';
    const key = `users:discord:guild:${guildId}:members`;
    const limit = opts?.limit ?? 1000; // cap before slicing to 25 for menus
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ id: string; label: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      let members: any = null;
      try {
        // Fetch all members if intents allow; otherwise will throw or return partial
        if (typeof guild.members?.fetch === 'function') {
          members = await guild.members.fetch();
        }
      } catch {}

      const list: Array<{ id: string; label: string }> = [];
      const each = (col: any) => {
        try {
          if (col && typeof col.forEach === 'function') {
            col.forEach((m: any) => {
              const user = (m.user ?? m);
              if (user?.bot) return;
              if (list.length >= limit) return;
              const tag = user.discriminator ? `${user.username}#${user.discriminator}` : user.username;
              list.push({ id: user.id, label: tag });
            });
          }
        } catch {}
      };
      // Prefer fetched members; fallback to cache
      each(members);
      if (list.length < 1 && guild.members?.cache) each(guild.members.cache);

      await cacheService.set(key, list, this.DISCORD_TTL);
      return list.slice(0, 25);
    } catch (e) {
      logger.warn('getDiscordCandidates failed', { error: (e as any)?.message || e });
      return [];
    }
  }

  async refreshDiscordCandidates(guild: { id?: string; members: any }): Promise<void> {
    await this.getDiscordCandidates(guild, { forceRefresh: true });
  }

  async getGithubCandidates(opts?: { forceRefresh?: boolean }): Promise<Array<{ login: string }>> {
    const key = `users:github:repo:${repoCredentials.owner}:${repoCredentials.repo}:collaborators`;
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ login: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      // Prefer repo collaborators for precise permissions
      const collabs = await octokit.rest.repos.listCollaborators({ ...repoCredentials, per_page: 100 });
      const list = collabs.data.map(c => ({ login: c.login }));
      await cacheService.set(key, list, this.GITHUB_TTL);
      return list.slice(0, 25);
    } catch {
      try {
        const contrib = await octokit.rest.repos.listContributors({ ...repoCredentials, per_page: 100 });
        const list = contrib.data.map(c => ({ login: c.login! }));
        await cacheService.set(key, list, this.GITHUB_TTL);
        return list.slice(0, 25);
      } catch (e2) {
        logger.warn('getGithubCandidates failed', { error: (e2 as any)?.message || e2 });
        return [];
      }
    }
  }

  async refreshGithubCandidates(): Promise<void> {
    await this.getGithubCandidates({ forceRefresh: true });
  }

  async getJiraCandidates(query: string = 'a', opts?: { forceRefresh?: boolean }): Promise<Array<{ key: string; label: string }>> {
    // Jira candidates should depend only on Jira configuration, not primary provider
    if (!jiraService.isConfigured()) return [];
    const key = `users:jira:q:${query}`;
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ key: string; label: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      const { jiraSearchUsers, jiraGetGroupMembers } = await import('../jira/jiraClient');

      // If configured, use group membership to build candidate list (preferred for org scoping)
      const groupCfg = process.env.JIRA_USER_GROUPS;
      let users: Array<any> = [];
      if (groupCfg && groupCfg.trim()) {
        const groups = groupCfg.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
        const seen = new Set<string>();
        for (const g of groups) {
          const members = await jiraGetGroupMembers(g, 200);
          for (const m of members) {
            if (!seen.has(m.accountId)) { users.push(m); seen.add(m.accountId); }
          }
        }
        // If a search query is provided (and not default), refine the list
        if (query && query !== 'a') {
          const q = query.toLowerCase();
          users = users.filter(u => (u.displayName?.toLowerCase().includes(q)) || (u.emailAddress?.toLowerCase().includes(q)));
        }
      } else {
        // Fallback to general search
        users = await jiraSearchUsers(query, 100);
        // If empty, try discovering groups and pull members (best effort)
        if (!users || users.length === 0) {
          const { jiraListGroups } = await import('../jira/jiraClient');
          let groups: string[] = [];
          try {
            // First pass: broad picker
            groups = await jiraListGroups('a', 100);
            // Prioritize common software groups if present
            const priority = ['jira-software-users', 'jira-servicemanagement-users', 'site-admins'];
            groups.sort((a, b) => (priority.indexOf(a) === -1 ? 999 : priority.indexOf(a)) - (priority.indexOf(b) === -1 ? 999 : priority.indexOf(b)));
          } catch {}

          const seen = new Set<string>();
          for (const g of groups.slice(0, 8)) {
            try {
              const members = await jiraGetGroupMembers(g, 200);
              for (const m of members) {
                if (!seen.has(m.accountId)) { users.push(m); seen.add(m.accountId); }
              }
              if (users.length >= 200) break; // cap to avoid overfetch
            } catch {}
          }
        }
      }

      // Optional domain filter to avoid cross-org noise (only if explicitly set)
      const allowedDomain = process.env.JIRA_ALLOWED_EMAIL_DOMAIN;

      const filtered = Array.isArray(users)
        ? users.filter((u: any) => {
            if (!allowedDomain) return true;
            const em = (u as any)?.emailAddress || '';
            return typeof em === 'string' && em.toLowerCase().endsWith(allowedDomain.toLowerCase());
          })
        : [];

      const list = filtered.map(u => ({ key: u.accountId, label: `${u.displayName}${u.emailAddress ? ' • ' + u.emailAddress : ''}` }));
      await cacheService.set(key, list, this.JIRA_TTL);
      return list.slice(0, 25);
    } catch (e) {
      logger.warn('getJiraCandidates failed', { error: (e as any)?.message || e });
      return [];
    }
  }

  async refreshJiraCandidates(query: string = 'a'): Promise<void> {
    await this.getJiraCandidates(query, { forceRefresh: true });
  }

  // Linear user candidates
  async getLinearCandidates(query: string = 'a', opts?: { forceRefresh?: boolean }): Promise<Array<{ id: string; label: string }>> {
    const key = `users:linear:q:${query}`;
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ id: string; label: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      const { linearService } = await import('../linear/linearClient');
      const users = await linearService.searchUsers(query, 50);
      const list = (users || []).map(u => ({ id: u.id, label: `${u.displayName}${u.email ? ' • ' + u.email : ''}` }));
      await cacheService.set(key, list, this.LINEAR_TTL);
      return list.slice(0, 25);
    } catch (e) {
      logger.warn('getLinearCandidates failed', { error: (e as any)?.message || e });
      return [];
    }
  }

  async refreshLinearCandidates(query: string = 'a'): Promise<void> {
    await this.getLinearCandidates(query, { forceRefresh: true });
  }

  // Atoms user candidates (project members)
  async getAtomsCandidates(query: string = 'a', opts?: { forceRefresh?: boolean }): Promise<Array<{ id: string; label: string }>> {
    const key = `users:atoms:q:${query}`;
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ id: string; label: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      const { atomsService } = await import('../atoms/atomsClient');
      const users = await atomsService.searchUsers(query, 50);
      const list = (users || []).map(u => ({ id: u.id, label: `${u.displayName}${u.email ? ' • ' + u.email : ''}` }));
      await cacheService.set(key, list, this.ATOMS_TTL);
      return list.slice(0, 25);
    } catch (e) {
      logger.warn('getAtomsCandidates failed', { error: (e as any)?.message || e });
      return [];
    }
  }

  async refreshAtomsCandidates(query: string = 'a'): Promise<void> {
    await this.getAtomsCandidates(query, { forceRefresh: true });
  }

  // Coda user candidates (requires configured users table)
  async getCodaCandidates(query: string = 'a', opts?: { forceRefresh?: boolean }): Promise<Array<{ id: string; label: string }>> {
    const key = `users:coda:q:${query}`;
    if (!opts?.forceRefresh) {
      const cached = await cacheService.get<Array<{ id: string; label: string }>>(key);
      if (cached && Array.isArray(cached)) return cached.slice(0, 25);
    }
    try {
      const { codaService } = await import('../coda/codaClient');
      const users = await (codaService as any).listUsers?.(query, 50).catch?.(() => []) || [];
      const list = (users || []).map((u: any) => ({ id: String(u.id || u.email || u.name), label: `${u.name || u.email || u.id}${u.email ? ' • ' + u.email : ''}` }));
      await cacheService.set(key, list, this.CODA_TTL);
      return list.slice(0, 25);
    } catch (e) {
      logger.warn('getCodaCandidates failed', { error: (e as any)?.message || e });
      return [];
    }
  }

  async refreshCodaCandidates(query: string = 'a'): Promise<void> {
    await this.getCodaCandidates(query, { forceRefresh: true });
  }
}

export const userDirectory = new UserDirectory();
// Initialize at import time (swallow errors)
void userDirectory.init();
