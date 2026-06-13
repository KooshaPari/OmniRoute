/**
 * Integration example showing how to use the Smart Embed Framework
 * with the existing Discord bot functionality
 */

import { ButtonInteraction, MessageFlags } from "discord.js";
import {
  framework,
  createIssueCard,
  createDashboardCard,
  registerQuickAction,
  actionButtonManager,
  modalFormManager,
  stateManager,
} from "../index";
import { Thread, IssueMetadata } from "../../../interfaces";
import { octokit, repoCredentials } from "../../../github/githubActions";
// Jira integration is not used in this example file

/**
 * Initialize the framework integration
 */
export async function initializeFramework(): Promise<void> {
  console.log("🔧 Initializing Smart Embed Framework integration...");

  // Initialize the framework
  await framework.initialize({
    theme: "default",
    persistence: true,
    autoCleanup: true,
    cleanupInterval: 60 * 60 * 1000, // 1 hour
  });

  // Register enhanced actions
  registerEnhancedActions();

  // Register enhanced forms
  registerEnhancedForms();

  // Setup event handlers
  setupEventHandlers();

  console.log("✅ Smart Embed Framework integration initialized");
}

/**
 * Register enhanced actions using the new framework
 */
function registerEnhancedActions(): void {
  // Enhanced issue assignment
  registerQuickAction(
    "assign_enhanced",
    "Assign Issue",
    async (interaction: ButtonInteraction) => {
      const threadId = interaction.customId.split("_").pop();
      const thread = getThreadById(threadId!);

      if (!thread) {
        await interaction.reply({
          content: "❌ Thread not found.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Show enhanced assignment modal
      await modalFormManager.startForm(interaction, "assign-issue-form", {
        threadId: thread.id,
        currentAssignee: thread.assignee || "None",
      });
    },
    {
      emoji: "👤",
      permissions: ["ManageMessages"],
      cooldown: 5,
    },
  );

  // Enhanced priority setting
  registerQuickAction(
    "priority_enhanced",
    "Set Priority",
    async (interaction: ButtonInteraction) => {
      const threadId = interaction.customId.split("_").pop();

      // Create priority selection embed
      const priorityCard = createIssueCard({
        id: `priority-${threadId}`,
        title: "Set Issue Priority",
        description: "Select the priority level for this issue",
        priority: "medium", // current priority
      });

      if (priorityCard) {
        // Add priority selection buttons
        (await priorityCard)?.addSelectMenu(
          `priority_select_${threadId}`,
          "Select Priority Level",
          [
            {
              label: "🔴 Critical",
              value: "critical",
              description: "Urgent, blocks other work",
            },
            {
              label: "🟠 High",
              value: "high",
              description: "Important, should be done soon",
            },
            {
              label: "🟡 Medium",
              value: "medium",
              description: "Normal priority",
            },
            { label: "🟢 Low", value: "low", description: "Nice to have" },
          ],
        );

        const { embeds, components } = (await priorityCard)?.build() || {
          embeds: [],
          components: [],
        };
        await interaction.reply({
          embeds,
          components,
          flags: MessageFlags.Ephemeral,
        });
      }
    },
    {
      emoji: "⚡",
      permissions: ["ManageMessages"],
      cooldown: 3,
    },
  );

  // Enhanced comment system
  registerQuickAction(
    "comment_enhanced",
    "Add Comment",
    async (interaction: ButtonInteraction) => {
      const threadId = interaction.customId.split("_").pop();

      await modalFormManager.startForm(interaction, "add-comment-form", {
        threadId,
      });
    },
    {
      emoji: "💬",
      cooldown: 10,
    },
  );

  // Dashboard refresh action
  registerQuickAction(
    "refresh_dashboard",
    "Refresh Dashboard",
    async (interaction: ButtonInteraction) => {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        // Fetch latest data
        const dashboardData = await fetchDashboardData();

        // Update dashboard embed
        const dashboardCard = createDashboardCard({
          id: "main-dashboard",
          title: "📊 Project Dashboard",
          description: "Real-time project metrics and analytics",
          metrics: dashboardData.metrics,
          progress: dashboardData.progress,
          refreshInterval: 300, // 5 minutes
        });

        if (dashboardCard) {
          const { embeds, components } = (await dashboardCard)?.build() || {
            embeds: [],
            components: [],
          };
          await interaction.editReply({
            content: "✅ Dashboard refreshed!",
            embeds,
            components,
          });
        }
      } catch {
        await interaction.editReply({
          content: "❌ Failed to refresh dashboard.",
        });
      }
    },
    {
      emoji: "🔄",
      cooldown: 30,
    },
  );
}

/**
 * Register enhanced forms using the new framework
 */
function registerEnhancedForms(): void {
  // Enhanced bug report form
  modalFormManager.registerTemplate({
    id: "enhanced-bug-report",
    name: "Enhanced Bug Report",
    description: "Comprehensive bug reporting with validation",
    category: "issue-management",
    tags: ["bug", "report", "issue"],
    steps: [
      {
        id: "basic-info",
        title: "Bug Report - Basic Information",
        description: "Provide basic information about the bug",
        fields: [
          {
            id: "title",
            label: "Bug Title",
            type: "text",
            style: 1, // Short
            placeholder: "Brief description of the bug",
            required: true,
            minLength: 10,
            maxLength: 100,
          },
          {
            id: "severity",
            label: "Severity Level",
            type: "text",
            style: 1, // Short
            placeholder: "Critical, High, Medium, Low",
            required: true,
            validation: {
              pattern: /^(critical|high|medium|low)$/i,
            },
          },
        ],
      },
      {
        id: "details",
        title: "Bug Report - Detailed Information",
        description: "Provide detailed information about the bug",
        fields: [
          {
            id: "description",
            label: "Detailed Description",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "Detailed description of the bug and its impact",
            required: true,
            minLength: 50,
            maxLength: 2000,
          },
          {
            id: "steps",
            label: "Steps to Reproduce",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "1. Go to...\n2. Click on...\n3. See error",
            required: true,
            maxLength: 1000,
          },
          {
            id: "expected",
            label: "Expected Behavior",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "What should happen instead?",
            required: false,
            maxLength: 500,
          },
        ],
      },
      {
        id: "environment",
        title: "Bug Report - Environment Details",
        description: "Provide environment and system information",
        fields: [
          {
            id: "environment",
            label: "Environment Details",
            type: "text",
            style: 1, // Short
            placeholder: "Browser, OS, version, etc.",
            required: false,
            maxLength: 200,
          },
          {
            id: "additional",
            label: "Additional Information",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "Any additional context, logs, or screenshots",
            required: false,
            maxLength: 1000,
          },
        ],
      },
    ],
  });

  // Issue assignment form
  modalFormManager.registerTemplate({
    id: "assign-issue-form",
    name: "Assign Issue",
    description: "Assign issue to team member",
    category: "issue-management",
    steps: [
      {
        id: "assignment",
        title: "Issue Assignment",
        fields: [
          {
            id: "assignee",
            label: "Assignee Username",
            type: "text",
            style: 1, // Short
            placeholder: "GitHub username or @mention",
            required: true,
            validation: {
              pattern: /^@?[a-zA-Z0-9_-]+$/,
            },
          },
          {
            id: "note",
            label: "Assignment Note",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "Optional note about the assignment",
            required: false,
            maxLength: 500,
          },
        ],
      },
    ],
  });

  // Comment form
  modalFormManager.registerTemplate({
    id: "add-comment-form",
    name: "Add Comment",
    description: "Add a comment to the issue",
    category: "communication",
    steps: [
      {
        id: "comment",
        title: "Add Comment",
        fields: [
          {
            id: "comment",
            label: "Comment",
            type: "textarea",
            style: 2, // Paragraph
            placeholder: "Enter your comment...",
            required: true,
            minLength: 10,
            maxLength: 2000,
          },
          {
            id: "type",
            label: "Comment Type",
            type: "text",
            style: 1, // Short
            placeholder: "general, question, suggestion, solution",
            required: false,
            validation: {
              pattern: /^(general|question|suggestion|solution)$/i,
            },
          },
        ],
      },
    ],
  });
}

/**
 * Setup event handlers for framework integration
 */
function setupEventHandlers(): void {
  // Handle form completions
  modalFormManager.on("formCompleted", async (data) => {
    const { template, submission, user } = data;

    switch (template.id) {
      case "enhanced-bug-report":
        await handleBugReportSubmission(submission, user);
        break;
      case "assign-issue-form":
        await handleIssueAssignment(submission, user);
        break;
      case "add-comment-form":
        await handleCommentSubmission(submission, user);
        break;
    }
  });

  // Handle state updates for real-time embeds
  stateManager.on("discordUpdateRequired", async (data) => {
    // This would be handled by the main Discord client
    // Update the actual Discord message with new embed data
    console.log("Discord update required for message:", data.messageId);
  });

  // Handle action confirmations
  actionButtonManager.on("actionConfirmed", async (data) => {
    const { action } = data;

    // Handle confirmed actions (like closing issues, deleting comments, etc.)
    console.log("Action confirmed:", action.id);
  });
}

/**
 * Create an enhanced issue embed using the new framework
 */
export async function createEnhancedIssueEmbed(
  thread: Thread,
  metadata: IssueMetadata,
): Promise<{ embeds: any[]; components: any[] }> {
  const issueCard = createIssueCard({
    id: `issue-${thread.id}`,
    title: thread.title,
    description: metadata.description || "No description provided",
    status: metadata.state || "open",
    priority: metadata.priority || "medium",
    assignee: metadata.assignees?.[0]?.login || "Unassigned",
  });

  if (!issueCard) {
    throw new Error("Failed to create issue card");
  }

  // Add real-time fields
  (await issueCard)?.addDynamicField({
    name: "📈 Activity",
    value: `💬 ${metadata.comments || 0} comments • 👍 ${metadata.reactions?.total_count || 0} reactions`,
    inline: true,
    dynamic: true,
    refreshCallback: async () => {
      // Fetch latest activity data
      const latestData = await fetchIssueActivity(thread.id);
      return `💬 ${latestData.comments} comments • 👍 ${latestData.reactions} reactions`;
    },
  });

  // Add metadata for state tracking
  (await issueCard)?.setMetadata("threadId", thread.id);
  (await issueCard)?.setMetadata("issueNumber", metadata.number);
  (await issueCard)?.setMetadata("lastSync", new Date().toISOString());

  // Register with state manager for real-time updates
  const state = (await issueCard)?.getState();
  if (state) {
    stateManager.registerState({
      ...state,
      channelId: thread.channelId || "",
      autoUpdate: true,
      updateInterval: 300, // 5 minutes
    });
  }

  return (await issueCard)?.build() || { embeds: [], components: [] };
}

/**
 * Helper functions
 */
async function fetchDashboardData(): Promise<any> {
  // Fetch real dashboard data from GitHub, Jira, etc.
  const issues = await octokit.rest.issues.listForRepo({
    ...repoCredentials,
    state: "all",
    per_page: 100,
  });

  const openIssues = issues.data.filter(
    (issue: any) => issue.state === "open",
  ).length;
  const closedIssues = issues.data.filter(
    (issue: any) => issue.state === "closed",
  ).length;
  const totalIssues = issues.data.length;

  return {
    metrics: {
      "Total Issues": totalIssues,
      "Open Issues": openIssues,
      "Closed Issues": closedIssues,
      "Completion Rate": `${Math.round((closedIssues / totalIssues) * 100)}%`,
    },
    progress: {
      current: closedIssues,
      total: totalIssues,
    },
  };
}

async function fetchIssueActivity(_threadId: string): Promise<any> {
  // Fetch latest activity for an issue
  return {
    comments: Math.floor(Math.random() * 20),
    reactions: Math.floor(Math.random() * 10),
  };
}

function getThreadById(_threadId: string): Thread | null {
  // This would fetch from your thread store
  return null; // Placeholder
}

async function handleBugReportSubmission(
  submission: any,
  _user: any,
): Promise<void> {
  console.log("Processing bug report submission:", submission.data);
  // Create GitHub issue, Discord thread, etc.
}

async function handleIssueAssignment(
  submission: any,
  _user: any,
): Promise<void> {
  console.log("Processing issue assignment:", submission.data);
  // Update GitHub issue assignee, notify user, etc.
}

async function handleCommentSubmission(
  submission: any,
  _user: any,
): Promise<void> {
  console.log("Processing comment submission:", submission.data);
  // Add comment to GitHub issue, Discord thread, etc.
}
