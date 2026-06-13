import { readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function cleanupOldTmpDirs(prefix = 'atomsbot-deploys-ctx', maxAgeDays = 3): Promise<void> {
  try {
    const dir = tmpdir();
    const entries = await readdir(dir);
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    for (const name of entries) {
      if (!name.startsWith(prefix)) continue;
      const full = join(dir, name);
      try {
        const st = await stat(full);
        if (now - st.mtimeMs > maxAge) {
          await rm(full, { recursive: true, force: true });
        }
      } catch {}
    }
  } catch {}
}

