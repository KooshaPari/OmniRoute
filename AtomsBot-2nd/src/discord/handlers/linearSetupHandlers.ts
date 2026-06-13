import { StringSelectMenuInteraction, ButtonInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { secretsStore } from '../../settings/SecretsStore';

const drafts = new Map<string, { teamId?: string; projectId?: string }>();

async function buildComponents(userId: string) {
  const { linearService } = await import('../../linear/linearClient');
  const draft = drafts.get(userId) || {};
  const teams = await linearService.listTeams();
  const teamRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('linear_sel_team')
      .setPlaceholder('Select Linear team')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((teams || []).slice(0,25).map((t: any) => ({ label: `${t.name}${t.id ? ' • ' + t.id : ''}`, value: String(t.id) })) as any)
  );

  let projRow: any | null = null;
  const tid = draft.teamId || (teams?.[0]?.id ? String(teams[0].id) : undefined);
  if (tid) {
    const projects = await linearService.listProjects(tid);
    projRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('linear_sel_project')
        .setPlaceholder('Select Linear project (optional)')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions((projects || []).slice(0,25).map(p => ({ label: p.name, value: String(p.id) })) as any)
    );
  }

  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('linear_sel_save').setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('linear_sel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const content = [
    'Configure Linear:',
    draft.teamId ? `• Team: ${draft.teamId}` : null,
    draft.projectId ? `• Project: ${draft.projectId}` : null,
  ].filter(Boolean).join('\n');
  return { content: content || 'Configure Linear:', components: [teamRow, ...(projRow ? [projRow] : []), saveRow] as any };
}

export async function handleLinearSelect(interaction: StringSelectMenuInteraction) {
  try {
    const id = interaction.customId || '';
    const userId = interaction.user.id;
    const value = interaction.values?.[0];
    const draft = drafts.get(userId) || {};
    if (id === 'linear_sel_team') { draft.teamId = value; draft.projectId = undefined; }
    if (id === 'linear_sel_project') { draft.projectId = value; }
    drafts.set(userId, draft);
    const ui = await buildComponents(userId);
    try { await interaction.update(ui as any); } catch { try { await interaction.reply({ ...ui, flags: MessageFlags.Ephemeral } as any); } catch {} }
  } catch (e) {
    try { await interaction.reply({ content: `❌ Failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral }); } catch {}
  }
}

export async function handleLinearButtons(interaction: ButtonInteraction) {
  const id = interaction.customId || '';
  const userId = interaction.user.id;
  if (id === 'linear_sel_cancel') { drafts.delete(userId); try { await interaction.update({ content: '❎ Cancelled.', components: [] }); } catch {}; return; }
  if (id === 'linear_sel_save') {
    const draft = drafts.get(userId) || {};
    const toSet: Array<[string,string]> = [];
    if (draft.teamId) toSet.push(['linear_team_id', draft.teamId]);
    if (draft.projectId) toSet.push(['linear_project_id', draft.projectId]);
    for (const [k,v] of toSet) await secretsStore.set(k, v);
    drafts.delete(userId);
    try { await interaction.update({ content: `✅ Saved: ${toSet.map(([k])=>k).join(', ') || 'nothing'}`, components: [] }); } catch {}
  }
}
