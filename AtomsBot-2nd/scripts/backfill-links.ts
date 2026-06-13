#!/usr/bin/env tsx
import 'dotenv/config';
import { databaseService } from '../src/database/DatabaseService';
import { store } from '../src/store-db';
import { logger } from '../src/logger';

async function main() {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const guildId = process.env.DISCORD_DEV_GUILD_ID || 'local-dev-guild';
  if (!channelId) {
    console.error('[links:backfill] DISCORD_CHANNEL_ID is required');
    process.exit(1);
  }

  await databaseService.initialize();
  await store.loadThreads();

  // Ensure guild/channel exist so FK constraints are satisfied
  await databaseService.ensureGuildAndChannel({
    guildId,
    guildName: 'Development Guild',
    channelId,
    channelName: 'Forum',
    channelType: 15 as any,
    channelTopic: null,
  });

  let createdThreads = 0;
  let ghLinked = 0;
  let jiraLinked = 0;

  for (const t of store.threads) {
    // Create thread in DB if missing
    const exists = await databaseService.findThread(t.id);
    if (!exists) {
      try {
        await databaseService.threads.create({
          id: t.id,
          channelId,
          title: t.title || 'Unknown Thread',
          archived: !!t.archived,
          locked: !!t.locked,
          tagIds: Array.isArray(t.appliedTags) ? (t.appliedTags as any) : [],
        });
        createdThreads++;
      } catch (e) {
        logger.warn('Backfill: failed to create thread row', { threadId: t.id, error: (e as any)?.message || e });
        continue;
      }
    }

    // Backfill GitHub link
    if (typeof t.number === 'number') {
      const existingGh = await databaseService.getGitHubNumber(t.id);
      if (!existingGh) {
        try {
          await databaseService.addGitHubLink(t.id, t.number, (t as any).repoOwner, (t as any).repoName);
          ghLinked++;
        } catch (e) {
          logger.warn('Backfill: failed to add GitHub link', { threadId: t.id, number: t.number, error: (e as any)?.message || e });
        }
      }
    }

    // Backfill Jira link
    if (t.jiraKey) {
      const existingJira = await databaseService.getJiraKey(t.id);
      if (!existingJira) {
        try {
          await databaseService.addJiraLink(t.id, t.jiraKey);
          jiraLinked++;
        } catch (e) {
          logger.warn('Backfill: failed to add Jira link', { threadId: t.id, jiraKey: t.jiraKey, error: (e as any)?.message || e });
        }
      }
    }
  }

  logger.info('[links:backfill] Completed', { createdThreads, ghLinked, jiraLinked, totalThreads: store.threads.length });
}

main().catch((e) => {
  console.error('[links:backfill] error:', e);
  process.exit(1);
});

