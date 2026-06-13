import { PrismaClient } from '@prisma/client';
import { createCalendarClientFromRefreshToken } from '../google/calendarClient';
import { secretsStore } from '../settings/SecretsStore';
import { DateTime } from 'luxon';

export class CalendarService {
  constructor(private prisma: PrismaClient) {}

  async getPrimaryAccount() {
    return this.prisma.calendarAccount.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  async listEventsInWindow(params: { start: Date; end: Date; atomsOnly?: boolean; calendarId?: string; }) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = params.calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const res = await calendar.events.list({
      calendarId,
      timeMin: params.start.toISOString(),
      timeMax: params.end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    });
    const atomsKw = (await secretsStore.get('atoms_keywords')) ?? process.env.ATOMS_KEYWORDS;
    const kw = (atomsKw !== undefined ? atomsKw : 'atoms,atoms.tech')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const items = (res.data.items || []).filter((e) => {
      if (!params.atomsOnly) return true;
      const title = (e.summary || '').toLowerCase();
      const attendees = (e.attendees || []).map((a) => (a.email || '').toLowerCase()).join(' ');
      return kw.some((k) => title.includes(k) || attendees.includes(k));
    });
    return items;
  }

  async createMeetingWithMeet(params: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: Array<{ email: string; optional?: boolean }>;
    calendarId?: string;
  }) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = params.calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const requestId = `atoms-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const res = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.start.toISOString() },
        end: { dateTime: params.end.toISOString() },
        attendees: params.attendees,
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });
    return res.data;
  }

  async getEventById(calendarId: string, eventId: string) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calId = calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const res = await calendar.events.get({ calendarId: calId, eventId });
    return res.data;
  }

  async updateEventDescription(calendarId: string, eventId: string, updater: (prev: string) => string) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calId = calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const current = await calendar.events.get({ calendarId: calId, eventId });
    const prev = current.data.description || '';
    const description = updater(prev);
    const res = await calendar.events.patch({ calendarId: calId, eventId, requestBody: { description } });
    return res.data;
  }

  async syncUpdatesSince(updatedMinISO: string) {
    const account = await this.getPrimaryAccount();
    if (!account) return { count: 0 };
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const res = await calendar.events.list({ calendarId, updatedMin: updatedMinISO, singleEvents: true, maxResults: 2500 });
    const events = res.data.items || [];
    const atomsKw = (await secretsStore.get('atoms_keywords')) ?? process.env.ATOMS_KEYWORDS;
    const kw = (atomsKw !== undefined ? atomsKw : 'atoms,atoms.tech').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const e of events) {
      const title = (e.summary || '').toLowerCase();
      const attendees = (e.attendees || []).map((a) => (a.email || '').toLowerCase()).join(' ');
      const atomsFlag = kw.some((k) => title.includes(k) || attendees.includes(k));
      await this.prisma.calendarEvent.upsert({
        where: { calendarId_eventId_accountId: { calendarId, eventId: String(e.id), accountId: account.id } },
        create: {
          accountId: account.id,
          calendarId,
          eventId: String(e.id),
          summary: e.summary || null,
          description: e.description || null,
          startTime: e.start?.dateTime ? new Date(e.start.dateTime) : (e.start?.date ? new Date(e.start.date + 'T00:00:00') : null),
          endTime: e.end?.dateTime ? new Date(e.end.dateTime) : (e.end?.date ? new Date(e.end.date + 'T00:00:00') : null),
          status: e.status || null,
          htmlLink: e.htmlLink || null,
          conferenceUrl: (e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri) || null,
          attachments: e.attachments ? JSON.stringify(e.attachments) : null,
          atomsFlag,
        },
        update: {
          summary: e.summary || null,
          description: e.description || null,
          startTime: e.start?.dateTime ? new Date(e.start.dateTime) : (e.start?.date ? new Date(e.start.date + 'T00:00:00') : null),
          endTime: e.end?.dateTime ? new Date(e.end.dateTime) : (e.end?.date ? new Date(e.end.date + 'T00:00:00') : null),
          status: e.status || null,
          htmlLink: e.htmlLink || null,
          conferenceUrl: (e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri) || null,
          attachments: e.attachments ? JSON.stringify(e.attachments) : null,
          atomsFlag,
        }
      });
    }
    return { count: events.length };
  }

  // Smart scheduling: availability via freeBusy
  async getFreeBusy(params: { start: Date; end: Date; calendarId?: string }) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = params.calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: params.start.toISOString(),
        timeMax: params.end.toISOString(),
        items: [{ id: calendarId }],
      },
    });
    const busy = res.data.calendars?.[calendarId]?.busy || [];
    return busy.map(b => ({ start: new Date(String(b.start)), end: new Date(String(b.end)) }));
  }

  // Preferences
  async getPreferences(userId: string) {
    let pref = await this.prisma.schedulingPreference.findUnique({ where: { userId } });
    if (!pref) {
      pref = await this.prisma.schedulingPreference.create({ data: { userId } });
    }
    return pref;
  }

  async setPreferences(userId: string, data: Partial<{ timezone: string; workStartMin: number; workEndMin: number; bufferMinutes: number }>) {
    return this.prisma.schedulingPreference.upsert({
      where: { userId },
      update: data as any,
      create: { userId, timezone: data.timezone || 'UTC', workStartMin: data.workStartMin ?? 540, workEndMin: data.workEndMin ?? 1020, bufferMinutes: data.bufferMinutes ?? 15 },
    });
  }

  // Suggest slots using prefs and Google busy + custom blocks
  async suggestSlots(params: { userId: string; durationMin: number; start?: Date; end?: Date; count?: number }) {
    const { userId, durationMin } = params;
    const pref = await this.getPreferences(userId);
    const start = params.start || new Date();
    const end = params.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const buffer = pref.bufferMinutes;
    // Gather busy blocks
    const gcalBusy = await this.getFreeBusy({ start, end });
    const blocks = await this.prisma.availabilityWindow.findMany({ where: { userId, start: { lt: end }, end: { gt: start } } });
    const customBusy = blocks.map(b => ({ start: b.start, end: b.end }));
    // Gather existing bookings to avoid collisions
    const bookings = await this.prisma.booking.findMany({ where: { userId, slotStart: { lt: end }, slotEnd: { gt: start } } });
    const bookingBusy = bookings.map(b => ({ start: b.slotStart, end: b.slotEnd }));
    const busy = [...gcalBusy, ...customBusy, ...bookingBusy].sort((a,b)=>a.start.getTime()-b.start.getTime());
    // Build working windows per day in user's timezone
    const zone = pref.timezone || 'UTC';
    const suggestions: Array<{ start: Date; end: Date; score?: number; note?: string }> = [];
    const want = Math.max(1, params.count ?? 5);
    // Iterate days in zone
    let dayCursor = DateTime.fromJSDate(start, { zone }).startOf('day');
    const endDt = DateTime.fromJSDate(end, { zone }).endOf('day');
    while (dayCursor <= endDt && suggestions.length < want * 4) {
      const wsZ = dayCursor.plus({ minutes: pref.workStartMin });
      const weZ = dayCursor.plus({ minutes: pref.workEndMin });
      // Convert working window to UTC Date objects
      const winStart = wsZ.toUTC().toJSDate();
      const winEnd = weZ.toUTC().toJSDate();
      if (winEnd <= start) { dayCursor = dayCursor.plus({ days: 1 }); continue; }
      const clampedStart = winStart < start ? start : winStart;
      const clampedEnd = winEnd > end ? end : winEnd;
      if (clampedEnd <= clampedStart) { dayCursor = dayCursor.plus({ days: 1 }); continue; }
      // Scan gaps using busy intervals
      let cursor = new Date(clampedStart);
      const relevant = busy.filter(b => b.end > clampedStart && b.start < clampedEnd);
      for (const b of relevant) {
        const gapEnd = new Date(Math.min(b.start.getTime() - buffer * 60 * 1000, clampedEnd.getTime()));
        const gapStart = new Date(Math.max(cursor.getTime(), clampedStart.getTime()));
        if (gapEnd.getTime() - gapStart.getTime() >= durationMin * 60 * 1000 && suggestions.length < want) {
          const s = new Date(gapStart);
          const e = new Date(s.getTime() + durationMin * 60 * 1000);
          if (e <= gapEnd) {
            // Score: prefer mid-morning local time
            const localMid = wsZ.plus({ minutes: (pref.workEndMin - pref.workStartMin) / 2 });
            const sLocal = DateTime.fromJSDate(s, { zone });
            const score = 1 / (1 + Math.abs(sLocal.diff(localMid, 'minutes').minutes || 0));
            suggestions.push({ start: s, end: e, score, note: `${zone}` });
          }
        }
        cursor = new Date(Math.max(cursor.getTime(), b.end.getTime() + buffer * 60 * 1000));
        if (cursor >= clampedEnd) break;
      }
      // Tail gap
      if (cursor < clampedEnd && suggestions.length < want) {
        const s = new Date(cursor);
        const e = new Date(s.getTime() + durationMin * 60 * 1000);
        if (e <= clampedEnd) {
          const localMid = wsZ.plus({ minutes: (pref.workEndMin - pref.workStartMin) / 2 });
          const sLocal = DateTime.fromJSDate(s, { zone });
          const score = 1 / (1 + Math.abs(sLocal.diff(localMid, 'minutes').minutes || 0));
          suggestions.push({ start: s, end: e, score, note: `${zone}` });
        }
      }
      dayCursor = dayCursor.plus({ days: 1 });
    }
    // Sort by score desc then start
    suggestions.sort((a,b) => (b.score || 0) - (a.score || 0) || a.start.getTime() - b.start.getTime());
    return suggestions.slice(0, want);
  }

  async createHold(userId: string, start: Date, end: Date, ttlMinutes = 15) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return await this.prisma.holdReservation.create({ data: { userId, slotStart: start, slotEnd: end, expiresAt, status: 'held', provider: 'gcal' } });
  }

  async releaseHold(userId: string, holdId: string) {
    const hold = await this.prisma.holdReservation.findUnique({ where: { id: holdId } });
    if (!hold || hold.userId !== userId) throw new Error('Invalid hold');
    await this.prisma.holdReservation.delete({ where: { id: holdId } });
    return { ok: true };
  }

  async confirmHold(params: { userId: string; holdId: string; title: string; description?: string; attendees?: string[] }) {
    const hold = await this.prisma.holdReservation.findUnique({ where: { id: params.holdId } });
    if (!hold || hold.userId !== params.userId) throw new Error('Invalid hold');
    if (hold.expiresAt.getTime() <= Date.now()) { await this.prisma.holdReservation.delete({ where: { id: hold.id } }); throw new Error('Hold expired'); }
    const event = await this.createMeetingWithMeet({
      summary: params.title,
      description: params.description,
      start: hold.slotStart,
      end: hold.slotEnd,
      attendees: (params.attendees || []).map(e => ({ email: e })),
    });
    const booking = await this.prisma.booking.create({ data: {
      userId: params.userId,
      slotStart: hold.slotStart,
      slotEnd: hold.slotEnd,
      title: params.title,
      description: params.description || null,
      attendees: (params.attendees && params.attendees.length) ? JSON.stringify(params.attendees) : null,
      provider: 'gcal',
      eventId: String(event.id),
      htmlLink: event.htmlLink || null,
      conferenceUrl: (event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri) || null,
    }});
    await this.prisma.holdReservation.delete({ where: { id: hold.id } }).catch(()=>{});
    return { booking, event };
  }

  /**
   * Create a calendar event
   */
  async createEvent(eventData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: string[];
    reminders?: Array<{ method: string; minutes: number }>;
    location?: string;
    timezone?: string;
  }) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';
    
    const event = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone || 'UTC',
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timezone || 'UTC',
      },
      attendees: eventData.attendees?.map(email => ({ email })),
      location: eventData.location,
      reminders: eventData.reminders ? {
        useDefault: false,
        overrides: eventData.reminders.map(r => ({ method: r.method, minutes: r.minutes }))
      } : undefined
    };

    const result = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return {
      id: result.data.id!,
      url: result.data.htmlLink!,
      hangoutLink: result.data.hangoutLink
    };
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, eventData: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    attendees?: string[];
    location?: string;
    timezone?: string;
  }): Promise<boolean> {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';

    const updateData: any = {};
    if (eventData.title) updateData.summary = eventData.title;
    if (eventData.description) updateData.description = eventData.description;
    if (eventData.startTime) {
      updateData.start = {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone || 'UTC',
      };
    }
    if (eventData.endTime) {
      updateData.end = {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timezone || 'UTC',
      };
    }
    if (eventData.attendees) {
      updateData.attendees = eventData.attendees.map(email => ({ email }));
    }
    if (eventData.location) updateData.location = eventData.location;

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: updateData,
    });

    return true;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  }

  /**
   * List calendar events
   */
  async listEvents(options?: {
    maxResults?: number;
    timeMin?: Date;
    timeMax?: Date;
    q?: string;
  }) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';

    const result = await calendar.events.list({
      calendarId,
      maxResults: options?.maxResults || 10,
      timeMin: options?.timeMin?.toISOString(),
      timeMax: options?.timeMax?.toISOString(),
      q: options?.q,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (result.data.items || []).map(event => ({
      id: event.id!,
      title: event.summary || '',
      description: event.description || '',
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      attendees: (event.attendees || []).map(a => a.email!).filter(Boolean),
      location: event.location || '',
      url: event.htmlLink || '',
      hangoutLink: event.hangoutLink,
      reminders: event.reminders?.overrides?.map(r => ({ method: r.method!, minutes: r.minutes! })) || []
    }));
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(eventId: string) {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calendarId = process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary';

    try {
      const result = await calendar.events.get({
        calendarId,
        eventId,
      });

      const event = result.data;
      return {
        id: event.id!,
        title: event.summary || '',
        description: event.description || '',
        startTime: new Date(event.start?.dateTime || event.start?.date || ''),
        endTime: new Date(event.end?.dateTime || event.end?.date || ''),
        attendees: (event.attendees || []).map(a => a.email!).filter(Boolean),
        location: event.location || '',
        url: event.htmlLink || '',
        hangoutLink: event.hangoutLink,
        reminders: event.reminders?.overrides?.map(r => ({ method: r.method!, minutes: r.minutes! })) || []
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(count: number = 10, fromTime?: Date) {
    const timeMin = fromTime || new Date();
    return this.listEvents({
      maxResults: count,
      timeMin,
    });
  }

  /**
   * Sync with Google Calendar
   */
  async syncWithGoogleCalendar() {
    const account = await this.getPrimaryAccount();
    if (!account) throw new Error('No connected Google account');
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);

    const result = await calendar.events.list({
      calendarId: 'primary'
    });

    return {
      synced: result.data.items?.length || 0,
      errors: [] as string[]
    };
  }

  /**
   * Schedule a reminder for an event
   */
  async scheduleReminder(eventId: string, _reminderTime: Date, _type: 'email' | 'popup' = 'email') {
    // For now, return a mock reminder ID
    // In a real implementation, this would integrate with a job scheduler
    return `reminder_${eventId}_${Date.now()}`;
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string): Promise<boolean> {
    // Mock implementation - in reality would cancel scheduled job
    return true;
  }

  /**
   * Handle recurring events
   */
  async handleRecurringEvents(eventData: any) {
    // Mock implementation - return array of event IDs for recurring instances
    const count = eventData.recurrence ? 5 : 1; // Mock 5 instances for recurring
    return Array.from({ length: count }, (_, i) => `${eventData.id || 'event'}_${i + 1}`);
  }

  /**
   * Process webhook notifications
   */
  async processWebhookNotification(payload: any) {
    // Mock webhook processing
    return { processed: true, payload };
  }

  /**
   * Validate time zone
   */
  validateTimeZone(timeZone: string): boolean {
    const validTimeZones = [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 
      'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'
    ];
    return validTimeZones.includes(timeZone);
  }

  /**
   * Convert time zone
   */
  convertTimeZone(dateTime: Date, fromTimeZone: string, toTimeZone: string): Date {
    if (!this.validateTimeZone(fromTimeZone) || !this.validateTimeZone(toTimeZone)) {
      throw new Error('Invalid time zone');
    }
    
    // Simple mock implementation - in reality would use proper timezone conversion
    const offsetMap: { [key: string]: number } = {
      'UTC': 0,
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Asia/Tokyo': 9
    };
    
    const fromOffset = offsetMap[fromTimeZone] || 0;
    const toOffset = offsetMap[toTimeZone] || 0;
    const offsetDiff = (toOffset - fromOffset) * 60 * 60 * 1000;
    
    return new Date(dateTime.getTime() + offsetDiff);
  }
}
