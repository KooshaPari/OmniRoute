// Seed teams and forum mappings from JSON
// Usage:
//   npm run seed:teams -- --file data/team-seed.json
// or set env SEED_TEAMS_JSON='[{...}]'

import fs from 'fs';
import path from 'path';
import { settingsService } from '../src/settings/SettingsService';

type TeamSeed = {
  id: string;
  name?: string;
  description?: string;
  color?: number;
  emoji?: string;
  bugForumId?: string;
  bugChannelId?: string;
  featureForumId?: string;
  featureChannelId?: string;
  githubOwner?: string;
  githubRepo?: string;
  jiraProjectKey?: string;
  jiraBoardId?: string;
};

async function main() {
  const args = process.argv.slice(2);
  let file: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') file = args[i+1];
  }

  let payload: TeamSeed[] = [];
  if (file) {
    const abs = path.resolve(process.cwd(), file);
    const raw = fs.readFileSync(abs, 'utf-8');
    payload = JSON.parse(raw);
  } else if (process.env.SEED_TEAMS_JSON) {
    payload = JSON.parse(process.env.SEED_TEAMS_JSON);
  } else {
    console.error('No input provided. Use --file <path> or set SEED_TEAMS_JSON.');
    process.exit(1);
  }

  const guildId = process.env.SEED_GUILD_ID || process.env.DISCORD_DEV_GUILD_ID || '';
  if (!guildId) {
    console.warn('No guild ID provided (SEED_GUILD_ID or DISCORD_DEV_GUILD_ID). Forum mappings will be stored but not guild-scoped.');
  }

  for (const t of payload) {
    console.log(`Seeding team: ${t.id}`);
    await settingsService.upsertTeamSettings(t.id, {
      name: t.name,
      description: t.description,
      color: t.color,
      emoji: t.emoji,
      bugForumId: t.bugForumId,
      featureForumId: t.featureForumId,
      bugForumChannelId: t.bugChannelId,
      featureForumChannelId: t.featureChannelId,
      githubOwner: t.githubOwner,
      githubRepo: t.githubRepo,
      jiraProjectKey: t.jiraProjectKey,
      jiraBoardId: t.jiraBoardId,
    });

    if (guildId) {
      if (t.bugForumId && t.bugChannelId) await settingsService.setForumChannelId(guildId, t.bugForumId, t.bugChannelId);
      if (t.featureForumId && t.featureChannelId) await settingsService.setForumChannelId(guildId, t.featureForumId, t.featureChannelId);
    }
  }

  console.log('Seeding complete.');
}

main().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});

