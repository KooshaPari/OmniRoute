import { Thread } from "../interfaces";
import client from "../discord/discord";
import { ThreadChannel } from "discord.js";
import { logger } from "../logger";
import { octokit, getRepoCredentialsForThread } from "./githubActions";
import { parseGitHubIssueUrl } from "./linkFormats";

// Try to resolve GitHub issue linkage from thread content (messages),
// setting thread.number and repoOwner/repoName if found
export async function resolveGitHubLinkage(thread: Thread): Promise<boolean> {
  try {
    // Try fetch thread channel
    const channel = (await client.channels.fetch(thread.id)) as ThreadChannel | null;
    if (!channel) {
      logger.warn(`Auto-linker failed for thread ${thread.id}: channel not found`);
      return false;
    }

    // Fetch a reasonably small number of recent messages for scanning
    const messages = await channel.messages.fetch({ limit: 50 });

    const rc0 = getRepoCredentialsForThread(thread);
    const owner = thread.repoOwner || rc0.owner;
    const repo = thread.repoName || rc0.repo;

    // Build deterministic snapshot of message contents
    const contents: string[] = [];
    for (const [, msg] of messages) {
      contents.push((msg as any)?.content ?? "");
    }

    // 1) Scan messages for candidate GitHub URLs and validate the first that exists
    const urlExtractor = /(https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[0-9]+)/ig;
    // Gather all URLs across messages in order found
    const allUrls: string[] = [];
    for (const text of contents) {
      const urls = text.match(urlExtractor) || [];
      for (const u of urls) allUrls.push(u);
    }
    // Validate URLs in the order discovered; skip invalid host formats
    for (const url of allUrls) {
      const parsed = parseGitHubIssueUrl(url);
      if (!parsed) continue; // skip non-issue or malformed URLs
      const ok = await validateIssueExists(parsed.owner, parsed.repo, parsed.number);
      if (ok) {
        thread.number = parsed.number;
        thread.repoOwner = parsed.owner;
        thread.repoName = parsed.repo;
        logger.info(`Auto-linked thread ${thread.id} to ${parsed.owner}/${parsed.repo}#${parsed.number}`);
        return true;
      }
    }

    // 2) If none, scan for shorthand references like #123 using default/per-thread repo
    for (const text of contents) {
      const shorthand = /#(\d+)/g;
      const matches = text?.matchAll(shorthand) ?? [] as any;
      for (const m of matches as any) {
        const n = Number(m[1]);
        if (!Number.isFinite(n) || n <= 0) continue;
        const ok = await validateIssueExists(owner, repo, n);
        if (ok) {
          thread.number = n;
          thread.repoOwner = owner;
          thread.repoName = repo;
          logger.info(`Auto-linked thread ${thread.id} to ${owner}/${repo}#${n} via shorthand`);
          return true;
        }
      }
    }

    return false;
  } catch (e) {
    logger.warn(`Auto-linker failed for thread ${thread.id}: ${e}`);
    return false;
  }
}

async function validateIssueExists(owner: string, repo: string, issue_number: number): Promise<boolean> {
  try {
    await octokit.rest.issues.get({ owner, repo, issue_number });
    return true;
  } catch {
    return false;
  }
}
