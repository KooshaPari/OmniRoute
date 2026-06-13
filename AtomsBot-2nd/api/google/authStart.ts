import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthUrl } from '../../src/google/calendarClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const url = await getAuthUrl();
    const mode = (req.query?.mode as string) || 'redirect';
    if (mode === 'json') return res.status(200).json({ url });
    return res.status(302).send(url);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Auth start failed' });
  }
}

