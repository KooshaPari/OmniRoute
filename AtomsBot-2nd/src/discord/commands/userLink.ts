import { ChatInputCommandInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { userDirectory } from '../../users/UserDirectory';
import { forumManager } from '../components/ForumManager';
import { octokit, repoCredentials } from '../../github/githubActions';
// import { jiraService } from '../../jira/jiraClient';
// import { store } from '../../store-db';

import { logger } from '../../logger';

export const userLinkCommand = {
  data: {
    name: 'user-link',
    description: 'Link Discord users to GitHub/Providers and view team matrix',
    options: [
      {
        name: 'link',
        type: 1,
        description: 'Map a Discord user to GitHub/Providers/Team'
      },
      {
        name: 'dashboard',
        type: 1,
        description: 'View a matrix of teammates and their connection state'
      },
      {
        name: 'refresh',
        type: 1,
        description: 'Refresh cached users from Discord/GitHub/Providers'
      },
      {
        name: 'map',
        type: 1,
        description: 'Map via params',
        options: [
          {
            name: 'discord',
            type: 6,
            description: 'Discord user',
            required: true
          },
          {
            name: 'github',
            type: 3,
            description: 'GitHub login'
          },
          {
            name: 'jira-account-id',
            type: 3,
            description: 'Jira accountId'
          },
          {
            name: 'linear-user-id',
            type: 3,
            description: 'Linear user id'
          },
          {
            name: 'coda-user',
            type: 3,
            description: 'Coda user identifier'
          },
          {
            name: 'atoms-user-id',
            type: 3,
            description: 'Atoms user id'
          },
          {
            name: 'team',
            type: 3,
            description: 'Team name'
          }
        ]
      }
    ]
  },

  async execute(interaction: ChatInputCommandInteraction) {
    // Pre-ack to avoid Unknown interaction on slow branches
    try { if (!(interaction.deferred || interaction.replied)) { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } } catch {}
    const sub = interaction.options.getSubcommand();
    if (sub === 'map') {
      await handleMap(interaction);
      return;
    }

    const startedAt = Date.now();
    const ctx = { guildId: interaction.guildId, userId: interaction.user.id };
    logger.info('[user-link] start', { sub, ...ctx });

    if (sub === 'link') {
      logger.info('[user-link] building UI components...', ctx);
      await handleLink(interaction);
    } else if (sub === 'dashboard') {
      logger.info('[user-link] computing dashboard...', ctx);
      await handleDashboard(interaction);
    } else if (sub === 'refresh') {
      logger.info('[user-link] refreshing caches...', ctx);
    // Optional: ephemeral progress hint to user for longer operations
    try { await interaction.editReply({ content: '⏳ Working on it…' }); } catch {}

      await handleRefresh(interaction);
    }

    logger.info('[user-link] done', { sub, ms: Date.now() - startedAt, ...ctx });
  }
};

export async function renderUserLinkUI(interaction: ChatInputCommandInteraction, pageOverride?: number) {
  if (!(interaction.deferred || interaction.replied)) {
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
  }

  // Discord candidates (cached) with soft timeout
  const guild = interaction.guild;
  const discordOptions: any[] = [];
  const withTimeout = async <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    await Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
  if (guild) {
    try {
      const candidates = await withTimeout(userDirectory.getDiscordCandidates(guild as any), 2500, [] as any[]);
      (candidates || []).forEach(c => discordOptions.push({ label: c.label, value: c.id }));
    } catch {}
  }
  // Ensure at least 1 option (Discord requires 1-25)
  if (discordOptions.length === 0) {
    // Fallback to any previously linked entries if available
    try {
      for (const e of userDirectory.getAll()) {
        if (!e.discordId) continue;
        const label = e.discordTag || e.discordId;
        if (!discordOptions.find(o => o.value === e.discordId)) {
          discordOptions.push({ label, value: e.discordId });
        }
      }
    } catch {}
  }
  if (discordOptions.length === 0) {
    const me = interaction.user as any;
    const label = me?.discriminator ? `${me.username}#${me.discriminator}` : me?.username || 'You';
    discordOptions.push({ label, value: interaction.user.id });
  }

  // Provider-driven identity selects (only enabled providers + GitHub)
  const { getEnabledProviders, isProviderEnabled } = await import('../../pm/provider');
  const enabled = new Set<string>(getEnabledProviders().map(p => String(p)));
  const identityProviders: Array<{ id: string; label: string; fetchCandidates: (q: string) => Promise<Array<{ label: string; value: string }>> }> = [];
  // Jira
  if (enabled.has('jira')) {
    identityProviders.push({
      id: 'jira',
      label: 'Jira',
      fetchCandidates: async (q: string) => {
        try {
          const list = await userDirectory.getJiraCandidates(q);
          return (list || []).map(it => ({ label: it.label, value: it.key }));
        } catch { return []; }
      },
    });
  }
  // Linear
  if (enabled.has('linear')) {
    identityProviders.push({
      id: 'linear',
      label: 'Linear',
      fetchCandidates: async (q: string) => {
        try {
          const list = await userDirectory.getLinearCandidates(q);
          return (list || []).map(it => ({ label: it.label, value: it.id }));
        } catch { return []; }
      },
    });
  }
  // Coda
  if (enabled.has('coda')) {
    identityProviders.push({
      id: 'coda',
      label: 'Coda',
      fetchCandidates: async (q: string) => {
        try {
          const list = await userDirectory.getCodaCandidates(q);
          return (list || []).map(it => ({ label: it.label, value: it.id }));
        } catch { return []; }
      },
    });
  }
  // Atoms
  if (enabled.has('atoms')) {
    identityProviders.push({
      id: 'atoms',
      label: 'Atoms',
      fetchCandidates: async (q: string) => {
        try {
          const list = await userDirectory.getAtomsCandidates(q);
          return (list || []).map(it => ({ label: it.label, value: it.id }));
        } catch { return []; }
      },
    });
  }
  // Always include GitHub
  identityProviders.push({
    id: 'github',
    label: 'GitHub',
    fetchCandidates: async (_q: string) => {
      try {
        const list = await userDirectory.getGithubCandidates();
        return (list || []).map(it => ({ label: it.login, value: it.login }));
      } catch { return []; }
    },
  });
  const providerRowsAll: Array<{ id: string; row: any }> = [];
  for (const prov of identityProviders) {
    const opts: Array<{ label: string; value: string }> = await withTimeout(prov.fetchCandidates('a'), prov.id === 'jira' ? 5000 : 2500, [] as any[]);
    const safeOpts = (opts && opts.length > 0) ? opts.slice(0, 25) : [{ label: `${prov.label} not configured or no users found`, value: 'manual' }];
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`userlink_${prov.id}`)
        .setPlaceholder(`Select ${prov.label} user`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(safeOpts as any)
    );
    providerRowsAll.push({ id: prov.id, row });
  }

  // Teams: prefer configured teams from ForumManager
  const teamOptions = forumManager
    .getAllTeams()
    .map(t => ({ label: `${t.emoji ? t.emoji + ' ' : ''}${t.name}`, value: t.id }))
    .slice(0, 25);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('userlink_discord')
      .setPlaceholder('Select Discord user')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(discordOptions.slice(0, 25))
  );
  logger.info('[user-link] building selects: discord/providers/team');
  const row4 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('userlink_team')
      .setPlaceholder('Select team')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(teamOptions.length ? teamOptions.slice(0, 25) : [{ label: 'No teams yet (will save null)', value: 'none' }])
  );

  // Determine page (default 1); allow override
  const draft = userDirectory.getDraft(interaction.user.id) || {};
  const page = Math.max(
    1,
    Math.min(2, Number(pageOverride ?? ((draft as any).__page ?? 1)))
  );
  const providerPageRows = page === 1 ? providerRowsAll.slice(0, 3).map(x => x.row) : providerRowsAll.slice(3).map(x => x.row);

  // Navigation will be added to the action row to avoid consuming an extra row

  const saveActions: ButtonBuilder[] = [
    new ButtonBuilder().setCustomId('userlink_save').setLabel('Save Link').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('userlink_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('userlink_addteam').setLabel('Add Team').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('userlink_removeteam').setLabel('Remove Team').setStyle(ButtonStyle.Danger),
  ];
  if (providerRowsAll.length > 3) {
    if (page === 1) saveActions.push(new ButtonBuilder().setCustomId('userlink_page_next').setLabel('More Providers').setStyle(ButtonStyle.Secondary));
    if (page === 2) saveActions.push(new ButtonBuilder().setCustomId('userlink_page_prev').setLabel('Back').setStyle(ButtonStyle.Secondary));
  }
  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...(saveActions as any));

  // Calculate allowed providers to respect 5-row limit.
  // Page 1: Discord + 3 provider selects + Save
  // Page 2: Discord + remaining providers (up to 2) + Team + Save
  const maxRows = 5;
  const reserved = page === 1 ? (1 /*row1*/ + 1 /*save*/) : (1 /*row1*/ + 1 /*team*/ + 1 /*save*/);
  const allowedProviders = Math.max(0, maxRows - reserved);
  const providerLimited = providerPageRows.slice(0, allowedProviders);

  // Build final rows in priority: discord, providers, nav, team (if p1), save
  const rows: any[] = [row1, ...providerLimited];
  if (page === 2) rows.push(row4);
  rows.push(saveRow);
  const finalRows = rows;

  await interaction.editReply({
    content: 'Discord/Github/PM Providers/Actions',
    components: finalRows as any,
  });
}

