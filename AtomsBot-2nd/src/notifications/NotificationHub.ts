import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import client from '../discord/discord';
import { databaseService } from '../database/DatabaseService';

type EventType = 'issues'|'github'|'deployments'|'all'|string;

export class NotificationHub {
  async upsertEvent(guildId: string, eventType: EventType, eventId: string, embed: EmbedBuilder, actions?: Array<{ label: string; url?: string; customId?: string; style?: ButtonStyle }>): Promise<void> {
    const row = await databaseService.findEventMessage(guildId, eventType, eventId).catch(() => null) as any;
    const channelId = await databaseService.resolveNotificationChannel(guildId, eventType).catch(() => undefined) as any;
    if (!channelId) return; // unmapped
    const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel | null;
    if (!channel) return;
    const rowButtons = new ActionRowBuilder<ButtonBuilder>();
    for (const a of (actions||[])) {
      const btn = new ButtonBuilder().setLabel(a.label).setStyle(a.style || ButtonStyle.Secondary);
      if (a.url) btn.setStyle(ButtonStyle.Link).setURL(a.url);
      if (a.customId) btn.setCustomId(a.customId);
      rowButtons.addComponents(btn);
    }
    if (row?.messageId) {
      try {
        const msg = await channel.messages.fetch(row.messageId).catch(() => null);
        if (msg) { await msg.edit({ embeds: [embed], components: actions && actions.length ? [rowButtons] : [] }); return; }
      } catch {}
    }
    const sent = await channel.send({ embeds: [embed], components: actions && actions.length ? [rowButtons] : [] });
    await databaseService.upsertEventMessage({ guildId, eventType, eventId, channelId, messageId: sent.id });
  }
}

export const notificationHub = new NotificationHub();

