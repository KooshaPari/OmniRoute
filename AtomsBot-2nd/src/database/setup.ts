import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../logger';

export async function setupDatabaseEnvironment(): Promise<void> {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (e) {
    try { logger.warn('Could not create data directory (may already exist)', { dataDir, e }); } catch {}
  }
  if (!process.env.DATABASE_URL) {
    const defaultUrl = `file:${path.join(dataDir, 'bot.db')}`;
    process.env.DATABASE_URL = defaultUrl;
    try { logger.info('Set default DATABASE_URL', { url: defaultUrl }); } catch {}
  }
}
