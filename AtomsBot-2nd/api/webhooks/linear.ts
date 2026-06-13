import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processLinearWebhook } from '../../src/sync/webhooks/linear';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.LINEAR_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers['x-linear-signature'] as string | undefined;
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) return res.status(401).json({ ok: false, error: 'invalid signature' });
    }
    await processLinearWebhook(req.body || {});
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
