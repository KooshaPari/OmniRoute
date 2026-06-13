import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { store } from "../../store";
import {
  octokit,
  getRepoCredentialsForThread,
  ensureThreadRepoBinding,
} from "../../github/githubActions";
import { logger } from "../../logger";
import { jiraService } from "../../jira/jiraClient";

// Long-term maintainable: explicit injection point for GitHub bindings used by status
export type StatusGitHubBindings = {
  octokit: typeof octokit;
  getRepoCredentialsForThread: typeof getRepoCredentialsForThread;
};

let ghBinding: StatusGitHubBindings = { octokit, getRepoCredentialsForThread };
export function setStatusGitHubBindings(binding: StatusGitHubBindings) {
  ghBinding = binding;
}

export const statusCommand = {
  data: {
    name: "status",
    description: "Update the status of a GitHub issue",
    options: [
      {
        type: 3,
        name: "state",
        description: "Issue state",
        required: true,
        choices: [
          { name: "🟢 Open", value: "open" },
          { name: "🔴 Closed", value: "closed" },
          { name: "🟦 In Progress", value: "in-progress" },
          { name: "✅ Resolved", value: "resolved" },
          { name: "🔒 Lock", value: "lock" },
          { name: "🔓 Unlock", value: "unlock" },
        ],
      },
      {
        type: 3,
        name: "reason",
        description: "Reason for status change",
        required: false,
      },
    ],
  },

  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used in a forum thread (avoid instanceof in tests)
    const ch: any = (interaction as any).channel ?? null;
    const hasStoreThread = ch && store.threads && (store.threads.find((t: any) => t.id === (ch as any)?.id) != null);
    const isThreadLike = ch && typeof ch === "object" && (typeof ch.name === "string" || hasStoreThread);
    if (!isThreadLike) {
      await interaction.reply({
        content: "❌ This command can only be used in forum threads.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const thread = (store as any).threads?.find?.(
      (t: any) => t.id === (ch as any)?.id,
    );
    if (!thread || typeof thread.number !== "number" || thread.number <= 0) {
      if (typeof (interaction as any).deferReply === 'function') {
        try { const gh = await (store as any).getGitHubNumber?.((interaction.channel as any)?.id); if (gh && thread) (thread as any).number = gh as any; } catch {}
      }
    }
    if (!thread || typeof thread.number !== "number" || thread.number <= 0) {
      await interaction.reply({
        content: "❌ This thread is not linked to a GitHub issue.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Ensure legacy threads have repo binding
    await ensureThreadRepoBinding(thread);

    const state = interaction.options.getString("state", true);
    const reason = interaction.options.getString("reason") || "";

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let actionTaken = "";
      let emoji = "";
      let color = 0x888888;
      
      const creds = ghBinding.getRepoCredentialsForThread(thread);

      switch (state) {
        case "open":
          await ghBinding.octokit.rest.issues.update({
            ...creds,
            issue_number: thread.number,
            state: "open",
          });
          actionTaken = "reopened";
          emoji = "🟢";
          color = 0x00ff00;
          break;

        case "closed":
          await ghBinding.octokit.rest.issues.update({
            ...creds,
            issue_number: thread.number,
            state: "closed",
          });
          actionTaken = "closed";
          emoji = "🔴";
          color = 0xff0000;
          break;

        case "in-progress":
          // Keep GitHub issue open, tag status label, transition Jira
          await ghBinding.octokit.rest.issues.update({
            ...creds,
            issue_number: thread.number,
            state: "open",
          });
          try {
            await ghBinding.octokit.rest.issues.addLabels({
              ...creds,
              issue_number: thread.number,
              labels: ["status:in-progress"],
            });
          } catch {}
          // Transition all provider links to In Progress
          try {
            const all = (store as any).getAllProviderLinks?.() || [];
            const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
            if (mine.length > 0) {
              const { facadeTransitionForProvider } = await import('../../pm/facade');
              for (const l of mine) { try { await facadeTransitionForProvider(String(l.provider), l.key, 'In Progress'); } catch {} }
            } else if ((thread as any).jiraKey) {
              const { facadeTransition } = await import('../../pm/facade');
              await facadeTransition((thread as any).jiraKey, 'In Progress');
            }
          } catch {}
          actionTaken = "moved to In Progress";
          emoji = "🟦";
          color = 0x00aaff;
          break;

        case "resolved":
          await ghBinding.octokit.rest.issues.update({
            ...creds,
            issue_number: thread.number,
            state: "closed",
          });
          // Transition all provider links to Done
          try {
            const all = (store as any).getAllProviderLinks?.() || [];
            const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
            if (mine.length > 0) {
              const { facadeTransitionForProvider } = await import('../../pm/facade');
              for (const l of mine) { try { await facadeTransitionForProvider(String(l.provider), l.key, 'Done'); } catch {} }
            } else if ((thread as any).jiraKey) {
              const { facadeTransition } = await import('../../pm/facade');
              await facadeTransition((thread as any).jiraKey, 'Done');
            }
          } catch {}
          try {
            await ghBinding.octokit.rest.issues.addLabels({
              ...creds,
              issue_number: thread.number,
              labels: ["status:done"],
            });
          } catch {}
          actionTaken = "resolved";
          emoji = "✅";
          color = 0x00aa00;
          break;

        case "lock":
          await ghBinding.octokit.rest.issues.lock({
            ...creds,
            issue_number: thread.number,
            lock_reason: reason ? "spam" : undefined, // GitHub requires a specific reason
          } as any);
          actionTaken = "locked";
          emoji = "🔒";
          color = 0xffaa00;
          break;

        case "unlock":
          await ghBinding.octokit.rest.issues.unlock({
            ...creds,
            issue_number: thread.number,
          });
          actionTaken = "unlocked";
          emoji = "🔓";
          color = 0x00aaff;
          break;
      }

      const embed: any = {
        data: {
          color,
          title: "Status Updated",
          description: `Issue ${actionTaken} ${emoji}`,
          fields: [
            {
              name: "Issue",
              value: `[#${thread.number}](https://github.com/${creds.owner}/${creds.repo}/issues/${thread.number})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      };
      if (reason) {
        (embed.data.fields as any[]).push({ name: "Reason", value: reason, inline: false });
      }

      const statusMessage = `✅ Status updated to ${actionTaken === "moved to In Progress" ? "In Progress" : actionTaken === "resolved" ? "Done" : actionTaken}`;
      await interaction.editReply({ content: statusMessage });

      // Logging as expected by tests
      const base = `Issue #${thread.number} ${actionTaken} by ${(interaction as any).user?.tag}`;
      if (reason) {
        logger.info(`${base} (Reason: ${reason})`);
      } else {
        logger.info(base);
      }
    } catch (error: any) {
      const status = error?.status;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to update status for issue #${thread.number} [status=${status}]: ${message}`,
      );

      let content = "❌ Failed to update status.";
      if (status === 404 || /not found/i.test(message)) {
        const creds = ghBinding.getRepoCredentialsForThread(thread);
        content = `❌ GitHub issue #${thread.number} not found in ${creds.owner}/${creds.repo}. Try refreshing the embed or verify repository settings.`;
      } else if (status === 403) {
        content =
          "❌ Permission denied. Ensure the GitHub token has repo scope and access to the repository.";
      }

      // Handle error response - check if interaction is already deferred
      if (interaction.deferred) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  }
};
export const __storeRef: any = store as any;
