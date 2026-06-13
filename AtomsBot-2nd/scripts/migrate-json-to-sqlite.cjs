#!/usr/bin/env node
/*
  One-time importer: JSON (.data/link-mappings.json) -> SQLite (data/bot.db)
  Usage:
    1) npm i better-sqlite3
    2) node scripts/migrate-json-to-sqlite.cjs [optional: path/to/link-mappings.json]
*/
const fs = require('fs');
const path = require('path');

function loadBetterSqlite3() {
  try { return require('better-sqlite3'); } catch (e) {
    console.error('Missing dependency better-sqlite3. Install with: npm i better-sqlite3');
    process.exit(1);
  }
}

function ensureSchema(db) {
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

(function main() {
  const BetterSqlite = loadBetterSqlite3();
  const dbFile = process.env.DB_SQLITE_PATH || path.join(process.cwd(), 'data', 'bot.db');
  const jsonPath = process.argv[2] || path.join(process.cwd(), '.data', 'link-mappings.json');
  const outDir = path.dirname(dbFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const db = new BetterSqlite(dbFile);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);

  if (!fs.existsSync(jsonPath)) {
    console.error('No JSON mappings found at', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  const jira = Array.isArray(parsed.jiraLinks) ? parsed.jiraLinks : [];
  const gh = Array.isArray(parsed.githubLinks) ? parsed.githubLinks : [];

  const upsertJira = db.prepare(
    `INSERT INTO jira_links (threadId, jiraKey, githubNumber, createdAt)
     VALUES (@threadId, @jiraKey, @githubNumber, @createdAt)
     ON CONFLICT(threadId) DO UPDATE SET jiraKey=excluded.jiraKey, githubNumber=excluded.githubNumber, createdAt=excluded.createdAt`
  );
  const upsertGh = db.prepare(
    `INSERT INTO github_links (threadId, number, owner, repo, createdAt)
     VALUES (@threadId, @number, @owner, @repo, @createdAt)
     ON CONFLICT(threadId) DO UPDATE SET number=excluded.number, owner=excluded.owner, repo=excluded.repo, createdAt=excluded.createdAt`
  );

  const txn = db.transaction(() => {
    jira.forEach(j => upsertJira.run({
      threadId: j.threadId,
      jiraKey: j.jiraKey,
      githubNumber: j.githubNumber ?? null,
      createdAt: j.createdAt || Date.now(),
    }));
    gh.forEach(g => upsertGh.run({
      threadId: g.threadId,
      number: g.number,
      owner: g.owner || null,
      repo: g.repo || null,
      createdAt: g.createdAt || Date.now(),
    }));
  });

  txn();
  console.log(`Imported ${jira.length} Jira links and ${gh.length} GitHub links into ${dbFile}`);
})();

