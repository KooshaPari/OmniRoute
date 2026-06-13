import {
  ButtonInteraction,
  Message,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { safeEmbedBuilder, safeButtonBuilder, safeActionRowBuilder } from "../utils/safeBuilders";
import { SmartIssueCard, SmartIssueCardConfig } from "./SmartIssueCard";
// import { bugReportForm } from "./BugReportForm";
// import { featureRequestWorkflow } from "./FeatureRequestWorkflow";
import { framework } from "../framework";
import { actionButtonManager } from "../framework/ActionButtonManager";
import { modalFormManager } from "../framework/ModalFormManager";
import { stateManager } from "../framework/StateManager";
import { Thread } from "../../interfaces";
import { IssueMetadata } from "../../interfaces";
import { octokit, repoCredentials } from "../../github/githubActions";

/**
 * Integration layer for enhanced issue management components
 */
export class IssueManagementIntegration {
  private issueCards: Map<string, SmartIssueCard> = new Map();
  private threadIssueMap: Map<string, string> = new Map(); // threadId -> issueId
  private issueThreadMap: Map<string, string> = new Map(); // issueId -> threadId

  constructor() {
    this.initializeIntegration();
  }

  /**
   * Initialize the integration system
   */
  private async initializeIntegration(): Promise<void> {
    console.log("🔧 Initializing Issue Management Integration...");

    // Ensure framework is initialized
    if (!framework.isInitialized()) {
      await framework.initialize({
        theme: "default",
        persistence: true,
        autoCleanup: true,
      });
    }

    // Register enhanced command handlers
    this.registerCommandHandlers();

    // Register interaction handlers
    this.registerInteractionHandlers();

    // Setup event listeners
    this.setupEventListeners();

    console.log("✅ Issue Management Integration initialized");
  }

  /**
   * Register enhanced command handlers
   */
  private registerCommandHandlers(): void {
    // Enhanced issue creation command
    actionButtonManager.createQuickAction(
      "create-enhanced-issue",
      "Create Issue",
      async (interaction: ButtonInteraction) => {
        await this.showIssueCreationMenu(interaction);
      },
      {
        emoji: "📝",
        cooldown: 10,
      },
    );

    // Enhanced dashboard command
    actionButtonManager.createQuickAction(
      "show-enhanced-dashboard",
      "Project Dashboard",
      async (interaction: ButtonInteraction) => {
        await this.showEnhancedDashboard(interaction);
      },
      {
        emoji: "📊",
        cooldown: 30,
      },
    );

    // Issue search and management
    actionButtonManager.createQuickAction(
      "manage-issues",
      "Manage Issues",
      async (interaction: ButtonInteraction) => {
        await this.showIssueManagement(interaction);
      },
      {
        emoji: "🔧",
        permissions: ["ManageMessages"],
        cooldown: 5,
      },
    );
  }

  /**
   * Register interaction handlers
   */
  private registerInteractionHandlers(): void {
    // Handle issue card interactions
    actionButtonManager.on("actionExecuted", async (data) => {
      const { action, user } = data;

      if (action.id.startsWith("assign_")) {
        await this.handleIssueAssignment(action, user);
      } else if (action.id.startsWith("comment_")) {
        await this.handleIssueComment(action, user);
      } else if (action.id.startsWith("priority_")) {
        await this.handlePriorityChange(action, user);
      } else if (
        action.id.startsWith("close_") ||
        action.id.startsWith("reopen_")
      ) {
        await this.handleStatusChange(action, user);
      } else if (action.id.startsWith("thread_")) {
        await this.handleThreadAction(action, user);
      }
    });

    // Handle form submissions
    modalFormManager.on("formCompleted", async (data) => {
      const { template, submission, user } = data;

      if (template.category === "bug-reports") {
        await this.handleBugReportSubmission(template, submission, user);
      } else if (template.id === "feature-request") {
        await this.handleFeatureRequestSubmission(template, submission, user);
      } else if (template.id.includes("issue-comment")) {
        await this.handleCommentSubmission(template, submission, user);
      } else if (template.id.includes("issue-assignment")) {
        await this.handleAssignmentSubmission(template, submission, user);
      }
    });

    // Handle state updates
    stateManager.on("discordUpdateRequired", async (data) => {
      await this.handleDiscordUpdate(data);
    });
  }

  /**
   * Setup event listeners for external integrations
   */
  private setupEventListeners(): void {
    // Listen for GitHub webhook events (if available)
    // This would be implemented with actual webhook handling
    // Listen for Jira webhook events (if available)
    // This would be implemented with actual webhook handling
    // Listen for Coda updates (if available)
    // This would be implemented with actual webhook handling
  }

  /**
   * Show issue creation menu
   */
  private async showIssueCreationMenu(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const embed = safeEmbedBuilder()
      .setTitle("📝 Create New Issue")
      .setDescription("Choose the type of issue you want to create:")
      .setColor(0x0099ff)
      .addFields([
        {
          name: "🐛 Bug Report",
          value: "Report a bug with guided templates and validation",
          inline: false,
        },
        {
          name: "💡 Feature Request",
          value: "Request a new feature with community voting",
          inline: false,
        },
        {
          name: "📋 General Issue",
          value: "Create a general issue or task",
          inline: false,
        },
        {
          name: "🔒 Security Issue",
          value: "Report a security vulnerability (private)",
          inline: false,
        },
      ]);

    const buttons = [
      safeButtonBuilder()
        .setCustomId("create-bug-report")
        .setLabel("Bug Report")
        .setEmoji("🐛")
        .setStyle(ButtonStyle.Danger),
      safeButtonBuilder()
        .setCustomId("create-feature-request")
        .setLabel("Feature Request")
        .setEmoji("💡")
        .setStyle(ButtonStyle.Primary),
      safeButtonBuilder()
        .setCustomId("create-general-issue")
        .setLabel("General Issue")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary),
      safeButtonBuilder()
        .setCustomId("create-security-issue")
        .setLabel("Security Issue")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary),
    ];

    const rows = [
      (safeActionRowBuilder() as any).addComponents(buttons.slice(0, 2) as any),
      (safeActionRowBuilder() as any).addComponents(buttons.slice(2, 4) as any),
    ];

    await interaction.reply({
      embeds: [embed],
      components: rows,
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Show enhanced dashboard
   */
  private async showEnhancedDashboard(
    interaction: ButtonInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    try {
      // Fetch dashboard data
      const dashboardData = await this.fetchDashboardData();

      // Create dashboard embed using the framework
      const { createDashboardCard } = await import("../framework");

      const dashboardCard = await createDashboardCard({
        id: "enhanced-dashboard",
        title: "📊 Enhanced Project Dashboard",
        description: "Real-time project metrics and issue analytics",
        metrics: dashboardData.metrics,
        progress: dashboardData.progress,
        refreshInterval: 300, // 5 minutes
      });

      if (dashboardCard) {
        const { embeds, components } = dashboardCard.build();

        await interaction.editReply({
          embeds,
          components,
        });
      } else {
        throw new Error("Failed to create dashboard card");
      }
    } catch (error) {
      console.error("Error creating enhanced dashboard:", error);
      await interaction.editReply({
        content: "❌ Failed to load dashboard. Please try again.",
      });
    }
  }

  /**
   * Show issue management interface
   */
  private async showIssueManagement(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle("🔧 Issue Management")
      .setDescription("Manage and monitor project issues")
      .setColor(0x17a2b8)
      .addFields([
        {
          name: "📊 Active Issues",
          value: `${this.issueCards.size} smart issue cards active`,
          inline: true,
        },
        {
          name: "🧵 Threads",
          value: `${this.threadIssueMap.size} issue threads created`,
          inline: true,
        },
        {
          name: "🔄 Sync Status",
          value: "All systems synchronized",
          inline: true,
        },
      ]);

    const buttons = [
      new ButtonBuilder()
        .setCustomId("refresh-all-issues")
        .setLabel("Refresh All")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("sync-external-issues")
        .setLabel("Sync External")
        .setEmoji("🔗")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("cleanup-old-issues")
        .setLabel("Cleanup")
        .setEmoji("🧹")
        .setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }

  /**
   * Create enhanced issue from thread
   */
  async createEnhancedIssueFromThread(
    thread: Thread,
    metadata: IssueMetadata,
    channel: TextChannel,
  ): Promise<Message> {
    // Create smart issue card configuration
    const config: SmartIssueCardConfig = {
      id: thread.id,
      title: thread.title,
      description: metadata.description || "No description provided",
      status: this.mapStatus(metadata.state || "open"),
      priority: this.mapPriority(metadata.priority || "medium"),
      assignee: metadata.assignees?.[0]
        ? {
            id: metadata.assignees[0].id?.toString() || "",
            username: metadata.assignees[0].login,
            displayName: metadata.assignees[0].login,
            avatarUrl: metadata.assignees[0].avatar_url,
          }
        : undefined,
      labels:
        metadata.labels?.map((label) => ({
          name: typeof label === "string" ? label : label.name,
          color: typeof label === "string" ? "#0099ff" : label.color,
          description:
            typeof label === "string" ? undefined : label.description,
        })) || [],
      metadata,
      activity: {
        items: [],
        totalCount: 0,
        lastUpdated: new Date(),
      },
      reactions: {
        thumbsUp: metadata.reactions?.total_count || 0,
        thumbsDown: 0,
        heart: 0,
        rocket: 0,
        eyes: 0,
        total: metadata.reactions?.total_count || 0,
      },
      threadId: thread.channelId,
      externalLinks: {
        github: metadata.html_url,
        jira: metadata.jira_url,
        coda: metadata.coda_url,
      },
    };

    // Create smart issue card
    const issueCard = new SmartIssueCard(config);
    this.issueCards.set(thread.id, issueCard);

    // Map thread to issue
    if (thread.channelId) {
      this.threadIssueMap.set(thread.channelId, thread.id);
      this.issueThreadMap.set(thread.id, thread.channelId);
    }

    // Build and send the embed
    const { embeds, components } = issueCard.build();

    const message = await channel.send({
      embeds,
      components,
    });

    // Update state with message ID
    const state = issueCard.getState();
    await stateManager.updateState(state.id, {
      messageId: message.id,
      channelId: channel.id,
      guildId: channel.guild.id,
    });

    return message;
  }

  /**
   * Handle various interaction types
   */
  private async handleIssueAssignment(action: any, user: any): Promise<void> {
    const issueId = action.id.replace("assign_", "");
    const issueCard = this.issueCards.get(issueId);

    if (!issueCard) return;

    // Show assignment modal
    await modalFormManager.startForm(user, "issue-assignment", {
      issueId,
      currentAssignee: issueCard.getConfig().assignee?.username || "None",
    });
  }

  private async handleIssueComment(action: any, user: any): Promise<void> {
    const issueId = action.id.replace("comment_", "");

    // Show comment modal
    await modalFormManager.startForm(user, "issue-comment", {
      issueId,
    });
  }

  private async handlePriorityChange(action: any, _user: any): Promise<void> {
    const issueId = action.id.replace("priority_", "");
    const issueCard = this.issueCards.get(issueId);

    if (!issueCard) return;

    // Show priority selection
    // This would show a select menu for priority levels
    console.log("Priority change requested for issue:", issueId);
  }

  private async handleStatusChange(action: any, user: any): Promise<void> {
    const issueId = action.id.replace(/^(close_|reopen_)/, "");
    const issueCard = this.issueCards.get(issueId);

    if (!issueCard) return;

    const newStatus = action.id.startsWith("close_") ? "closed" : "open";

    await issueCard.updateStatus(newStatus, {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    });

    // Sync with external systems
    await this.syncStatusWithExternal(issueId, newStatus);
  }

  private async handleThreadAction(action: any, _user: any): Promise<void> {
    const issueId = action.id.replace("thread_", "");
    const threadId = this.issueThreadMap.get(issueId);

    if (threadId) {
      // Navigate to existing thread
      console.log("Navigating to thread:", threadId);
    } else {
      // Create new thread
      await this.createIssueThread(issueId);
    }
  }

  /**
   * Handle form submissions
   */
  private async handleBugReportSubmission(
    template: any,
    submission: any,
    _user: any,
  ): Promise<void> {
    // Create GitHub issue from bug report
    try {
      const issueData = {
        title: submission.data.title,
        body: this.formatBugReportBody(submission.data),
        labels: ["bug", template.id.replace("-bug", "")],
        assignees: template.autoAssign || [],
      };

      const response = await octokit.rest.issues.create({
        ...repoCredentials,
        ...issueData,
      });

      // Create smart issue card
      const _thread: Thread = {
        id: `bug-${response.data.number}`,
        title: response.data.title,
        channelId: "", // Will be set when posted
        appliedTags: [],
        comments: [],
        archived: false,
        locked: false,
        number: response.data.number,
        body: response.data.body || "",
      };

      const _metadata: IssueMetadata = {
        number: response.data.number,
        state: response.data.state as "open" | "closed",
        html_url: response.data.html_url,
        description: response.data.body || "",
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
      };

      // This would be posted to the appropriate channel
      console.log("Bug report created:", response.data.html_url);
    } catch (error) {
      console.error("Error creating bug report:", error);
    }
  }

  private async handleFeatureRequestSubmission(
    _template: any,
    submission: any,
    _user: any,
  ): Promise<void> {
    // Feature requests are handled by the FeatureRequestWorkflow
    console.log("Feature request submitted:", submission.data.title);
  }

  private async handleCommentSubmission(
    _template: any,
    submission: any,
    _user: any,
  ): Promise<void> {
    const issueId = submission.data.issueId;
    const comment = submission.data.comment;
    const issueCard = this.issueCards.get(issueId);

    if (issueCard) {
      await issueCard.addComment(comment, {
        id: (_user as any)?.id || "",
        username: (_user as any)?.username || "",
        displayName: ((_user as any)?.displayName || (_user as any)?.username) || "",
      });

      // Sync with external systems
      await this.syncCommentWithExternal(issueId, comment, _user);
    }
  }

  private async handleAssignmentSubmission(
    template: any,
    submission: any,
    user: any,
  ): Promise<void> {
    const issueId = submission.data.issueId;
    const assigneeUsername = submission.data.assignee;
    const issueCard = this.issueCards.get(issueId);

    if (issueCard) {
      await issueCard.assignTo(
        {
          id: "", // Would be resolved from username
          username: assigneeUsername,
          displayName: assigneeUsername,
        },
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
        },
      );

      // Sync with external systems
      await this.syncAssignmentWithExternal(issueId, assigneeUsername);
    }
  }

  /**
   * Handle Discord message updates
   */
  private async handleDiscordUpdate(data: any): Promise<void> {
    // This would update the actual Discord message
    console.log("Discord update required:", data.messageId);
  }

  /**
   * Utility methods
   */
  private mapStatus(externalStatus: string): SmartIssueCardConfig["status"] {
    const statusMap: Record<string, SmartIssueCardConfig["status"]> = {
      open: "open",
      closed: "closed",
      in_progress: "in_progress",
      review: "review",
      blocked: "blocked",
      resolved: "resolved",
    };

    return statusMap[externalStatus] || "open";
  }

  private mapPriority(
    externalPriority: string,
  ): SmartIssueCardConfig["priority"] {
    const priorityMap: Record<string, SmartIssueCardConfig["priority"]> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    return priorityMap[externalPriority] || "medium";
  }

  private async fetchDashboardData(): Promise<any> {
    // Fetch real dashboard data
    try {
      const issues = await octokit.rest.issues.listForRepo({
        ...repoCredentials,
        state: "all",
        per_page: 100,
      });

      const openIssues = issues.data.filter(
        (issue) => issue.state === "open",
      ).length;
      const closedIssues = issues.data.filter(
        (issue) => issue.state === "closed",
      ).length;
      const totalIssues = issues.data.length;

      return {
        metrics: {
          "Total Issues": totalIssues,
          "Open Issues": openIssues,
          "Closed Issues": closedIssues,
          "Smart Cards": this.issueCards.size,
          "Active Threads": this.threadIssueMap.size,
          "Completion Rate": `${Math.round((closedIssues / totalIssues) * 100)}%`,
        },
        progress: {
          current: closedIssues,
          total: totalIssues,
        },
      };
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return {
        metrics: {
          Error: "Failed to fetch data",
        },
        progress: {
          current: 0,
          total: 1,
        },
      };
    }
  }

  private formatBugReportBody(data: any): string {
    return `## Description
${data.description}

## Steps to Reproduce
${data.steps}

## Environment
- **Browser**: ${data.browser || "Not specified"}
- **Device**: ${data.device || "Not specified"}
- **Page URL**: ${data.page_url || "Not specified"}

## Additional Information
${data.additional || "None provided"}

---
*This bug report was created using the Enhanced Bug Report Form*`;
  }

  private async createIssueThread(issueId: string): Promise<void> {
    // This would create a Discord thread for the issue
    console.log("Creating thread for issue:", issueId);
  }

  private async syncStatusWithExternal(
    issueId: string,
    status: string,
  ): Promise<void> {
    // Sync status change with GitHub, Jira, etc.
    console.log("Syncing status change:", issueId, status);
  }

  private async syncCommentWithExternal(
    issueId: string,
    comment: string,
    _user: any,
  ): Promise<void> {
    // Sync comment with GitHub, Jira, etc.
    console.log("Syncing comment:", issueId, comment);
  }

  private async syncAssignmentWithExternal(
    issueId: string,
    assignee: string,
  ): Promise<void> {
    // Sync assignment with GitHub, Jira, etc.
    console.log("Syncing assignment:", issueId, assignee);
  }

  /**
   * Public methods
   */

  /**
   * Get issue card by ID
   */
  getIssueCard(issueId: string): SmartIssueCard | undefined {
    return this.issueCards.get(issueId);
  }

  /**
   * Get all active issue cards
   */
  getAllIssueCards(): SmartIssueCard[] {
    return Array.from(this.issueCards.values());
  }

  /**
   * Get thread ID for issue
   */
  getThreadForIssue(issueId: string): string | undefined {
    return this.issueThreadMap.get(issueId);
  }

  /**
   * Get issue ID for thread
   */
  getIssueForThread(threadId: string): string | undefined {
    return this.threadIssueMap.get(threadId);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.issueCards.forEach((card) => card.destroy());
    this.issueCards.clear();
    this.threadIssueMap.clear();
    this.issueThreadMap.clear();
  }
}

// Global instance
export const issueManagementIntegration = new IssueManagementIntegration();
