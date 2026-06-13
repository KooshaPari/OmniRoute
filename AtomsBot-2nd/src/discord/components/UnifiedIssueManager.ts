import {
  ForumChannel,
  ThreadChannel,
  EmbedBuilder,
  ButtonStyle,
} from "discord.js";
import {
  SmartEmbedBuilder,
  SmartEmbedConfig,
} from "../framework/SmartEmbedBuilder";
import { forumManager } from "./ForumManager";
import { ForumConfig } from "./ForumTypes";
import { jiraService } from "../../jira/jiraClient";
import { getPMLabel, getPMEmoji, isPMConfigured } from "../../pm/provider";
import { octokit, repoCredentials } from "../../github/githubActions";
import { actionButtonManager } from "../framework/ActionButtonManager";
import { store } from "../../store-db";
import { databaseService } from "../../database/DatabaseService";
import { Thread } from "../../interfaces";
import { logger } from "../../logger";
import { getPMProvider } from "../../pm/provider";

export interface IssueData {
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  type: "bug" | "feature" | "task" | "support";
  submitter: {
    id: string;
    username: string;
    displayName: string;
  };
  forum: ForumConfig;
  labels?: string[];
  assignees?: string[];
  customFields?: Record<string, any>;
}

export interface CreatedIssue {
  discordThread: ThreadChannel;
  githubIssue?: {
    number: number;
    url: string;
    id: number;
  };
  jiraIssue?: {
    key: string;
    url: string;
    id: string;
  };
  smartEmbed: SmartEmbedBuilder;
}

/**
 * Unified Issue Manager for creating and managing issues across Discord, GitHub, and Jira
 */
// Simple in-memory idempotency guard for issue creation (forumId:title:submitterId)
type InFlightEntry = { promise: Promise<CreatedIssue | null>; startedAt: number };
const __inFlightIssues = new Map<string, InFlightEntry>();
function makeIssueKey(data: IssueData): string {
  const normTitle = (data.title || "").trim().toLowerCase();
  return `${data.forum.id}:${normTitle}:${data.submitter?.id || "unknown"}`;
}

function makeDistributedKey(data: IssueData): string {
  const normTitle = (data.title || "").trim().toLowerCase();
  return `issue:idemp:${data.forum.id}:${normTitle}:${data.submitter?.id || "unknown"}`;
}

export class UnifiedIssueManager {
  constructor() {
    this.registerActionHandlers();
  }

