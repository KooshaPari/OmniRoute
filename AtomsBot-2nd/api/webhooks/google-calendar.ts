import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { createCalendarClientFromRefreshToken } from '../../src/google/calendarClient';
import { CalendarService } from '../../src/calendar/calendarService';
import { notificationHub } from '../../src/notifications/NotificationHub';
import { buildEventEmbed } from '../../src/calendar/eventFormat';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Headers per Google push notifications
    const state = String(req.headers['x-goog-resource-state'] || '');
    const rid = String(req.headers['x-goog-resource-id'] || '');
    const cid = String(req.headers['x-goog-channel-id'] || '');
    const exp = String(req.headers['x-goog-channel-expiration'] || '');
    console.log('Google Calendar notify', { state, rid, cid, exp });
    const account = await prisma.calendarAccount.findFirst();
    if (account) {
      // Sync and refresh Discord persistent messages for changed events
      const svc = new CalendarService(prisma);
      const updatedMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
      await svc.syncUpdatesSince(updatedMin);

      // Fetch last 1 day window to refresh embeds for modified items
      const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
      const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';
      const list = await calendar.events.list({ calendarId, updatedMin, singleEvents: true, maxResults: 100 });
      const guildId = (process.env.DISCORD_GUILD_ID as string) || '';
      for (const e of list.data.items || []) {
        const { embed, actions } = buildEventEmbed(e);
        const eventId = `gcal:${e.id}`;
        if (guildId) await notificationHub.upsertEvent(guildId, 'calendar', eventId, embed, actions);
      }
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Webhook failure' });
  }
}
