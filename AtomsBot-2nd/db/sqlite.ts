import fs from 'fs';
import path from 'path';

// Lazy require to avoid build failure when dependency isn't installed yet
function loadBetterSqlite3() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('better-sqlite3');
  } catch (e) {
    throw new Error(
      "better-sqlite3 is not installed. Install it with: npm i better-sqlite3\n" +
        "This DB layer is scaffolded but not used by runtime until enabled.",
    );
  }
}

export interface SqliteConfig {
  filePath?: string;
}

export function openDatabase(cfg: SqliteConfig = {}) {
  const BetterSqlite = loadBetterSqlite3();
  const dbPath = cfg.filePath || process.env.DB_SQLITE_PATH || path.join(process.cwd(), 'data', 'bot.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new BetterSqlite(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function ensureSchema(db: any) {
  const ddl = `
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT,
    archived INTEGER,
    locked INTEGER,
    repoOwner TEXT,
    repoName TEXT,
    number INTEGER,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS jira_links (
    threadId TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
    jiraKey TEXT NOT NULL,
    githubNumber INTEGER,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS github_links (
    threadId TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    owner TEXT,
    repo TEXT,
    createdAt INTEGER
  );`;
  db.exec(ddl);
}

export type JiraLinkRow = { threadId: string; jiraKey: string; githubNumber?: number | null; createdAt: number };
export type GitHubLinkRow = { threadId: string; number: number; owner?: string | null; repo?: string | null; createdAt: number };

export function upsertJiraLink(db: any, row: JiraLinkRow) {
  const stmt = db.prepare(
    `INSERT INTO jira_links (threadId, jiraKey, githubNumber, createdAt)
     VALUES (@threadId, @jiraKey, @githubNumber, @createdAt)
     ON CONFLICT(threadId) DO UPDATE SET jiraKey=excluded.jiraKey, githubNumber=excluded.githubNumber, createdAt=excluded.createdAt`,
  );
  stmt.run({ ...row, githubNumber: row.githubNumber ?? null });
}

export function upsertGitHubLink(db: any, row: GitHubLinkRow) {
  const stmt = db.prepare(
    `INSERT INTO github_links (threadId, number, owner, repo, createdAt)
     VALUES (@threadId, @number, @owner, @repo, @createdAt)
     ON CONFLICT(threadId) DO UPDATE SET number=excluded.number, owner=excluded.owner, repo=excluded.repo, createdAt=excluded.createdAt`);
  stmt.run({ ...row, owner: row.owner ?? null, repo: row.repo ?? null });
}

export function getAllJiraLinks(db: any): JiraLinkRow[] {
  return db.prepare('SELECT threadId, jiraKey, githubNumber, createdAt FROM jira_links').all();
}

export function getAllGitHubLinks(db: any): GitHubLinkRow[] {
  return db.prepare('SELECT threadId, number, owner, repo, createdAt FROM github_links').all();
}

