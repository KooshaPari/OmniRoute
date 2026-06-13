import { StringSelectMenuInteraction, ButtonInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { secretsStore } from '../../settings/SecretsStore';

type Draft = { docId?: string; issuesTableId?: string; commentsTableId?: string; usersTableId?: string; keyCol?: string; titleCol?: string; statusCol?: string; priorityCol?: string; assigneeCol?: string };
const drafts = new Map<string, Draft>();

async function buildComponents(userId: string) {
  const { codaService } = await import('../../coda/codaClient');
  const draft = drafts.get(userId) || {};
  const docs = await codaService.listDocs(100).then(r => r.items);
  const docRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('coda_sel_doc')
      .setPlaceholder('Select Coda document')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((docs || []).slice(0,25).map(d => ({ label: d.name, value: String(d.id) })) as any)
  );

  // Tables under selected doc
  let tables: Array<{ id: string; name: string }> = [];
  if (draft.docId) tables = await codaService.listTablesForDoc(draft.docId);
  const issuesRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('coda_sel_issues')
      .setPlaceholder('Select Issues table (optional)')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((tables || []).slice(0,25).map(t => ({ label: t.name, value: String(t.id) })) as any)
  );
  const commentsRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('coda_sel_comments')
      .setPlaceholder('Select Comments table (optional)')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((tables || []).slice(0,25).map(t => ({ label: t.name, value: String(t.id) })) as any)
  );
  const usersRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('coda_sel_users')
      .setPlaceholder('Select Users table (optional)')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((tables || []).slice(0,25).map(t => ({ label: t.name, value: String(t.id) })) as any)
  );

  // Columns for issues table
  let columns: Array<{ id: string; name: string }> = [];
  if (draft.docId && draft.issuesTableId) columns = await codaService.listColumns(draft.issuesTableId);
  const col = (customId: string, placeholder: string) => new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions((columns || []).slice(0,25).map(c => ({ label: c.name, value: String(c.id) })) as any)
  );
  const keyRow = col('coda_sel_col_key','Select Key column');
  const titleRow = col('coda_sel_col_title','Select Title column');
  const statusRow = col('coda_sel_col_status','Select Status column');
  const priorityRow = col('coda_sel_col_priority','Select Priority column');
  const assigneeRow = col('coda_sel_col_assignee','Select Assignee column');

  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('coda_sel_save').setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('coda_sel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const content = [
    'Configure Coda:',
    draft.docId ? `• Doc: ${draft.docId}` : null,
    draft.issuesTableId ? `• Issues table: ${draft.issuesTableId}` : null,
    draft.commentsTableId ? `• Comments table: ${draft.commentsTableId}` : null,
    draft.usersTableId ? `• Users table: ${draft.usersTableId}` : null,
  ].filter(Boolean).join('\n');
  return { content: content || 'Configure Coda:', components: [docRow, issuesRow, commentsRow, usersRow, keyRow, titleRow, statusRow, priorityRow, assigneeRow, saveRow].slice(0,5) as any };
}

export async function handleCodaSelect(interaction: StringSelectMenuInteraction) {
  try {
    const id = interaction.customId || '';
    const userId = interaction.user.id;
    const value = interaction.values?.[0];
    const draft = drafts.get(userId) || {};
    if (id === 'coda_sel_doc') { draft.docId = value; draft.issuesTableId = draft.commentsTableId = draft.usersTableId = undefined; }
    if (id === 'coda_sel_issues') { draft.issuesTableId = value; draft.keyCol = draft.titleCol = draft.statusCol = draft.priorityCol = draft.assigneeCol = undefined; }
    if (id === 'coda_sel_comments') { draft.commentsTableId = value; }
    if (id === 'coda_sel_users') { draft.usersTableId = value; }
    if (id === 'coda_sel_col_key') { draft.keyCol = value; }
    if (id === 'coda_sel_col_title') { draft.titleCol = value; }
    if (id === 'coda_sel_col_status') { draft.statusCol = value; }
    if (id === 'coda_sel_col_priority') { draft.priorityCol = value; }
    if (id === 'coda_sel_col_assignee') { draft.assigneeCol = value; }
    drafts.set(userId, draft);
    const ui = await buildComponents(userId);
    try { await interaction.update(ui as any); } catch { try { await interaction.reply({ ...ui, flags: MessageFlags.Ephemeral } as any); } catch {} }
  } catch (e) {
    try { await interaction.reply({ content: `❌ Failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral }); } catch {}
  }
}

export async function handleCodaButtons(interaction: ButtonInteraction) {
  const id = interaction.customId || '';
  const userId = interaction.user.id;
  if (id === 'coda_sel_cancel') { drafts.delete(userId); try { await interaction.update({ content: '❎ Cancelled.', components: [] }); } catch {}; return; }
  if (id === 'coda_sel_save') {
    const draft = drafts.get(userId) || {};
    const toSet: Array<[string,string]> = [];
    if (draft.docId) toSet.push(['coda_doc_id', draft.docId]);
    if (draft.issuesTableId) toSet.push(['coda_issues_table_id', draft.issuesTableId]);
    if (draft.commentsTableId) toSet.push(['coda_comments_table_id', draft.commentsTableId]);
    if (draft.usersTableId) toSet.push(['coda_users_table_id', draft.usersTableId]);
    if (draft.keyCol) toSet.push(['coda_issue_key_column', draft.keyCol]);
    if (draft.titleCol) toSet.push(['coda_issue_title_column', draft.titleCol]);
    if (draft.statusCol) toSet.push(['coda_issue_status_column', draft.statusCol]);
    if (draft.priorityCol) toSet.push(['coda_issue_priority_column', draft.priorityCol]);
    if (draft.assigneeCol) toSet.push(['coda_issue_assignee_column', draft.assigneeCol]);
    for (const [k,v] of toSet) await secretsStore.set(k, v);
    drafts.delete(userId);
    try { await interaction.update({ content: `✅ Saved: ${toSet.map(([k])=>k).join(', ') || 'nothing'}`, components: [] }); } catch {}
  }
}

