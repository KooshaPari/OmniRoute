import { setupDatabaseEnvironment } from "./database/setup";
import { databaseService } from "./database/DatabaseService";
import { runDbHeal } from "./maintenance/dbHeal";
import { cleanupOldTmpDirs } from "./maintenance/tmpCleanup";
import { octokit } from "./github/githubActions";
import { config as appConfig } from "./config";
import { secretsStore } from "./settings/SecretsStore";

let __initialized = false;

// Application initialization function (idempotent)
async function initializeApplication() {
  // Always idempotent: if already initialized, do nothing
  if (__initialized) return;
  __initialized = true;
  // Apply runtime overrides from SecretsStore where supported
  try {
    const [chanId, clientId, devGuild, pmProvider, pmSync, syncJira, syncLinear, syncGhProj, syncCoda, codaToken, codaDoc, codaIssues, codaComments, codaUsers,
      codaKeyCol, codaTitleCol, codaStatusCol, codaPriorityCol, codaAssigneeCol] = await Promise.all([
      secretsStore.get('discord_channel_id'),
      secretsStore.get('discord_client_id'),
      secretsStore.get('discord_dev_guild_id'),
      secretsStore.get('pm_provider'),
      secretsStore.get('pm_sync'),
      secretsStore.get('pm_sync_jira'),
      secretsStore.get('pm_sync_linear'),
      secretsStore.get('pm_sync_github_projects'),
      secretsStore.get('pm_sync_coda'),
      secretsStore.get('coda_api_token'),
      secretsStore.get('coda_doc_id'),
      secretsStore.get('coda_issues_table_id'),
      secretsStore.get('coda_comments_table_id'),
      secretsStore.get('coda_users_table_id'),
      secretsStore.get('coda_issue_key_column'),
      secretsStore.get('coda_issue_title_column'),
      secretsStore.get('coda_issue_status_column'),
      secretsStore.get('coda_issue_priority_column'),
      secretsStore.get('coda_issue_assignee_column'),
    ]);
    if (chanId) (appConfig as any).DISCORD_CHANNEL_ID = chanId;
    if (clientId) (appConfig as any).DISCORD_CLIENT_ID = clientId;
    if (devGuild) (appConfig as any).DISCORD_DEV_GUILD_ID = devGuild;
    if (pmProvider) process.env.PM_PROVIDER = pmProvider;
    if (pmSync) process.env.PM_SYNC = pmSync;
    if (syncJira) process.env.PM_SYNC_JIRA = syncJira;
    if (syncLinear) process.env.PM_SYNC_LINEAR = syncLinear;
    if (syncGhProj) process.env.PM_SYNC_GITHUB_PROJECTS = syncGhProj;
    if (syncCoda) process.env.PM_SYNC_CODA = syncCoda;
    if (codaToken) process.env.CODA_API_TOKEN = codaToken;
    if (codaDoc) process.env.CODA_DOC_ID = codaDoc;
    if (codaIssues) process.env.CODA_ISSUES_TABLE_ID = codaIssues;
    if (codaComments) process.env.CODA_COMMENTS_TABLE_ID = codaComments;
    if (codaUsers) process.env.CODA_USERS_TABLE_ID = codaUsers;
    if (codaKeyCol) process.env.CODA_ISSUE_KEY_COLUMN = codaKeyCol;
    if (codaTitleCol) process.env.CODA_ISSUE_TITLE_COLUMN = codaTitleCol;
    if (codaStatusCol) process.env.CODA_ISSUE_STATUS_COLUMN = codaStatusCol;
    if (codaPriorityCol) process.env.CODA_ISSUE_PRIORITY_COLUMN = codaPriorityCol;
    if (codaAssigneeCol) process.env.CODA_ISSUE_ASSIGNEE_COLUMN = codaAssigneeCol;

    // Per-provider enable toggles
    try {
      const [enJira, enLinear, enGhProj, enCoda, enAtoms] = await Promise.all([
        secretsStore.get('pm_enabled_jira'),
        secretsStore.get('pm_enabled_linear'),
        secretsStore.get('pm_enabled_github_projects'),
        secretsStore.get('pm_enabled_coda'),
        secretsStore.get('pm_enabled_atoms'),
      ]);
      if (enJira) process.env.PM_ENABLED_JIRA = enJira;
      if (enLinear) process.env.PM_ENABLED_LINEAR = enLinear;
      if (enGhProj) process.env.PM_ENABLED_GITHUB_PROJECTS = enGhProj;
      if (enCoda) process.env.PM_ENABLED_CODA = enCoda;
      if (enAtoms) process.env.PM_ENABLED_ATOMS = enAtoms;
    } catch {}

    // Linear secrets
    try {
      const [linKey, linTeam, linWh] = await Promise.all([
        secretsStore.get('linear_api_key'),
        secretsStore.get('linear_team_id'),
        secretsStore.get('linear_webhook_secret'),
      ]);
      if (linKey) process.env.LINEAR_API_KEY = linKey;
      if (linTeam) process.env.LINEAR_TEAM_ID = linTeam;
      if (linWh) process.env.LINEAR_WEBHOOK_SECRET = linWh;
    } catch {}
    // Apply default sync flags if not set, per pm_provider
    const currentProvider = (process.env.PM_PROVIDER || 'jira').toLowerCase();
    const ensureFlag = (k: string, v: string) => { if (process.env[k] === undefined) process.env[k] = v; };
    if (currentProvider === 'jira') {
      ensureFlag('PM_SYNC_GITHUB_PROJECTS', 'false');
      ensureFlag('PM_SYNC_LINEAR', 'false');
      ensureFlag('PM_SYNC_CODA', 'true');
      ensureFlag('PM_SYNC_ATOMS', 'true');
    } else if (currentProvider === 'linear') {
      ensureFlag('PM_SYNC_GITHUB_PROJECTS', 'false');
      ensureFlag('PM_SYNC_JIRA', 'false');
      ensureFlag('PM_SYNC_CODA', 'true');
      ensureFlag('PM_SYNC_ATOMS', 'true');
    } else if (currentProvider === 'github_projects') {
      ensureFlag('PM_SYNC_LINEAR', 'false');
      ensureFlag('PM_SYNC_JIRA', 'false');
      ensureFlag('PM_SYNC_CODA', 'true');
      ensureFlag('PM_SYNC_ATOMS', 'true');
    } else if (currentProvider === 'multi') {
      ensureFlag('PM_SYNC_JIRA', 'true');
      ensureFlag('PM_SYNC_LINEAR', 'false');
      ensureFlag('PM_SYNC_GITHUB_PROJECTS', 'false');
      ensureFlag('PM_SYNC_CODA', 'true');
      ensureFlag('PM_SYNC_ATOMS', 'true');
    }
  } catch {}
  // Initialize Database
  try {
    await setupDatabaseEnvironment();
    await databaseService.initialize();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }

  // Redis and NATS integrations removed — no initialization performed

  // Initialize Discord
  try {
    let initDiscordFn: (() => Promise<any>) | undefined;
    const isTestEnv = process.env.NODE_ENV === 'test';
    // In test, prefer the global mock so tests can control behavior deterministically
    if (isTestEnv && typeof (globalThis as any).mockInitDiscord === 'function') {
      initDiscordFn = (globalThis as any).mockInitDiscord as any;
    } else {
      try {
        const discordMod = await import('./discord/discord');
        initDiscordFn = (discordMod as any)?.initDiscord;
      } catch (_e) {
        // Swallow here; we will fall back to test stub if available
        if (isTestEnv && typeof (globalThis as any).mockInitDiscord === 'function') {
          initDiscordFn = (globalThis as any).mockInitDiscord as any;
        }
      }
    }
    if (initDiscordFn) {
      await initDiscordFn();
    }
  } catch (error) {
    console.error('Discord initialization failed:', error);
  }

  // Start PM SyncEngine if enabled
  try {
    const enabled = (process.env.PM_SYNC_ENGINE_ENABLED || '').toLowerCase() === 'true' || (process.env.PM_SYNC || '').toLowerCase() === 'true';
    if (enabled) {
      const { pmSyncEngine } = await import('./pm/SyncEngine');
      const interval = parseInt(process.env.PM_SYNC_ENGINE_INTERVAL_MS || '300000', 10) || 300000;
      (pmSyncEngine as any).intervalMs = interval;
      pmSyncEngine.start();
    }
  } catch (e) {
    console.warn('PM SyncEngine failed to start', (e as any)?.message || e);
  }

  // Initialize Calendar (watch + reminders)
  try {
    const [cid, cs] = await Promise.all([
      secretsStore.get('google_client_id'),
      secretsStore.get('google_client_secret'),
    ]);
    if ((cid || process.env.GOOGLE_CLIENT_ID) && (cs || process.env.GOOGLE_CLIENT_SECRET)) {
      const { startWatchRenewalLoop } = await import('./calendar/watchService');
      const { startReminderLoop } = await import('./calendar/reminderService');
      startWatchRenewalLoop();
      startReminderLoop();
      console.log('Google Calendar watch + reminders initialized');
    }
  } catch (error) {
    console.error('Calendar initialization failed:', error);
  }

  // Start update polling (backup for local webhook environments)
  try {
    const { startUpdatePolling } = await import('./polling/updatePoller');
    startUpdatePolling();
    console.log('Update polling started');
  } catch (error) {
    console.error('Update polling init failed:', error);
  }


  // Schedule tmpdir cleanup daily
  try {
    const days = parseInt(process.env.DEPLOY_TMPDIR_TTL_DAYS || '3', 10) || 3;
    setTimeout(() => { void cleanupOldTmpDirs('atomsbot-deploys-ctx', days); }, 15_000);
    setInterval(() => { void cleanupOldTmpDirs('atomsbot-deploys-ctx', days); }, 24*60*60*1000);
  } catch {}

  // Atoms token proactive refresh loop (optional; RLS)
  try {
    const { getPMProvider } = await import('./pm/provider');
    if (getPMProvider() === 'atoms') {
      const { atomsService } = await import('./atoms/atomsClient');
      setInterval(() => { void atomsService.refreshIfNeeded().catch(()=>{}); }, 5 * 60 * 1000); // every 5 min
    }
  } catch {}

  // GitHub preflight (non-fatal) — skip in test to avoid timeouts
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest) {
    try {
      const who = await octokit.rest.users.getAuthenticated();
      console.log(`GitHub token identity: @${who.data.login}`);
      try {
        await octokit.rest.repos.get({ owner: appConfig.GITHUB_USERNAME, repo: appConfig.GITHUB_REPOSITORY });
        console.log(`GitHub repo access OK: ${appConfig.GITHUB_USERNAME}/${appConfig.GITHUB_REPOSITORY}`);
      } catch (e: any) {
        console.warn(`GitHub repo access check failed for ${appConfig.GITHUB_USERNAME}/${appConfig.GITHUB_REPOSITORY}: ${e?.message || e}`);
      }
    } catch (e: any) {
      console.warn(`GitHub identity check failed: ${e?.message || e}`);
    }
  }
  // Initialize GitHub (always attempt)
  try {
    let initGithubFn: (() => Promise<any>) | undefined;
    const isTestEnv = process.env.NODE_ENV === 'test';
    if (isTestEnv && typeof (globalThis as any).mockInitGithub === 'function') {
      initGithubFn = (globalThis as any).mockInitGithub as any;
    } else {
      try {
        const githubMod = await import('./github/github');
        initGithubFn = (githubMod as any)?.initGithub;
      } catch (_e) {
        if (isTestEnv && typeof (globalThis as any).mockInitGithub === 'function') {
          initGithubFn = (globalThis as any).mockInitGithub as any;
        }
      }
    }
    if (initGithubFn) {
      await initGithubFn();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('EADDRINUSE')) {
      console.warn('GitHub server port already in use, skipping initialization');
    } else {
      console.error('GitHub initialization failed:', error);
    }
  }
}

// Export for testing
export { initializeApplication };

// Auto-initialize when module is imported
if (process.argv.includes('--db-heal')) {
  void runDbHeal().then(() => process.exit(0));
} else {
  void initializeApplication();
}
