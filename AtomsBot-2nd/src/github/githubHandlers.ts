import { Request } from "express";
import {
  archiveThread,
  createComment,
  createThread,
  deleteThread,
  lockThread,
  unarchiveThread,
  unlockThread,
} from "../discord/discordActions";
// import { GitHubLabel } from "../interfaces";
import { store } from "../store";
import { getDiscordInfoFromGithubBody } from "./githubActions";
import { updateIssueEmbed } from "../discord/embeds";
import { ThreadChannel } from "discord.js";
import client from "../discord/discord";

// Helper: strictly read node_id from req.body.issue
async function getIssueNodeId(req: Request): Promise<string | undefined> {
  try {
    const direct = (req as any)?.body?.issue?.node_id;
    return typeof direct === 'string' ? direct : undefined;
  } catch {}
  return undefined;
}

async function updateThreadEmbed(node_id: string) {
  try {
    // Be resilient to inconsistent store entries
    const threads = Array.isArray((store as any).threads) ? (store as any).threads : [];
    const thread = threads.find((t: any) => t && typeof t === 'object' && t.node_id === node_id);
    if (!thread) return;

    const channel = client.channels.cache.get(thread.id) as ThreadChannel | undefined;
    if (!channel) return;

    await updateIssueEmbed(channel, thread);
  } catch (error) {
    console.error("Failed to update thread embed:", error);
  }
}

export async function handleOpened(req: Request) {
  if (!req.body || !req.body.issue) return;
  const { node_id, number, title, user, body, labels } = req.body.issue;
  
  // Require node_id and valid user for thread creation
  if (!node_id) return;
  if (!user || typeof user !== 'object' || !user.login || !user.id) return;
  
  if (store.threads.some((thread) => thread.node_id === node_id)) return;

  const { login } = user;
  let appliedTags: string[] = [];
  
  try {
    if (Array.isArray(labels) && Array.isArray(store.availableTags)) {
      appliedTags = labels
        .filter((label) => label && typeof label === 'object' && label.name && label.name.trim() !== '')
        .map((label) => {
          const found = store.availableTags.find((tag) => tag.name === label.name);
          return found ? found.id : "";
        })
        .filter((id) => id !== ""); // Filter out empty strings for unknown labels
    }
  } catch (error) {
    console.error("Error processing labels:", error);
    appliedTags = [];
  }

  createThread({ login, appliedTags, number, title, body, node_id });

  // Notify feed
  try {
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', {
      action: 'opened',
      id: number,
      title,
      url,
      description: body || undefined,
      details: { Author: login },
      color: 0x238636,
    });
  } catch {}
}

export async function handleCreated(req: Request) {
  if (!req.body || !req.body.comment?.user || !req.body.issue?.node_id) return;
  
  const { user, id, body } = req.body.comment;
  const { login, avatar_url } = user;
  const { node_id } = req.body.issue;

  // Check if the comment already contains Discord info
  if (getDiscordInfoFromGithubBody(body).channelId) {
    // If it does, stop processing (assuming created with a bot)
    return;
  }

  createComment({
    git_id: id,
    body,
    login,
    avatar_url,
    node_id,
  });

  // Notify feed for comment
  try {
    const url = req.body?.comment?.html_url || req.body?.issue?.html_url || '';
    const num = req.body?.issue?.number;
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', {
      action: 'commented',
      id,
      title: `#${num}: ${req.body?.issue?.title || ''}`.trim(),
      url,
      description: body || undefined,
      details: { Author: login },
      color: 0x60a5fa,
      upsertKeySuffix: String(num ?? ''),
    });
  } catch {}
}

export async function handleClosed(req: Request) {
  const node_id = await getIssueNodeId(req);
  if (!node_id) return;
  archiveThread(node_id);
  await updateThreadEmbed(node_id);
  try {
    const num = req.body?.issue?.number;
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', { action: 'closed', id: num, title: req.body?.issue?.title, url, color: 0xcb2431 });
  } catch {}
}

export async function handleReopened(req: Request) {
  const node_id = await getIssueNodeId(req);
  if (!node_id) return;
  unarchiveThread(node_id);
  await updateThreadEmbed(node_id);
  try {
    const num = req.body?.issue?.number;
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', { action: 'reopened', id: num, title: req.body?.issue?.title, url, color: 0x238636 });
  } catch {}
}

export async function handleLocked(req: Request) {
  const node_id = await getIssueNodeId(req);
  if (!node_id) return;
  lockThread(node_id);
  await updateThreadEmbed(node_id);
  try {
    const num = req.body?.issue?.number;
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', { action: 'locked', id: num, title: req.body?.issue?.title, url, color: 0x6b7280 });
  } catch {}
}

export async function handleUnlocked(req: Request) {
  const node_id = await getIssueNodeId(req);
  if (!node_id) return;
  unlockThread(node_id);
  await updateThreadEmbed(node_id);
  try {
    const num = req.body?.issue?.number;
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', { action: 'unlocked', id: num, title: req.body?.issue?.title, url, color: 0x6b7280 });
  } catch {}
}

export async function handleDeleted(req: Request) {
  // For delete events, always forward the value (even if undefined)
  const node_id = (req as any)?.body?.issue?.node_id as string | undefined;
  deleteThread(node_id);
  // No need to update embed since thread is being deleted
  try {
    const num = req.body?.issue?.number;
    const url = req.body?.issue?.html_url || '';
    const { postProviderUpdate } = await import('../notifications/pmNotify');
    await postProviderUpdate('github', { action: 'deleted', id: num, title: req.body?.issue?.title, url, color: 0x111827 });
  } catch {}
}
