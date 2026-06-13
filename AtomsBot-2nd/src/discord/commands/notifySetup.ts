import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { databaseService } from '../../database/DatabaseService';

export const data = {
  name: 'notify-setup',
  description: 'Configure notification feed channels',
  options: [
    {
      name: 'set',
      type: 1,
      description: 'Map event type to channel',
      options: [
        {
          name: 'event',
          type: 3,
          description: 'Event type (issues|github|deployments|all)',
          required: true
        },
        {
          name: 'channel',
          type: 7,
          description: 'Target text channel',
          channel_types: [0],
          required: true
        }
      ]
    },
    {
      name: 'list',
      type: 1,
      description: 'List current mappings'
    }
  ]
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;
  const kv = databaseService as any;
  if (sub === 'set') {
    const event = interaction.options.getString('event', true);
    const channel = interaction.options.getChannel('channel', true);
    try {
      await kv.setNotificationChannel(guildId, event, channel.id);
      return interaction.reply({ content: `✅ Mapped '${event}' to <#${channel.id}>`, flags: MessageFlags.Ephemeral });
    } catch (e: any) {
      return interaction.reply({ content: `❌ Failed to save mapping: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
    }
  }
  if (sub === 'list') {
    try {
      const rows = await (kv.getNotificationChannels?.(guildId) || Promise.resolve([]));
      const lines = (rows || []).map((r: any) => `• ${r.event} → <#${r.channelId}>`).join('\n') || 'No mappings';
      return interaction.reply({ content: `Notification mappings:\n${lines}`, flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Failed to load mappings', flags: MessageFlags.Ephemeral });
    }
  }
  return interaction.reply({ content: '❌ Unknown subcommand', flags: MessageFlags.Ephemeral });
}

