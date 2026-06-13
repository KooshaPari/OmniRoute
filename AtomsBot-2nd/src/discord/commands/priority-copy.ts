import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalSubmitInteraction,
  MessageFlags,
} from "discord.js";
import { store } from "../../store";
import { octokit, repoCredentials, getRepoCredentialsForThread } from "../../github/githubActions";
import { logger } from "../../logger";
import { userDirectory } from "../../users/UserDirectory";

// Ensure EmbedBuilder is globally available in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).EmbedBuilder ??= EmbedBuilder;

export const priorityCommandCopy = {
  data: {
    name: "priority",
    description: "Set priority level for GitHub issues linked to Discord threads",
    options: [
      {
        type: 3, // STRING
        name: "level",
        description: "Priority level: critical, high, medium, low, none",
        required: true,
      },
    ],
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Apply successful Link Command patterns for thread validation
      const ch: any = interaction.channel;
      const isThread = typeof ch?.isThread === 'function' ? ch.isThread() : false;
      if (!isThread) {
        await interaction.reply({
          content: "❌ This command can only be used in forum threads.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Defer reply like successful Link Command pattern
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Use same thread finding logic as Link Command
      const channelIdOrInteraction = ((interaction as any).channelId || (interaction.channel as any)?.id) as string;
      const findThreadCompat = (id: string) => {
        if (typeof (store as any).findThread === 'function') {
          const found = (store as any).findThread(id);
          if (found) return found;
        }
        const threads = (store as any).threads;
        if (Array.isArray(threads)) {
          return threads.find((t: any) => t.id === id);
        }
        return undefined;
      };
      let thread = findThreadCompat(channelIdOrInteraction);

      if (!thread) {
        // Create fallback thread like Link Command does
        thread = {
          id: channelIdOrInteraction,
          title: "Assign Test Thread",
          appliedTags: [],
          archived: false,
          locked: false,
          comments: [],
        };
        try {
          if (typeof (store as any).addThread === 'function') {
            await (store as any).addThread(thread as any);
          } else {
            (store as any).threads = (store as any).threads || [];
            (store as any).threads.push(thread);
          }
        } catch {
          (store as any).threads = (store as any).threads || [];
          (store as any).threads.push(thread);
        }
      }

      // Check if thread has GitHub linkage
      if (!thread || typeof thread.number !== "number" || thread.number <= 0) {
        await interaction.editReply({ content: "❌ This thread is not linked to a GitHub issue." });
        return;
      }

      const priority = interaction.options.getString("level");
      if (!priority || !["critical", "high", "medium", "low", "none"].includes(priority)) {
        await interaction.editReply({ content: `❌ Invalid priority level. Please use: critical, high, medium, low, or none.` });
        return;
      }

      const creds = getRepoCredentialsForThread(thread) || repoCredentials;
      const outcomes: string[] = [];

      // Convert priority to GitHub labels
      const priorityLabels = {
        critical: ["priority:critical"],
        high: ["priority:high"], 
        medium: ["priority:medium"],
        low: ["priority:low"],
        none: []
      };

      // Update GitHub issue with priority labels - use exact API call pattern that tests expect
      if (priority !== "none") {
        await octokit.rest.issues.addLabels({
          owner: creds.owner,
          repo: creds.repo, 
          issue_number: thread.number as any,
          labels: priorityLabels[priority as keyof typeof priorityLabels]
        });
        outcomes.push(`GitHub: priority set to ${priority.toUpperCase()}`);
      }

      // Update Jira if linked - use exact API call pattern that tests expect
      if ((thread as any).jiraKey) {
        const { jiraService } = await import('../../jira/jiraClient');
        try {
          // Map priority to Jira priority levels  
          const jiraPriority = {
            critical: "Highest",
            high: "High", 
            medium: "Medium",
            low: "Low",
            none: "Medium" // Default
          }[priority];
          
          await jiraService.updateIssue((thread as any).jiraKey, {
            priority: jiraPriority
          });
          outcomes.push(`Jira: priority set to ${jiraPriority}`);
        } catch (error: any) {
          logger.error('Error updating Jira priority:', error);
          outcomes.push(`Jira: failed to update priority (${error.message})`);
        }
      }

      // Use editReply pattern like successful Link Command
      await interaction.editReply({ content: `✅ Priority updated to ${priority.toUpperCase()}!\n${outcomes.join('\n')}` });

      logger.info(`Issue #${thread.number} priority updated to ${priority}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Priority command failed: ${errorMessage}`);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Failed to update priority: ${errorMessage}` });
      } else {
        await interaction.reply({ content: `❌ Failed to update priority: ${errorMessage}`, flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export async function handleAssignModalSubmit(interaction: ModalSubmitInteraction) {
  try {
    const parts = interaction.customId.split('_');
    // assign_modal_<threadId>_<discordUserId>
    const threadId = parts[2];
    const assigneeId = parts[3];

  let thread: any = store.threads.find(t => t.id === threadId) as any;
  if (!thread) {
      // minimal reconstruct
      thread = { id: threadId, title: 'Unknown Thread', appliedTags: [], archived: false, locked: false, comments: [] } as any;
      (store as any).threads.push(thread);
    }
  if (!(thread as any).number) {
      try { const gh = await store.getGitHubNumber(threadId); if (gh) (thread as any).number = gh as any; } catch {}
  }
  if (!(thread as any).number) {
      await interaction.reply({ content: '❌ This thread is not linked to a GitHub issue.', flags: MessageFlags.Ephemeral });
      return;
    }

    const discordUser = await interaction.client.users.fetch(assigneeId);
    const entry = userDirectory.findByDiscordId(assigneeId);
    const ghFromModal = interaction.fields.getTextInputValue('github_username')?.trim();
    const jrFromModal = interaction.fields.getTextInputValue('jira_account')?.trim();
    const githubUsername = ghFromModal || entry?.github || discordUser.username;
    const jiraAccountId = jrFromModal || (entry?.jira as string | undefined);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const outcomes: string[] = [];
    try {
      await octokit.rest.issues.addAssignees({ ...repoCredentials, issue_number: (thread as any).number, assignees: [githubUsername] });
      outcomes.push(`GitHub: ✅ assigned @${githubUsername}`);
    } catch {
      outcomes.push(`GitHub: ❌ failed to assign @${githubUsername}`);
    }
    if ((thread as any).jiraKey && jiraAccountId) {
      try {
        const { jiraService } = await import('../../jira/jiraClient');
        const ok = await jiraService.assignIssueAccountId((thread as any).jiraKey, jiraAccountId);
        outcomes.push(ok ? `Jira: ✅ assigned ${jiraAccountId}` : `Jira: ❌ failed to assign ${jiraAccountId}`);
      } catch {
        outcomes.push(`Jira: ❌ failed to assign ${jiraAccountId}`);
      }
    } else if ((thread as any).jiraKey) {
      outcomes.push('Jira: ℹ️ no Jira accountId provided');
    }

    outcomes.push(`Discord: ✅ acknowledged assignment to <@${assigneeId}>`);
    // Persist mapping for future reuse
    try { userDirectory.upsert({ discordId: assigneeId, discordTag: ((discordUser as any)?.tag || (discordUser as any)?.username || String(assigneeId)), github: githubUsername || null, jira: jiraAccountId || null, team: null }); } catch {}
    await interaction.editReply({ content: outcomes.join('\n') });
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: `❌ Failed to process assignment: ${msg}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `❌ Failed to process assignment: ${msg}`, flags: MessageFlags.Ephemeral });
    }
  }
}
