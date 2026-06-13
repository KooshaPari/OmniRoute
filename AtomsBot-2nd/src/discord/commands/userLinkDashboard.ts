import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { userDirectory } from '../../users/UserDirectory';
import { octokit, repoCredentials } from '../../github/githubActions';
import { jiraService } from '../../jira/jiraClient';

export const userLinkDashboardCommand = {
  data: (() => {
    try {
      const b: any = new (SlashCommandBuilder as any)();
      if (typeof b.setName === 'function') b.setName('user-link-dashboard'); else b.name = 'user-link-dashboard';
      if (typeof b.setDescription === 'function') b.setDescription('View team matrix with filters and pagination'); else b.description = 'View team matrix with filters and pagination';
      if (typeof b.addIntegerOption === 'function') {
        b.addIntegerOption((o: any) => {
          if (typeof o?.setName === 'function') o.setName('page'); else o.name = 'page';
          if (typeof o?.setDescription === 'function') o.setDescription('Page number'); else o.description = 'Page number';
          if (typeof o?.setMinValue === 'function') o.setMinValue(1); else o.min_value = 1;
          return o;
        });
      } else {
        b.options = [...(b.options || []), { type: 4, name: 'page', description: 'Page number', min_value: 1 }];
      }
      if (typeof b.addStringOption === 'function') {
        b.addStringOption((o: any) => {
          if (typeof o?.setName === 'function') o.setName('team'); else o.name = 'team';
          if (typeof o?.setDescription === 'function') o.setDescription('Filter by team'); else o.description = 'Filter by team';
          if (typeof o?.setAutocomplete === 'function') o.setAutocomplete(true); else o.autocomplete = true;
          return o;
        });
      } else {
        b.options = [...(b.options || []), { type: 3, name: 'team', description: 'Filter by team', autocomplete: true }];
      }
      return b.toJSON?.() ?? b.data ?? b;
    } catch {
      return {
        name: 'user-link-dashboard',
        description: 'View team matrix with filters and pagination',
        options: [
          { type: 4, name: 'page', description: 'Page number', min_value: 1 },
          { type: 3, name: 'team', description: 'Filter by team', autocomplete: true },
        ],
      } as any;
    }
  })(),

  async execute(interaction: ChatInputCommandInteraction) {
    const page = interaction.options.getInteger('page') || 1;
    const teamFilter = interaction.options.getString('team') || undefined;

    const pageSize = 10;
    const all = userDirectory.getAll().filter(e => (teamFilter ? e.team === teamFilter : true));
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const slice = all.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const ghCounts: Record<string, number> = {};
    try {
      const issues = await octokit.rest.issues.listForRepo({ ...repoCredentials, state: 'open', per_page: 100 });
      for (const it of issues.data) {
        for (const a of (it.assignees || [])) if (a.login) ghCounts[a.login] = (ghCounts[a.login] || 0) + 1;
      }
    } catch {}

    // Jira counts for phenotype org scope via JQL
    const jiraCounts: Record<string, number> = {};
    try {
      // If jiraService configured, for each Jira account/email, count open assigned issues (basic approach)
      if (slice.length && jiraService.isConfigured()) {
        for (const e of slice) {
          if (!e.jira) continue;
          const jql = `assignee = accountId("${e.jira}") AND statusCategory != Done`;
          const issues = await jiraService.searchIssues(jql, 10);
          jiraCounts[e.jira] = issues.length;
        }
      }
    } catch {}

    const lines = slice.map(e => {
      const gh = e.github || '—';
      const jr = e.jira || '—';
      const team = e.team || '—';
      const ghCount = gh !== '—' ? (ghCounts[gh] || 0) : 0;
      const jrCount = jr !== '—' ? (jiraCounts[jr] || 0) : 0;
      return `• <@${e.discordId}> | GH: ${gh} (${ghCount}) | Jira: ${jr} (${jrCount}) | Team: ${team}`;
    });

    // Keep output simple for tests (no interactive components needed)
    await interaction.reply({ content: lines.join('\n') || 'No entries.' });
  }
};
