#!/usr/bin/env tsx
/*
  Sync all channels from the configured Discord guild into the database.
  Requirements:
    - DISCORD_TOKEN must be set
    - Either DISCORD_GUILD_ID or DISCORD_DEV_GUILD_ID must be set
  Usage:
    npx tsx scripts/sync-channels.ts
*/
import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, GuildBasedChannel } from 'discord.js';
import { databaseService } from '../src/database/DatabaseService';
import { setupDatabaseEnvironment } from './init-database';
import { logger } from '../src/logger';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || process.env.DISCORD_DEV_GUILD_ID;
  if (!token) throw new Error('DISCORD_TOKEN is not set');
  if (!guildId) throw new Error('DISCORD_GUILD_ID or DISCORD_DEV_GUILD_ID is not set');

  await setupDatabaseEnvironment();
  await databaseService.initialize();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch(); // populate cache

    const channels = guild.channels.cache;
    let ok = 0, fail = 0;

    for (const [, ch] of channels) {
      const c = ch as GuildBasedChannel & { topic?: string | null };
      try {
        const channelType = (c.type as unknown) as number;
        await databaseService.ensureGuildAndChannel({
          guildId: guild.id,
          guildName: guild.name || 'Unknown Guild',
          channelId: c.id,
          channelName: c.name || 'Unknown',
          channelType,
          channelTopic: c.topic ?? null,
        });
        ok++;
      } catch (e: any) {
        fail++;
        logger.warn('Failed to upsert channel', { id: c.id, name: c.name, type: c.type, error: e?.message || String(e) });
      }
    }

    logger.info('Channel sync complete', { guildId: guild.id, total: channels.size, ok, fail });
  } finally {
    await client.destroy();
  }
}

main().then(() => {
  console.log('Sync finished');
  process.exit(0);
}).catch((err) => {
  console.error('Sync failed', err);
  process.exit(1);
});

