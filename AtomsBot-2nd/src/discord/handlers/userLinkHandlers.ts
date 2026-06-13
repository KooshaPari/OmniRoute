import { StringSelectMenuInteraction, ButtonInteraction, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import { ModalSubmitInteraction, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalBuilder } from 'discord.js';

import { userDirectory } from '../../users/UserDirectory';
import { logger } from '../../logger';

export async function handleUserLinkSelect(interaction: StringSelectMenuInteraction) {
  try {
    const [action, field] = interaction.customId.split('_');
    if (action !== 'userlink') return;

    // Acknowledge to avoid "This interaction failed"
    try { await interaction.deferUpdate(); } catch {}

    const value = interaction.values?.[0];
    const author = interaction.user.id;
    switch (field) {
      case 'discord': {
        const discordId = value;
        let discordTag: string | undefined;
        try {
          const member = await interaction.guild?.members.fetch(discordId);
          if (member && member.user) {
            discordTag = member.user.discriminator ? `${member.user.username}#${member.user.discriminator}` : member.user.username;
          }
        } catch {}
        userDirectory.setDraft(author, { discordId, discordTag });
        break;
      }
      case 'github': {
        userDirectory.setDraft(author, { github: value });
        break;
      }
      case 'jira': {
        // value === 'manual' means leave jira undefined for now
        userDirectory.setDraft(author, { jira: value === 'manual' ? undefined : value });
        break;
      }
      case 'linear': {
        userDirectory.setDraft(author, { linear: value === 'manual' ? undefined : value });
        userDirectory.setIdentityDraft(author, 'linear', value === 'manual' ? undefined : value);
        break;
      }
      case 'coda': {
        userDirectory.setDraft(author, { coda: value === 'manual' ? undefined : value });
        userDirectory.setIdentityDraft(author, 'coda', value === 'manual' ? undefined : value);
        break;
      }
      case 'atoms': {
        userDirectory.setDraft(author, { atoms: value === 'manual' ? undefined : value });
        userDirectory.setIdentityDraft(author, 'atoms', value === 'manual' ? undefined : value);
        break;
      }
      case 'team': {
        userDirectory.setDraft(author, { team: value === 'none' ? undefined : value });
        break;
      }
      default:
        // Treat unknown suffix after userlink_ as generic provider id
        if (field && field.length > 0) {
          userDirectory.setIdentityDraft(author, field, value === 'manual' ? undefined : value);
        }
        break;
    }
  } catch (e) {
    logger.error(`userLink select failed: ${e}`);
  }
}

export async function handleUserLinkButton(interaction: ButtonInteraction) {
  const [, sub] = interaction.customId.split('_'); // userlink_save|cancel
  const author = interaction.user.id;

  if (sub === 'cancel') {
    userDirectory.clearDraft(author);
    try {
      await interaction.update({ content: '❎ Cancelled user link operation.', components: [] });
    } catch {
      try { await interaction.editReply({ content: '❎ Cancelled user link operation.', components: [] }); } catch {}
    }
    return;
  }

  if (sub === 'save') {
    const draft = userDirectory.getDraft(author) || {};
    if (!draft.discordId) {
      try {
        await interaction.reply({ content: '❌ Please select a Discord user first.', flags: MessageFlags.Ephemeral });
      } catch {}
      return;
    }

    userDirectory.upsert({
      discordId: draft.discordId,
      discordTag: draft.discordTag || null,
      github: draft.github || null,
      jira: draft.jira || null,
      linear: (draft as any).linear || null,
      coda: (draft as any).coda || null,
      atoms: (draft as any).atoms || null,
      team: (draft.team as any) || null,
      identities: (draft as any).identities || null,
    });
    userDirectory.clearDraft(author);

    const summary = [
      `Discord: <@${draft.discordId}>${draft.discordTag ? ` (${draft.discordTag})` : ''}`,
      `GitHub: ${draft.github || '—'}`,
      `Jira: ${draft.jira || '—'}`,
      `Linear: ${(draft as any).linear || '—'}`,
      `Coda: ${(draft as any).coda || '—'}`,
      `Atoms: ${(draft as any).atoms || '—'}`,
      `Team: ${draft.team || '—'}`,
    ].join(' | ');

    try {
      await interaction.update({ content: `✅ Saved link. ${summary}`, components: [] });
    } catch {
      try { await interaction.editReply({ content: `✅ Saved link. ${summary}`, components: [] }); } catch {}
    }
    return;
  }

  // Paging controls for provider selects
  if (interaction.customId === 'userlink_page_next' || interaction.customId === 'userlink_page_prev') {
    const draft = userDirectory.getDraft(author) || {};
    const nextPage = interaction.customId.endsWith('next') ? 2 : 1;
    (draft as any).__page = nextPage as any;
    userDirectory.setDraft(author, draft as any);
    try {
      const { renderUserLinkUI } = await import('../commands/userLink');
      await renderUserLinkUI(interaction as any, nextPage);
    } catch (e) {
      try { await interaction.reply({ content: `❌ Failed to switch page: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral }); } catch {}
    }
    return;
  }

  // Team management (RW): add/remove
  if (sub === 'addteam') {
    const modal = new ModalBuilder().setCustomId('userlink_addteam_modal').setTitle('Add Team');
    const input = new TextInputBuilder().setCustomId('team_name').setLabel('Team name').setStyle(TextInputStyle.Short).setRequired(true);
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    try { await interaction.showModal(modal); } catch {}
    return;
  }
  if (sub === 'removeteam') {
    const modal = new ModalBuilder().setCustomId('userlink_removeteam_modal').setTitle('Remove Team');
    const input = new TextInputBuilder().setCustomId('team_name').setLabel('Team name to remove').setStyle(TextInputStyle.Short).setRequired(true);
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    try { await interaction.showModal(modal); } catch {}
    return;
  }
  // removed: legacy search modal path for provider users (replaced by combo boxes)


}

export async function handleUserLinkModal(interaction: ModalSubmitInteraction) {
  const id = interaction.customId;
  if (id === 'userlink_addteam_modal') {
    const name = interaction.fields.getTextInputValue('team_name')?.trim();
    if (name) userDirectory.addTeam(name);
    try { await interaction.reply({ content: `✅ Team added: ${name}`, flags: MessageFlags.Ephemeral }); } catch {}
  } else if (id === 'userlink_removeteam_modal') {
    const name = interaction.fields.getTextInputValue('team_name')?.trim();
    if (name) userDirectory.removeTeam(name);
    try { await interaction.reply({ content: `✅ Team removed: ${name}`, flags: MessageFlags.Ephemeral }); } catch {}
  }
}
// Named exports only to avoid bundler chunking bugs
