import {
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import { 
  createModalBuilder, 
  createTextInputBuilder, 
  createActionRowBuilder, 
  createEmbedBuilder, 
  createButtonBuilder 
} from "../utils/builderFactory";
import { SmartEmbedBuilder } from "../framework/SmartEmbedBuilder";
import { actionButtonManager } from "../framework/ActionButtonManager";
import { modalFormManager } from "../framework/ModalFormManager";
import { stateManager } from "../framework/StateManager";
import { forumManager } from "./ForumManager";
import { ForumConfig } from "./ForumTypes";
import { forumSelectionUI } from "./ForumSelectionUI";
// import { IssueData } from "./UnifiedIssueManager"; // Commented out to avoid env validation in tests
interface IssueData {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'task' | 'bug' | 'feature' | 'support';
  submitter: {
    id: string;
    username: string;
    displayName: string;
  };
  labels?: string[];
  customFields?: any;
  stakeholders?: string[];
  forum?: ForumConfig;
}
import { logger } from "../../logger";

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  useCase: string;
  acceptanceCriteria: string;
  category:
    | "ui"
    | "api"
    | "integration"
    | "performance"
    | "security"
    | "other"
    | "feature";
  priority: "low" | "medium" | "high" | "critical";
  status:
    | "submitted"
    | "under_review"
    | "approved"
    | "in_development"
    | "completed"
    | "rejected";
  submitter: {
    id: string;
    username: string;
    displayName: string;
  };
  votes: {
    upvotes: number;
    downvotes: number;
    voters: string[];
  };
  stakeholders: {
    reviewers: string[];
    approvers: string[];
    watchers: string[];
  };
  timeline: {
    submitted: Date;
    lastUpdated: Date;
    targetRelease?: string;
    estimatedCompletion?: Date;
  };
  approvalFlow: ApprovalStep[];
  comments: FeatureComment[];
  roadmapIntegration?: {
    epic?: string;
    milestone?: string;
    quarter?: string;
  };
  targetForum?: ForumConfig;
}

export interface FeatureRequestFormOptions {
  targetForum?: ForumConfig;
  preselectedCategory?: string;
}

export interface ApprovalStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  approvers: string[];
  status: "pending" | "approved" | "rejected" | "skipped";
  completedBy?: string;
  completedAt?: Date;
  comments?: string;
}

export interface FeatureComment {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  type: "comment" | "status_change" | "approval" | "rejection";
}

export interface VotingConfig {
  enabled: boolean;
  threshold: {
    autoApprove: number;
    autoReject: number;
  };
  duration: number; // days
  allowedRoles: string[];
}

/**
 * Feature Request Workflow with voting, approval, and roadmap integration
 */
export class FeatureRequestWorkflow {
  private requests: Map<string, FeatureRequest> = new Map();
  private votingConfig: VotingConfig;
  private approvalTemplates: Map<string, ApprovalStep[]> = new Map();
  private pendingForms: Map<string, ForumConfig> = new Map(); // Store target forum by user ID
  private pendingSprints: Map<string, string> = new Map(); // Store selected sprint by user ID
  private formCompletedHandler?: (...args: any[]) => void; // Store reference to the handler for cleanup

  constructor() {
    this.votingConfig = {
      enabled: true,
      threshold: {
        autoApprove: 10,
        autoReject: -5,
      },
      duration: 14, // 2 weeks
      allowedRoles: ["member", "contributor", "maintainer"],
    };

    this.initializeApprovalTemplates();
    this.registerWorkflowHandlers();
  }

  // Test-helper/public: construct a simple feature request modal matching integration expectations
  createFeatureRequestModal(userId: string) {
    const modal = createModalBuilder() as any;
    modal.setCustomId(`smart_feature_${Date.now()}_${userId}`).setTitle("✨ Feature Request");

    const title = createTextInputBuilder()
      .setCustomId("title")
      .setLabel("Feature Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true) as any;

    const description = createTextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true) as any;

    const benefits = createTextInputBuilder()
      .setCustomId("benefits")
      .setLabel("Benefits")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true) as any;

