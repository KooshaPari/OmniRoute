import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  target: 'es2022',
  platform: 'node',
  clean: true,
  dts: true,
  onSuccess: 'echo "Build completed successfully"',
  rolldown: {
    resolve: {
      preferBuiltins: true,
    },
    external: [
      'discord.js',
      'express',
      'dotenv',
      'winston',
      'googleapis',
      'better-sqlite3',
      '@prisma/client',
      'luxon',
      'jira.js',
      '@octokit/rest',
      '@octokit/graphql',
      '@vercel/node'
    ]
  }
})
