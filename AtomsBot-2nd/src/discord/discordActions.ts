import { ForumChannel, MessagePayload, ThreadChannel } from "discord.js";
import { config } from "../config";
import { getDefaultForumChannelId } from "./configRuntime";
import { Thread } from "../interfaces";
import {
  ActionValue,
  Actions,
  Triggerer,
  getDiscordUrl,
  logger,
} from "../logger";
import { store } from "../store";
import client from "./discord";

const info = (action: ActionValue, thread: Thread) =>
  logger.info(`${Triggerer.Github} | ${action} | ${getDiscordUrl(thread)}`);

export async function createThread({
  body,
  login,
  title,
  appliedTags,
  node_id,
  number,
}: {
  body: string;
  login: string;
  title: string;
  appliedTags: string[];
  node_id: string;
  number: number;
}) {
  try {
    const chanId = await getDefaultForumChannelId();
    let forum = client.channels.cache.get(chanId) as ForumChannel;
    if (!forum) forum = (await client.channels.fetch(chanId)) as ForumChannel;

    // Fallback: if forum requires tags but none were mapped, pick a reasonable default tag
    let tagsToApply = appliedTags;
    try {
      const avail = (forum.availableTags || []) as any[];
      if ((!tagsToApply || tagsToApply.length === 0) && Array.isArray(avail) && avail.length > 0) {
        const candidates = ['bug', 'feature', 'task', 'issue'];
        const found = avail.find(t => candidates.some(c => (t.name || '').toLowerCase().includes(c)));
        tagsToApply = [ (found || avail[0]).id ];
      }
    } catch {}

    const { id } = await forum.threads.create({
      message: {
        content: body + "/" + login, // TODO
      },
      name: title,
      appliedTags: tagsToApply,
    });

    const thread = store.threads.find((thread) => thread.id === id);
    if (!thread) return;

    thread.body = body;
    thread.node_id = node_id;
    thread.number = number;

    info(Actions.Created, thread);
  } catch (error) {
    logger.error(`Failed to create thread: ${error}`);
  }
}

export async function createComment({
  git_id,
  body,
  login,
  avatar_url,
  node_id,
}: {
  git_id: number;
  body: string;
  login: string;
  avatar_url: string;
  node_id: string;
}) {
  try {
    const { thread, channel } = await getThreadChannel(node_id);
    if (!thread || !channel) return;

    const webhook = await channel.parent?.createWebhook({
      name: login,
      avatar: avatar_url,
    });

    if (!webhook) return;

    const messagePayload = MessagePayload.create(webhook, {
      content: body,
      threadId: thread.id,
    }).resolveBody();

    const message = await webhook.send(messagePayload);
    thread.comments.push({ id: message.id, git_id });

    try {
      await webhook.delete("Cleanup");
    } catch (webhookError) {
      logger.warn(`Failed to delete webhook: ${webhookError}`);
    }

    info(Actions.Commented, thread);
  } catch (error) {
    console.error(error);
  }
}

export async function archiveThread(node_id: string | undefined) {
  try {
    const { thread, channel } = await getThreadChannel(node_id);
    if (!thread || !channel || channel.archived) return;

    thread.archived = true;
    await channel.setArchived(true);

    info(Actions.Closed, thread);
  } catch (error) {
    // Update thread state even if Discord API call fails
    const { thread } = await getThreadChannel(node_id);
    if (thread) {
      thread.archived = true;
    }
    logger.error(`Failed to archive thread: ${error}`);
  }
}

export async function unarchiveThread(node_id: string | undefined) {
  try {
    const { thread, channel } = await getThreadChannel(node_id);
    if (!thread || !channel || !channel.archived) return;

    thread.archived = false;
    await channel.setArchived(false);

    info(Actions.Reopened, thread);
  } catch (error) {
    // Update thread state even if Discord API call fails
    const { thread } = await getThreadChannel(node_id);
    if (thread) {
      thread.archived = false;
    }
    logger.error(`Failed to unarchive thread: ${error}`);
  }
}

export async function lockThread(node_id: string | undefined) {
  try {
    const { thread, channel } = await getThreadChannel(node_id);
    if (!thread || !channel || channel.locked) return;

    thread.locked = true;
    if (channel.archived) {
      thread.lockArchiving = true;
      thread.lockLocking = true;
      await channel.setArchived(false);
      await channel.setLocked(true);
      await channel.setArchived(true);
    } else {
      await channel.setLocked(true);
    }

    info(Actions.Locked, thread);
  } catch (error) {
    // Update thread state even if Discord API call fails
    const { thread } = await getThreadChannel(node_id);
    if (thread) {
      thread.locked = true;
    }
    logger.error(`Failed to lock thread: ${error}`);
  }
}