async function handleLink(interaction: ChatInputCommandInteraction) {
  await renderUserLinkUI(interaction);
}

async function handleDashboard(interaction: ChatInputCommandInteraction) {
  if (!(interaction.deferred || interaction.replied)) {
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
  }

  const entries = userDirectory.getAll();

  // Compute assigned issue counts (GitHub)
  const ghCounts: Record<string, number> = {};
  try {
    // Pull open issues and count by assignee
    const issues = await octokit.rest.issues.listForRepo({ ...repoCredentials, state: 'open', per_page: 100 });
    for (const it of issues.data) {
      for (const a of (it.assignees || [])) {
        if (a.login) ghCounts[a.login] = (ghCounts[a.login] || 0) + 1;
      }
    }
  } catch {}

  // PM counts placeholder (requires a search API integration in jiraService when provider=jira)
  const jiraCounts: Record<string, number> = {};

  const lines = entries.map(e => {
    const gh = e.github || '—';
    const jr = e.jira || '—';
    const ln = e.linear || '—';
    const cd = e.coda || '—';
    const at = e.atoms || '—';
    const team = e.team || '—';
    const ghCount = gh !== '—' ? (ghCounts[gh] || 0) : 0;
    const jrCount = jr !== '—' ? (jiraCounts[jr] || 0) : 0;
    return `• <@${e.discordId}> | GH: ${gh} (${ghCount}) | PM: ${jr} (${jrCount}) | Linear: ${ln} | Coda: ${cd} | Atoms: ${at} | Team: ${team}`;
  });

  await interaction.editReply({ content: lines.join('\n') || 'No directory entries yet.' });
}