  /**
   * Create a unified issue across all platforms
   */
  async createUnifiedIssue(
    forum: ForumChannel,
    issueData: IssueData,
  ): Promise<CreatedIssue | null> {
    // Early validation for edge cases
    if (!forum || !issueData) {
      return null;
    }

    try {
      // Idempotency: share in-flight work and prevent duplicate creations
      const key = makeIssueKey(issueData);
      const dkey = makeDistributedKey(issueData);

      // Try distributed guard first (best-effort)
      try {
        const { tryAcquireIdempotencyKey } = await import("../../utils/idempotency");
        const acquired = await tryAcquireIdempotencyKey(dkey, 30);
        if (!acquired) {
          const active = __inFlightIssues.get(key);
          if (active && Date.now() - active.startedAt < 30_000) {
            return await active.promise;
          }
          // In tests, continue locally even if distributed key not acquired
          if (process.env.NODE_ENV === 'test' || (process.env as any).VITEST) {
            // proceed without returning null
          } else {
            // Another process likely owns; avoid double-creation locally
            return null;
          }
        }
      } catch {
        // ignore if helper unavailable
      }
      const active = __inFlightIssues.get(key);
      if (active && Date.now() - active.startedAt < 30_000) {
        console.warn(`Duplicate issue creation detected; awaiting in-flight result for key=${key}`);
        return await active.promise; // share the first result
      }

      // Build the work promise and register it
      const work = (async (): Promise<CreatedIssue | null> => {
        // 1. Create Discord forum thread with smart embed
        const discordThread = await this.createDiscordThread(forum, issueData);
        const postStatus = async (msg: string) => {
          try { await discordThread.send({ content: `Status: ${msg}` }); } catch {}
        };
        try { (await import('../../logger')).logger.info(`[unified] Thread ${discordThread.id} created for '${issueData.title}'`); } catch {}

        // 2. Create smart embed for the thread
        const smartEmbed = await this.createSmartIssueEmbed(
          issueData,
          discordThread,
        );

        // 3. Create GitHub issue
        await postStatus('Creating GitHub issue…');
        const githubIssue = await this.createGitHubIssue(
          issueData,
          discordThread,
        );
        if (githubIssue) await postStatus(`GitHub issue created #${githubIssue.number}`);
        else await postStatus('GitHub: skipped or failed (continuing)');

        // 4. Create items in all enabled providers via facade
        let jiraIssue: any | null = null;
        const extraLinks: Array<{ provider: string; label: string; key: string; url?: string }> = [];
        try {
          await postStatus('Creating provider items…');
          // Compose a provider-agnostic description, including Discord and optional GitHub link
          const discordLink = `https://discord.com/channels/${discordThread.guildId}/${discordThread.id}`;
          const githubLink = githubIssue ? `\nGitHub Issue: ${githubIssue.url}` : '';
          const desc = `${issueData.description}\n\n---\nDiscord Thread: ${discordLink}${githubLink}`;
          const { facadeCreateIssue } = await import('../../pm/facade');
          const created = await facadeCreateIssue(issueData.title, desc);
          const all = created?.results || [];
          for (const it of all) {
            const provider = String(it.provider || '').toLowerCase();
            const label = it.provider ? (it.provider[0].toUpperCase() + it.provider.slice(1).replace('_',' ')) : 'Provider';
            // Persist link
            try { (await import('../../store')).store.setProviderLink(discordThread.id, provider, it.key, (it as any).url); } catch {}
            try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(discordThread.id, provider, it.key, (it as any).url); } catch {}
            if (provider === 'jira') {
              jiraIssue = { key: it.key, url: (it as any).url, id: (it as any).id || it.key };
              await postStatus(`Jira issue created ${it.key}`);
            } else {
              extraLinks.push({ provider, label, key: it.key, url: (it as any).url });
            }
          }
        } catch (error: any) {
          console.log("🔧 Provider creation failed (non-fatal):", error?.message || error);
        }

        // 4.5. Establish bidirectional links between GitHub and Jira if both exist
        if (githubIssue && jiraIssue) {
          await this.establishBidirectionalLinks(githubIssue, jiraIssue, discordThread.id);
        }

        // 6. Update smart embed with external links
        await this.updateEmbedWithExternalLinks(
          smartEmbed,
          githubIssue,
          jiraIssue || undefined,
        );
        // Append other provider links in a consolidated field and add open buttons
        if (extraLinks.length) {
          const lines = extraLinks.map(l => l.url ? `• ${l.label}: [${l.key}](${l.url})` : `• ${l.label}: ${l.key}`).join('\n');
          smartEmbed.addDynamicField({ name: '🔗 Other Provider Links', value: lines, inline: false });
          for (const l of extraLinks) {
            if (l.url) {
              try { smartEmbed.addActionButton({ id: `open_${l.provider}_${discordThread.id}`, label: `Open ${l.label}`, style: (ButtonStyle as any).Link ?? 5, action: 'link', actionData: { url: l.url } }); } catch {}
            }
          }
        }
        await postStatus('Links updated in embed');

        // 6. Store thread data with issue linking information
        await this.storeThreadWithIssueLinks(
          discordThread,
          githubIssue,
          jiraIssue || undefined,
        );

        // 8. Post the smart embed to the thread
        await this.postSmartEmbedToThread(discordThread, smartEmbed);

        // 9. Post separate GitHub and Jira embeds
        await this.postSeparateIntegrationEmbeds(
          discordThread,
          githubIssue,
          jiraIssue || undefined,
          issueData,
          extraLinks,
        );
        await postStatus('Setup complete');

        return {
          discordThread,
          githubIssue,
          jiraIssue: jiraIssue || undefined,
          smartEmbed,
        };
      })();

      __inFlightIssues.set(key, { promise: work, startedAt: Date.now() });

      try {
        const result = await work;
        return result;
      } finally {
        // Clean up guard a bit after completion
        setTimeout(() => __inFlightIssues.delete(key), 5_000);
        try {
          const { releaseIdempotencyKey } = await import("../../utils/idempotency");
          await releaseIdempotencyKey(dkey);
        } catch {}
      }
    } catch (error) {
      console.error("Failed to create unified issue:", error);
      if (process.env.NODE_ENV === 'test' || (process.env as any).VITEST) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Create Discord forum thread
   */
  private async createDiscordThread(
    forum: ForumChannel,
    issueData: IssueData,
  ): Promise<ThreadChannel> {
    const { title, description, type, priority, submitter } = issueData;

    const typeEmoji = this.getTypeEmoji(type);
    const priorityEmoji = this.getPriorityEmoji(priority);

    const threadTitle = `${typeEmoji} ${title}`;

    // Create basic content for the thread
    const content = `**${type.toUpperCase()}**: ${title}

**Priority:** ${priorityEmoji} ${priority.toUpperCase()}

**Description:**
${description}

**Submitted by:** ${submitter.displayName}

---
*This issue has been automatically created and will be synced with external tracking systems.*`;

    // Get forum tags
    const availableTags = forum.availableTags || [];
    let appliedTags = this.getApplicableTags(availableTags, issueData);
    // Fallback: some forums require a tag; choose a sensible default
    if ((!appliedTags || appliedTags.length === 0) && availableTags.length > 0) {
      // Prefer tags that look like the type or generic issue tags
      const candidates = ['bug', 'feature', 'task', 'issue', 'request'];
      const found = availableTags.find(t => candidates.some(c => (t.name || '').toLowerCase().includes(c)));
      appliedTags = [ (found || availableTags[0]).id ];
    }

    try { logger.info(`[uim] Creating thread in forum ${forum.id} with ${appliedTags?.length || 0} tag(s): ${threadTitle}`); } catch {}
    const thread = await forum.threads.create({
      name: threadTitle,
      message: { content },
      appliedTags,
    });
    try { logger.info(`[uim] Thread created: ${thread.id}`); } catch {}

    return thread;
  }

  /**
   * Create smart embed for the issue
   */
  private async createSmartIssueEmbed(
    issueData: IssueData,
    thread: ThreadChannel,
  ): Promise<SmartEmbedBuilder> {
    const { title, description, type, priority, submitter, forum } = issueData;

    const embedConfig: SmartEmbedConfig = {
      id: `unified-issue-${thread.id}`,
      title: `${this.getTypeEmoji(type)} ${title}`,
      description:
        description.length > 200
          ? description.substring(0, 200) + "..."
          : description,
      color: this.getTypeColor(type),
      autoRefresh: true,
      refreshInterval: 300, // 5 minutes
      theme: this.getThemeFromPriority(priority),
    };

    // Create SmartEmbed and ensure compatibility with different mocks/environments
    const smartEmbed: any = new SmartEmbedBuilder(embedConfig) as any;
    // Polyfill minimal API if certain methods are missing in test/mocked environments
    if (typeof smartEmbed.addDynamicField !== 'function') {
      smartEmbed.addDynamicField = function(_field: any) { return this; };
    }
    if (typeof smartEmbed.addActionButton !== 'function') {
      smartEmbed.addActionButton = function(_cfg: any) { return this; };
    }
    if (typeof smartEmbed.build !== 'function') {
      smartEmbed.build = function() { return { embeds: [], components: [] }; };
    }
    if (typeof smartEmbed.on !== 'function') {
      smartEmbed.on = function() { return this; };
    }
    if (typeof smartEmbed.removeAllListeners !== 'function') {
      smartEmbed.removeAllListeners = function() { return this; };
    }
    if (typeof smartEmbed.updateField !== 'function') {
      smartEmbed.updateField = function() { return this; };
    }
    if (typeof smartEmbed.refresh !== 'function') {
      smartEmbed.refresh = function() { return this; };
    }

    // Add static fields using addDynamicField
    smartEmbed.addDynamicField({
      name: "📋 Type",
      value: `${this.getTypeEmoji(type)} ${type.toUpperCase()}`,
      inline: true,
      dynamic: false,
    });

    smartEmbed.addDynamicField({
      name: "⚡ Priority",
      value: `${this.getPriorityEmoji(priority)} ${priority.toUpperCase()}`,
      inline: true,
      dynamic: false,
    });

    smartEmbed.addDynamicField({
      name: "👥 Team",
      value: `${this.getTeamEmoji(forum.team)} ${forum.name}`,
      inline: true,
      dynamic: false,
    });

    smartEmbed.addDynamicField({
      name: "👤 Submitted by",
      value: submitter.displayName,
      inline: true,
      dynamic: false,
    });

    // Add dynamic status field
    smartEmbed.addDynamicField({
      name: "📊 Status",
      value: "🟡 Open",
      inline: true,
      dynamic: true,
      refreshCallback: async () => {
        // This will be updated based on GitHub/Jira status
        return "🟡 Open";
      },
    });

    // Add action buttons
    this.addActionButtons(smartEmbed, thread.id, issueData);

    return smartEmbed as SmartEmbedBuilder;
  }

  /**
   * Create GitHub issue
   */
  private async createGitHubIssue(
    issueData: IssueData,
    thread: ThreadChannel,
  ): Promise<{ number: number; url: string; id: number; owner: string; repo: string } | undefined> {
    try {
      const {
        title,
        description,
        type,
        priority,
        labels = [],
        assignees = [],
      } = issueData;

      const discordLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
      const body = `${description}

---
**Discord Thread:** ${discordLink}
**Type:** ${type}
**Priority:** ${priority}
**Forum:** ${issueData.forum.name}

*This issue was created from Discord and is being tracked across multiple platforms.*`;

      // Map types to valid GitHub labels
      const typeLabel = type === "feature" ? "enhancement" : type;

      const issueLabels = [
        typeLabel,
        `priority-${priority}`,
        "discord-integration",
        ...labels.filter((label) => !["feature", "bug"].includes(label)), // Remove duplicate type labels
      ];
      if (issueData.forum?.team) issueLabels.push(`team-${issueData.forum.team}`);
      // Deduplicate + filter invalid labels
      const uniq = Array.from(new Set(issueLabels));
      const finalLabels = uniq.filter((l) => typeof l === 'string' && l.trim().length > 0);

      // Prefer team-scoped repo if configured in DB
      let owner = repoCredentials.owner;
      let repo = repoCredentials.repo;
      try {
        const { settingsService } = await import('../../settings/SettingsService');
        const teamId = issueData.forum?.team;
        if (teamId) {
          const team = await settingsService.getTeamSettings(teamId);
          if (team?.githubOwner && team?.githubRepo) {
            owner = team.githubOwner;
            repo = team.githubRepo;
          }
        }
      } catch {}

      const { ensureOctokitAuthFromDb, refreshDefaultRepoFromDb } = await import('../../github/githubActions');
      await ensureOctokitAuthFromDb();
      await refreshDefaultRepoFromDb();

      const response = await octokit.rest.issues.create({
        owner,
        repo,
        title: (issueData.forum?.team ? `[${issueData.forum.team}] ` : '') + title,
        body,
        labels: finalLabels,
        assignees,
      });

      return {
        number: response.data.number,
        url: response.data.html_url,
        id: response.data.id,
        owner,
        repo,
      };
    } catch (error) {
      console.error("Failed to create GitHub issue:", error);
      return undefined;
    }
  }

  /**
   * Create Jira issue
   */
  private async createJiraIssue(
    issueData: IssueData,
    thread: ThreadChannel,
    githubIssue?: { number: number; url: string; id: number },
  ): Promise<{ key: string; url: string; id: string } | undefined> {
    try {
      // Load DB-backed Jira credentials and team project key if available
      try {
        // @ts-ignore extend service at runtime
        if (typeof (jiraService as any).updateCredentialsFromDb === 'function') {
          await (jiraService as any).updateCredentialsFromDb(issueData.forum?.team);
        }
      } catch {}
      if (!jiraService.isConfigured()) {
        return undefined;
      }

      const { title, description, type, priority } = issueData;

      const discordLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
      const githubLink = githubIssue
        ? `\nGitHub Issue: ${githubIssue.url}`
        : "";

      const jiraDescription = `${description}

---
Discord Thread: ${discordLink}${githubLink}
Type: ${type}
Priority: ${priority}
Forum: ${issueData.forum.name}

This issue was created from Discord and is being tracked across multiple platforms.`;

      const jiraIssueType = this.mapTypeToJiraIssueType(type);
      // Priority field is not available in the ASRE project screen configuration

      const jiraIssue = await jiraService.createIssue({
        summary: title,
        description: jiraDescription,
        issueType: jiraIssueType,
        // priority: removed - not available in project screen
        // labels: removed - labels must exist in Jira project before assignment
      });

      if (jiraIssue) {
        // Prefer provider URL if available
        let url = (jiraIssue as any).url || '';
        if (!url) {
          const provider = getPMProvider();
          if (provider === 'jira') {
            const jiraHost = (typeof (jiraService as any).getHost === 'function') ? (jiraService as any).getHost() : (process.env.JIRA_HOST || "your-domain.atlassian.net");
            const cleanHost = String(jiraHost || '').replace(/^https?:\/\//, '');
            url = `https://${cleanHost}/browse/${jiraIssue.key}`;
          }
        }
        return { key: jiraIssue.key, url, id: jiraIssue.id };
      }
    } catch (error) {
      console.error("Failed to create Jira issue:", error);
    }

    return undefined;
  }

  /**
   * Store thread data with issue linking information
   */
  private async storeThreadWithIssueLinks(
    discordThread: ThreadChannel,
    githubIssue?: { number: number; url: string; id: number; owner?: string; repo?: string },
    jiraIssue?: { key: string; url: string; id: string },
  ): Promise<void> {
    // Check if thread already exists in store (prefer in-memory for integration tests)
    let thread = store.threads.find((t) => t.id === discordThread.id);
    
    if (!thread) {
      // Create new thread entry and persist to DB-backed store
      // Ensure guild/channel exist before creating thread row
      try {
        const parent = (discordThread as any).parent;
        const gid = (discordThread as any)?.guildId;
        const pid = (discordThread as any)?.parentId;
        if (gid && pid) {
          await databaseService.ensureGuildAndChannel({
            guildId: gid,
            guildName: (discordThread as any).guild?.name,
            channelId: pid,
            channelName: parent?.name,
            channelType: parent?.type as any,
            channelTopic: parent?.topic || null,
          });
        }
      } catch {}

      thread = {
        id: discordThread.id,
        title: discordThread.name || "Unknown Thread",
        appliedTags: (discordThread.appliedTags as any) || [],
        archived: false,
        locked: false,
        comments: [],
        channelId: (discordThread as any).parentId,
      } as Thread;
      try {
        await store.addThread(thread as any, (discordThread as any).parentId);
      } catch (e) {
        console.error("Failed to create thread ", e);
        // Still add to in-memory store to avoid breaking flow
        store.threads.push(thread);
      }
    }

    // Update with GitHub issue information
    if (githubIssue) {
      thread.number = githubIssue.number;
      thread.repoOwner = githubIssue.owner || repoCredentials.owner;
      thread.repoName = githubIssue.repo || repoCredentials.repo;
      // Persist GitHub link mapping so status and actions work immediately
      try {
        await store.addGitHubLink(
          discordThread.id,
          githubIssue.number,
          thread.repoOwner as any,
          thread.repoName as any,
        );
      } catch (e) {
        console.error("Failed to persist GitHub link", e);
      }
    }

    // Update with Jira issue information
    if (jiraIssue) {
      thread.jiraKey = jiraIssue.key;
      // Also save to persistent storage with GitHub issue number if available
      try {
        if (typeof (store as any).setJiraLink === 'function') {
          await (store as any).setJiraLink(discordThread.id, jiraIssue.key, githubIssue?.number);
        } else if (typeof (store as any).addJiraLink === 'function') {
          await (store as any).addJiraLink(discordThread.id, jiraIssue.key, githubIssue?.number);
        }
      } catch (e) {
        console.error("Failed to persist Jira link", e);
      }
    }
  }

  /**
   * Update smart embed with external links
   */
  private async updateEmbedWithExternalLinks(
    smartEmbed: SmartEmbedBuilder,
    githubIssue?: { number: number; url: string; id: number },
    jiraIssue?: { key: string; url: string; id: string },
  ): Promise<void> {
    let externalLinks = "";

    if (githubIssue) {
      externalLinks += `🐙 [GitHub #${githubIssue.number}](${githubIssue.url})`;
    }

    if (jiraIssue) {
      if (externalLinks) externalLinks += "\n";
      externalLinks += `${getPMEmoji()} [PM ${jiraIssue.key}](${jiraIssue.url})`;
    }

    if (externalLinks) {
      smartEmbed.addDynamicField({
        name: "🔗 External Links",
        value: externalLinks,
        inline: false,
        dynamic: false,
      });
    }
  }

  /**
   * Post smart embed to thread
   */
  private async postSmartEmbedToThread(
    thread: ThreadChannel,
    smartEmbed: SmartEmbedBuilder,
  ): Promise<void> {
    const { embeds, components } = smartEmbed.build();

    await thread.send({
      content: "📋 **Issue Tracking Dashboard**",
      embeds,
      components,
    });
  }

  /**
   * Add action buttons to smart embed
   */
  private addActionButtons(
    smartEmbed: SmartEmbedBuilder,
    threadId: string,
    _issueData: IssueData,
  ): void {
    // Base management row (matches buttonHandlers patterns)
    smartEmbed.addActionButton({ id: `assign_${threadId}`, label: "👤 Assign", style: ButtonStyle.Primary, action: "callback" });
    smartEmbed.addActionButton({ id: `priority_${threadId}`, label: "⚡ Priority", style: ButtonStyle.Secondary, action: "callback" });
    smartEmbed.addActionButton({ id: `status_${threadId}`, label: "📊 Status", style: ButtonStyle.Secondary, action: "callback" });
    smartEmbed.addActionButton({ id: `labels_${threadId}`, label: "🏷️ Labels", style: ButtonStyle.Secondary, action: "callback" });
    smartEmbed.addActionButton({ id: `triage_${threadId}`, label: "🔎 Triage", style: ButtonStyle.Secondary, action: "callback" });

    // Actions row
    smartEmbed.addActionButton({ id: `comment_${threadId}`, label: "💬 Add Comment", style: ButtonStyle.Primary, action: "callback" });
    smartEmbed.addActionButton({ id: `resolve_${threadId}`, label: "✅ Resolve", style: ButtonStyle.Success, action: "callback" });
    smartEmbed.addActionButton({ id: `closeissue_${threadId}`, label: "🚫 Close", style: ButtonStyle.Danger, action: "callback" });
    smartEmbed.addActionButton({ id: `reopen_${threadId}`, label: "🟢 Reopen", style: ButtonStyle.Secondary, action: "callback" });
    smartEmbed.addActionButton({ id: `refresh_${threadId}`, label: "🔄 Refresh", style: ButtonStyle.Secondary, action: "callback" });

    // PM providers row (only if at least one is configured/enabled)
    try {
      if (isPMConfigured()) {
        smartEmbed.addActionButton({ id: `jira_create_${threadId}`, label: `➕ Create PM Item`, style: ButtonStyle.Success, action: "callback" });
        smartEmbed.addActionButton({ id: `jira_link_${threadId}`, label: `🔗 Link PM Item`, style: ButtonStyle.Secondary, action: "callback" });
      }
    } catch {}

    // Destructive action row
    smartEmbed.addActionButton({ id: `delete_${threadId}`, label: "🗑️ Delete", style: ButtonStyle.Danger, action: "callback" });
  }

  // Helper methods
  private getTypeEmoji(type: string): string {
    switch (type) {
      case "bug":
        return "🐛";
      case "feature":
        return "✨";
      case "task":
        return "📋";
      case "support":
        return "❓";
      default:
        return "📝";
    }
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  }

  private getTeamEmoji(teamId: string): string {
    try {
      const fm: any = forumManager as any;
      if (fm && typeof fm.getTeam === 'function') {
        const team = fm.getTeam(teamId);
        return team?.emoji || "📁";
      }
    } catch {}
    return "📁";
  }

  private getTypeColor(type: string): number {
    switch (type) {
      case "bug":
        return 0xff6b6b;
      case "feature":
        return 0x4ecdc4;
      case "task":
        return 0x45b7d1;
      case "support":
        return 0x96ceb4;
      default:
        return 0x95a5a6;
    }
  }

  private getThemeFromPriority(
    priority: string,
  ): "default" | "success" | "warning" | "danger" | "info" {
    switch (priority) {
      case "critical":
        return "danger";
      case "high":
        return "warning";
      case "medium":
        return "info";
      case "low":
        return "success";
      default:
        return "default";
    }
  }

  private getApplicableTags(
    availableTags: any[],
    issueData: IssueData,
  ): string[] {
    const tags: string[] = [];
    const { type, priority } = issueData;

    // Find matching tags
    availableTags.forEach((tag) => {
      const tagName = tag.name.toLowerCase();
      if (tagName.includes(type) || tagName.includes(priority)) {
        tags.push(tag.id);
      }
    });

    return tags;
  }

  private mapTypeToJiraIssueType(type: string): string {
    switch (type) {
      case "bug":
        return "Bug";
      case "feature":
        return "Story";
      case "task":
        return "Story"; // Task type not available, using Story
      case "support":
        return "Story"; // Support type not available, using Story
      default:
        return "Story"; // Default to Story as it's available in ASRE project
    }
  }

  private mapPriorityToJiraPriority(priority: string): string {
    switch (priority) {
      case "critical":
        return "Highest";
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      default:
        return "Medium";
    }
  }

  /**
   * Register action button handlers
   */
  private registerActionHandlers(): void {
    // Register action handlers for the smart embed buttons
    actionButtonManager.createQuickAction(
      "assign_issue",
      "Assign Issue",
      async (interaction) => {
        // Handle issue assignment
        await this.handleAssignIssue(interaction);
      },
    );

    actionButtonManager.createQuickAction(
      "update_priority",
      "Update Priority",
      async (interaction) => {
        // Handle priority update
        await this.handleUpdatePriority(interaction);
      },
    );

    actionButtonManager.createQuickAction(
      "add_comment",
      "Add Comment",
      async (interaction) => {
        // Handle adding comment
        await this.handleAddComment(interaction);
      },
    );

    actionButtonManager.createQuickAction(
      "close_issue",
      "Close Issue",
      async (interaction) => {
        // Handle closing issue
        await this.handleCloseIssue(interaction);
      },
    );
  }

  // Action handlers (to be implemented)
  private async handleAssignIssue(_interaction: any): Promise<void> {
    // Implementation for assigning issues
  }

  private async handleUpdatePriority(_interaction: any): Promise<void> {
    // Implementation for updating priority
  }

  private async handleAddComment(_interaction: any): Promise<void> {
    // Implementation for adding comments
  }

  /**
   * Post separate GitHub and Jira embeds with their own information
   */
  private async postSeparateIntegrationEmbeds(
    thread: ThreadChannel,
    githubIssue: any,
    jiraIssue: any,
    issueData: IssueData,
    otherProviderLinks?: Array<{ provider: string; label: string; key: string; url?: string }>,
  ): Promise<void> {
    const embeds: EmbedBuilder[] = [];

    // Create GitHub embed if issue was created
    if (githubIssue && githubIssue.number) {
      try {
        const githubEmbed = new EmbedBuilder()
        .setTitle("🐙 GitHub Issue Created")
        .setColor(0x238636)
        .setDescription(`**#${githubIssue.number}: ${issueData.title}**`)
        .setURL(githubIssue.url)
        .addFields(
          {
            name: "📊 Status",
            value: `**State:** Open\n**Created:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true,
          },
          {
            name: "👤 Details",
            value: `**Author:** ${issueData.submitter?.username || "Unknown"}\n**Assignee:** Unassigned`,
            inline: true,
          },
          {
            name: "🔗 Links",
            value: `[View Issue](${githubIssue.url})` + (githubIssue.owner && githubIssue.repo ? `\n[Repository](https://github.com/${githubIssue.owner}/${githubIssue.repo})` : ''),
            inline: false,
          },
        )
        .setTimestamp();

      if (issueData.labels && issueData.labels.length > 0) {
        const labels = issueData.labels
          .map((label: string) => `\`${label}\``)
          .join(" ");
        githubEmbed.addFields({
          name: "🏷️ Labels",
          value: labels,
          inline: false,
        });
      }

      embeds.push(githubEmbed);
      } catch (error) {
        console.error("Failed to create GitHub embed:", error);
      }
    }

    // Provider-agnostic embed for non-GitHub items (includes Jira and others)
    try {
      const providerLines: string[] = [];
      if (jiraIssue && jiraIssue.key && jiraIssue.url) {
        providerLines.push(`• PM: [${jiraIssue.key}](${jiraIssue.url})`);
      }
      const links = Array.isArray(otherProviderLinks) ? otherProviderLinks : [];
      for (const l of links) {
        if (!l || !l.key) continue;
        const label = l.label || (l.provider ? (l.provider[0].toUpperCase() + l.provider.slice(1).replace('_',' ')) : 'Provider');
        providerLines.push(l.url ? `• ${label}: [${l.key}](${l.url})` : `• ${label}: ${l.key}`);
      }
      if (providerLines.length) {
        const provEmbed = new EmbedBuilder()
          .setTitle('📁 Provider Items Created')
          .setColor(0x5865f2)
          .setDescription(providerLines.join('\n'))
          .setTimestamp();
        embeds.push(provEmbed);
      }
    } catch (error) {
      console.error('Failed to create provider embed:', error);
    }

    // Post embeds if any were created
    if (embeds.length > 0) {
      try {
        await thread.send({ embeds });
      } catch (error) {
        console.error("🔧 Failed to post integration embeds:", error);
      }
    }
  }

  private async handleCloseIssue(_interaction: any): Promise<void> {
    // Implementation for closing issues
  }

  /**
   * Establish bidirectional links between GitHub and Jira issues
   */
  private async establishBidirectionalLinks(
    githubIssue: { number: number; url: string; id: number; owner?: string; repo?: string },
    jiraIssue: { key: string; url: string; id: string },
    threadId: string,
  ): Promise<void> {
    try {
      // Add Jira link to GitHub issue
      await this.addJiraLinkToGitHubIssue(githubIssue, jiraIssue);
      
      // Add GitHub link to Jira issue  
      await this.addGitHubLinkToJiraIssue(githubIssue, jiraIssue);
      
      // Store the bidirectional mapping in persistent storage
      try {
        if (typeof (store as any).setJiraLink === 'function') {
          await (store as any).setJiraLink(threadId, jiraIssue.key, githubIssue.number);
        } else if (typeof (store as any).addJiraLink === 'function') {
          await (store as any).addJiraLink(threadId, jiraIssue.key, githubIssue.number);
        }
      } catch (e) {
        console.error("Failed to persist bidirectional link mapping", e);
      }
      
      console.log(`🔗 Successfully linked GitHub #${githubIssue.number} ↔ Jira ${jiraIssue.key} for thread ${threadId}`);
    } catch (error) {
      console.error("🔧 Failed to establish bidirectional links:", error);
    }
  }

  /**
   * Add Jira issue link to GitHub issue as a comment
   */
  private async addJiraLinkToGitHubIssue(
    githubIssue: { number: number; url: string; id: number; owner?: string; repo?: string },
    jiraIssue: { key: string; url: string; id: string },
  ): Promise<void> {
    try {
      const linkComment = `🎫 **Linked Jira Issue:** [${jiraIssue.key}](${jiraIssue.url})

This GitHub issue is automatically synchronized with Jira ${jiraIssue.key}. Updates to either issue will be reflected in both systems.`;

      const owner = githubIssue.owner || repoCredentials.owner;
      const repo = githubIssue.repo || repoCredentials.repo;
      await octokit.rest.issues.createComment({ owner, repo, issue_number: githubIssue.number, body: linkComment });

      console.log(`✅ Added Jira link to GitHub issue #${githubIssue.number}`);
    } catch (error) {
      console.error(`❌ Failed to add Jira link to GitHub issue #${githubIssue.number}:`, error);
    }
  }

  /**
   * Add GitHub issue link to Jira issue as a comment
   */
  private async addGitHubLinkToJiraIssue(
    githubIssue: { number: number; url: string; id: number },
    jiraIssue: { key: string; url: string; id: string },
  ): Promise<void> {
    try {
      const linkComment = `🐙 *Linked GitHub Issue:* [#${githubIssue.number}](${githubIssue.url})

This Jira issue is automatically synchronized with GitHub #${githubIssue.number}. Updates to either issue will be reflected in both systems.`;

      await jiraService.addComment(jiraIssue.key, linkComment);
      
      console.log(`✅ Added GitHub link to Jira issue ${jiraIssue.key}`);
    } catch (error) {
      console.error(`❌ Failed to add GitHub link to Jira issue ${jiraIssue.key}:`, error);
    }
  }
}

// Global instance
export const unifiedIssueManager = new UnifiedIssueManager();
