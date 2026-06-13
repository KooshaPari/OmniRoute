import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import { sprintService } from '../components/SprintService';

export const sprintCommand = {
  data: {
    name: 'sprint',
    description: 'Manage sprints and assignments',
    options: [
      {
        name: 'create',
        type: 1,
        description: 'Create a new sprint (modal form)'
      },
      {
        name: 'set',
        type: 1,
        description: 'Assign this thread to a sprint',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            autocomplete: true
          }
        ]
      },
      {
        name: 'unset',
        type: 1,
        description: 'Remove sprint from this thread'
      },
      {
        name: 'progress',
        type: 1,
        description: 'Show sprint progress',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            autocomplete: true
          }
        ]
      },
      {
        name: 'list',
        type: 1,
        description: 'List sprints by state',
        options: [
          {
            name: 'state',
            type: 3,
            description: 'planned|active|completed|canceled',
            choices: [
              { name: 'active', value: 'active' },
              { name: 'planned', value: 'planned' },
              { name: 'completed', value: 'completed' },
              { name: 'canceled', value: 'canceled' }
            ]
          }
        ]
      },
      {
        name: 'edit',
        type: 1,
        description: 'Edit a sprint (modal form)',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'close',
        type: 1,
        description: 'Mark sprint as completed',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'current',
        type: 1,
        description: 'Show default sprint for this guild'
      },
      {
        name: 'default',
        type: 1,
        description: 'Set default sprint and auto-assign behavior',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          },
          {
            name: 'auto',
            type: 5,
            description: 'Enable auto-assign for new issues?'
          }
        ]
      },
      {
        name: 'activate',
        type: 1,
        description: 'Mark a sprint as active (overrides dates)',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'planned',
        type: 1,
        description: 'Mark a sprint as planned (future)',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'cancel',
        type: 1,
        description: 'Cancel a sprint',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'refs',
        type: 1,
        description: 'Set external references for a sprint (GitHub/Jira)',
        options: [
          {
            name: 'sprint',
            type: 3,
            description: 'Sprint (search)',
            required: true,
            autocomplete: true
          },
          {
            name: 'github_milestone',
            type: 3,
            description: 'GitHub milestone title (optional)'
          },
          {
            name: 'jira_sprint_id',
            type: 3,
            description: 'Jira sprint ID (optional)'
          }
        ]
      }
    ]
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId as string;

    switch (sub) {
      case 'create':
        return showCreateModal(interaction);
      case 'set':
        return handleSet(interaction, guildId);
      case 'unset':
        return handleUnset(interaction);
      case 'progress':
        return handleProgress(interaction, guildId);
      case 'list':
        return handleList(interaction, guildId);
      case 'edit':
        return showEditModal(interaction, guildId);
      case 'close':
        return handleClose(interaction, guildId);
      case 'current':
        return handleCurrent(interaction, guildId);
      case 'default':
        return handleDefault(interaction, guildId);
      case 'refs':
        return handleRefs(interaction, guildId);
      case 'activate':
        return handleActivate(interaction, guildId);
      case 'planned':
        return handlePlanned(interaction, guildId);
      case 'cancel':
        return handleCancel(interaction, guildId);
      default:
        return interaction.reply({ content: '❌ Unknown subcommand', flags: MessageFlags.Ephemeral });
    }
  },
};

async function showCreateModal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`sprint_create_${interaction.guildId}`)
    .setTitle('Create Sprint');

  const name = new TextInputBuilder().setCustomId('name').setLabel('Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64);
  const goal = new TextInputBuilder().setCustomId('goal').setLabel('Goal (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300);
  const start = new TextInputBuilder().setCustomId('start').setLabel('Start Date (YYYY-MM-DD, optional)').setStyle(TextInputStyle.Short).setRequired(false);
  const end = new TextInputBuilder().setCustomId('end').setLabel('End Date (YYYY-MM-DD, optional)').setStyle(TextInputStyle.Short).setRequired(false);
  const velocity = new TextInputBuilder().setCustomId('velocity').setLabel('Velocity target (optional)').setStyle(TextInputStyle.Short).setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(goal),
    new ActionRowBuilder<TextInputBuilder>().addComponents(start),
    new ActionRowBuilder<TextInputBuilder>().addComponents(end),
    new ActionRowBuilder<TextInputBuilder>().addComponents(velocity),
  );

  await interaction.showModal(modal);
}

