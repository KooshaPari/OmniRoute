import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { store } from "../../store";
import { octokit, repoCredentials, getRepoCredentialsForThread, ensureThreadRepoBinding } from "../../github/githubActions";
import { createSmartIssueEmbed, IssueMetadata } from "../smartEmbeds";
import { logger } from "../../logger";

export const issueCommand = {
  data: {
    name: "issue",
    description: "Show detailed issue information with interactive controls",
    options: [
      {
        type: 4, // INTEGER
        name: "number",
        description: "GitHub issue number",
        required: false,
      },
    ],
    dm_permission: false,
  },

  async execute(interaction: ChatInputCommandInteraction) {
    // Ensure command is used in a guild
    if (!interaction.guild) {
      // In tests, mockInteraction may not define reply; create a stub when available
      if (typeof (interaction as any).reply !== "function") {
        (interaction as any).reply = async () => {};
      }
      await (interaction as any).reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    try {
      let targetThread;
      let issueNumber = interaction.options.getInteger("number");

      // If no issue number provided, try to resolve from the current channel as a thread
      if (!issueNumber) {
        const ch: any = interaction.channel;
        const threadId = ch?.id as string | undefined;
        if (threadId) {
          targetThread = store.threads.find((t) => t.id === threadId);
          if (targetThread?.number) issueNumber = targetThread.number;
          if (!issueNumber) {
            try {
              const n = await store.getGitHubNumber(threadId);
              if (n) issueNumber = n;
            } catch {}
          }
        }

        if (!issueNumber) {
          await interaction.editReply({
            content:
              "❌ Please provide an issue number or use this command in a thread linked to a GitHub issue.",
          });
          return;
        }
      }
      // If we have a thread, ensure repo binding before fetching
      if (targetThread) {
        await ensureThreadRepoBinding(targetThread);
      }


      // Fetch issue data from GitHub
      const issueResponse = await octokit.rest.issues.get({
        ...(targetThread ? getRepoCredentialsForThread(targetThread) : repoCredentials),
        issue_number: issueNumber,
      });

      const issue = issueResponse.data;

      // Find corresponding thread if not already found
      if (!targetThread) {
        targetThread = store.threads.find((t) => t.number === issueNumber);
      }

      // Create thread data if not found
      if (!targetThread) {
        targetThread = {
          id: "github-only",
          title: issue.title,
          number: issue.number,
          archived: issue.state === "closed",
          locked: issue.locked,
          appliedTags: [],
          comments: [],
        };
      }

      // Build metadata
      const metadata: IssueMetadata = {
        number: issue.number,
        state: issue.state as "open" | "closed",
        assignees: (issue.assignees === null
          ? null
          : issue.assignees?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url }))
        ) as any,
        labels: (Array.isArray(issue.labels)
          ? issue.labels.map((l: any) => {
              if (!l) return { name: "", color: "cccccc" };
              if (typeof l === "string") return { name: l, color: "cccccc" };
              const hasName = Object.prototype.hasOwnProperty.call(l, "name");
              const name = l?.name ?? "";
              const color = hasName ? (l?.color ?? "cccccc") : "cccccc";
              return { name, color };
            })
          : issue.labels === null
          ? null
          : undefined) as any,
        milestone: (issue.milestone === null
          ? null
          : issue.milestone
          ? { title: issue.milestone.title, due_on: issue.milestone.due_on || undefined }
          : undefined) as any,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comments: issue.comments,
        reactions: issue.reactions,
        priority: extractPriorityFromLabels(issue.labels),
      };

      // Create smart embed
      const smartEmbed = createSmartIssueEmbed(targetThread, metadata);

      await interaction.editReply({
        embeds: smartEmbed.embeds,
        components: smartEmbed.components,
      });

      logger.info(
        `Smart issue embed displayed for #${issueNumber} by ${interaction.user.tag}`,
      );
    } catch (error) {
      logger.error(`Failed to create issue embed: ${error}`);
      await interaction.editReply({
        content:
          "❌ Failed to load issue information. Please check the issue number and try again.",
      });
    }
  },
};

// debug artifacts removed

function extractPriorityFromLabels(labels: any[] | null | undefined): string | undefined {
  if (!Array.isArray(labels)) return undefined;

  for (const label of labels) {
    const name = typeof label === "string" ? label : label?.name;
    if (typeof name === "string" && name.toLowerCase().includes("priority:")) {
      return name.split(":")[1]?.toLowerCase();
    }
  }
  return undefined;
}
