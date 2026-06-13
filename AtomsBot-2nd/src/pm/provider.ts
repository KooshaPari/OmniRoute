import { env, integrations } from "../env";

export type PMProvider = "jira" | "linear" | "github_projects" | "coda" | "atoms";

export function getPMProvider(): PMProvider {
  const v = (env as any)?.PM_PROVIDER || process.env.PM_PROVIDER || 'jira';
  const l = String(v).toLowerCase();
  return (l === 'linear' || l === 'github_projects' || l === 'coda' || l === 'atoms') ? (l as PMProvider) : 'jira';
}

export function getPMLabel(): string {
  switch (getPMProvider()) {
    case 'atoms': return 'Atoms';
    case 'linear': return 'Linear';
    case 'github_projects': return 'GitHub Projects';
    case 'coda': return 'Coda';
    default: return 'Jira';
  }
}

export function getProviderLabelFor(id: PMProvider): string {
  switch (id) {
    case 'atoms': return 'Atoms';
    case 'linear': return 'Linear';
    case 'github_projects': return 'GitHub Projects';
    case 'coda': return 'Coda';
    default: return 'Jira';
  }
}

export function getPMEmoji(): string {
  switch (getPMProvider()) {
    case 'atoms': return '🔷';
    case 'linear': return '📈';
    case 'github_projects': return '🗂️';
    case 'coda': return '📄';
    default: return '🎫';
  }
}

export function isPMConfigured(): boolean {
  const p = getPMProvider();
  if (p === 'linear') return integrations.linear.isConfigured();
  if (p === 'github_projects') return integrations.githubProjects.isConfigured();
  if (p === 'coda') return integrations.coda.isConfigured();
  if (p === 'atoms') return (integrations as any)?.atoms?.isConfigured?.() === true;
  return integrations.jira.isConfigured();
}

function flagTrue(v: any): boolean {
  return String(v || '').toLowerCase() === 'true';
}

function envOr(k: string): string | undefined {
  // prefer process.env, then env bag
  return (process.env as any)[k] ?? (env as any)?.[k];
}

export function isProviderEnabled(id: PMProvider): boolean {
  const upper = id.toUpperCase(); // JIRA, LINEAR, GITHUB_PROJECTS, CODA, ATOMS
  const enabledFlag = envOr(`PM_ENABLED_${upper}`);
  const syncFlag = envOr(`PM_SYNC_${upper}`);
  // If explicitly disabled, honor it
  if (String(enabledFlag || '').toLowerCase() === 'false') return false;
  // If explicitly enabled or sync-enabled, honor it
  if (flagTrue(enabledFlag)) return true;
  if (flagTrue(syncFlag)) return true;
  // Default: enabled (no primary provider; multi-provider UX)
  return true;
}

export function getEnabledProviders(): PMProvider[] {
  const ids: PMProvider[] = ['jira','linear','github_projects','coda','atoms'];
  return ids.filter((p) => isProviderEnabled(p));
}

export function getEnabledProviderDisplay(): string {
  const ids = getEnabledProviders();
  const names = ids.map(getProviderLabelFor);
  return names.join('/');
}
