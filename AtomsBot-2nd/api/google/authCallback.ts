import { VercelRequest, VercelResponse } from '@vercel/node';
import { exchangeCodeForTokens } from '../../src/google/calendarClient';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const code = (req.query?.code as string) || '';
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const { tokens, email } = await exchangeCodeForTokens(code);
    if (!email) return res.status(400).json({ error: 'Missing email from Google userinfo' });
    if (!tokens.refresh_token && !tokens.access_token) return res.status(400).json({ error: 'No tokens returned' });
    const refreshToken = tokens.refresh_token || '';
    if (!refreshToken) {
      // If consent previously granted, Google may omit refresh_token; keep existing one
      const existing = await prisma.calendarAccount.findUnique({ where: { email } });
      if (!existing?.refreshToken) return res.status(400).json({ error: 'No refresh token provided; re-run with prompt=consent' });
      // keep old token
    } else {
      await prisma.calendarAccount.upsert({
        where: { email },
        create: { email, refreshToken },
        update: { refreshToken },
      });
    }
    const successHtml = `<!doctype html><meta charset="utf-8"><title>Google Connected</title><body style="font-family:system-ui;padding:24px">✅ Google account connected: ${email}. You can close this window.</body>`;
    res.status(200).send(successHtml);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Auth callback failed' });
  }
}

