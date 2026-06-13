import { databaseService } from "../database/DatabaseService";
import { config } from "../config";
import { getDefaultForumChannelId } from "../discord/configRuntime";
import { logger } from "../logger";
import { getIssues, repoCredentials } from "../github/githubActions";
import { store } from "../store-db";

export async function runDbHeal(): Promise<void> {
  logger.info("[HEAL] Starting DB heal: threads + links");

  // Ensure DB is available
  await databaseService.initialize();

  // Ensure forum channel FK
  const guildId = process.env.DISCORD_GUILD_ID as string;
  const chanId = await getDefaultForumChannelId();
  if (!guildId || !chanId) {
    logger.warn("[HEAL] Missing DISCORD_GUILD_ID or DISCORD_CHANNEL_ID; FK upserts may fail", {
      DISCORD_GUILD_ID: guildId,
      DISCORD_CHANNEL_ID: chanId,
    });
  } else {
    try {
      await databaseService.ensureGuildAndChannel({
        guildId,
        channelId: chanId,
        channelName: "Forum",
        channelType: 15 as any,
        channelTopic: null,
      });
      logger.info("[HEAL] Ensured guild+channel preconditions");
    } catch {
      logger.warn("[HEAL] Failed to ensure guild/channel");
    }
  }

  // Load GitHub issues and map to threads
  const ghThreads = await getIssues();

  let createdThreads = 0;
  let ghLinked = 0;
  let jiraLinked = 0;

  // Upsert threads
  for (const t of ghThreads) {
    try {
      const exists = await databaseService.findThread(t.id);
      if (!exists) {
        await databaseService.threads.create({
          id: t.id,
          channelId: chanId,
          title: t.title || "Unknown Thread",
          archived: !!t.archived,
          locked: !!t.locked,
          tagIds: Array.isArray(t.appliedTags) ? (t.appliedTags as any) : [],
        });
        createdThreads++;
      }
    } catch (e: any) {
      logger.warn("[HEAL] Thread upsert failed", { threadId: t.id, error: e?.message || e });
    }
  }

  // Upsert links (GitHub + Jira)
  for (const t of ghThreads) {
    try {
      if (t.number) {
        const owner = (t as any).repoOwner || repoCredentials.owner;
        const repo = (t as any).repoName || repoCredentials.repo;
        try {
          await databaseService.addGitHubLink(t.id, t.number, owner, repo);
          ghLinked++;
        } catch {
          // Ignore duplicate/constraint errors
        }
      }
      if ((t as any).jiraKey) {
        try {
          await databaseService.addJiraLink(t.id, (t as any).jiraKey, t.number);
          jiraLinked++;
        } catch {
          // Ignore duplicate/constraint errors
        }
      }
    } catch {}
  }

  // Reconcile any cached links that were waiting for threads to exist
  try {
    await (store as any).reconcileCachedLinks?.();
  } catch {}

  logger.info("[HEAL] Summary", { createdThreads, ghLinked, jiraLinked });
}
