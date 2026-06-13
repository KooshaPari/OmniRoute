import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { CalendarService } from '../../calendar/calendarService';
import { getConferenceLink } from '../../calendar/conference';

const prisma = new PrismaClient();
const svc = new CalendarService(prisma);

export const meetingCommand = {
  data: {
    name: 'meeting',
    description: 'View meetings from Google Calendar',
    options: [
      {
        name: 'today',
        type: 1,
        description: 'List today\'s meetings',
        options: [
          {
            name: 'atoms_only',
            type: 5,
            description: 'Only atoms/atoms.tech meetings'
          }
        ]
      },
      {
        name: 'in',
        type: 1,
        description: 'List meetings in the next period, e.g. 3h, 24h, 7d',
        options: [
          {
            name: 'period',
            type: 3,
            description: 'e.g. 3h, 24h, 7d',
            required: true
          },
          {
            name: 'atoms_only',
            type: 5,
            description: 'Only atoms/atoms.tech meetings'
          }
        ]
      },
      {
        name: 'now',
        type: 1,
        description: 'Show meetings happening now or starting soon',
        options: [
          {
            name: 'within_minutes',
            type: 4,
            description: 'Window in minutes (default 15)',
            min_value: 1
          }
        ]
      },
      {
        name: 'updated',
        type: 1,
        description: 'List meetings updated within a period (e.g. 1h, today)',
        options: [
          {
            name: 'since',
            type: 3,
            description: 'e.g. 15m, 1h, today',
            required: true
          },
          {
            name: 'atoms_only',
            type: 5,
            description: 'Only atoms/atoms.tech meetings'
          }
        ]
      },
      {
        name: 'create',
        type: 1,
        description: 'Create a meeting with Google Meet',
        options: [
          {
            name: 'title',
            type: 3,
            description: 'Meeting title',
            required: true
          },
          {
            name: 'start',
            type: 3,
            description: 'Start time ISO, e.g. 2025-09-02T15:00',
            required: true
          },
          {
            name: 'duration',
            type: 4,
            description: 'Duration minutes (default 30)',
            min_value: 5
          },
          {
            name: 'attendees',
            type: 3,
            description: 'Comma-separated emails'
          },
          {
            name: 'description',
            type: 3,
            description: 'Description/agenda'
          }
        ]
      },
      {
        name: 'details',
        type: 1,
        description: 'Show details for a meeting and links',
        options: [
          {
            name: 'id',
            type: 3,
            description: 'Google event ID'
          },
          {
            name: 'title',
            type: 3,
            description: 'Search by title'
          },
          {
            name: 'date',
            type: 3,
            description: 'ISO date, e.g. 2025-09-02'
          },
          {
            name: 'persist',
            type: 5,
            description: 'Post to the configured calendar channel'
          }
        ]
      },
      {
        name: 'attach',
        type: 1,
        description: 'Attach a notes or recording link to an event',
        options: [
          {
            name: 'id',
            type: 3,
            description: 'Google event ID',
            required: true
          },
          {
            name: 'type',
            type: 3,
            description: 'notes or recording',
            required: true
          },
          {
            name: 'url',
            type: 3,
            description: 'URL to attach',
            required: true
          }
        ]
      }
    ]
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'today') return await handleToday(interaction);
      if (sub === 'in') return await handleIn(interaction);
      if (sub === 'now') return await handleNow(interaction);
      if (sub === 'updated') return await handleUpdated(interaction);
      if (sub === 'create') return await handleCreate(interaction);
      if (sub === 'details') return await handleDetails(interaction);
      if (sub === 'attach') return await handleAttach(interaction);
      await interaction.reply({ content: 'Unknown subcommand', flags: MessageFlags.Ephemeral });
    } catch (e: any) {
      await interaction.reply({ content: `Calendar error: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
    }
  },
};

function parsePeriod(input: string): number {
  const s = input.trim().toLowerCase();
  if (s === 'today') {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23,59,59,999);
    return end.getTime() - now.getTime();
  }
  const m = s.match(/^(\d+)(m|h|d)$/);
  if (!m) throw new Error('Invalid period. Use N[m|h|d], e.g., 15m, 3h, 1d');
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  if (unit === 'd') return n * 24 * 60 * 60 * 1000;
  throw new Error('Invalid period');
}

async function handleToday(interaction: ChatInputCommandInteraction) {
  const atomsOnly = interaction.options.getBoolean('atoms_only') || false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0,0,0,0);
  const end = new Date(now);
  end.setHours(23,59,59,999);
  const items = await svc.listEventsInWindow({ start, end, atomsOnly });
  const embed = buildListEmbed('Today\'s Meetings', items);
  const components = buildListingComponents(items, interaction.user.id);
  await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

async function handleIn(interaction: ChatInputCommandInteraction) {
  const atomsOnly = interaction.options.getBoolean('atoms_only') || false;
  const period = interaction.options.getString('period', true);
  const delta = parsePeriod(period);
  const start = new Date();
  const end = new Date(Date.now() + delta);
  const items = await svc.listEventsInWindow({ start, end, atomsOnly });
  const embed = buildListEmbed(`Meetings in next ${period}`, items);
  const components = buildListingComponents(items, interaction.user.id);
  await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

async function handleNow(interaction: ChatInputCommandInteraction) {
  const within = interaction.options.getInteger('within_minutes') ?? 15;
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const end = new Date(Date.now() + within * 60 * 1000);
  const items = await svc.listEventsInWindow({ start, end });
  const filtered = items.filter((e) => {
    const s = getDate(e.start?.dateTime || e.start?.date);
    const en = getDate(e.end?.dateTime || e.end?.date);
    const now = new Date();
    return s && en && s.getTime() <= now.getTime() && en.getTime() >= now.getTime();
  });
  const embed = buildListEmbed(`Meetings now (±${within}m)`, filtered);
  // If exactly one current meeting, add a Join button
  let components: any[] = [];
  if (filtered.length === 1) {
    const link = getConferenceLink(filtered[0]);
    if (link) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Meet').setURL(link),
      );
      components = [row as any];
    }
  }
  await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

async function handleUpdated(interaction: ChatInputCommandInteraction) {
  const atomsOnly = interaction.options.getBoolean('atoms_only') || false;
  const since = interaction.options.getString('since', true);
  const delta = parsePeriod(since);
  const end = new Date();
  const start = new Date(Date.now() - delta);
  const items = await svc.listEventsInWindow({ start, end, atomsOnly });
  const filtered = items.filter((e) => {
    const upd = e.updated ? new Date(e.updated) : undefined;
    return upd && upd.getTime() >= start.getTime();
  });
  const embed = buildListEmbed(`Meetings updated in ${since}`, filtered);
  const components = buildListingComponents(filtered, interaction.user.id);
  await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

function getDate(s?: string | null) {
  if (!s) return undefined;
  if (s.length === 10) return new Date(s + 'T00:00:00');
  return new Date(s);
}

function buildListEmbed(title: string, items: any[]) {
  const eb = new EmbedBuilder().setTitle(title).setColor(0x60a5fa).setTimestamp(new Date());
  if (!items || items.length === 0) {
    eb.setDescription('No meetings found.');
    return eb;
  }
  const lines = items.slice(0, 15).map((e) => {
    const start = getDate(e.start?.dateTime || e.start?.date);
    const end = getDate(e.end?.dateTime || e.end?.date);
    const when = start && end ? fmtRange(start, end) : 'Time TBA';
    const link = getConferenceLink(e) || '';
    const title = e.summary || '(No title)';
    const atoms = ((title || '').toLowerCase().includes('atoms') || (title || '').toLowerCase().includes('atoms.tech')) ? ' [atoms]' : '';
    const linkTxt = link ? ` • [link](${link})` : '';
    const idTxt = e.id ? ` • [id: ${e.id}]` : '';
    return `• ${when} — ${title}${atoms}${linkTxt}${idTxt}`;
  });
  eb.setDescription(lines.join('\n'));
  return eb;
}

function fmtRange(s: Date, e: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const sH = pad(s.getHours());
  const sM = pad(s.getMinutes());
  const eH = pad(e.getHours());
  const eM = pad(e.getMinutes());
  const day = `${s.getMonth() + 1}/${s.getDate()}`;
  return `${day} ${sH}:${sM}-${eH}:${eM}`;
}

function buildListingComponents(items: any[], userId: string) {
  const first = (items || []).slice(0, 5);
  const rows: any[] = [];
  if (first.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const e of first) {
      if (!e?.id) continue;
      row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`meeting_details_${e.id}_${userId}`).setLabel(shorten(e.summary || 'Details', 20)));
    }
    if (row.components.length) rows.push(row as any);
  }
  if ((items || []).length > 5) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`meeting_pick_${userId}`)
      .setPlaceholder('Select a meeting to view details')
      .addOptions(
        (items || []).slice(0, 25).map((e: any) => ({
          label: shorten(`${fmtShort(getDate(e.start?.dateTime || e.start?.date))} ${e.summary || '(No title)'}`, 100),
          value: String(e.id || ''),
          description: shorten(e.id || '', 100),
        }))
      );
    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    rows.push(menuRow as any);
  }
  return rows;
}
function shorten(s: string, n: number) { return s.length > n ? s.slice(0, n-1) + '…' : s; }
function fmtShort(d?: Date) {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  // Permissions
  const allow = (process.env.MEETING_CREATE_ALLOWED_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allow.length && !allow.includes(interaction.user.id)) {
    await interaction.reply({ content: 'You are not allowed to create meetings.', flags: MessageFlags.Ephemeral });
    return;
  }
  const title = interaction.options.getString('title', true);
  const startStr = interaction.options.getString('start', true);
  const duration = interaction.options.getInteger('duration') ?? 30;
  const attendeesStr = interaction.options.getString('attendees') || '';
  const description = interaction.options.getString('description') || undefined;
  const start = new Date(startStr);
  if (isNaN(start.getTime())) {
    await interaction.reply({ content: 'Invalid start time. Use ISO like 2025-09-02T15:00', flags: MessageFlags.Ephemeral });
    return;
  }
  const end = new Date(start.getTime() + duration * 60_000);
  const attendees = attendeesStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
  const ev = await svc.createMeetingWithMeet({ summary: title, description, start, end, attendees });
  const link = getConferenceLink(ev) || ev.htmlLink || '';
  const embed = new EmbedBuilder()
    .setTitle(`Meeting created: ${title}`)
    .setDescription(`${start.toLocaleString()} - ${end.toLocaleTimeString()}`)
    .setURL(ev.htmlLink || null as any)
    .setColor(0x22c55e);
  const row = link ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Meet').setURL(link)) : undefined;
  await interaction.reply({ embeds: [embed], components: row ? [row as any] : [], flags: MessageFlags.Ephemeral });
}

async function handleDetails(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id') || '';
  const title = interaction.options.getString('title') || '';
  const dateStr = interaction.options.getString('date') || '';
  const persist = interaction.options.getBoolean('persist') || false;
  const calId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';
  let event: any | undefined;
  if (id) {
    event = await svc.getEventById(calId, id);
  } else {
    // Basic search in a 24h window around date or today
    const base = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(base); start.setHours(0,0,0,0);
    const end = new Date(base); end.setHours(23,59,59,999);
    const items = await svc.listEventsInWindow({ start, end });
    const q = title.toLowerCase();
    event = items.find((e: any) => (e.summary || '').toLowerCase().includes(q));
  }
  if (!event) {
    await interaction.reply({ content: 'Event not found. Provide an id or title/date.', flags: MessageFlags.Ephemeral });
    return;
  }
  const { buildEventEmbed } = await import('../../calendar/eventFormat');
  const { embed, actions } = buildEventEmbed(event);
  if (persist) {
    const { notificationHub } = await import('../../notifications/NotificationHub');
    const guildId = (process.env.DISCORD_GUILD_ID as string) || '';
    if (!guildId) {
      await interaction.reply({ content: 'No guild configured for persistence.', flags: MessageFlags.Ephemeral });
      return;
    }
    await notificationHub.upsertEvent(guildId, 'calendar', `gcal:${event.id}`, embed, actions);
    await interaction.reply({ content: 'Posted to calendar channel.', flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ embeds: [embed], components: actions?.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...actions.map(a => new ButtonBuilder().setStyle(a.style || ButtonStyle.Secondary).setLabel(a.label).setURL(a.url!)) as any)] : [], flags: MessageFlags.Ephemeral });
  }
}

async function handleAttach(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const type = (interaction.options.getString('type', true) || '').toLowerCase();
  const url = interaction.options.getString('url', true);
  if (!/^https?:\/\//i.test(url)) {
    await interaction.reply({ content: 'Invalid URL', flags: MessageFlags.Ephemeral });
    return;
  }
  if (type !== 'notes' && type !== 'recording') {
    await interaction.reply({ content: 'Type must be "notes" or "recording"', flags: MessageFlags.Ephemeral });
    return;
  }
  const calId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';
  const ev = await svc.updateEventDescription(calId, id, (prev) => {
    const lines = prev ? prev.split(/\r?\n/) : [];
    const prefix = type === 'notes' ? 'Notes:' : 'Recording:';
    const others = lines.filter((l) => !l.match(new RegExp(`^${prefix}`, 'i')));
    return [...others, `${prefix} ${url}`].join('\n');
  });
  const link = getConferenceLink(ev) || ev.htmlLink || '';
  const embed = new EmbedBuilder()
    .setTitle(`Updated ${type} link`)
    .setDescription(`Attached ${type}: ${url}`)
    .setURL(ev.htmlLink || null as any)
    .setColor(0x60a5fa);
  const row = link ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Meet').setURL(link)) : undefined;
  await interaction.reply({ embeds: [embed], components: row ? [row as any] : [], flags: MessageFlags.Ephemeral });
}
