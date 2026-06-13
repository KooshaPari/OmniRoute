import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  sourcemap: true,
  dts: true,
  clean: true,
  minify: false,
  target: 'node18',
  external: [
    '@octokit/graphql',
    '@octokit/rest',
    '@vercel/node',
    'discord-interactions',
    'discord.js',
    'dotenv',
    'express',
    'jira.js',
    'winston',
    'better-sqlite3',
    '@prisma/client',
    'prisma',
    'ioredis',
    'nats',
    'zod'
  ],
  shims: false,
  treeshake: false,
  splitting: true,
  skipNodeModulesBundle: true,
});
