import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { CalendarService } from '../../calendar/calendarService';

const prisma = new (PrismaClient as any)();
const svc = new CalendarService(prisma);

export const scheduleCommand = {
  data: {
    name: 'schedule',
    description: 'Smart scheduling via Google Calendar',
    options: [
      {
        name: 'suggest',
        type: 1,
        description: 'Suggest free slots within working hours',
        options: [
          {
            name: 'duration',
            type: 4,
            description: 'Duration in minutes',
            min_value: 15,
            max_value: 240,
            required: false
          },
          {
            name: 'count',
            type: 4,
            description: 'Number of options',
            min_value: 1,
            max_value: 10,
            required: false
          }
        ]
      },
      {
        name: 'prefs',
        type: 1,
        description: 'View or set scheduling preferences',
        options: [
          {
            name: 'timezone',
            type: 3,
            description: 'IANA TZ, e.g., America/Los_Angeles'
          },
          {
            name: 'work_start',
            type: 4,
            description: 'Workday start (minutes since midnight)'
          },
          {
            name: 'work_end',
            type: 4,
            description: 'Workday end (minutes since midnight)'
          },
          {
            name: 'buffer',
            type: 4,
            description: 'Buffer minutes between meetings'
          }
        ]
      },
      {
        name: 'my',
        type: 1,
        description: 'Show your upcoming booked meetings'
      }
    ]
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    if (sub === 'suggest') {
      try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
      const duration = interaction.options.getInteger('duration') ?? 30;
      const count = interaction.options.getInteger('count') ?? 5;
      const slots = await svc.suggestSlots({ userId, durationMin: duration, count });
      const pref = await svc.getPreferences(userId);
      if (!slots.length) return await interaction.editReply({ content: 'No free slots found within your working hours.' });
      const eb = new EmbedBuilder()
        .setTitle('Suggested slots')
        .setDescription(`Timezone: ${pref.timezone}. Click Hold to reserve a slot (15 min TTL).`)
        .setColor(0x00a884);
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (const s of slots) {
        const label = `${s.start.toISOString().slice(0,16).replace('T',' ')} → ${s.end.toISOString().slice(11,16)} UTC`;
        // Encode slot in button id; server will persist a real hold
        const customId = `sched_hold_${userId}_${s.start.getTime()}_${s.end.getTime()}`;
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(customId).setStyle(ButtonStyle.Secondary).setLabel(`Hold: ${label}`)
        );
        rows.push(row);
      }
      return await interaction.editReply({ embeds: [eb], components: rows.slice(0,5) as any });
    }
    if (sub === 'prefs') {
      try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
      const tz = interaction.options.getString('timezone') || undefined;
      const ws = interaction.options.getInteger('work_start') || undefined;
      const we = interaction.options.getInteger('work_end') || undefined;
      const buf = interaction.options.getInteger('buffer') || undefined;
      if (tz || ws !== undefined || we !== undefined || buf !== undefined) {
        await svc.setPreferences(userId, { timezone: tz, workStartMin: ws, workEndMin: we, bufferMinutes: buf });
      }
      const pref = await svc.getPreferences(userId);
      const eb = new EmbedBuilder()
        .setTitle('Scheduling Preferences')
        .addFields(
          { name: 'Time zone', value: pref.timezone, inline: true },
          { name: 'Work start', value: `${pref.workStartMin} min`, inline: true },
          { name: 'Work end', value: `${pref.workEndMin} min`, inline: true },
          { name: 'Buffer', value: `${pref.bufferMinutes} min`, inline: true },
        )
        .setColor(0x5865F2);
      return await interaction.editReply({ embeds: [eb] });
    }
    if (sub === 'my') {
      try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
      const upcoming = await prisma.booking.findMany({ where: { userId }, orderBy: { slotStart: 'asc' }, take: 10 });
      if (!upcoming.length) return await interaction.editReply({ content: 'No upcoming bookings.' });
      const eb = new EmbedBuilder().setTitle('My bookings').setColor(0x5865F2);
      for (const b of upcoming) {
        eb.addFields({ name: b.title, value: `${b.slotStart.toISOString()} → ${b.slotEnd.toISOString()}\n${b.conferenceUrl || b.htmlLink || ''}` });
      }
      return await interaction.editReply({ embeds: [eb] });
    }
  }
};
