import { StringSelectMenuInteraction, ButtonInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { secretsStore } from '../../settings/SecretsStore';
import { octokit } from '../../github/githubActions';

type Draft = { owner?: string; repo?: string; projectsOrg?: string; projectId?: string };
const drafts = new Map<string, Draft>();

async function listOwners(): Promise<Array<{ label: string; value: string }>> {
  try {
    const me = await octokit.rest.users.getAuthenticated();
    const mine = [{ label: me.data.login, value: me.data.login }];
    const orgs = await octokit.rest.orgs.listForAuthenticatedUser({ per_page: 100 });
    const orgItems = (orgs.data || []).map(o => ({ label: o.login, value: o.login }));
    return [...mine, ...orgItems].slice(0, 25);
  } catch { return []; }
}

async function listRepos(owner: string): Promise<Array<{ label: string; value: string }>> {
  try {
    // Try org first, fallback to user
    try {
      const res = await octokit.rest.repos.listForOrg({ org: owner, per_page: 100 });
      return (res.data || []).map(r => ({ label: r.name, value: r.name })).slice(0, 25);
    } catch {}
    const res = await octokit.rest.repos.listForUser({ username: owner, per_page: 100 });
    return (res.data || []).map(r => ({ label: r.name, value: r.name })).slice(0, 25);
  } catch { return []; }
}

async function listProjects(org: string): Promise<Array<{ label: string; value: string }>> {
  try {
    const data: any = await (octokit as any).graphql?.(
      `query($org: String!) { organization(login: $org) { projectsV2(first: 50) { nodes { id title } } } }`,
      { org }
    );
    const nodes = data?.organization?.projectsV2?.nodes || [];
    return nodes.map((n: any) => ({ label: n.title, value: n.id })).slice(0, 25);
  } catch { return []; }
}

async function buildComponents(userId: string) {
  const draft = drafts.get(userId) || {};
  const owners = await listOwners();
  const ownerRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('gh_sel_owner')
      .setPlaceholder('Select GitHub owner')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(owners as any)
  );
  let repoRow: any | null = null;
  const owner = draft.owner || owners?.[0]?.value;
  if (owner) {
    const repos = await listRepos(owner);
    repoRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('gh_sel_repo')
        .setPlaceholder('Select repository')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(repos as any)
    );
  }
  let projOrgRow: any | null = null;
  let projRow: any | null = null;
  if (owners?.length) {
    projOrgRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('gh_sel_proj_org')
        .setPlaceholder('Select org for Projects v2 (optional)')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(owners as any)
    );
  }
  const org = draft.projectsOrg || owners?.[0]?.value;
  if (org) {
    const projs = await listProjects(org);
    projRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('gh_sel_proj')
        .setPlaceholder('Select Projects v2 board (optional)')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(projs as any)
    );
  }
  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('gh_sel_save').setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gh_sel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  const content = [
    'Configure GitHub:',
    draft.owner ? `• Owner: ${draft.owner}` : null,
    draft.repo ? `• Repo: ${draft.repo}` : null,
    draft.projectsOrg ? `• Projects org: ${draft.projectsOrg}` : null,
    draft.projectId ? `• Project id: ${draft.projectId}` : null,
  ].filter(Boolean).join('\n');
  return { content: content || 'Configure GitHub:', components: [ownerRow, ...(repoRow ? [repoRow] : []), ...(projOrgRow ? [projOrgRow] : []), ...(projRow ? [projRow] : []), saveRow].slice(0,5) as any };
}

export async function handleGitHubSelect(interaction: StringSelectMenuInteraction) {
  try {
    const id = interaction.customId || '';
    const userId = interaction.user.id;
    const value = interaction.values?.[0];
    const draft = drafts.get(userId) || {};
    if (id === 'gh_sel_owner') { draft.owner = value; draft.repo = undefined; }
    if (id === 'gh_sel_repo') { draft.repo = value; }
    if (id === 'gh_sel_proj_org') { draft.projectsOrg = value; draft.projectId = undefined; }
    if (id === 'gh_sel_proj') { draft.projectId = value; }
    drafts.set(userId, draft);
    const ui = await buildComponents(userId);
    try { await interaction.update(ui as any); } catch { try { await interaction.reply({ ...ui, flags: MessageFlags.Ephemeral } as any); } catch {} }
  } catch (e) {
    try { await interaction.reply({ content: `❌ Failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral }); } catch {}
  }
}

export async function handleGitHubButtons(interaction: ButtonInteraction) {
  const id = interaction.customId || '';
  const userId = interaction.user.id;
  if (id === 'gh_sel_cancel') { drafts.delete(userId); try { await interaction.update({ content: '❎ Cancelled.', components: [] }); } catch {}; return; }
  if (id === 'gh_sel_save') {
    const draft = drafts.get(userId) || {};
    const toSet: Array<[string,string]> = [];
    if (draft.owner) toSet.push(['github_owner', draft.owner]);
    if (draft.repo) toSet.push(['github_repo', draft.repo]);
    if (draft.projectsOrg) toSet.push(['gh_projects_org', draft.projectsOrg]);
    if (draft.projectId) toSet.push(['gh_projects_project_id', draft.projectId]);
    for (const [k,v] of toSet) await secretsStore.set(k, v);
    drafts.delete(userId);
    try { await interaction.update({ content: `✅ Saved: ${toSet.map(([k])=>k).join(', ') || 'nothing'}`, components: [] }); } catch {}
  }
}

