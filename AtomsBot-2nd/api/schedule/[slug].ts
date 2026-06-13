import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { CalendarService } from '../../src/calendar/calendarService';

const prisma = new (PrismaClient as any)();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const slug = String(req.query.slug || 'default');
    let template = await prisma.meetingTemplate.findFirst({ where: { publicSlug: slug } });
    if (!template && slug === 'default') {
      template = await prisma.meetingTemplate.upsert({ where: { publicSlug: 'default' }, update: {}, create: { name: 'Quick Chat', durationMin: 30, publicSlug: 'default', description: 'Quick meeting' } as any });
    }
    if (!template) return res.status(404).json({ error: 'Unknown template' });
    const svc = new CalendarService(prisma);
    const organizerId = process.env.PUBLIC_SCHEDULER_USER_ID || 'organizer';
    if (req.method === 'GET') {
      const slots = await svc.suggestSlots({ userId: organizerId, durationMin: template.durationMin, count: 5 });
      return res.status(200).json({ template: { name: template.name, durationMin: template.durationMin }, slots });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const start = new Date(body.start);
      const end = new Date(body.end);
      const title = String(body.title || template.name);
      const attendees: string[] = Array.isArray(body.attendees) ? body.attendees : [];
      // Create a short hold and confirm immediately
      const hold = await svc.createHold(organizerId, start, end, 5);
      const { booking, event } = await svc.confirmHold({ userId: organizerId, holdId: hold.id, title, description: body.description, attendees });
      return res.status(200).json({ booking, event });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}

