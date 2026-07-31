import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const webPort = 43231;
const bffPort = 43232;
const webUrl = `http://127.0.0.1:${webPort}`;
const bunBinary = (process.env.PATH ?? '')
  .split(delimiter)
  .map((directory) => join(directory, 'bun'))
  .find((candidate) => !candidate.includes('/node_modules/.bin/') && existsSync(candidate));

if (!bunBinary) throw new Error('A Bun runtime is required to start the BFF smoke fixture.');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${JSON.stringify(bunBinary)} run ../bff/src/server.ts`,
      cwd: '.',
      env: {
        PORT: String(bffPort),
        NODE_ENV: 'test',
        BFF_CORS_ORIGINS: webUrl,
      },
      url: `http://127.0.0.1:${bffPort}/healthz`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node build',
      cwd: '.',
      env: {
        HOST: '127.0.0.1',
        PORT: String(webPort),
        PUBLIC_OMNIROUTE_BFF_URL: `http://127.0.0.1:${bffPort}`,
      },
      url: `${webUrl}/home`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
