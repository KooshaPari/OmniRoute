import { notificationHub } from '../notifications/NotificationHub';
import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { CalendarService } from './calendarService';
import { secretsStore } from '../settings/SecretsStore';
import { getConferenceLink } from './conference';

const prisma = new PrismaClient();
const calendarSvc = new CalendarService(prisma);

async function parseOffsets(): Promise<number[]> {
  const raw = (await secretsStore.get('reminder_offsets')) || process.env.REMINDER_OFFSETS || '15,5';
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a); // largest first
}

export async function checkDueReminders() {
  const guildId = (process.env.DISCORD_GUILD_ID as string) || '';
  if (!guildId) return;
  const offsets = await parseOffsets();
  if (!offsets.length) return;
  const now = new Date();
  const windowEnd = new Date(Date.now() + (Math.max(...offsets) + 2) * 60_000);
  const items = await calendarSvc.listEventsInWindow({ start: now, end: windowEnd });
  for (const e of items) {
    const startIso = e.start?.dateTime || e.start?.date;
    if (!startIso) continue;
    const start = new Date(startIso.length === 10 ? `${startIso}T00:00:00` : startIso);
    const minsUntil = Math.floor((start.getTime() - now.getTime()) / 60_000);
    if (!offsets.includes(minsUntil)) continue;
    // dedupe
    const eventId = String(e.id);
    const primary = (await secretsStore.get('gcal_primary_calendar_id')) || process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';
    const calendarId = String(primary);
    const account = await prisma.calendarAccount.findFirst();
    if (!account) continue;
    const exists = await prisma.reminderDelivery.findUnique({
      where: { accountId_calendarId_eventId_offsetMinute: { accountId: account.id, calendarId, eventId, offsetMinute: minsUntil } },
    }).catch(() => null);
    if (exists) continue;
    // send
    const title = e.summary || '(No title)';
    const link = getConferenceLink(e) || e.htmlLink || undefined;
    const embed = new EmbedBuilder()
      .setTitle(`Meeting in ${minsUntil}m: ${title}`)
      .setDescription(`${fmtTimeRange(e)}\n${e.description || ''}`.trim())
      .setURL(e.htmlLink || null as any)
      .setColor(0x3b82f6)
      .setTimestamp(new Date());
    const actions = link ? [ { label: 'Join', url: link, style: ButtonStyle.Link as const } ] : undefined;
    await notificationHub.upsertEvent(guildId, 'calendar', `gcal:${eventId}`, embed, actions);
    // record
    await prisma.reminderDelivery.create({ data: { accountId: account.id, calendarId, eventId, offsetMinute: minsUntil, deliveredAt: new Date() } }).catch(() => {});
  }
}

function fmtTimeRange(e: any) {
  const s = getDate(e.start?.dateTime || e.start?.date);
  const en = getDate(e.end?.dateTime || e.end?.date);
  if (!s || !en) return 'Time TBA';
  const pad = (n: number) => String(n).padStart(2, '0');
  const sH = pad(s.getHours()); const sM = pad(s.getMinutes());
  const eH = pad(en.getHours()); const eM = pad(en.getMinutes());
  const day = `${s.getMonth() + 1}/${s.getDate()}`;
  return `${day} ${sH}:${sM}-${eH}:${eM}`;
}
function getDate(s?: string | null) {
  if (!s) return undefined;
  if (s.length === 10) return new Date(s + 'T00:00:00');
  return new Date(s);
}

let timer: NodeJS.Timer | undefined;
export function startReminderLoop() {
  if (timer) return;
  timer = setInterval(() => { void checkDueReminders(); }, 60_000);
  // small delay to warm up
  setTimeout(() => { void checkDueReminders(); }, 10_000);
}