async function handleMap(interaction: ChatInputCommandInteraction) {
  if (!(interaction.deferred || interaction.replied)) {
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
  }
  try {
    const discord = interaction.options.getUser('discord', true);
    const github = interaction.options.getString('github') || undefined;
    const jira = interaction.options.getString('jira-account-id') || undefined;
    const linear = interaction.options.getString('linear-user-id') || undefined;
    const coda = interaction.options.getString('coda-user') || undefined;
    const atoms = interaction.options.getString('atoms-user-id') || undefined;
    const team = interaction.options.getString('team') || undefined;

    try {
      const teams = userDirectory.getTeams?.() || [];
      if (team && !teams.includes(team)) userDirectory.addTeam?.(team);
    } catch {}

    userDirectory.upsert({
      discordId: discord.id,
      discordTag: discord.tag,
      github: github || null,
      jira: jira || null,
      linear: linear || null,
      coda: coda || null,
      atoms: atoms || null,
      team: team || null,
      identities: {
        ...(github ? { github } : {}),
        ...(jira ? { jira } : {}),
        ...(linear ? { linear } : {}),
        ...(coda ? { coda } : {}),
        ...(atoms ? { atoms } : {}),
      }
    });
    await interaction.editReply({ content: `✅ Mapped <@${discord.id}>${github ? ` • GH: ${github}` : ''}${jira ? ` • PM: ${jira}` : ''}${linear ? ` • Linear: ${linear}` : ''}${coda ? ` • Coda: ${coda}` : ''}${atoms ? ` • Atoms: ${atoms}` : ''}${team ? ` • Team: ${team}` : ''}` });
  } catch (e) {
    await interaction.editReply({ content: `❌ Failed to map: ${(e as any)?.message || e}` });
  }
}

async function handleRefresh(interaction: ChatInputCommandInteraction) {
  if (!(interaction.deferred || interaction.replied)) {
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
  }
  try {
    const tasks: Promise<any>[] = [];
    if (interaction.guild) tasks.push(userDirectory.refreshDiscordCandidates(interaction.guild as any));
    tasks.push(userDirectory.refreshGithubCandidates());
    // Refresh enabled providers
    const { getEnabledProviders } = require('../../pm/provider');
    const enabled: string[] = getEnabledProviders();
    if (enabled.includes('jira')) tasks.push(userDirectory.refreshJiraCandidates('a'));
    if (enabled.includes('linear')) tasks.push(userDirectory.refreshLinearCandidates('a'));
    if (enabled.includes('coda')) tasks.push(userDirectory.refreshCodaCandidates('a'));
    if (enabled.includes('atoms')) tasks.push(userDirectory.refreshAtomsCandidates('a'));
    await Promise.allSettled(tasks);
    await interaction.editReply({ content: `✅ Refreshed cached users for Discord/GitHub/Providers` });
  } catch (e) {
    await interaction.editReply({ content: `⚠️ Refresh completed with warnings: ${(e as any)?.message || e}` });
  }
}
