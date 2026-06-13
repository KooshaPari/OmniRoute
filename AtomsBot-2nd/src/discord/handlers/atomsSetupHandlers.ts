import { StringSelectMenuInteraction, ButtonInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { secretsStore } from '../../settings/SecretsStore';

const drafts = new Map<string, { orgId?: string; projectId?: string; documentId?: string }>();

async function buildComponents(userId: string): Promise<{ content: string; components: any[] }> {
  const { atomsService } = await import('../../atoms/atomsClient');
  const draft = drafts.get(userId) || {};
  const projects = await atomsService.listProjects();
  const projOptions = (projects || []).slice(0, 25).map((p: any) => ({ label: p.name, value: String(p.id) }));
  const projectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('atoms_sel_project')
      .setPlaceholder('Select Atoms project')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(projOptions as any)
  );

  let docRow: any | null = null;
  const pid = draft.projectId || (projects?.[0]?.id ? String(projects[0].id) : undefined);
  if (pid) {
    const docs = await atomsService.listDocuments(pid);
    const docOptions = (docs || []).slice(0, 25).map((d: any) => ({ label: d.name, value: String(d.id) }));
    docRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('atoms_sel_document')
        .setPlaceholder('Select requirements document (optional)')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(docOptions as any)
    );
  }

  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('atoms_sel_save').setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('atoms_sel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const parts = [
    'Configure Atoms linkables:',
    draft.orgId ? `• Org: ${draft.orgId}` : null,
    draft.projectId ? `• Project: ${draft.projectId}` : null,
    draft.documentId ? `• Document: ${draft.documentId}` : null,
  ].filter(Boolean) as string[];

  return { content: parts.join('\n'), components: [projectRow, ...(docRow ? [docRow] : []), saveRow] as any };
}

export async function handleAtomsSelect(interaction: StringSelectMenuInteraction) {
  try {
    const id = interaction.customId || '';
    const userId = interaction.user.id;
    const value = interaction.values?.[0];
    const draft = drafts.get(userId) || {};
    if (id === 'atoms_sel_project') {
      draft.projectId = value;
      drafts.set(userId, draft);
    } else if (id === 'atoms_sel_document') {
      draft.documentId = value;
      drafts.set(userId, draft);
    }
    const ui = await buildComponents(userId);
    try { await interaction.update(ui as any); } catch { try { await interaction.reply({ ...ui, flags: MessageFlags.Ephemeral } as any); } catch {} }
  } catch (e) {
    try { await interaction.reply({ content: `❌ Failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral }); } catch {}
  }
}

export async function handleAtomsButtons(interaction: ButtonInteraction) {
  const id = interaction.customId || '';
  const userId = interaction.user.id;
  if (id === 'atoms_sel_cancel') {
    drafts.delete(userId);
    try { await interaction.update({ content: '❎ Cancelled.', components: [] }); } catch {}
    return;
  }
  if (id === 'atoms_sel_save') {
    const draft = drafts.get(userId) || {};
    const toSet: Array<[string, string]> = [];
    if (draft.projectId) toSet.push(['atoms_project_id', draft.projectId]);
    if (draft.documentId) toSet.push(['atoms_requirements_document_id', draft.documentId]);
    // org id is optional and not directly listed; infer from stored or project mapping if available
    if (draft.orgId) toSet.push(['atoms_org_id', draft.orgId]);
    for (const [k, v] of toSet) { await secretsStore.set(k, v); }
    drafts.delete(userId);
    // Optionally ensure doc/block after saving project
    try {
      const { atomsService } = await import('../../atoms/atomsClient');
      await atomsService.ensureIssuesDocAndBlock();
    } catch {}
    try { await interaction.update({ content: `✅ Saved: ${toSet.map(([k]) => k).join(', ') || 'nothing'}`, components: [] }); } catch {}
  }
}

