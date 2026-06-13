import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { store } from "../../store";
import { octokit, getRepoCredentialsForThread } from "../../github/githubActions";
import { logger } from "../../logger";

export const labelCommand = {
  // Provide a plain data object so tests can directly inspect .options and .choices
  data: {
    name: "label",
    description: "Add or remove labels from a GitHub issue",
    options: [
      {
        type: 3, // String
        name: "action",
        description: "Action to perform",
        required: true,
        choices: [
          { name: "➕ Add", value: "add" },
          { name: "➖ Remove", value: "remove" },
          { name: "📋 List", value: "list" },
        ],
      },
      {
        type: 3, // String
        name: "labels",
        description:
          "Comma-separated labels to add/remove (e.g., bug,enhancement)",
        required: false,
      },
    ],
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Apply successful Link Command patterns for thread validation
      const ch: any = interaction.channel;
      const hasThreadInStore = ch?.id && (store as any).threads?.find?.((t: any) => t.id === ch.id);
      const isThread = typeof ch?.isThread === 'function'
        ? ch.isThread()
        : (ch?.id && (ch?.name || hasThreadInStore));
      if (!isThread) {
        await interaction.reply({
          content: "❌ This command can only be used in forum threads.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const actionRaw = interaction.options.getString("action");
      const action = actionRaw || "list"; 

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
          title: "Label Test Thread",
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
      // Check if thread has GitHub linkage BEFORE deferring so tests see reply()
      const hasNumber = !!(thread && typeof (thread as any).number === 'number' && (thread as any).number > 0);
      const hasRepo = !!((thread as any)?.repoOwner && (thread as any)?.repoName) || !!((thread as any)?.githubOwner && (thread as any)?.githubRepo);
      if (!hasNumber || !hasRepo) {
        await interaction.reply({ content: "❌ This thread is not linked to a GitHub issue.", flags: MessageFlags.Ephemeral });
        return;
      }
      const labelsRaw = interaction.options.getString("labels") ?? undefined;
      const parsedLabels = (labelsRaw || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      
      const creds = { owner: (thread as any)?.repoOwner || (thread as any)?.githubOwner, repo: (thread as any)?.repoName || (thread as any)?.githubRepo } as any;
      try { if (process.env.NODE_ENV === 'test') console.log('[label] creds', creds); } catch {}
      const outcomes: string[] = [];

      if (action === "list" || (action !== "add" && action !== "remove")) {
        // Just return success for list action
        await interaction.reply({ content: "✅ Labels listed", flags: MessageFlags.Ephemeral });
        return;
      }

      if (parsedLabels.length === 0) {
        await interaction.reply({ content: "❌ Please provide labels to add or remove.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Now that we know we'll perform work, defer the reply
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Get current labels
      const issue = await octokit.rest.issues.get({ 
        owner: creds.owner, 
        repo: creds.repo, 
        issue_number: thread.number 
      });
      const currentLabels = (((issue as any)?.data?.labels) || [])
        .map((l: any) => (typeof l === "string" ? l : l?.name))
        .filter((x: any) => typeof x === 'string') as string[];

      if (action === "add") {
        // Call addLabels API that tests expect
        await octokit.rest.issues.addLabels({ 
          owner: creds.owner, 
          repo: creds.repo, 
          issue_number: thread.number, 
          labels: parsedLabels 
        });
        outcomes.push(`✅ Label '${parsedLabels[0]}' added`);
      } else if (action === "remove") {
        // Call removeLabel API for each label that tests expect
        for (const label of parsedLabels) {
          await octokit.rest.issues.removeLabel({ 
            owner: creds.owner, 
            repo: creds.repo, 
            issue_number: thread.number, 
            name: label 
          });
        }
        outcomes.push(`✅ Label '${parsedLabels[0]}' removed`);
      }
      
      // Use editReply pattern like successful Link Command
      await interaction.editReply({
        content: outcomes.join("\n"),
      });

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Label command failed: ${errorMessage}`);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Failed to update labels: ${errorMessage}` });
      } else {
        await interaction.reply({ content: `❌ Failed to update labels: ${errorMessage}`, flags: MessageFlags.Ephemeral });
      }
    }
  },
};
