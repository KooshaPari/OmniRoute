import { promises as fs } from "fs";
import path from "node:path";
import type { GuildForumTag } from "discord.js";
import type { Thread } from "./interfaces";
import { logger } from "./logger";

// Public default path used by tests to verify configuration
export const LINK_STORE_PATH_DEFAULT = path.join(
  process.cwd(),
  ".data",
  "link-mappings.json",
);

// Internal relative paths used for actual filesystem operations (per tests)
const LINKS_DIR = ".data";
const LINKS_FILE = ".data/link-mappings.json";

type JiraLink = {
  threadId: string;
  jiraKey: string;
  githubNumber?: number | null;
  createdAt: number;
};

type GitHubLink = {
  threadId: string;
  number: number;
  owner?: string | null;
  repo?: string | null;
  createdAt: number;
};

type ProviderLink = {
  threadId: string;
  provider: string; // linear | coda | atoms | github_projects | other
  key: string;
  url?: string | null;
  createdAt: number;
};

function parseTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

class JsonStore {
  // State used by commands/tests
  threads: Thread[] = [];
  availableTags: GuildForumTag[] = [];

  // Shadow write toggle
  dbEnabled: boolean = parseTruthyEnv(process.env.PERSISTENCE_DB_ENABLED);

  // Link stores
  private _jiraLinks: JiraLink[] = [];
  private _githubLinks: GitHubLink[] = [];
  private _providerLinks: ProviderLink[] = [];

  // Lazy DB
  private _db: any | null = null;
  private _dbModule: any | null = null;
  private _dbInitPromise: Promise<any> | null = null;

  // ============= Threads =============
  addThread(thread: any): void {
    if (!thread || typeof thread !== "object" || Array.isArray(thread)) {
      throw new Error("Invalid thread object provided");
    }
    if (!thread.id || typeof thread.id !== "string" || thread.id.length === 0) {
      throw new Error("Thread must have a valid string ID");
    }
    if (!thread.title || typeof thread.title !== "string" || thread.title.length === 0) {
      throw new Error("Thread must have a valid string title");
    }
    const idx = this.threads.findIndex((t) => t.id === thread.id);
    if (idx === -1) this.threads.push(thread as Thread);
    else this.threads[idx] = thread as Thread;
  }

