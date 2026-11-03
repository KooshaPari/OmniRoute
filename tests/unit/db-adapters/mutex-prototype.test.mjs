import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, realpathSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./mutex-owner-prototype.ps1', import.meta.url));
const name = path => 'Local\\OmniRouteExperiment-' + createHash('sha256').update(realpathSync(path).toLowerCase()).digest('hex');
const args = key => ['-NoProfile', '-NonInteractive', '-File', helper, '-MutexName', key];
const attempt = key => spawnSync('pwsh', args(key), { encoding: 'utf8', timeout: 10000 });

test('Windows mutex contention, crash release, direct bypass and hard-link alias', { skip: process.platform !== 'win32' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omni-mutex-'));
  const dbPath = join(dir, 'data.sqlite');
  const alias = join(dir, 'alias.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE witness (value INTEGER)');
  db.close();
  linkSync(dbPath, alias);
  const key = name(dbPath);
  const holder = spawn('pwsh', [...args(key), '-Hold'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('holder readiness timeout')), 10000);
      holder.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      holder.once('error', reject);
      holder.once('exit', code => reject(new Error(`holder exited ${code}`)));
    });
    assert.equal(attempt(key).status, 2, 'competing holder is refused');
    const bypass = new DatabaseSync(dbPath);
    bypass.exec('INSERT INTO witness VALUES (1)');
    bypass.close();
    assert.notEqual(name(alias), key, 'path hashing splits hard-link identity');
    assert.equal(attempt(name(alias)).status, 0, 'alias admits a second mutex owner');
    holder.kill();
    await new Promise(resolve => holder.once('exit', resolve));
    assert.equal(attempt(key).status, 0, 'abandoned mutex can be acquired');
  } finally {
    if (holder.exitCode === null && holder.signalCode === null) holder.kill();
  }
});
