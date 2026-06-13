import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { registerCommands } from '../registerCommands';

const ADMIN_ID = '201372818611372032';

export const data = {
  name: 'admin',
  description: 'Admin tools',
  options: [
    { name: 'reload-commands', type: 1, description: 'Reload slash commands for this guild' },
    { name: 'status', type: 1, description: 'Show bot status and config summary' },
    { name: 'help', type: 1, description: 'Show admin help' },
  ],
};

function isAuthorized(interaction: ChatInputCommandInteraction): boolean {
  if (interaction.user.id === ADMIN_ID) return true;
  const member: any = interaction.member;
  try {
    return Boolean(member?.permissions?.has?.(PermissionFlagsBits.Administrator));
  } catch {
    return false;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(false) || 'help';
  if (!isAuthorized(interaction)) {
    return interaction.reply({ content: '❌ Not authorized.', flags: MessageFlags.Ephemeral });
  }
  if (sub === 'reload-commands') {
    const guildId = interaction.guildId || undefined;
    await interaction.reply({ content: `Reloading commands for ${guildId || 'global'}…`, flags: MessageFlags.Ephemeral });
    await registerCommands(guildId);
    return interaction.followUp({ content: '✅ Commands reloaded.', flags: MessageFlags.Ephemeral });
  }
  if (sub === 'status') {
    const enabled = {
      jira: (process.env.PM_ENABLED_JIRA || 'true').toLowerCase() === 'true',
      linear: (process.env.PM_ENABLED_LINEAR || 'true').toLowerCase() === 'true',
      github_projects: (process.env.PM_ENABLED_GITHUB_PROJECTS || 'true').toLowerCase() === 'true',
      coda: (process.env.PM_ENABLED_CODA || 'true').toLowerCase() === 'true',
      atoms: (process.env.PM_ENABLED_ATOMS || 'true').toLowerCase() === 'true',
    } as const;
    const sync = {
      jira: (process.env.PM_SYNC_JIRA || 'true').toLowerCase() === 'true',
      linear: (process.env.PM_SYNC_LINEAR || 'true').toLowerCase() === 'true',
      github_projects: (process.env.PM_SYNC_GITHUB_PROJECTS || 'true').toLowerCase() === 'true',
      coda: (process.env.PM_SYNC_CODA || 'true').toLowerCase() === 'true',
      atoms: (process.env.PM_SYNC_ATOMS || 'true').toLowerCase() === 'true',
    } as const;
    return interaction.reply({ content: `⚙️ Providers\n• Enabled → Jira:${enabled.jira?'on':'off'} Linear:${enabled.linear?'on':'off'} GH_Projects:${enabled.github_projects?'on':'off'} Coda:${enabled.coda?'on':'off'} Atoms:${enabled.atoms?'on':'off'}\n• Sync → Jira:${sync.jira?'on':'off'} Linear:${sync.linear?'on':'off'} GH_Projects:${sync.github_projects?'on':'off'} Coda:${sync.coda?'on':'off'} Atoms:${sync.atoms?'on':'off'}`, flags: MessageFlags.Ephemeral });
  }
  // help or unknown
  return interaction.reply({ content: 'Admin commands:\n• /admin reload-commands — reload slash commands for this guild\n• /admin status — show provider/enable status', flags: MessageFlags.Ephemeral });
}

export const adminCommand = { data, execute };
