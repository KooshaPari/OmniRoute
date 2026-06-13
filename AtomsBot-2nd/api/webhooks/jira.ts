import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processJiraWebhook } from '../../src/sync/webhooks/jira';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.JIRA_WEBHOOK_SECRET;
    if (secret) {
      const hdr = (req.headers['x-webhook-secret'] || req.headers['x-jira-webhook-secret']) as string | undefined;
      if (!hdr || hdr !== secret) return res.status(401).json({ ok: false, error: 'invalid signature' });
    }
    await processJiraWebhook(req.body || {});
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