export async function unlockThread(node_id: string | undefined) {
  try {
    const { thread, channel } = await getThreadChannel(node_id);
    if (!thread || !channel || !channel.locked) return;

    thread.locked = false;
    if (channel.archived) {
      thread.lockArchiving = true;
      thread.lockLocking = true;
      await channel.setArchived(false);
      await channel.setLocked(false);
      await channel.setArchived(true);
    } else {
      await channel.setLocked(false);
    }

    info(Actions.Unlocked, thread);
  } catch (error) {
    // Update thread state even if Discord API call fails
    const { thread } = await getThreadChannel(node_id);
    if (thread) {
      thread.locked = false;
    }
    logger.error(`Failed to unlock thread: ${error}`);
  }
}

export async function deleteThread(node_id: string | undefined) {
  const { channel, thread } = await getThreadChannel(node_id);
  if (!thread) return;

  info(Actions.Deleted, thread);

  // Delete from Discord first, then remove from store
  let discordDeleteError = null;
  if (channel) {
    try {
      await channel.delete();
    } catch (error) {
      discordDeleteError = error;
      logger.error(`Failed to delete Discord channel: ${error}`);
    }
  }

  // Always try to remove from store, handle errors gracefully
  try {
    (store as any).deleteThread?.(thread.id);
  } catch (e) {
    logger.error(`Failed to remove thread from store: ${e}`);
    // fallback: remove from in-memory list if legacy method absent
    try {
      const idx = (store as any).threads?.findIndex?.((t: any) => t.id === thread.id) ?? -1;
      if (idx >= 0) (store as any).threads.splice(idx, 1);
    } catch (fallbackError) {
      logger.warn(`Fallback thread removal also failed: ${fallbackError}`);
    }
    // Don't re-throw - we want to continue execution even if store removal fails
  }

  // If Discord deletion failed but store succeeded, log the Discord error
  if (discordDeleteError) {
    logger.warn(`Thread removed from store despite Discord deletion failure`);
  }
}

export async function deleteThreadById(threadId: string) {
  if (!threadId) return;

  // Try to resolve thread from store
  const t = store.threads.find((th) => th.id === threadId);
  if (t) info(Actions.Deleted, t);

  // Resolve channel by ID from cache or fetch
  let channel: ThreadChannel<boolean> | undefined =
    (client.channels.cache.get(threadId) as ThreadChannel) || undefined;
  if (!channel) {
    try {
      const fetched = await client.channels.fetch(threadId);
      channel = fetched as ThreadChannel | undefined;
    } catch (e) {
      logger.debug(`Failed to fetch channel ${threadId}: ${e}`);
    }
  }

  // Attempt to delete channel if we have it
  if (channel) {
    try {
      await channel.delete();
    } catch (e) {
      logger.error(`Failed to delete Discord channel by id: ${e}`);
    }
  }

  // Remove from store regardless
  try { (store as any).deleteThread?.(threadId); } catch (e) {
    try {
      const idx = (store as any).threads?.findIndex?.((t: any) => t.id === threadId) ?? -1;
      if (idx >= 0) (store as any).threads.splice(idx, 1);
    } catch {}
    logger.warn(`Failed to remove thread from store: ${e}`);
  }
}


export async function getThreadChannel(node_id: string | undefined): Promise<{
  channel: ThreadChannel<boolean> | undefined;
  thread: Thread | undefined;
}> {
  let channel: ThreadChannel<boolean> | undefined;
  if (!node_id || node_id === "") return { thread: undefined, channel };

  const thread = store.threads.find((thread) => thread.node_id === node_id);
  if (!thread) return { thread, channel };

  // Check cache first
  channel = <ThreadChannel | undefined>client.channels.cache.get(thread.id);
  if (channel) return { thread, channel };

  // Fallback to fetch if not in cache
  try {
    const fetchedChannel = await client.channels.fetch(thread.id);
    // Ensure we return undefined instead of null for consistency
    channel = fetchedChannel ? <ThreadChannel>fetchedChannel : undefined;
  } catch (err) {
    logger.debug(`Failed to fetch channel ${thread.id}: ${err}`);
    channel = undefined;
  }

  return { thread, channel };
}
