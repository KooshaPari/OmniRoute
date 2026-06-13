import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ThreadChannel,
  MessageFlags,
} from 'discord.js';
import { store } from '../../store-db';
import { octokit, getRepoCredentialsForThread } from '../../github/githubActions';
import { jiraService } from '../../jira/jiraClient';
import { logger } from '../../logger';

export const unassignCommand = {
  data: {
    name: 'unassign',
    description: 'Unassign a mapped user (GitHub + PM providers) from this thread',
    options: [
      {
        type: 6, // USER
        name: 'user',
        description: 'Discord user to unassign (defaults to you)',
        required: false,
      },
    ],
  },

  async execute(interaction: ChatInputCommandInteraction) {
    // Ensure in a thread with a linked issue
    if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
      await interaction.reply({ content: '❌ This command can only be used in forum threads.', flags: MessageFlags.Ephemeral });
      return;
    }

    let thread = store.threads.find(t => t.id === interaction.channel!.id);
    if (!thread) {
      // Attempt on-demand hydration from DB
      const ch = interaction.channel as ThreadChannel;
      thread = {
        id: ch.id,
        title: ch.name || 'Unknown Thread',
        appliedTags: (ch as any).appliedTags || [],
        archived: false,
        locked: false,
        comments: [],
      } as any;
      try { await store.addThread(thread as any, (ch as any).parentId); } catch {}
    }

    // Hydrate linked identifiers if missing
    if (!(thread as any).number) {
      try {
        const gh = await store.getGitHubNumber((thread as any).id);
        if (gh) (thread as any).number = gh;
      } catch {}
    }
    if (!(thread as any).jiraKey) {
      try {
        const jk = await store.getJiraKey((thread as any).id);
        if (jk) (thread as any).jiraKey = jk as any;
      } catch {}
    }

  if (!(thread as any).number) {
      await interaction.reply({ content: '❌ This thread is not linked to a GitHub issue.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordUser = interaction.options.getUser('user') || interaction.user;
    // Map Discord -> GitHub/PM identities
    const entry = (await import('../../users/UserDirectory')).userDirectory.findByDiscordId(discordUser.id);
    if (!entry || (!entry.github && !entry.jira)) {
      await interaction.editReply({ content: '❌ No linked GitHub/PM identity found for that user. Use /user-link first.' });
      return;
    }

    const outcomes: string[] = [];

    // GitHub: remove mapped assignee
    try {
      if (entry.github) {
        await octokit.rest.issues.removeAssignees({
          ...getRepoCredentialsForThread(thread),
          issue_number: (thread as any).number,
          assignees: [entry.github],
        } as any);
        outcomes.push(`GitHub: ✅ removed @${entry.github}`);
      } else {
        outcomes.push('GitHub: ℹ️ no GitHub mapping for user');
      }
    } catch {
      outcomes.push('GitHub: ❌ failed to update assignees');
    }

    // PM providers: unassign if linked and mapped user matches current assignee
    if ((thread as any).jiraKey) {
      try {
        if (entry.jira) {
          const issue = await jiraService.getIssue((thread as any).jiraKey);
          const current = issue?.assignee;
          const matches = current && (
            current.accountId === entry.jira ||
            (current.emailAddress && current.emailAddress.toLowerCase() === String(entry.jira).toLowerCase())
          );
        
          if (matches) {
            const ok = await jiraService.unassignIssue((thread as any).jiraKey);
            outcomes.push(ok ? `PM: ✅ unassigned ${(thread as any).jiraKey}` : `PM: ❌ failed to unassign ${(thread as any).jiraKey}`);
          } else {
            outcomes.push('PM: ℹ️ assignee does not match mapped user');
          }
        } else {
          outcomes.push('PM: ℹ️ no PM mapping for user');
        }
      } catch {
        outcomes.push(`PM: ❌ failed to unassign ${(thread as any).jiraKey}`);
      }
    } else {
      outcomes.push('PM: ℹ️ not linked');
    }

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('Unassign complete')
      .setDescription(outcomes.join('\n'))
      .addFields({ name: 'Issue', value: `[#${(thread as any).number}](https://github.com/${getRepoCredentialsForThread(thread).owner}/${getRepoCredentialsForThread(thread).repo}/issues/${(thread as any).number})` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  logger.info(`Unassign executed by ${interaction.user.tag} on #${(thread as any).number}`);
  },
};
