import { PrismaClient } from '@prisma/client';
import { createCalendarClientFromRefreshToken } from '../google/calendarClient';
import { secretsStore } from '../settings/SecretsStore';

function newChannelId() {
  return `atoms-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

export class WatchService {
  constructor(private prisma: PrismaClient) {}

  async ensureWatch(calendarId?: string) {
    const account = await this.prisma.calendarAccount.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!account) return;
    const { calendar } = await createCalendarClientFromRefreshToken(account.refreshToken);
    const calId = calendarId || (await secretsStore.get('gcal_primary_calendar_id')) || (process.env.GCAL_PRIMARY_CALENDAR_ID || 'primary');
    const address = (await secretsStore.get('google_webhook_address')) || process.env.GOOGLE_WEBHOOK_ADDRESS;
    if (!address) return;
    const existing = await this.prisma.calendarSyncState.findUnique({ where: { calendarId_accountId: { calendarId: calId, accountId: account.id } } }).catch(() => null);
    const bufferMs = 6 * 60 * 60 * 1000; // 6h renew buffer
    const needsRenew = !existing?.channelExpiration || (new Date(existing.channelExpiration).getTime() - Date.now()) < bufferMs;
    if (needsRenew) {
      const id = newChannelId();
      try {
        const resp = await calendar.events.watch({
          calendarId: calId,
          requestBody: { id, type: 'webhook', address },
        });
        const resourceId = String(resp.data.resourceId || '');
        const exp = resp.data.expiration ? new Date(Number(resp.data.expiration)) : null;
        await this.prisma.calendarSyncState.upsert({
          where: { calendarId_accountId: { calendarId: calId, accountId: account.id } },
          create: { accountId: account.id, calendarId: calId, channelId: id, resourceId, channelExpiration: exp || undefined },
          update: { channelId: id, resourceId, channelExpiration: exp || undefined },
        });
      } catch (e) {
        // Ignore watch errors (address must be public HTTPS). Polling will still work.
        return;
      }
    }
  }
}

export async function startWatchRenewalLoop(prisma = new PrismaClient()) {
  const svc = new WatchService(prisma);
  const tick = () => { void svc.ensureWatch(); };
  setTimeout(tick, 5_000);
  setInterval(tick, 60 * 60 * 1000);
}
