// Utilities for parsing and generating cross-platform links

export const DISCORD_LINK_REGEX = /https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i;
export const GITHUB_ISSUE_URL_REGEX = /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i;
export const GITHUB_SHORTHAND_REGEX = /#(\d+)/g; // captures numbers in #123 form

export function parseGitHubIssueUrl(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.match(GITHUB_ISSUE_URL_REGEX);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

export function extractDiscordLink(text: string | null | undefined): { guildId: string; channelId: string; messageId: string } | null {
  if (!text) return null;
  const m = text.match(DISCORD_LINK_REGEX);
  if (!m || m.length < 4) return null;
  return { guildId: m[1], channelId: m[2], messageId: m[3] };
}

// Returns a canonical snippet to include in GitHub issue body to ensure importer mapping
export function getCanonicalDiscordLink(
  guildId: string,
  channelId: string,
  messageId: string,
): string {
  return `Linked to Discord thread: https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

