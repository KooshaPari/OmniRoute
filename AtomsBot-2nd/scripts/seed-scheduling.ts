import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const templates = [
    { name: 'Quick 15', durationMin: 15, publicSlug: '15', description: '15-min sync' },
    { name: 'Focus 30', durationMin: 30, publicSlug: '30', description: '30-min meeting' },
    { name: 'Deep 60', durationMin: 60, publicSlug: '60', description: '60-min deep dive' },
    { name: 'Quick Chat', durationMin: 30, publicSlug: 'default', description: 'Default quick chat' },
  ];
  for (const t of templates) {
    await prisma.meetingTemplate.upsert({
      where: { publicSlug: t.publicSlug! },
      update: { name: t.name, durationMin: t.durationMin, description: t.description || null },
      create: t as any,
    });
  }
  const organizerId = process.env.PUBLIC_SCHEDULER_USER_ID || 'organizer';
  await prisma.schedulingPreference.upsert({
    where: { userId: organizerId },
    update: {},
    create: { userId: organizerId, timezone: process.env.DEFAULT_SCHED_TZ || 'UTC', workStartMin: 540, workEndMin: 1020, bufferMinutes: 15 },
  });
  console.log('Seeded scheduling templates and organizer preferences');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => process.exit(0));

