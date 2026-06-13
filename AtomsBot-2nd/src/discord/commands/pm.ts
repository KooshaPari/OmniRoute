import { ChatInputCommandInteraction, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { settingsService } from '../../settings/SettingsService';

export const pmCommand = {
  data: {
    name: 'pm',
    description: 'Project Management providers: audit, status, mappings, sync',
    options: [
      { name: 'show', type: 1, description: 'Show provider enablement, sync settings, and mappings' },
      { name: 'validate', type: 1, description: 'Run a one-time validation pass across teams' },
      { name: 'report', type: 1, description: 'Show last PM Sync report', options: [ { name: 'detail', type: 5, description: 'Include examples', required: false } ] },
      { name: 'audit', type: 1, description: 'Provider parity audit with capabilities' },
      { name: 'repair', type: 1, description: 'Run repair/backfill (optional team)', options: [ { name: 'team_id', type: 3, description: 'Team id', required: false } ] },
      { name: 'policy', type: 1, description: 'Set per-team conflict policy', options: [ { name: 'team_id', type: 3, description: 'Team id', required: true }, { name: 'policy', type: 3, description: 'provider_wins|coda_wins|most_recent', required: true } ] },
      { name: 'sync-teams', type: 1, description: 'Toggle pmSync for all teams', options: [ { name: 'enable', type: 5, description: 'Enable (true) or disable (false)', required: true } ] },
      { name: 'team-linear', type: 1, description: 'Select Linear team/project for a team', options: [ { name: 'team_id', type: 3, description: 'Team id', required: true } ] },
      { name: 'team-github-projects', type: 1, description: 'Select GH Projects project for a team', options: [ { name: 'team_id', type: 3, description: 'Team id', required: true } ] },
    ],
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'show') {
      const [sj, sl, sg, sc, sa, ej, el, eg, ec, ea] = await Promise.all([
        process.env.PM_SYNC_JIRA,
        process.env.PM_SYNC_LINEAR,
        process.env.PM_SYNC_GITHUB_PROJECTS,
        process.env.PM_SYNC_CODA,
        process.env.PM_SYNC_ATOMS,
        process.env.PM_ENABLED_JIRA,
        process.env.PM_ENABLED_LINEAR,
        process.env.PM_ENABLED_GITHUB_PROJECTS,
        process.env.PM_ENABLED_CODA,
        process.env.PM_ENABLED_ATOMS,
      ]);
      const by = {
        jira: (sj || '').toLowerCase() === 'true' ? 'on' : 'off',
        linear: (sl || '').toLowerCase() === 'true' ? 'on' : 'off',
        github_projects: (sg || '').toLowerCase() === 'true' ? 'on' : 'off',
        coda: (sc || '').toLowerCase() === 'true' ? 'on' : 'off',
        atoms: (sa || '').toLowerCase() === 'true' ? 'on' : 'off',
      } as const;
      const enabled = {
        jira: (ej || '').toLowerCase() === 'true' ? 'on' : 'off',
        linear: (el || '').toLowerCase() === 'true' ? 'on' : 'off',
        github_projects: (eg || '').toLowerCase() === 'true' ? 'on' : 'off',
        coda: (ec || '').toLowerCase() === 'true' ? 'on' : 'off',
        atoms: (ea || '').toLowerCase() === 'true' ? 'on' : 'off',
      } as const;
      return interaction.reply({ content: `Providers\n• Enabled → Jira:${enabled.jira} Linear:${enabled.linear} GH_Projects:${enabled.github_projects} Coda:${enabled.coda} Atoms:${enabled.atoms}\n• Sync → Jira:${by.jira} Linear:${by.linear} GH_Projects:${by.github_projects} Coda:${by.coda} Atoms:${by.atoms}`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'validate') {
      try {
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        await pmSyncEngine.runOnce();
        return interaction.reply({ content: '✅ SyncEngine validation pass completed (check logs for details).', flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Validation failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'report') {
      try {
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        const rep = (pmSyncEngine as any).getLastReport?.() || { teams: [], totals: { processed: 0, mirrored: 0, teams: 0 } };
        const detail = interaction.options.getBoolean('detail') || false;
        const lines = [
          `Teams: ${rep?.totals?.teams ?? 0}`,
          `Processed: ${rep?.totals?.processed ?? 0}`,
          `Mirrored: ${rep?.totals?.mirrored ?? 0}`,
        ];
        for (const t of rep.teams || []) {
          const base = `• ${t.id} [${t.provider}] processed:${t.processed} mirrored:${t.mirrored}${t.skipped?` skipped:${t.skipped}`:''}${t.errors?.length?` errors:${t.errors.length}`:''}`;
          if (detail && Array.isArray(t.examples) && t.examples.length) lines.push(`${base} eg:[${t.examples.join(', ')}]`);
          else lines.push(base);
        }
        return interaction.reply({ content: `PM Sync Report:\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Report error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'repair') {
      try {
        const teamId = interaction.options.getString('team_id') || undefined;
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        const rep = await pmSyncEngine.repair(teamId || undefined);
        const lines = [ `Teams: ${rep?.totals?.teams ?? 0}`, `Processed: ${rep?.totals?.processed ?? 0}`, `Mirrored: ${rep?.totals?.mirrored ?? 0}` ];
        for (const t of rep.teams || []) lines.push(`• ${t.id} [${t.provider}] processed:${t.processed} mirrored:${t.mirrored}${t.skipped?` skipped:${t.skipped}`:''}${t.errors?.length?` errors:${t.errors.length}`:''}`);
        return interaction.reply({ content: `PM Repair Report${teamId?` (team ${teamId})`:''}:\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Repair error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'policy') {
      try {
        const teamId = interaction.options.getString('team_id', true);
        const policy = (interaction.options.getString('policy', true) || '').toLowerCase();
        if (!['provider_wins','coda_wins','most_recent'].includes(policy)) {
          return interaction.reply({ content: '❌ Invalid policy. Use provider_wins|coda_wins|most_recent', flags: MessageFlags.Ephemeral });
        }
        await settingsService.upsertTeamSettings(teamId, { pmConflictPolicy: policy as any });
        return interaction.reply({ content: `✅ Set policy for ${teamId} → ${policy}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Policy error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'audit') {
      try {
        const { runParityAudit } = await import('../../pm/ParityAudit');
        const res = await runParityAudit();
        const { EmbedBuilder } = await import('discord.js');
        const { getEnabledProviders } = await import('../../pm/provider');

        const emojiFor = (p: string) => (
          p === 'jira' ? '🎫' : p === 'linear' ? '📈' : p === 'github_projects' ? '🗂️' : p === 'coda' ? '📄' : p === 'atoms' ? '🔷' : '🧩'
        );
        const tf = (b: boolean) => (b ? '✅' : '❌');
        const capIcon = (v?: string) => v === 'supported' ? '✅' : v === 'partial' ? '⚠️' : '❌';
        const nice = (k: string) => (k === 'addComment' ? 'comment' : k === 'getTransitions' ? 'transitions' : k);

        const embed = new EmbedBuilder()
          .setTitle('Provider Parity Audit')
          .setDescription(`Enabled: ${getEnabledProviders().join(', ')}`)
          .setColor(0x5865F2);

        for (const r of res) {
          const head = `${emojiFor(r.provider)} ${r.provider} — cfg:${tf(!!r.configured)} conn:${tf(!!r.connected)}`;
          const parts: string[] = [];
          for (const [k, v] of Object.entries(r.capabilities || {})) parts.push(`${nice(k)} ${capIcon(v as string)}`);
          const body = '```' + parts.join('  ') + '```';
          embed.addFields({ name: head.slice(0, 256), value: body.slice(0, 1024) });
        }

        // Coda mapping summary
        try {
          const teams = await settingsService.listTeamSettings();
          const missing: string[] = [];
          const ok: string[] = [];
          for (const t of teams as any[]) {
            const miss: string[] = [];
            if (!t.codaDocId) miss.push('doc');
            if (!t.codaIssuesTableId) miss.push('issues_table');
            const cols: Array<[string,string|undefined]> = [
              ['key', t.codaIssueKeyColumn],
              ['title', t.codaIssueTitleColumn],
              ['status', t.codaIssueStatusColumn],
              ['priority', t.codaIssuePriorityColumn],
              ['assignee', t.codaIssueAssigneeColumn],
            ];
            const missingCols = cols.filter(([_, v]) => !v).map(([k]) => k);
            if (missingCols.length) miss.push('cols:' + missingCols.join(','));
            if (miss.length) missing.push(`${t.id}: ${miss.join(' | ')}`);
            else ok.push(`${t.id}`);
          }
          const block = (arr: string[]) => arr.length ? '```' + arr.join('\n').slice(0, 990) + '```' : '```—```';
          embed.addFields(
            { name: '📄 Coda Mapping — Missing', value: block(missing).slice(0, 1024) },
            { name: '✅ Coda Mapping — OK', value: block(ok).slice(0, 1024) },
          );
        } catch {}

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Audit error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'sync-teams') {
      try {
        const enable = interaction.options.getBoolean('enable', true) === true;
        const teams = await settingsService.listTeamSettings();
        let updated = 0;
        for (const t of teams as any[]) {
          await settingsService.upsertTeamSettings(t.id, { pmSync: enable });
          updated++;
        }
        return interaction.reply({ content: `✅ Set pmSync=${enable ? 'on' : 'off'} for ${updated} teams.`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to toggle team sync: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'team-linear') {
      const appTeamId = interaction.options.getString('team_id', true);
      try {
        const { linearService } = await import('../../linear/linearClient');
        const teams = await linearService.listTeams(50);
        if (!teams.length) return interaction.reply({ content: '❌ No Linear teams available (check LINEAR_API_KEY).', flags: MessageFlags.Ephemeral });
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`pm_linear_team_${appTeamId}_${interaction.user.id}`)
          .setPlaceholder('Pick Linear team…')
          .setMinValues(1).setMaxValues(1)
          .addOptions(...teams.slice(0, 25).map(t => ({ label: t.name.slice(0, 100), value: t.id })));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select a Linear team for '${appTeamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load Linear teams: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (sub === 'team-github-projects') {
      const appTeamId = interaction.options.getString('team_id', true);
      try {
        const { githubProjectsService } = await import('../../github/projectsClient');
        const list = await githubProjectsService.listProjects(100);
        if (!list.length) return interaction.reply({ content: '❌ No GitHub Projects found (check GH Projects config).', flags: MessageFlags.Ephemeral });
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`pm_ghproj_project_${appTeamId}_${interaction.user.id}`)
          .setPlaceholder('Pick a GH Project…')
          .setMinValues(1).setMaxValues(1)
          .addOptions(...list.slice(0, 25).map(p => ({ label: `${p.title}${p.number?` (#${p.number})`:''}`.slice(0, 100), value: p.id })));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select a GitHub Project for '${appTeamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load GH Projects: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
  },
};