  async updateThread(threadId: string, updates: Partial<Thread>): Promise<void> {
    const idx = this.threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      this.threads[idx] = { ...(this.threads[idx] as any), ...(updates as any) } as Thread;
    }
  }

  findThread(threadId: any): Thread | undefined {
    if (typeof threadId !== "string" || threadId.length === 0) return undefined;
    try {
      return this.threads.find((t) => t.id === threadId);
    } catch {
      return undefined;
    }
  }

  deleteThread(threadId: any): Thread[] {
    try {
      if (typeof threadId !== "string" || threadId.length === 0) return this.threads;
      const index = this.threads.findIndex((t) => t.id === threadId);
      if (index >= 0) this.threads.splice(index, 1);
      return this.threads;
    } catch (e) {
      throw new Error(`Failed to delete thread: ${(e as any)?.message || String(e)}`);
    }
  }

  getAllThreads(): Thread[] {
    return [...this.threads];
  }

  clearThreads(): void {
    try {
      this.threads = [];
    } catch (e) {
      throw new Error(`Failed to clear threads: ${(e as any)?.message || String(e)}`);
    }
  }

  setAvailableTags(tags: any): void {
    if (!Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }
    this.availableTags = [...(tags as GuildForumTag[])];
  }

  getAvailableTags(): GuildForumTag[] {
    return [...this.availableTags];
  }

  getStats(): { threadCount: number; tagCount: number } {
    return { threadCount: this.threads.length, tagCount: this.availableTags.length };
  }

  validateIntegrity(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    try {
      if (!Array.isArray((this as any).availableTags)) {
        issues.push("Available tags is not an array");
      }

      const ids = this.threads.map((t) => t?.id);
      const dups = ids.filter((id, i) => id && ids.indexOf(id) !== i);
      if (dups.length > 0) {
        issues.push(`Duplicate thread IDs found: ${Array.from(new Set(dups)).join(", ")}`);
      }

      for (let i = 0; i < this.threads.length; i++) {
        const t: any = this.threads[i];
        if (!t || typeof t.id !== "string" || t.id.length === 0) {
          issues.push(`Thread at index ${i} has invalid ID`);
        }
        if (!t || typeof t.title !== "string" || t.title.length === 0) {
          issues.push(`Thread at index ${i} has invalid title`);
        }
        if (!Array.isArray(t?.appliedTags)) {
          issues.push(`Thread at index ${i} has invalid appliedTags`);
        }
        if (!Array.isArray(t?.comments)) {
          issues.push(`Thread at index ${i} has invalid comments`);
        }
      }

      return { isValid: issues.length === 0, issues };
    } catch (e) {
      logger.error("Error during store integrity validation", { error: e });
      return {
        isValid: false,
        issues: [`Validation error: ${(e as any)?.message || String(e)}`],
      };
    }
  }

  // ============= Links =============
  setJiraLink(threadId: any, jiraKey: any, githubNumber?: number): void {
    if (typeof threadId !== "string" || threadId.length === 0 || typeof jiraKey !== "string" || jiraKey.length === 0) {
      throw new Error("Invalid threadId or jiraKey provided");
    }
    const idx = this._jiraLinks.findIndex((l) => l.threadId === threadId);
    const entry: JiraLink = { threadId, jiraKey, createdAt: Date.now() } as JiraLink;
    if (githubNumber !== undefined) (entry as any).githubNumber = githubNumber;
    if (idx >= 0) this._jiraLinks[idx] = entry; else this._jiraLinks.push(entry);

    // persist async
    Promise.resolve().then(() => this.persistLinks()).catch(() => {});

    if (this.dbEnabled) {
      // Support both legacy spy signature (threadId, jiraKey, githubNumber) and object form
      const num = (entry as any).githubNumber as number | undefined;
      void (this.dbWriteJiraLink as any)(entry.threadId, entry.jiraKey, num).catch(() => {});
    }
  }

  async addJiraLink(threadId: string, jiraKey: string, githubNumber?: number): Promise<void> {
    this.setJiraLink(threadId, jiraKey, githubNumber);
  }

  getJiraKey(threadId: any): string | undefined {
    try {
      if (typeof threadId !== "string" || threadId.length === 0) return undefined;
      return this._jiraLinks.find((l) => l.threadId === threadId)?.jiraKey;
    } catch {
      return undefined;
    }
  }

  getJiraLinkMapping(threadId: any): JiraLink | undefined {
    if (typeof threadId !== "string" || threadId.length === 0) return undefined;
    return this._jiraLinks.find((l) => l.threadId === threadId);
  }

  getAllJiraLinks(): JiraLink[] { return [...this._jiraLinks]; }

  removeJiraLink(threadId: any): void {
    if (typeof threadId !== "string" || threadId.length === 0) return;
    const before = this._jiraLinks.length;
    this._jiraLinks = this._jiraLinks.filter((l) => l.threadId !== threadId);
    Promise.resolve().then(() => this.persistLinks()).catch(() => {});
    if (this.dbEnabled && this._jiraLinks.length < before) {
      void this.dbDeleteJiraLink(threadId).catch(() => {});
    }
  }

  forceSetJiraKey(threadId: string, jiraKey: string): void {
    this.setJiraLink(threadId, jiraKey);
  }

  setGitHubLink(threadId: any, number: number, owner?: string, repo?: string): void {
    if (typeof threadId !== "string" || threadId.length === 0) {
      throw new Error("Invalid threadId provided");
    }
    const entry: GitHubLink = {
      threadId,
      number,
      owner: owner ?? null,
      repo: repo ?? null,
      createdAt: Date.now(),
    };
    const idx = this._githubLinks.findIndex((l) => l.threadId === threadId);
    if (idx >= 0) this._githubLinks[idx] = entry; else this._githubLinks.push(entry);

    Promise.resolve().then(() => this.persistLinks()).catch(() => {});
    if (this.dbEnabled) void this.dbWriteGitHubLink(entry).catch(() => {});
  }

  async addGitHubLink(threadId: string, number: number, owner?: string, repo?: string): Promise<void> {
    this.setGitHubLink(threadId, number, owner, repo);
  }

  getGitHubLinkMapping(threadId: any): { number: number; owner?: string | null; repo?: string | null } | undefined {
    if (typeof threadId !== "string" || threadId.length === 0) return undefined;
    const found = this._githubLinks.find((l) => l.threadId === threadId);
    if (!found) return undefined;
    return { number: found.number, owner: found.owner ?? null, repo: found.repo ?? null };
  }

  getAllGitHubLinks(): GitHubLink[] { return [...this._githubLinks]; }

  getGitHubLink(threadId: any): { number: number; owner?: string | null; repo?: string | null } | undefined {
    return this.getGitHubLinkMapping(threadId);
  }

  removeGitHubLink(threadId: any): void {
    if (typeof threadId !== "string" || threadId.length === 0) return;
    const before = this._githubLinks.length;
    this._githubLinks = this._githubLinks.filter((l) => l.threadId !== threadId);
    Promise.resolve().then(() => this.persistLinks()).catch(() => {});
    if (this.dbEnabled && this._githubLinks.length < before) {
      void this.dbDeleteGitHubLink(threadId).catch(() => {});
    }
  }

  // Generic provider links (Linear, Coda, Atoms, GH Projects, etc.)
  setProviderLink(threadId: string, provider: string, key: string, url?: string | null): void {
    if (!threadId || !provider || !key) return;
    const idx = this._providerLinks.findIndex((l) => l.threadId === threadId && l.provider === provider);
    const entry: ProviderLink = { threadId, provider: provider.toLowerCase(), key, url: url ?? null, createdAt: Date.now() };
    if (idx >= 0) this._providerLinks[idx] = entry; else this._providerLinks.push(entry);
    Promise.resolve().then(() => this.persistLinks()).catch(() => {});
  }

  getProviderLink(threadId: string, provider: string): ProviderLink | undefined {
    return this._providerLinks.find((l) => l.threadId === threadId && l.provider === provider.toLowerCase());
  }

  getAllProviderLinks(): ProviderLink[] { return [...this._providerLinks]; }

  removeProviderLink(threadId: string, provider: string): void {
    const before = this._providerLinks.length;
    this._providerLinks = this._providerLinks.filter((l) => !(l.threadId === threadId && l.provider === provider.toLowerCase()));
    if (this._providerLinks.length < before) Promise.resolve().then(() => this.persistLinks()).catch(() => {});
  }

  restoreJiraLinks(): void {
    for (const link of this._jiraLinks) {
      const t = this.threads.find((th) => th.id === link.threadId) as any;
      if (!t) continue;
      if (!t.jiraKey) t.jiraKey = link.jiraKey;
    }
  }

  restoreGitHubLinks(): void {
    for (const link of this._githubLinks) {
      const t = this.threads.find((th) => th.id === link.threadId) as any;
      if (!t) continue;
      if (t.number == null) t.number = link.number as any;
      if (!t.repoOwner && link.owner) t.repoOwner = link.owner as any;
      if (!t.repoName && link.repo) t.repoName = link.repo as any;
    }
  }

  // For provider links, we do not mutate thread fields by default; expose this to trigger any future side effects
  restoreProviderLinks(): void {
    // No-op for now; provider links are available via getAllProviderLinks()
    try {
      const count = this._providerLinks.length;
      if (count > 0) logger.info?.(`[NETWORK] Provider links loaded: ${count}`);
    } catch {}
  }

  async getGitHubNumber(threadId: string): Promise<number | null> {
    const mapping = this.getGitHubLinkMapping(threadId);
    return typeof mapping?.number === "number" ? mapping!.number : null;
  }

  // ============= Persistence =============
  async persistLinks(): Promise<void> {
    try { await fs.mkdir(LINKS_DIR, { recursive: true }); } catch {}
    try {
      const payload = {
        version: 1,
        updatedAt: Date.now(),
        jiraLinks: this._jiraLinks,
        githubLinks: this._githubLinks,
        providerLinks: this._providerLinks,
      };
      await fs.writeFile(LINKS_FILE, JSON.stringify(payload, null, 2), "utf-8");
    } catch {}
  }

  async loadLinksFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(LINKS_FILE, "utf-8");
      if (!raw) return;
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { return; }
      if (Array.isArray(parsed?.jiraLinks)) {
        this._jiraLinks = parsed.jiraLinks
          .filter((x: any) => x && typeof x.threadId === "string" && typeof x.jiraKey === "string")
          .map((x: any) => ({
            threadId: x.threadId,
            jiraKey: x.jiraKey,
            githubNumber: x.githubNumber ?? null,
            createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
          }));
      }
      if (Array.isArray(parsed?.githubLinks)) {
        this._githubLinks = parsed.githubLinks
          .filter((x: any) => x && typeof x.threadId === "string" && typeof x.number === "number")
          .map((x: any) => ({
            threadId: x.threadId,
            number: x.number,
            owner: x.owner ?? null,
            repo: x.repo ?? null,
            createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
          }));
      }
      if (Array.isArray(parsed?.providerLinks)) {
        this._providerLinks = parsed.providerLinks
          .filter((x: any) => x && typeof x.threadId === 'string' && typeof x.provider === 'string' && typeof x.key === 'string')
          .map((x: any) => ({
            threadId: x.threadId,
            provider: String(x.provider).toLowerCase(),
            key: x.key,
            url: x.url ?? null,
            createdAt: typeof x.createdAt === 'number' ? x.createdAt : Date.now(),
          }));
      }
    } catch {}
  }

  async loadThreads(): Promise<void> {
    // No-op for JSON store
    return;
  }

  async logLinkRestorationSummary(): Promise<void> {
    try {
      logger.info(
        `[NETWORK] Link restoration summary Jira=0/${this._jiraLinks.length} GitHub=0/${this._githubLinks.length}`,
      );
    } catch {}
  }

  // ============= Shadow DB =============
  private async ensureDb() {
    if (!this.dbEnabled) return null;
    if (this._dbInitPromise) return this._dbInitPromise;
    this._dbInitPromise = (async () => {
      try {
        // Shadow DB is optional; guard import for test environment
        let mod: any = null;
        try {
          // Use dynamic any-import with string to satisfy TS when file is absent
          const anyImporter: any = (s: string) => import(s as any);
          mod = await anyImporter('./db/sqlite.js');
        } catch {
          this._db = null;
          this._dbModule = null;
          return null;
        }
        const db = await mod.openDatabase({});
        await mod.ensureSchema(db);
        this._db = db;
        this._dbModule = mod;
        return db;
      } catch (e) {
        try { logger.warn("DB shadow write failed: init", { error: (e as any)?.message || e }); } catch {}
        this._db = null;
        this._dbModule = null;
        return null;
      }
    })();
    return this._dbInitPromise;
  }

  private async dbWriteJiraLink(entryOrThreadId: JiraLink | string, jiraKey?: string, githubNumber?: number): Promise<void> {
    try {
      const db = await this.ensureDb();
      if (!db || !this._dbModule) return;
      let record: JiraLink;
      if (typeof entryOrThreadId === 'string') {
        record = {
          threadId: entryOrThreadId,
          jiraKey: jiraKey as string,
          githubNumber: githubNumber ?? null,
          createdAt: Date.now(),
        };
      } else {
        record = {
          threadId: entryOrThreadId.threadId,
          jiraKey: entryOrThreadId.jiraKey,
          githubNumber: entryOrThreadId.githubNumber ?? null,
          createdAt: entryOrThreadId.createdAt,
        };
      }
      await this._dbModule.upsertJiraLink(db, record);
    } catch (e) {
      try {
        logger.warn("DB shadow write failed: jira_links upsert", {
          threadId: (entryOrThreadId as any)?.threadId || entryOrThreadId,
          jiraKey: (entryOrThreadId as any)?.jiraKey || jiraKey,
          error: (e as any)?.message || e,
        });
      } catch {}
    }
  }

  private async dbDeleteJiraLink(threadId: string): Promise<void> {
    try {
      const db = await this.ensureDb();
      if (!db || !this._dbModule) return;
      const stmt = db.prepare("DELETE FROM jira_links WHERE threadId = ?");
      await stmt.run(threadId);
    } catch (e) {
      try {
        logger.warn("DB shadow write failed: jira_links delete", {
          threadId,
          error: (e as any)?.message || e,
        });
      } catch {}
    }
  }

  private async dbWriteGitHubLink(entry: GitHubLink): Promise<void> {
    try {
      const db = await this.ensureDb();
      if (!db || !this._dbModule) return;
      await this._dbModule.upsertGitHubLink(db, {
        threadId: entry.threadId,
        number: entry.number,
        owner: entry.owner ?? null,
        repo: entry.repo ?? null,
        createdAt: entry.createdAt,
      });
    } catch (e) {
      try {
        logger.warn("DB shadow write failed: github_links upsert", {
          threadId: entry.threadId,
          number: entry.number,
          error: (e as any)?.message || e,
        });
      } catch {}
    }
  }

  private async dbDeleteGitHubLink(threadId: string): Promise<void> {
    try {
      const db = await this.ensureDb();
      if (!db || !this._dbModule) return;
      const stmt = db.prepare("DELETE FROM github_links WHERE threadId = ?");
      await stmt.run(threadId);
    } catch (e) {
      try {
        logger.warn("DB shadow write failed: github_links delete", {
          threadId,
          error: (e as any)?.message || e,
        });
      } catch {}
    }
  }
}

export const store = new JsonStore();
export default store;
