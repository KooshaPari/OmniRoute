import { EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { notificationHub } from './NotificationHub';
import { secretsStore } from '../settings/SecretsStore';

type ProviderId = 'jira' | 'linear' | 'github_projects' | 'coda' | 'atoms' | 'github' | string;

function getProviderLabel(p: string): string {
  const id = String(p || '').toLowerCase();
  switch (id) {
    case 'jira': return 'Jira';
    case 'linear': return 'Linear';
    case 'github_projects': return 'GitHub Projects';
    case 'coda': return 'Coda';
    case 'atoms': return 'Atoms';
    case 'github': return 'GitHub';
    default: return p;
  }
}

function getProviderEmoji(p: string): string {
  const id = String(p || '').toLowerCase();
  switch (id) {
    case 'jira': return '🧩';
    case 'linear': return '📐';
    case 'github_projects': return '🗂️';
    case 'coda': return '📄';
    case 'atoms': return '⚛️';
    case 'github': return '🐙';
    default: return '📢';
  }
}

async function isProviderEnabled(provider: string): Promise<boolean> {
  const key = `pm_enabled_${String(provider).toLowerCase()}`;
  try {
    const v = (await secretsStore.get(key)) || '';
    if (v) return v.toLowerCase() === 'true';
  } catch {}
  // Fallback to env flags like PM_ENABLED_JIRA=true
  try {
    const envKey = `PM_ENABLED_${String(provider).toUpperCase()}`;
    const v = (process.env as any)[envKey];
    if (typeof v === 'string') return v.toLowerCase() === 'true';
  } catch {}
  // Default: enabled (non-blocking)
  return true;
}

export async function postProviderUpdate(provider: ProviderId, payload: {
  action: string;
  id?: string | number;
  key?: string | number;
  title?: string;
  url?: string;
  description?: string;
  details?: Record<string, string | number | undefined>;
  color?: number;
  upsertKeySuffix?: string; // allows forcing unique vs. merge behavior
}): Promise<void> {
  const guildId = (process.env.DISCORD_GUILD_ID as string) || '';
  if (!guildId) return;
  if (!(await isProviderEnabled(String(provider)))) return;

  const prov = String(provider).toLowerCase();
  const label = getProviderLabel(prov);
  const emoji = getProviderEmoji(prov);
  const idOrKey = String(payload.key ?? payload.id ?? 'unknown');
  const title = payload.title || `${label} ${idOrKey}`;
  const url = payload.url;
  const color = payload.color ?? 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${label}: ${payload.action}`)
    .setDescription(`${title}${payload.description ? `\n\n${payload.description}` : ''}`)
    .setColor(color)
    .setTimestamp(new Date());
  if (url) embed.setURL(url as any);

  const fields = payload.details || {};
  const fieldEntries = Object.entries(fields).filter(([_, v]) => v !== undefined && v !== null);
  if (fieldEntries.length) {
    embed.addFields(
      ...fieldEntries.slice(0, 12).map(([name, value]) => ({ name, value: String(value), inline: true }))
    );
  }

  const actions: Array<{ label: string; url?: string; style?: ButtonStyle }> = [];
  if (url) actions.push({ label: 'Open', url, style: ButtonStyle.Link });

  const upsertId = `${prov}:${idOrKey}:${payload.action}${payload.upsertKeySuffix ? ':' + payload.upsertKeySuffix : ''}`;
  await notificationHub.upsertEvent(guildId, prov, upsertId, embed, actions);
}

export default { postProviderUpdate };
