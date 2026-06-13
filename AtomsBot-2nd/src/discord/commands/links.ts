import {
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { store } from '../../store-db';
import { logger } from '../../logger';

export const linksCommand = {
  data: {
    name: 'links',
    description: 'Link utilities: debug current thread across all providers, rescan embeds',
    options: [
      {
        name: 'list',
        type: 1,
        description: 'Show concise one-line mapping summary for this thread'
      },
      {
        name: 'debug',
        type: 1,
        description: 'Show current link mapping for this thread (GitHub + Jira/Linear/GH Projects/Coda/Atoms)'
      },
      {
        name: 'rescan',
        type: 1,
        description: 'Rescan this thread for links from messages and embeds'
      },
      {
        name: 'attach',
        type: 1,
        description: 'Attach this thread to an item by provider (existing or new)',
        options: [
          { name: 'provider', type: 3, description: 'linear | github_projects | coda | atoms | jira | github', required: true },
          { name: 'item', type: 3, description: "Item key/identifier, or 'new'", required: true },
          { name: 'title', type: 3, description: 'Title when creating new (optional)' }
        ]
      }
    ]
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.channel as any;

    // Small helpers to avoid Unknown interaction errors
    const ensureDeferred = async () => {
      try {
        if (!(interaction.deferred || interaction.replied)) {
          // In v14, deferReply uses `ephemeral` instead of `flags`
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        // Swallow; we'll try safeReply below
        logger.debug?.('[links] defer failed (possibly already acked)', { error: (e as any)?.message || e });
      }
    };
    const safeReply = async (payload: any) => {
      try {
        if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
        return await interaction.reply(payload);
      } catch (e) {
        logger.warn('[links] reply failed', { error: (e as any)?.message || e });
      }
    };

    if (!channel?.id) {
      await safeReply({ content: '❌ Not in a thread.', flags: MessageFlags.Ephemeral });
      return;
    }
    const threadId = channel.id as string;
    await ensureDeferred();

    const thread = store.findThread(threadId) || { id: threadId } as any;

    if (sub === 'list') {
      const ghNum = await store.getGitHubNumber(threadId);
      const jiraKey = await store.getJiraKey(threadId);
      const owner = (store.findThread(threadId) as any)?.repoOwner || process.env.GITHUB_USERNAME || '—';
      const repo = (store.findThread(threadId) as any)?.repoName || process.env.GITHUB_REPOSITORY || '—';
      // Pull provider links from JSON store (authoritative for provider links)
      let provMap: Record<string, { key: string; url?: string | null }> = {};
      try {
        const js = (await import('../../store')).store as any;
        const all = js.getAllProviderLinks?.() || [];
        const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === threadId) : [];
        for (const l of mine) provMap[l.provider] = { key: l.key, url: l.url };
      } catch {}
      const linear = provMap['linear']?.key || '—';
      const ghp = provMap['github_projects']?.key || '—';
      const coda = provMap['coda']?.key || '—';
      const atoms = provMap['atoms']?.key || '—';
      const line = `GitHub:${ghNum ? ` #${ghNum}` : ' —'} (${owner}/${repo}) | Jira:${jiraKey || ' —'} | Linear:${linear} | GH_Projects:${ghp} | Coda:${coda} | Atoms:${atoms}`;
      try { await interaction.editReply({ content: line }); } catch { await safeReply({ content: line, flags: MessageFlags.Ephemeral }); }
      return;
    }

    if (sub === 'debug') {
      const ghNum = await store.getGitHubNumber(threadId);
      const jiraKey = await store.getJiraKey(threadId);
      const owner = (thread as any).repoOwner || process.env.GITHUB_USERNAME;
      const repo = (thread as any).repoName || process.env.GITHUB_REPOSITORY;
      const lines: string[] = [];
      lines.push(`GitHub: ${ghNum ? `#${ghNum} (owner=${owner} repo=${repo})` : '— not linked'}`);
      lines.push(`Jira: ${jiraKey || '— not linked'}`);
      let provMap: Record<string, { key: string; url?: string | null }> = {};
      try {
        const js = (await import('../../store')).store as any;
        const all = js.getAllProviderLinks?.() || [];
        const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === threadId) : [];
        for (const l of mine) provMap[l.provider] = { key: l.key, url: l.url };
      } catch {}
      const mk = (p: string, label: string) => provMap[p]?.key ? `${label}: ${provMap[p].key}${provMap[p].url ? ` (${provMap[p].url})` : ''}` : `${label}: — not linked`;
      lines.push(mk('linear', 'Linear'));
      lines.push(mk('github_projects', 'GitHub Projects'));
      lines.push(mk('coda', 'Coda'));
      lines.push(mk('atoms', 'Atoms'));
      try {
        await interaction.editReply({ content: lines.join('\n') });
      } catch {
        await safeReply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (sub === 'rescan') {
      try {
        // Lazy import to avoid cycles
        const { scanThreadsForSmartEmbeds: scan } = await import('../discordHandlers');
        await scan((interaction.client as any), [thread]);
        try {
          await interaction.editReply({ content: 'Rescan complete. Run /links debug to verify mappings.' });
        } catch {
          await safeReply({ content: 'Rescan complete. Run /links debug to verify mappings.', flags: MessageFlags.Ephemeral });
        }
      } catch (e: any) {
        const msg = `❌ Rescan failed: ${e?.message || e}`;
        try {
          await interaction.editReply({ content: msg });
        } catch {
          await safeReply({ content: msg, flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    if (sub === 'attach') {
      const provider = (interaction.options.getString('provider', true) || '').toLowerCase();
      const item = interaction.options.getString('item', true);
      const title = interaction.options.getString('title') || (store.findThread(threadId)?.title || 'New Item');
      const outcomes: string[] = [];
      try {
        if (provider === 'github' || provider === 'gh' || provider === 'git') {
          outcomes.push('ℹ️ Use /link for GitHub.');
        } else if (provider === 'jira') {
          // Use provider proxy under jiraService
          const { jiraService } = await import('../../jira/jiraClient');
          if (/^new$/i.test(item)) {
            const created = await jiraService.createIssue({ summary: title, description: `Linked from Discord thread ${threadId}` });
            if (created?.key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'jira', created.key, (created as any).url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'jira', created.key, (created as any).url); } catch {}
              outcomes.push(`✅ Jira: created ${created.key}`);
            } else outcomes.push('❌ Jira: create failed');
          } else {
            const found = await jiraService.getIssue(item);
            if (found) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'jira', item, (found as any).url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'jira', item, (found as any).url); } catch {}
              outcomes.push(`✅ Jira: linked ${item}`);
            } else outcomes.push(`❌ Jira: not found (${item})`);
          }
        } else if (provider === 'linear') {
          const { LinearService } = await import('../../linear/linearClient');
          const svc = new LinearService();
          if (/^new$/i.test(item)) {
            const created = await svc.createIssue({ summary: title });
            const key = (created as any)?.identifier || (created as any)?.id;
            if (key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'linear', key, (created as any)?.url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'linear', key, (created as any)?.url); } catch {}
              outcomes.push(`✅ Linear: created ${key}`);
            } else outcomes.push('❌ Linear: create failed');
          } else {
            const found = await svc.getIssue(item);
            const key = (found as any)?.identifier || (found as any)?.id;
            if (key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'linear', key, (found as any)?.url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'linear', key, (found as any)?.url); } catch {}
              outcomes.push(`✅ Linear: linked ${key}`);
            } else outcomes.push(`❌ Linear: not found (${item})`);
          }
        } else if (provider === 'github_projects' || provider === 'gh_projects' || provider === 'projects') {
          const { GitHubProjectsAdapter } = await import('../../pm/adapters/GitHubProjectsAdapter');
          const ad = new GitHubProjectsAdapter();
          if (/^new$/i.test(item)) {
            const created = await ad.createIssue({ title, description: `Linked from Discord thread ${threadId}` });
            if (created?.key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'github_projects', created.key, (created as any)?.url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'github_projects', created.key, (created as any)?.url); } catch {}
              outcomes.push(`✅ GH Projects: created ${created.key}`);
            } else outcomes.push('❌ GH Projects: create failed');
          } else {
            // Linking existing project item by id is non-trivial without lookup; store as-is
            try { (await import('../../store')).store.setProviderLink(threadId, 'github_projects', item, undefined); } catch {}
            try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'github_projects', item, undefined); } catch {}
            outcomes.push(`✅ GH Projects: linked ${item}`);
          }
        } else if (provider === 'coda') {
          const { codaService } = await import('../../coda/codaClient');
          if (/^new$/i.test(item)) {
            const key = `CODA-${Date.now()}`;
            await codaService.upsertIssue({ externalKey: key, title, description: `Linked from Discord thread ${threadId}` });
            try { (await import('../../store')).store.setProviderLink(threadId, 'coda', key, undefined); } catch {}
            try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'coda', key, undefined); } catch {}
            outcomes.push(`✅ Coda: created row ${key}`);
          } else {
            try { (await import('../../store')).store.setProviderLink(threadId, 'coda', item, undefined); } catch {}
            try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'coda', item, undefined); } catch {}
            outcomes.push(`✅ Coda: linked ${item}`);
          }
        } else if (provider === 'atoms') {
          const { atomsService } = await import('../../atoms/atomsClient');
          if (/^new$/i.test(item)) {
            const created = await atomsService.createIssue({ summary: title });
            const key = (created as any)?.key;
            if (key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'atoms', key, (created as any)?.url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'atoms', key, (created as any)?.url); } catch {}
              outcomes.push(`✅ Atoms: created ${key}`);
            } else outcomes.push('❌ Atoms: create failed');
          } else {
            const found = await atomsService.getIssue(item);
            const key = (found as any)?.key;
            if (key) {
              try { (await import('../../store')).store.setProviderLink(threadId, 'atoms', key, (found as any)?.url); } catch {}
              try { const dbs = (await import('../../store-db')).store as any; dbs.queueProviderLink?.(threadId, 'atoms', key, (found as any)?.url); } catch {}
              outcomes.push(`✅ Atoms: linked ${key}`);
            } else outcomes.push(`❌ Atoms: not found (${item})`);
          }
        } else {
          outcomes.push(`❌ Unknown provider: ${provider}`);
        }
      } catch (e: any) {
        outcomes.push(`❌ Attach failed: ${e?.message || e}`);
      }
      const msg = outcomes.join('\n') || 'No changes';
      try { await interaction.editReply({ content: msg }); } catch { await safeReply({ content: msg, flags: MessageFlags.Ephemeral }); }
      return;
    }
  },
};
