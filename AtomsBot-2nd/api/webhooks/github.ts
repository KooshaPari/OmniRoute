import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processGithubWebhook } from '../../src/sync/webhooks/github';
import crypto from 'crypto';

function verifySignature(req: VercelRequest, secret?: string): boolean {
  if (!secret) return true;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!verifySignature(req, secret)) return res.status(401).json({ ok: false, error: 'invalid signature' });
    await processGithubWebhook(req.body || {});
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