async function showEditModal(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const sprint = await sprintService.getById(sprintId);
  if (!sprint || sprint.guildId !== guildId) {
    return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`sprint_edit_${sprint.id}`)
    .setTitle('Edit Sprint');

  const name = new TextInputBuilder().setCustomId('name').setLabel('Name').setStyle(TextInputStyle.Short).setRequired(true).setValue(sprint.name).setMaxLength(64);
  const goal = new TextInputBuilder().setCustomId('goal').setLabel('Goal (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(sprint.goal || '');
  const start = new TextInputBuilder().setCustomId('start').setLabel('Start Date (YYYY-MM-DD, optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(sprint.startDate ? sprint.startDate.toISOString().slice(0,10) : '');
  const end = new TextInputBuilder().setCustomId('end').setLabel('End Date (YYYY-MM-DD, optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(sprint.endDate ? sprint.endDate.toISOString().slice(0,10) : '');
  const velocity = new TextInputBuilder().setCustomId('velocity').setLabel('Velocity target (optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(sprint.velocityTarget ? String(sprint.velocityTarget) : '');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(goal),
    new ActionRowBuilder<TextInputBuilder>().addComponents(start),
    new ActionRowBuilder<TextInputBuilder>().addComponents(end),
    new ActionRowBuilder<TextInputBuilder>().addComponents(velocity),
  );

  await interaction.showModal(modal);
}

function requireThread(interaction: ChatInputCommandInteraction): { ok: boolean; threadId?: string } {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread && channel.type !== ChannelType.AnnouncementThread) {
    (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).call(interaction, { content: '❌ Run this in a thread created for an issue.', flags: MessageFlags.Ephemeral });
    return { ok: false };
  }
  return { ok: true, threadId: channel.id };
}

async function handleSet(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintIdOpt = interaction.options.getString('sprint');
  const { ok, threadId } = requireThread(interaction);
  if (!ok || !threadId) return;

  if (!sprintIdOpt) {
    // Show dropdown of active sprints
    const sprints = await sprintService.listActiveSprints(guildId, 25);
    if (sprints.length === 0) {
      return interaction.reply({ content: 'ℹ️ No active sprints found. Use /sprint create first.', flags: MessageFlags.Ephemeral });
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId(`sprint_select_${threadId}`)
      .setPlaceholder('Select a sprint…')
      .setMinValues(1).setMaxValues(1);
    sprints.forEach(s => select.addOptions(new StringSelectMenuOptionBuilder().setLabel(s.name).setValue(s.id).setDescription(s.goal?.slice(0,90) || '')));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    return interaction.reply({ content: 'Select a sprint to assign:', components: [row], flags: MessageFlags.Ephemeral });
  }

  const sprint = await sprintService.getById(sprintIdOpt);
  if (!sprint || sprint.guildId !== guildId) {
    return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  }
  const okAssigned = await sprintService.assignThread(threadId, sprint.id, interaction.user.id);
  if (!okAssigned) {
    return interaction.reply({ content: '❌ Failed to assign sprint', flags: MessageFlags.Ephemeral });
  }
  return interaction.reply({ content: `✅ Assigned to sprint: ${sprint.name}`, flags: MessageFlags.Ephemeral });
}

async function handleUnset(interaction: ChatInputCommandInteraction) {
  const { ok, threadId } = requireThread(interaction);
  if (!ok || !threadId) return;
  const result = await sprintService.unassignThread(threadId, interaction.user.id);
  return interaction.reply({ content: result ? '✅ Sprint removed from this thread' : '❌ Failed to remove sprint', flags: MessageFlags.Ephemeral });
}

async function handleProgress(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintIdOpt = interaction.options.getString('sprint');
  let sprintId = sprintIdOpt || null;
  if (!sprintId) {
    // Try: current thread sprint
    const channel = interaction.channel;
    if (channel && (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread || channel.type === ChannelType.AnnouncementThread)) {
      const s = await sprintService.getSprintForThread(channel.id);
      if (s) sprintId = s.id;
    }
  }
  if (!sprintId) {
    const def = await sprintService.getDefaultSprint(guildId);
    if (def) sprintId = def.id;
  }
  if (!sprintId) return interaction.reply({ content: 'ℹ️ No sprint specified and none detected. Use `/sprint progress sprint:<name>`.', flags: MessageFlags.Ephemeral });

  const progress = await sprintService.getProgress(sprintId);
  if (!progress) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  const s = progress.sprint;
  const t = progress.totals;
  const embed = new EmbedBuilder()
    .setTitle(`🏃 Sprint: ${s.name}`)
    .setDescription(s.goal || 'No goal set')
    .addFields(
      { name: 'State', value: s.state, inline: true },
      { name: 'Dates', value: `${s.startDate ? s.startDate.toISOString().slice(0,10) : '—'} → ${s.endDate ? s.endDate.toISOString().slice(0,10) : '—'}`, inline: true },
      { name: 'Issues', value: `Open: ${t.open} • Closed: ${t.closed} • Total: ${t.issues}`, inline: false },
      { name: 'Points', value: `Total: ${t.pointsTotal} • Done: ${t.pointsDone} • Remaining: ${t.pointsRemaining}`, inline: false },
    )
    .setColor(0x5865F2)
    .setTimestamp();
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleList(interaction: ChatInputCommandInteraction, guildId: string) {
  const state = (interaction.options.getString('state') || 'active') as any;
  const sprints = await sprintService.listSprints(guildId, state);
  if (sprints.length === 0) return interaction.reply({ content: `ℹ️ No ${state} sprints.`, flags: MessageFlags.Ephemeral });
  const lines = sprints.slice(0, 25).map(s => `• ${s.name} (${s.state}) ${s.startDate ? s.startDate.toISOString().slice(0,10) : ''}${s.endDate ? ' → ' + s.endDate.toISOString().slice(0,10) : ''}`);
  return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
}

async function handleClose(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  await sprintService.editSprint(sp.id, { state: 'completed' as any });
  return interaction.reply({ content: `✅ Sprint marked completed: ${sp.name}`, flags: MessageFlags.Ephemeral });
}

async function handleCurrent(interaction: ChatInputCommandInteraction, guildId: string) {
  const def = await sprintService.getDefaultSprint(guildId);
  if (!def) return interaction.reply({ content: 'ℹ️ No default sprint set.', flags: MessageFlags.Ephemeral });
  return interaction.reply({ content: `Default sprint: ${def.name}`, flags: MessageFlags.Ephemeral });
}

async function handleDefault(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const auto = interaction.options.getBoolean('auto');
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  await sprintService.setDefaultSprint(guildId, sp.id, auto === null ? undefined : !!auto);
  const suffix = auto === undefined || auto === null ? '' : (auto ? ' (auto-assign enabled)' : ' (auto-assign disabled)');
  return interaction.reply({ content: `✅ Default sprint set to ${sp.name}${suffix}`, flags: MessageFlags.Ephemeral });
}

async function handleRefs(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const ghMs = interaction.options.getString('github_milestone');
  const jiraSprintId = interaction.options.getString('jira_sprint_id');
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  const updated = await sprintService.editSprint(sp.id, { githubMilestone: ghMs === null ? undefined : (ghMs || null), jiraSprintId: jiraSprintId === null ? undefined : (jiraSprintId || null) });
  return interaction.reply({ content: `✅ Updated refs for ${updated?.name || sp.name}${ghMs ? ` • GH Milestone: ${ghMs}` : ''}${jiraSprintId ? ` • Jira Sprint: ${jiraSprintId}` : ''}`, flags: MessageFlags.Ephemeral });
}

async function handleActivate(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  const updated = await sprintService.editSprint(sp.id, { state: 'active' as any });
  return interaction.reply({ content: `✅ Sprint activated: ${updated?.name || sp.name}`, flags: MessageFlags.Ephemeral });
}

async function handlePlanned(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  const updated = await sprintService.editSprint(sp.id, { state: 'planned' as any });
  return interaction.reply({ content: `✅ Sprint marked planned: ${updated?.name || sp.name}`, flags: MessageFlags.Ephemeral });
}

async function handleCancel(interaction: ChatInputCommandInteraction, guildId: string) {
  const sprintId = interaction.options.getString('sprint', true);
  const sp = await sprintService.getById(sprintId);
  if (!sp || sp.guildId !== guildId) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
  const updated = await sprintService.editSprint(sp.id, { state: 'canceled' as any });
  return interaction.reply({ content: `✅ Sprint canceled: ${updated?.name || sp.name}`, flags: MessageFlags.Ephemeral });
}

// Modal submit handlers wired from discordHandlers
export async function handleSprintCreateModal(interaction: any) {
  try {
    const guildId = interaction.customId.split('_').pop();
    const name = interaction.fields.getTextInputValue('name')?.trim();
    const goal = interaction.fields.getTextInputValue('goal')?.trim();
    const startRaw = interaction.fields.getTextInputValue('start')?.trim();
    const endRaw = interaction.fields.getTextInputValue('end')?.trim();
    const velocityRaw = interaction.fields.getTextInputValue('velocity')?.trim();
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    const velocity = velocityRaw ? parseInt(velocityRaw, 10) : null;
    if (!guildId || !name) {
      return interaction.reply({ content: '❌ Missing required fields', flags: MessageFlags.Ephemeral });
    }
    const sprint = await sprintService.createSprint({ guildId, name, goal: goal || null, startDate: isNaN(start as any) ? null : start, endDate: isNaN(end as any) ? null : end, velocityTarget: velocity && !isNaN(velocity) ? velocity : null });
    const embed = new EmbedBuilder()
      .setTitle(`🏃 Sprint created: ${sprint.name}`)
      .setDescription(sprint.goal || 'No goal set')
      .addFields(
        { name: 'State', value: sprint.state, inline: true },
        { name: 'Dates', value: `${sprint.startDate ? sprint.startDate.toISOString().slice(0,10) : '—'} → ${sprint.endDate ? sprint.endDate.toISOString().slice(0,10) : '—'}`, inline: true },
      )
      .setColor(0x57F287);
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {
    const msg = (e as any)?.message || e;
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content: `❌ Failed to create sprint: ${msg}`, flags: MessageFlags.Ephemeral });
    return interaction.reply({ content: `❌ Failed to create sprint: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

export async function handleSprintEditModal(interaction: any) {
  try {
    const sprintId = interaction.customId.replace('sprint_edit_', '');
    const name = interaction.fields.getTextInputValue('name')?.trim();
    const goal = interaction.fields.getTextInputValue('goal')?.trim();
    const startRaw = interaction.fields.getTextInputValue('start')?.trim();
    const endRaw = interaction.fields.getTextInputValue('end')?.trim();
    const velocityRaw = interaction.fields.getTextInputValue('velocity')?.trim();
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    const velocity = velocityRaw ? parseInt(velocityRaw, 10) : null;
    const updated = await sprintService.editSprint(sprintId, {
      name: name || undefined,
      goal: goal === '' ? null : (goal || undefined),
      startDate: startRaw === '' ? null : (isNaN(start as any) ? undefined : start),
      endDate: endRaw === '' ? null : (isNaN(end as any) ? undefined : end),
      velocityTarget: velocityRaw === '' ? null : (velocity && !isNaN(velocity) ? velocity : undefined),
    });
    if (!updated) return interaction.reply({ content: '❌ Sprint not found', flags: MessageFlags.Ephemeral });
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content: `✅ Sprint updated: ${updated.name}`, flags: MessageFlags.Ephemeral });
    return interaction.reply({ content: `✅ Sprint updated: ${updated.name}`, flags: MessageFlags.Ephemeral });
  } catch (e) {
    const msg = (e as any)?.message || e;
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content: `❌ Failed to update sprint: ${msg}`, flags: MessageFlags.Ephemeral });
    return interaction.reply({ content: `❌ Failed to update sprint: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

export async function handleSprintSelect(interaction: any) {
  try {
    const threadId = interaction.customId.replace('sprint_select_', '');
    const sprintId = (interaction.values?.[0] || '').trim();
    if (!sprintId) return interaction.reply({ content: '❌ Invalid selection', flags: MessageFlags.Ephemeral });
    const ok = await sprintService.assignThread(threadId, sprintId, interaction.user.id);
    if (!ok) return interaction.reply({ content: '❌ Failed to assign sprint', flags: MessageFlags.Ephemeral });
    const s = await sprintService.getById(sprintId);
    return interaction.reply({ content: `✅ Assigned to sprint: ${s?.name || sprintId}`, flags: MessageFlags.Ephemeral });
  } catch (e) {
    const msg = (e as any)?.message || e;
    return interaction.reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral });
  }
}