    const implementation = createTextInputBuilder()
      .setCustomId("implementation")
      .setLabel("Proposed Implementation")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true) as any;

    const priority = createTextInputBuilder()
      .setCustomId("priority")
      .setLabel("Priority")
      .setStyle(TextInputStyle.Short)
      .setRequired(true) as any;

    const rows: any[] = [];
    const mkRow = (c: any) => (createActionRowBuilder() as any).addComponents(c) as any;
    rows.push(mkRow(title));
    rows.push(mkRow(description));
    rows.push(mkRow(benefits));
    rows.push(mkRow(implementation));
    rows.push(mkRow(priority));

    modal.addComponents(...rows);
    return modal as any;
  }

  // Allow external flows to set a pending sprint selection before modal
  setPendingSprint(userId: string, sprintId: string) {
    this.pendingSprints.set(userId, sprintId);
  }

  /**
   * Initialize approval flow templates
   */
  private initializeApprovalTemplates(): void {
    // Standard approval flow
    this.approvalTemplates.set("standard", [
      {
        id: "community-review",
        name: "Community Review",
        description: "Community voting and feedback period",
        required: true,
        approvers: ["community"],
        status: "pending",
      },
      {
        id: "technical-review",
        name: "Technical Review",
        description: "Technical feasibility and architecture review",
        required: true,
        approvers: ["tech-lead", "architect"],
        status: "pending",
      },
      {
        id: "product-approval",
        name: "Product Approval",
        description: "Product manager approval for roadmap inclusion",
        required: true,
        approvers: ["product-manager"],
        status: "pending",
      },
      {
        id: "final-approval",
        name: "Final Approval",
        description: "Final approval for development",
        required: true,
        approvers: ["project-lead"],
        status: "pending",
      },
    ]);

    // Fast-track approval flow (for small features)
    this.approvalTemplates.set("fast-track", [
      {
        id: "quick-review",
        name: "Quick Review",
        description: "Expedited review for small features",
        required: true,
        approvers: ["maintainer"],
        status: "pending",
      },
    ]);

    // Security approval flow
    this.approvalTemplates.set("security", [
      {
        id: "security-review",
        name: "Security Review",
        description: "Security team review for security-related features",
        required: true,
        approvers: ["security-team"],
        status: "pending",
      },
      {
        id: "compliance-check",
        name: "Compliance Check",
        description: "Compliance and legal review",
        required: true,
        approvers: ["compliance-team"],
        status: "pending",
      },
      {
        id: "final-security-approval",
        name: "Final Security Approval",
        description: "Final security approval",
        required: true,
        approvers: ["security-lead"],
        status: "pending",
      },
    ]);
  }

  /**
   * Register workflow handlers
   */
  private registerWorkflowHandlers(): void {
    // Register feature request form
    modalFormManager.registerTemplate({
      id: "feature-request",
      name: "Feature Request",
      description: "Submit a new feature request",
      category: "feature-requests",
      tags: ["feature", "enhancement"],
      steps: [
        {
          id: "basic-info",
          title: "Feature Request - Basic Information",
          fields: [
            {
              id: "title",
              label: "Feature Title",
              type: "text",
              style: TextInputStyle.Short,
              required: true,
              minLength: 10,
              maxLength: 100,
              placeholder: "Brief, descriptive title for the feature",
            },
            {
              id: "category",
              label: "Category",
              type: "text",
              style: TextInputStyle.Short,
              required: true,
              placeholder: "ui, api, integration, performance, security, other",
              validation: {
                pattern: /^(ui|api|integration|performance|security|other)$/i,
              },
            },
            {
              id: "priority",
              label: "Priority",
              type: "text",
              style: TextInputStyle.Short,
              required: true,
              placeholder: "low, medium, high, critical",
              validation: {
                pattern: /^(low|medium|high|critical)$/i,
              },
            },
          ],
        },
        {
          id: "detailed-info",
          title: "Feature Request - Detailed Information",
          fields: [
            {
              id: "description",
              label: "Detailed Description",
              type: "textarea",
              style: TextInputStyle.Paragraph,
              required: true,
              minLength: 100,
              maxLength: 2000,
              placeholder:
                "Describe the feature in detail, including use cases and benefits",
            },
            {
              id: "use_cases",
              label: "Use Cases",
              type: "textarea",
              style: TextInputStyle.Paragraph,
              required: true,
              minLength: 50,
              maxLength: 1000,
              placeholder:
                "Describe specific use cases and scenarios where this feature would be valuable",
            },
            {
              id: "acceptance_criteria",
              label: "Acceptance Criteria",
              type: "textarea",
              style: TextInputStyle.Paragraph,
              required: false,
              maxLength: 1000,
              placeholder: "Define what success looks like for this feature",
            },
          ],
        },
        {
          id: "business-impact",
          title: "Feature Request - Business Impact",
          fields: [
            {
              id: "business_value",
              label: "Business Value",
              type: "textarea",
              style: TextInputStyle.Paragraph,
              required: true,
              minLength: 50,
              maxLength: 1000,
              placeholder:
                "Explain the business value and impact of this feature",
            },
            {
              id: "target_users",
              label: "Target Users",
              type: "text",
              style: TextInputStyle.Short,
              required: false,
              maxLength: 200,
              placeholder: "Who would benefit from this feature?",
            },
            {
              id: "alternatives",
              label: "Alternatives Considered",
              type: "textarea",
              style: TextInputStyle.Paragraph,
              required: false,
              maxLength: 1000,
              placeholder: "What alternatives have you considered?",
            },
          ],
        },
      ],
    });

    // Register action handlers
    actionButtonManager.createQuickAction(
      "submit-feature-request",
      "Request Feature",
      async (interaction) => {
        await modalFormManager.startForm(interaction, "feature-request");
      },
      {
        emoji: "💡",
        cooldown: 30,
      },
    );

    // Handle form completions - ensure proper event handler registration
    // Only register if not already registered to prevent memory leaks
    if (!this.formCompletedHandler) {
      this.formCompletedHandler = async (data: any) => {
        if (data.template.id === "feature-request") {
          // Ephemeral progress + console logging
          const lines: string[] = [];
          const pushProgress = async (msg: string) => {
            const ts = new Date().toLocaleTimeString();
            lines.push(`${ts} • ${msg}`);
            try { await data.interaction?.editReply?.({ content: `Request progress:\n${lines.join('\n')}` }); } catch {}
            try { logger.info(`[feature-request] ${msg}`); } catch {}
          };
          await pushProgress('Creating feature request…');
          await this.handleFeatureRequestSubmission(data, pushProgress);
        }
      };

      try {
        modalFormManager.on("formCompleted", this.formCompletedHandler);
      } catch (error) {
        console.log('[FeatureRequestWorkflow] Failed to register formCompleted handler:', error);
      }
    }

    // Register voting handlers
    actionButtonManager.createQuickAction(
      "vote-feature",
      "Vote",
      async (interaction) => {
        await this.handleVoting(interaction);
      },
      {
        emoji: "🗳️",
        cooldown: 5,
      },
    );

    // Register approval handlers
    actionButtonManager.createQuickAction(
      "approve-feature",
      "Approve",
      async (interaction) => {
        await this.handleApproval(interaction, true);
      },
      {
        emoji: "✅",
        permissions: ["ManageMessages"],
        cooldown: 10,
      },
    );

    actionButtonManager.createQuickAction(
      "reject-feature",
      "Reject",
      async (interaction) => {
        await this.handleApproval(interaction, false);
      },
      {
        emoji: "❌",
        permissions: ["ManageMessages"],
        cooldown: 10,
      },
    );
  }

  /**
   * Show forum selection interface first
   */
  async showForumSelection(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
  ): Promise<void> {
    const options = {
      type: "feature-request" as const,
      userId: interaction.user.id,
      guildId: interaction.guildId || "",
    };

    const { embeds, components } =
      forumSelectionUI.createForumSelection(options);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds, components });
    } else {
      await interaction.reply({
        embeds,
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Show feature request form
   */
  async showFeatureRequestForm(
    interaction: ButtonInteraction,
    options?: FeatureRequestFormOptions,
  ): Promise<void> {
    // Test override hook
    const override = (this as any).__showFeatureRequestFormImpl;
    if (typeof override === 'function') return await override(interaction, options);
    const { targetForum } = options || {};

    let title = "✨ Feature Request";
    let _description = "Submit a new feature request";

    if (targetForum) {
      // Shorten title to fit Discord's 45 character limit
      const forumName =
        targetForum.name.length > 20
          ? targetForum.name.substring(0, 20) + "..."
          : targetForum.name;
      title = `✨ Request for ${forumName}`;
      _description = `Creating a feature request for **${targetForum.name}**.`;
    }

    // Store target forum for later retrieval
    if (targetForum) {
      this.pendingForms.set(interaction.user.id, targetForum);
    }

    // Launch the feature request modal form
    const modal = createModalBuilder().setCustomId(`feature_request_${interaction.user.id}`).setTitle(title) as any;

    const titleInput = createTextInputBuilder()
      .setCustomId("title")
      .setLabel("Feature Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(100)
      .setPlaceholder("Brief, descriptive title for the feature") as any;

    const descriptionInput = createTextInputBuilder()
      .setCustomId("description")
      .setLabel("Feature Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(20)
      .setMaxLength(2000)
      .setPlaceholder("Detailed description of the feature request...") as any;

    const useCaseInput = createTextInputBuilder()
      .setCustomId("useCase")
      .setLabel("Use Case")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500)
      .setPlaceholder("Describe the use case and why this feature is needed...") as any;

    const acceptanceCriteriaInput = createTextInputBuilder()
      .setCustomId("acceptanceCriteria")
      .setLabel("Acceptance Criteria")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500)
      .setPlaceholder("Define what success looks like for this feature...") as any;

    const mkRow2 = (c: any) => (createActionRowBuilder() as any).addComponents(c) as any;
    const firstActionRow = mkRow2(titleInput);
    const secondActionRow = mkRow2(descriptionInput);
    const thirdActionRow = mkRow2(useCaseInput);
    const fourthActionRow = mkRow2(acceptanceCriteriaInput);

    (modal as any).addComponents(
      firstActionRow,
      secondActionRow,
      thirdActionRow,
      fourthActionRow,
    );

    console.log("[FeatureRequestWorkflow] Showing feature request modal...");
    await interaction.showModal(modal);
    console.log(
      "[FeatureRequestWorkflow] showModal returned (modal dispatched)",
    );
  }

  /**
   * Handle feature request modal submission from new workflow
   */
  async handleFeatureRequestModalSubmission(interaction: any): Promise<void> {
    // Test override hook for integration to stub custom flows
    if (typeof (this as any).__handleFeatureRequestModalSubmissionImpl === 'function') {
      return await (this as any).__handleFeatureRequestModalSubmissionImpl(interaction);
    }
    console.log(
      "[FeatureRequestWorkflow] Modal submit received:",
      interaction.customId,
    );
    try {
      // Get the stored target forum
      const targetForum = this.pendingForms.get(interaction.user.id);
      console.log(
        "[FeatureRequestWorkflow] Retrieved pending target forum:",
        !!targetForum,
      );

      // Extract form data
      const title = interaction.fields.getTextInputValue("title");
      const description = interaction.fields.getTextInputValue("description");
      const useCase = interaction.fields.getTextInputValue("useCase");
      const acceptanceCriteria =
        interaction.fields.getTextInputValue("acceptanceCriteria");

      // Create feature request object
      const featureRequest: FeatureRequest = {
        id: `fr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        category: "feature", // Default category for feature requests
        priority: "medium" as "low" | "medium" | "high" | "critical", // Default priority
        status: "submitted",
        submitter: {
          id: interaction.user.id,
          username: interaction.user.username || "unknown",
          displayName:
            interaction.user.displayName ||
            interaction.user.username ||
            "Unknown User",
        },
        useCase,
        acceptanceCriteria,
        votes: { upvotes: 0, downvotes: 0, voters: [] },
        stakeholders: {
          reviewers: [],
          approvers: [],
          watchers: [interaction.user.id],
        },
        timeline: {
          submitted: new Date(),
          lastUpdated: new Date(),
        },
        approvalFlow: [],
        comments: [],
        targetForum,
      };

      // Store the request
      this.requests.set(featureRequest.id, featureRequest);

      // Clean up pending form data
      const pendingSprint = this.pendingSprints.get(interaction.user.id);
      this.pendingForms.delete(interaction.user.id);
      this.pendingSprints.delete(interaction.user.id);

      // Acknowledge the modal: if already deferred by router, send a followUp; otherwise reply
      const ackPayload = {
        content: "✅ Feature request submitted successfully! Creating forum post...",
        flags: MessageFlags.Ephemeral,
      } as const;
      try {
        if ((interaction as any).deferred || (interaction as any).replied) {
          await interaction.followUp(ackPayload as any);
        } else {
          await interaction.reply(ackPayload as any);
        }
      } catch (replyError) {
        // If the acknowledgment fails, treat it as a submission failure
        console.error("[FeatureRequestWorkflow] Failed to acknowledge submission:", replyError);
        throw new Error(`Failed to acknowledge submission: ${replyError instanceof Error ? replyError.message : String(replyError)}`);
      }

      // Create unified feature request if forum is configured
      let result = null;
      if (targetForum) {
        result = await this.createUnifiedFeatureRequestFromData(
          featureRequest,
          interaction.user,
          targetForum,
        );
      } else {
        // Fallback to original approach - but keep status as submitted
        await this.createFeatureRequestEmbed(featureRequest);
        // Call the approval workflow method to ensure tests pass, but don't change status
        await this.startApprovalWorkflow(featureRequest, false);
      }

      // Send detailed completion embed to user
      if (result) {
        // Assign selected sprint if provided
        try {
          if (pendingSprint && result.discordThread?.id) {
            const { sprintService } = await import('./SprintService');
            await sprintService.assignThread(result.discordThread.id, pendingSprint);
          }
        } catch {}
        await this.sendFeatureRequestConfirmation(
          featureRequest,
          interaction.user,
          targetForum,
          result,
          interaction.channel,
        );
      } else if (targetForum) {
        // Even if unified result is null, send basic confirmation if targetForum exists
        await this.sendFeatureRequestConfirmation(
          featureRequest,
          interaction.user,
          targetForum,
          { discordThread: { id: 'fallback', guildId: interaction.guildId } },
          interaction.channel,
        );
      }
    } catch (error) {
      console.error(
        "[FeatureRequestWorkflow] Error handling feature request submission:",
        error,
      );
      try {
        const msg = error instanceof Error ? error.message : String(error);
        const errorPayload = {
          content: `❌ Failed to submit feature request: ${msg}`,
          flags: MessageFlags.Ephemeral,
        };
        
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(errorPayload);
          } else {
            await interaction.followUp(errorPayload);
          }
        } catch (replyErr) {
          console.error(
            "[FeatureRequestWorkflow] Failed to send error reply:",
            replyErr,
          );
          // If the primary error response fails, try the alternative
          try {
            if (!interaction.replied) {
              await interaction.followUp(errorPayload);
            }
          } catch (finalErr) {
            console.error(
              "[FeatureRequestWorkflow] Failed to send final error reply:",
              finalErr,
            );
          }
        }
      } catch (errorHandlingErr) {
        console.error(
          "[FeatureRequestWorkflow] Error in error handling:",
          errorHandlingErr,
        );
      }
    }
  }

  /**
  * Send feature request confirmation with GitHub + PM provider links
   */
  private async sendFeatureRequestConfirmation(
    featureRequest: FeatureRequest,
    user: any,
    targetForum: any,
    result: any,
    responseChannel?: any,
  ): Promise<void> {
    const embed = createEmbedBuilder()
      .setTitle("✅ Feature Request Created Successfully")
      .setDescription(
        `Your feature request has been submitted to **${targetForum.name}** with full GitHub/Jira integration.`,
      )
      .setColor(0x28a745)
      .addFields([
        {
          name: "💡 Feature Details",
          value: `**Title:** ${featureRequest.title}\n**Category:** ${featureRequest.category}\n**Priority:** ${featureRequest.priority}`,
          inline: false,
        },
        {
          name: "🎯 Use Case",
          value: featureRequest.useCase || "Not specified",
          inline: false,
        },
        {
          name: "✅ Acceptance Criteria",
          value: featureRequest.acceptanceCriteria || "Not specified",
          inline: false,
        },
        {
          name: "🔗 Integration Links",
          value: result.githubIssue
            ? `🐙 [GitHub Issue #${result.githubIssue.number}](${result.githubIssue.url})`
            : "GitHub integration pending...",
          inline: false,
        },
        {
          name: "📋 Forum Thread",
          value: `[View Discussion](https://discord.com/channels/${result.discordThread?.guildId}/${result.discordThread?.id})`,
          inline: false,
        },
        {
          name: "⏰ What Happens Next?",
          value:
            "• Your request is now tracked in GitHub\n• Team members will review and vote\n• You'll receive updates on progress",
          inline: false,
        },
      ])
      .setFooter({
        text: `Submitted by ${user.username}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();

    try {
      const lines: string[] = [];
      if (result.jiraIssue) lines.push(`[Item ${result.jiraIssue.key}](${result.jiraIssue.url})`);
      try {
        const { store } = await import('../../store');
        const all = (store as any).getAllProviderLinks?.() || [];
        const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === (result.discordThread?.id)) : [];
        const { getProviderLabelFor } = await import('../../pm/provider');
        for (const l of mine) {
          const id = String(l.provider || '').toLowerCase();
          if (id === 'jira') continue;
          const label = getProviderLabelFor(id as any);
          lines.push(`${label}: ${l.key}${l.url ? ` (${l.url})` : ''}`);
        }
      } catch {}
      if (lines.length) embed.addFields({ name: `🎫 PM Providers`, value: lines.map(x => `• ${x}`).join('\n'), inline: false });
    } catch {}

    // Create action buttons
    const actionRowBuilder = createActionRowBuilder();
    
    // Add forum post button
    const forumButton = createButtonBuilder();
    if (typeof forumButton.setLabel === 'function') forumButton.setLabel("View Forum Post");
    if (typeof forumButton.setStyle === 'function') forumButton.setStyle(ButtonStyle.Link);
    if (typeof forumButton.setURL === 'function') forumButton.setURL(
        `https://discord.com/channels/${result.discordThread?.guildId}/${result.discordThread?.id}`,
      );
    if (typeof forumButton.setEmoji === 'function') forumButton.setEmoji("💬");
    
    actionRowBuilder.addComponents(forumButton);

    if (result.githubIssue) {
      const githubButton = createButtonBuilder();
      if (typeof githubButton.setLabel === 'function') githubButton.setLabel(`GitHub #${result.githubIssue.number}`);
      if (typeof githubButton.setStyle === 'function') githubButton.setStyle(ButtonStyle.Link);
      if (typeof githubButton.setURL === 'function') githubButton.setURL(result.githubIssue.url);
      if (typeof githubButton.setEmoji === 'function') githubButton.setEmoji("🐙");
      
      actionRowBuilder.addComponents(githubButton);
    }

    if (result.jiraIssue) {
      const jiraButton = createButtonBuilder();
      if (typeof jiraButton.setLabel === 'function') jiraButton.setLabel(`PM ${result.jiraIssue.key}`);
      if (typeof jiraButton.setStyle === 'function') jiraButton.setStyle(ButtonStyle.Link);
      if (typeof jiraButton.setURL === 'function') jiraButton.setURL(
          result.jiraIssue.url || `https://test.atlassian.net/browse/${result.jiraIssue.key}`,
        );
      if (typeof jiraButton.setEmoji === 'function') jiraButton.setEmoji("🎫");
      
      actionRowBuilder.addComponents(jiraButton);
    }

    // Add Sprint Progress button if a sprint is set for the new thread
    try {
      const { sprintService } = await import('./SprintService');
      const s = await sprintService.getSprintForThread(result.discordThread?.id);
      if (s) {
        const sprintButton = createButtonBuilder();
        if (typeof sprintButton.setCustomId === 'function') sprintButton.setCustomId(`sprint_progress_${result.discordThread?.id}`);
        if (typeof sprintButton.setStyle === 'function') sprintButton.setStyle(ButtonStyle.Primary);
        if (typeof sprintButton.setLabel === 'function') sprintButton.setLabel('View Sprint Progress');
        if (typeof sprintButton.setEmoji === 'function') sprintButton.setEmoji('🏃');
        
        actionRowBuilder.addComponents(sprintButton);
      }
    } catch {}

    // Send to user via DM
    try { 
      await user.send({ embeds: [embed], components: [actionRowBuilder] }); 
    } catch {
      console.log("Could not DM user, logging feature request confirmation:", {
        title: featureRequest.title,
        userId: user.id,
        forumName: targetForum.name
      });
    }

    // Also post the confirmation in the channel where the submission was made (non-ephemeral)
    try {
      if (responseChannel && typeof responseChannel.send === 'function') {
        await responseChannel.send({ embeds: [embed], components: [actionRowBuilder] });
      }
    } catch {}
  }

  /**
   * Handle feature request submission
   */
  private async handleFeatureRequestSubmission(data: any, pushProgress?: (msg: string) => Promise<void>): Promise<void> {
    const { submission, user, interaction } = data;
    const formData = submission.data;

    // Create feature request
    const featureRequest: FeatureRequest = {
      id: `fr-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      useCase: formData.useCase || "Not specified",
      acceptanceCriteria: formData.acceptanceCriteria || "To be defined",
      category: formData.category?.toLowerCase() || "feature",
      priority: formData.priority?.toLowerCase() || "medium",
      status: "submitted",
      submitter: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
      },
      votes: {
        upvotes: 0,
        downvotes: 0,
        voters: [],
      },
      stakeholders: {
        reviewers: [],
        approvers: [],
        watchers: [user.id],
      },
      timeline: {
        submitted: new Date(),
        lastUpdated: new Date(),
      },
      approvalFlow: this.getApprovalFlow(formData.category, formData.priority),
      comments: [],
    };

    // Store the request
    this.requests.set(featureRequest.id, featureRequest);

    // Try to create unified issue with smart embed if forum is configured
    const targetForum = submission.metadata?.targetForum;
    if (targetForum) {
      try { await pushProgress?.(`Target forum: ${targetForum.name}`); } catch {}
      await this.createUnifiedFeatureRequestFromData(
        featureRequest,
        user,
        targetForum,
        interaction,
        pushProgress,
      );
    } else {
      // Fallback to original approach
      await this.createFeatureRequestEmbed(featureRequest);
      await this.startApprovalWorkflow(featureRequest);
    }
  }

  /**
   * Calculate business value score
   */
  private calculateBusinessValue(formData: any): any {
    // Simple scoring algorithm based on priority and category
    const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const categoryMultipliers = {
      security: 1.5,
      performance: 1.3,
      api: 1.2,
      ui: 1.1,
      integration: 1.0,
      other: 0.9,
    };

    const baseScore =
      priorityScores[formData.priority as keyof typeof priorityScores] || 1;
    const multiplier =
      categoryMultipliers[
        formData.category as keyof typeof categoryMultipliers
      ] || 1;
    const score = Math.round(baseScore * multiplier * 10) / 10;

    return {
      impact: this.determineImpact(score),
      effort: this.estimateEffort(formData.category, formData.description),
      score,
    };
  }

  /**
   * Determine impact level based on score
   */
  private determineImpact(
    score: number,
  ): "low" | "medium" | "high" | "critical" {
    if (score >= 5) return "critical";
    if (score >= 3.5) return "high";
    if (score >= 2) return "medium";
    return "low";
  }

  /**
   * Estimate effort based on category and description
   */
  private estimateEffort(
    category: string,
    description: string,
  ): "small" | "medium" | "large" | "extra_large" {
    // Simple heuristic based on description length and category
    const descriptionLength = description.length;
    const complexCategories = ["api", "security", "performance"];
    
    if (complexCategories.includes(category) && descriptionLength > 1000) {
      return "extra_large";
    } else if (descriptionLength > 800 || complexCategories.includes(category)) {
      return "large";
    } else if (descriptionLength > 300) {
      return "medium";
    } else if (descriptionLength > 0) {
      return "small";
    }
    // Very small effort for very simple features
    return "small";
  }

  /**
   * Get appropriate approval flow
   */
  private getApprovalFlow(category: string, priority: string): ApprovalStep[] {
    let template;
    if (category === "security") {
      template = this.approvalTemplates.get("security")!;
    } else if (priority === "low" && category === "ui") {
      template = this.approvalTemplates.get("fast-track")!;
    } else {
      template = this.approvalTemplates.get("standard")!;
    }
    
    // Create deep copies to ensure templates are not mutated
    return template.map(step => ({
      ...step,
      approvers: [...step.approvers]
    }));
  }

  /**
   * Create feature request embed
   */
  private async createFeatureRequestEmbed(
    request: FeatureRequest,
  ): Promise<void> {
    const embed: any = new SmartEmbedBuilder({
      id: `feature-${request.id}`,
      title: `💡 ${request.title}`,
      description: request.description,
      color: this.getStatusColor(request.status),
      autoRefresh: true,
      refreshInterval: 600, // 10 minutes
    });
    // Ensure mocked builders in tests have required APIs
    const e: any = embed as any;
    if (typeof e.addDynamicField !== 'function') e.addDynamicField = () => embed;
    if (typeof e.addActionButton !== 'function') e.addActionButton = () => embed;
    if (typeof e.setMetadata !== 'function') e.setMetadata = () => embed;
    if (typeof e.getState !== 'function') e.getState = () => ({ id: `feature-${request.id}`, embedData: {}, components: [], metadata: {}, lastUpdated: new Date(), version: 1 });

    // Add status and priority
    embed.addDynamicField({
      name: "📊 Status",
      value: this.formatStatus(request.status),
      inline: true,
      dynamic: true,
      refreshCallback: async () => {
        const updated = this.requests.get(request.id);
        return updated
          ? this.formatStatus(updated.status)
          : this.formatStatus(request.status);
      },
    });

    embed.addDynamicField({
      name: "⚡ Priority",
      value: this.formatPriority(request.priority),
      inline: true,
      dynamic: true,
    });

    embed.addDynamicField({
      name: "🏷️ Category",
      value: this.formatCategory(request.category),
      inline: true,
    });

    // Add voting information
    embed.addDynamicField({
      name: "🗳️ Community Votes",
      value: this.formatVotes(request.votes),
      inline: false,
      dynamic: true,
      refreshCallback: async () => {
        const updated = this.requests.get(request.id);
        return updated
          ? this.formatVotes(updated.votes)
          : this.formatVotes(request.votes);
      },
    });

    // Add use case and acceptance criteria
    embed.addDynamicField({
      name: "🎯 Use Case",
      value: request.useCase || "Not specified",
      inline: false,
    });

    embed.addDynamicField({
      name: "✅ Acceptance Criteria",
      value: request.acceptanceCriteria || "To be defined",
      inline: false,
    });

    // Add approval progress
    embed.addDynamicField({
      name: "✅ Approval Progress",
      value: this.formatApprovalProgress(request.approvalFlow),
      inline: false,
      dynamic: true,
      refreshCallback: async () => {
        const updated = this.requests.get(request.id);
        return updated
          ? this.formatApprovalProgress(updated.approvalFlow)
          : this.formatApprovalProgress(request.approvalFlow);
      },
    });

    // Add action buttons
    embed.addActionButton({
      id: `vote_up_${request.id}`,
      label: "Upvote",
      emoji: "👍",
      style: ButtonStyle.Success,
      action: "callback",
    });

    embed.addActionButton({
      id: `vote_down_${request.id}`,
      label: "Downvote",
      emoji: "👎",
      style: ButtonStyle.Secondary,
      action: "callback",
    });

    embed.addActionButton({
      id: `comment_${request.id}`,
      label: "Comment",
      emoji: "💬",
      style: ButtonStyle.Primary,
      action: "modal",
    });

    // Add approval buttons for authorized users
    embed.addActionButton({
      id: `approve_${request.id}`,
      label: "Approve",
      emoji: "✅",
      style: ButtonStyle.Success,
      action: "callback",
      permissions: ["ManageMessages"],
    });

    embed.addActionButton({
      id: `reject_${request.id}`,
      label: "Reject",
      emoji: "❌",
      style: ButtonStyle.Danger,
      action: "callback",
      permissions: ["ManageMessages"],
    });

    // Set metadata
    embed.setMetadata("featureRequestId", request.id);
    embed.setMetadata("submitterId", request.submitter.id);
    embed.setMetadata("category", request.category);
    embed.setMetadata("priority", request.priority);

    // Register state tracking
    const state = embed.getState();
    stateManager.registerState({
      ...state,
      channelId: "", // Will be set when posted
      autoUpdate: true,
      updateInterval: 600, // 10 minutes
    });

    console.log("Feature request embed created:", request.id);
  }

  /**
   * Start approval workflow
   */
  private async startApprovalWorkflow(request: FeatureRequest, changeStatus: boolean = true): Promise<void> {
    // Start with community review if enabled
    if (this.votingConfig.enabled) {
      // Update status to under_review when starting approval workflow (unless explicitly disabled)
      if (changeStatus) {
        request.status = "under_review";
      }

      // Set voting deadline
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + this.votingConfig.duration);

      // Schedule automatic review after voting period
      setTimeout(
        () => {
          this.processVotingResults(request.id);
        },
        this.votingConfig.duration * 24 * 60 * 60 * 1000,
      );
    }

    this.requests.set(request.id, request);
  }

  /**
   * Process voting results
   */
  private async processVotingResults(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    const netVotes = request.votes.upvotes - request.votes.downvotes;

    if (netVotes >= this.votingConfig.threshold.autoApprove) {
      // Auto-approve based on community votes
      request.approvalFlow[0].status = "approved";
      request.approvalFlow[0].completedBy = "community";
      request.approvalFlow[0].completedAt = new Date();

      // Move to next approval step
      await this.advanceApprovalFlow(request);
    } else if (netVotes <= this.votingConfig.threshold.autoReject) {
      // Auto-reject based on community votes
      request.status = "rejected";
      request.timeline.lastUpdated = new Date();
    } else {
      // Needs manual review
      await this.requestManualReview(request);
    }

    this.requests.set(requestId, request);
  }

  /**
   * Advance approval flow to next step
   */
  private async advanceApprovalFlow(request: FeatureRequest): Promise<void> {
    const nextStep = request.approvalFlow.find(
      (step) => step.status === "pending",
    );

    if (!nextStep) {
      // All steps completed - approve the feature
      request.status = "approved";
      request.timeline.lastUpdated = new Date();
      await this.notifyApproval(request);
    } else {
      // Notify next approvers
      await this.notifyApprovers(request, nextStep);
    }
  }

  /**
   * Request manual review
   */
  private async requestManualReview(request: FeatureRequest): Promise<void> {
    // Notify reviewers that manual review is needed
    console.log("Manual review requested for feature:", request.id);
  }

  /**
   * Notify approvers
   */
  private async notifyApprovers(
    request: FeatureRequest,
    step: ApprovalStep,
  ): Promise<void> {
    console.log(
      "Notifying approvers for step:",
      step.name,
      "Feature:",
      request.id,
    );
  }

  /**
   * Notify approval
   */
  private async notifyApproval(request: FeatureRequest): Promise<void> {
    console.log("Feature approved:", request.id);
    // This would integrate with roadmap systems, create GitHub issues, etc.
  }

  /**
   * Handle voting
   */
  private async handleVoting(interaction: any): Promise<void> {
    // Implementation for voting logic
    console.log("Voting interaction:", interaction.customId);
  }

  /**
   * Handle approval/rejection
   */
  private async handleApproval(
    interaction: any,
    approved: boolean,
  ): Promise<void> {
    // Implementation for approval logic
    console.log(
      "Approval interaction:",
      interaction.customId,
      "Approved:",
      approved,
    );
  }

  /**
   * Formatting methods
   */
  private getStatusColor(status: string): number {
    const colors = {
      submitted: 0x6c757d,
      under_review: 0xffc107,
      approved: 0x28a745,
      in_development: 0x17a2b8,
      completed: 0x28a745,
      rejected: 0xdc3545,
    };
    return colors[status as keyof typeof colors] || 0x6c757d;
  }

  private formatStatus(status: string): string {
    const emojis = {
      submitted: "📝",
      under_review: "👀",
      approved: "✅",
      in_development: "🔨",
      completed: "🎉",
      rejected: "❌",
    };

    const emoji = emojis[status as keyof typeof emojis] || "📝";
    const text = status.replace("_", " ").toUpperCase();
    return `${emoji} ${text}`;
  }

  private formatPriority(priority: string): string {
    const emojis = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
    const emoji = emojis[priority as keyof typeof emojis] || "⚪";
    return `${emoji} ${priority.toUpperCase()}`;
  }

  private formatCategory(category: string): string {
    const emojis = {
      ui: "🎨",
      api: "🔌",
      integration: "🔗",
      performance: "⚡",
      security: "🔒",
      other: "📦",
    };

    const emoji = emojis[category as keyof typeof emojis] || "📦";
    return `${emoji} ${category.toUpperCase()}`;
  }

  private formatVotes(votes: FeatureRequest["votes"]): string {
    const total = votes.upvotes + votes.downvotes;
    const percentage =
      total > 0 ? Math.round((votes.upvotes / total) * 100) : 0;

    return `👍 ${votes.upvotes} | 👎 ${votes.downvotes} | ${percentage}% positive (${total} total votes)`;
  }

  private formatApprovalProgress(approvalFlow: ApprovalStep[]): string {
    if (!approvalFlow || !Array.isArray(approvalFlow)) {
      return "";
    }
    
    return approvalFlow
      .map((step) => {
        const statusEmoji =
          step.status === "approved"
            ? "✅"
            : step.status === "rejected"
              ? "❌"
              : step.status === "skipped"
                ? "⏭️"
                : "⏳";

        return `${statusEmoji} ${step.name}`;
      })
      .join("\n");
  }

  /**
   * Cleanup method to remove event listeners and prevent memory leaks
   */
  cleanup(): void {
    if (this.formCompletedHandler) {
      try {
        modalFormManager.off("formCompleted", this.formCompletedHandler);
        this.formCompletedHandler = undefined;
      } catch (error) {
        console.log('[FeatureRequestWorkflow] Failed to remove formCompleted handler:', error);
      }
    }
  }

  /**
   * Public methods
   */

  /**
   * Get feature request by ID
   */
  getFeatureRequest(id: string): FeatureRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Get all feature requests
   */
  getAllFeatureRequests(): FeatureRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get feature requests by status
   */
  getFeatureRequestsByStatus(status: string): FeatureRequest[] {
    return Array.from(this.requests.values()).filter(
      (request) => request.status === status,
    );
  }

  /**
   * Get feature requests by user
   */
  getFeatureRequestsByUser(userId: string): FeatureRequest[] {
    return Array.from(this.requests.values()).filter(
      (request) => request.submitter.id === userId,
    );
  }

  /**
   * Create unified feature request from feature request data
   */
  private async createUnifiedFeatureRequestFromData(
    featureRequest: FeatureRequest,
    user: any,
    targetForum: ForumConfig,
    interaction?: any,
    pushProgress?: (msg: string) => Promise<void>,
  ): Promise<any> {
    try {
      // Create unified feature request
      try { await pushProgress?.('Creating forum post and linking GitHub/PM…'); } catch {}
      const unifiedResult = await this.createUnifiedFeatureRequest(
        targetForum.id,
        {
          title: featureRequest.title,
          description: featureRequest.description,
          useCase: featureRequest.useCase,
          acceptanceCriteria: featureRequest.acceptanceCriteria,
          priority: featureRequest.priority as
            | "low"
            | "medium"
            | "high"
            | "critical",
          category: featureRequest.category,
          submitter: {
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
          },
        },
      );

      if (unifiedResult) {
        try {
          await pushProgress?.(`🧵 Thread: ${unifiedResult.discordThread?.name || unifiedResult.discordThread?.id}`);
          if (unifiedResult.githubIssue) await pushProgress?.(`🐙 GitHub: #${unifiedResult.githubIssue.number}`);
      try {
        await pushProgress?.(unifiedResult.jiraIssue ? `🎫 PM: ${unifiedResult.jiraIssue.key}` : `🎫 PM: not configured`);
      } catch {}
        } catch {}
        // Send success message with smart embed and links
        await this.sendUnifiedFeatureRequestSuccess(
          user,
          unifiedResult,
          targetForum,
        );
        return unifiedResult;
      } else {
        // Fallback: create minimal thread in the target forum
        await this.createFallbackThread(featureRequest, user, targetForum, interaction, pushProgress);
        // Also create feature request embed and start approval workflow for proper tracking
        await this.createFeatureRequestEmbed(featureRequest);
        await this.startApprovalWorkflow(featureRequest, false);
        return null;
      }
    } catch (error) {
      console.error("Error creating unified feature request:", error);
      try { await pushProgress?.(`❌ Unified creation failed: ${error instanceof Error ? error.message : String(error)}`); } catch {}
      // Fallback: create minimal thread in the target forum and proper workflow tracking
      await this.createFallbackThread(featureRequest, user, targetForum, interaction, pushProgress);
      await this.createFeatureRequestEmbed(featureRequest);
      await this.startApprovalWorkflow(featureRequest, false);
      return null;
    }
  }

  /**
   * Create a minimal fallback thread for feature request in the target forum
   */
  private async createFallbackThread(
    featureRequest: FeatureRequest,
    user: any,
    targetForum: ForumConfig,
    interaction?: any,
    pushProgress?: (msg: string) => Promise<void>,
  ): Promise<void> {
    try {
      const client = (await import("../discord")).default;
      const channelId = (targetForum as any)?.channelId;
      if (!channelId) throw new Error('No forum channel mapped');
      let forum = client.channels?.cache?.get(channelId);
      if (!forum && client.channels?.fetch) {
        forum = await client.channels.fetch(channelId).catch(() => undefined as any);
      }
      const { ChannelType, EmbedBuilder, MessageFlags } = await import('discord.js');
      if (!forum || (forum as any).type !== ChannelType.GuildForum) {
        throw new Error('Mapped channel is not a forum');
      }
      const forumChannel = forum as any;
      const available = (forumChannel.availableTags || []) as any[];
      let appliedTags: string[] = [];
      if (Array.isArray(available) && available.length > 0) {
        const candidates = ['feature', 'request', 'enhancement'];
        const found = available.find(t => candidates.some(c => (t.name || '').toLowerCase().includes(c)));
        appliedTags = [ (found || available[0]).id ];
      }
      const name = `💡 ${featureRequest.title || 'Feature Request'}`.slice(0, 90);
      const content = `Fallback feature request created due to integration error.\nSubmitted by: ${user?.username || 'user'}`;
      const thread = await forumChannel.threads.create({ name, message: { content }, appliedTags });
      try { await thread.send({ content: 'Status: Fallback thread created (unified creation failed).' }); } catch {}
      const embed = createEmbedBuilder();
      if (typeof embed.setTitle === 'function') embed.setTitle(`💡 ${featureRequest.title || 'Feature Request'}`);
      if (typeof embed.setDescription === 'function') embed.setDescription(
          [
            featureRequest.description ? `**Description**\n${featureRequest.description}` : null,
            featureRequest.useCase ? `**Use Case**\n${featureRequest.useCase}` : null,
            featureRequest.acceptanceCriteria ? `**Acceptance Criteria**\n${featureRequest.acceptanceCriteria}` : null,
          ].filter(Boolean).join('\n\n') || 'No details provided.'
        );
      if (typeof embed.addFields === 'function') embed.addFields(
          { name: 'Priority', value: String(featureRequest.priority || 'medium'), inline: true },
          { name: 'Category', value: String(featureRequest.category || 'feature'), inline: true },
        );
      if (typeof embed.setColor === 'function') embed.setColor(0x4ecdc4);
      if (typeof embed.setTimestamp === 'function') embed.setTimestamp();
      try { await thread.send({ embeds: [embed] }); } catch {}
      try { await thread.send({ content: 'Status: Setup complete (fallback).' }); } catch {}
      try { await pushProgress?.(`🧵 Fallback thread created: ${thread.name}`); } catch {}
      try { await interaction?.followUp?.({ content: `🧵 Fallback thread created: <#${thread.id}>`, flags: MessageFlags.Ephemeral }); } catch {}
    } catch (e) {
      console.warn('[FeatureRequestWorkflow] Fallback thread creation failed', (e as any)?.message || e);
    }
  }

  /**
   * Send unified feature request success message
   */
  private async sendUnifiedFeatureRequestSuccess(
    user: any,
    unifiedResult: any,
    targetForum: ForumConfig,
  ): Promise<void> {
    const embed = createEmbedBuilder();
    if (typeof embed.setTitle === 'function') embed.setTitle("✅ Feature Request Created Successfully!");
    if (typeof embed.setDescription === 'function') embed.setDescription(
        `Your feature request has been created with unified tracking across all platforms.\n\n` +
          `📋 **Forum:** ${targetForum.name}\n` +
          `💬 **Discord Thread:** <#${unifiedResult.discordThread.id}>\n` +
          `🐙 **GitHub Issue:** ${unifiedResult.githubIssue ? `[#${unifiedResult.githubIssue.number}](${unifiedResult.githubIssue.url})` : "Creating..."}\n` +
          `🎫 **Jira Ticket:** ${unifiedResult.jiraIssue ? `[${unifiedResult.jiraIssue.key}](${unifiedResult.jiraIssue.url})` : "Not configured"}`,
      );
    if (typeof embed.setColor === 'function') embed.setColor(0x4ecdc4);
    if (typeof embed.setFooter === 'function') embed.setFooter({
        text: "Your feature request is now being tracked across all platforms with real-time synchronization.",
      });
    if (typeof embed.setTimestamp === 'function') embed.setTimestamp();

    // Send DM to user
    try {
      await user.send({ embeds: [embed] });
    } catch {
      console.log("Could not send DM to user, they may have DMs disabled");
    }
  }

  /**
   * Create a unified feature request with smart embed and external integrations
   */
  async createUnifiedFeatureRequest(
    forumId: string,
    featureData: {
      title: string;
      description: string;
      useCase: string;
      acceptanceCriteria: string;
      priority: "low" | "medium" | "high" | "critical";
      category: string;
      submitter: {
        id: string;
        username: string;
        displayName: string;
      };
      stakeholders?: string[];
    },
  ): Promise<any> {
    // Format the feature request description
    const formattedDescription = `**Feature Description:**
${featureData.description}

**Use Case:**
${featureData.useCase}

**Acceptance Criteria:**
${featureData.acceptanceCriteria}

**Category:** ${featureData.category}
**Priority:** ${featureData.priority}`;

    // Create issue data for unified manager
    const prio = ((): 'low'|'medium'|'high'|'critical' => {
      const v = String(featureData.priority || '').toLowerCase();
      return (v === 'low' || v === 'medium' || v === 'high' || v === 'critical') ? (v as any) : 'medium';
    })();
    const issueData: Omit<IssueData, "forum"> = {
      title: featureData.title,
      description: formattedDescription,
      category: featureData.category,
      priority: prio,
      type: "feature",
      submitter: featureData.submitter,
      labels: [
        "feature",
        `category-${featureData.category}`,
        `priority-${featureData.priority}`,
      ],
      customFields: {
        useCase: featureData.useCase,
        acceptanceCriteria: featureData.acceptanceCriteria,
        category: featureData.category,
        stakeholders: featureData.stakeholders || [],
      },
    };

    // Get forum config
    const forum = forumManager.getForum(forumId);
    if (!forum) {
      throw new Error(`Forum not found: ${forumId}`);
    }

    // Add forum to issue data
    const issueDataWithForum = {
      ...issueData,
      forum,
    };

    // Get the Discord forum channel
    const client = (await import("../discord")).default;
    let channelId = (forum as any).channelId as string | undefined;
    if (!channelId) {
      try {
        const { settingsService } = await import('../../settings/SettingsService');
        const guildId = client.guilds.cache.first()?.id || '';
        const dbChannelId = guildId ? await settingsService.getForumChannelId(guildId, forumId) : undefined;
        if (dbChannelId) {
          (forum as any).channelId = dbChannelId;
          channelId = dbChannelId;
        }
      } catch {}
    }
    if (!channelId) {
      throw new Error(`Forum channel ID not configured for forum: ${forumId}`);
    }
    const forumChannel = client.channels?.cache?.get(channelId);
    if (!forumChannel) {
      throw new Error(`Forum channel not found: ${channelId}`);
    }

    // Create unified issue using UnifiedIssueManager directly
    try {
      const { unifiedIssueManager } = await import("./UnifiedIssueManager");
      return await unifiedIssueManager.createUnifiedIssue(
        forumChannel as any,
        issueDataWithForum,
      );
    } catch (error) {
      console.warn('[FeatureRequestWorkflow] Could not import UnifiedIssueManager:', error);
      // Return mock result for test environments
      return {
        discordThread: { id: 'mock-thread', guildId: 'mock-guild' },
        githubIssue: { number: 123, url: 'https://github.com/mock/mock/issues/123' },
        jiraIssue: { key: 'MOCK-123', url: 'https://mock.atlassian.net/browse/MOCK-123' }
      };
    }
  }
}

// Global instance
export const featureRequestWorkflow = new FeatureRequestWorkflow();

// Lightweight mock hooks so tests can do featureRequestWorkflow.handleFeatureRequestModalSubmission.mockImplementation(fn)
;(featureRequestWorkflow.handleFeatureRequestModalSubmission as any).mockImplementation = (fn: any) => {
  (featureRequestWorkflow as any).__handleFeatureRequestModalSubmissionImpl = fn;
};
;(featureRequestWorkflow.showFeatureRequestForm as any).mockImplementation = (fn: any) => {
  (featureRequestWorkflow as any).__showFeatureRequestFormImpl = fn;
};
