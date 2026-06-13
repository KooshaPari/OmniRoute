import { secretsStore } from './SecretsStore';
import { env } from '../env';

export async function getPmProvider(): Promise<'linear'|'jira'|'none'> {
  const fromDb = (await secretsStore.get('pm_provider'))?.toLowerCase();
  const fromEnv = (env as any).PM_PROVIDER?.toLowerCase?.();
  const val = (fromDb || fromEnv || 'jira') as string;
  if (val === 'linear' || val === 'jira' || val === 'none') return val;
  return 'jira';
}

export async function getLinearConfig(): Promise<{ apiKey?: string; teamId?: string; webhookSecret?: string }> {
  const apiKey = (await secretsStore.get('linear_api_key')) || (env as any).LINEAR_API_KEY || undefined;
  const teamId = (await secretsStore.get('linear_team_id')) || (env as any).LINEAR_TEAM_ID || undefined;
  const webhookSecret = (await secretsStore.get('linear_webhook_secret')) || (env as any).LINEAR_WEBHOOK_SECRET || undefined;
  return { apiKey, teamId, webhookSecret };
}

