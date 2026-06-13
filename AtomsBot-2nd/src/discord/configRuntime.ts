import { secretsStore } from "../settings/SecretsStore";
import { config } from "../config";

export async function getDefaultForumChannelId(): Promise<string> {
  return (await secretsStore.get('discord_channel_id')) || config.DISCORD_CHANNEL_ID;
}

export async function getDiscordAppId(): Promise<string> {
  return (await secretsStore.get('discord_client_id')) || config.DISCORD_CLIENT_ID;
}

export async function getDevGuildId(): Promise<string | undefined> {
  return (await secretsStore.get('discord_dev_guild_id')) || config.DISCORD_DEV_GUILD_ID;
}

