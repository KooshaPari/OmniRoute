import { PMIssue } from './interfaces';
import { formatProviderComment } from '../discord/utils/commentFormat';
import { JiraAdapter } from './adapters/JiraAdapter';
import { GitHubIssuesAdapter } from './adapters/GitHubIssuesAdapter';
import { LinearAdapter } from './adapters/LinearAdapter';
import { GitHubProjectsAdapter } from './adapters/GitHubProjectsAdapter';
import { CodaAdapter } from './adapters/CodaAdapter';
import { AtomsAdapter } from './adapters/AtomsAdapter';
import { getEnabledProviders, isProviderEnabled, PMProvider } from '../pm/provider';

// Jira-specific normalization helper used selectively per-adapter
function normalizeForJiraIfNeeded(key: string): string {
  const trimmed = String(key || '').trim();
  if (/^\d+$/.test(trimmed)) return `ASRE-${trimmed}`;
  if (/^ASRE-\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

function enabled(flag: string | undefined) {
  return String(flag || '').toLowerCase() === 'true';
}

async function getAdapters() {
  const list: any[] = [];
  const enabledProviders = getEnabledProviders();
  for (const id of enabledProviders) {
    if (id === 'jira') list.push(new JiraAdapter());
    else if (id === 'linear') list.push(new LinearAdapter());
    else if (id === 'github_projects') list.push(new GitHubProjectsAdapter());
    else if (id === 'coda') list.push(new CodaAdapter());
    else if (id === 'atoms') list.push(new AtomsAdapter());
  }
  return list;
}

async function getAdapterMap() {
  const map: Record<string, any> = {};
  for (const a of [new JiraAdapter(), new LinearAdapter(), new GitHubProjectsAdapter(), new CodaAdapter(), new AtomsAdapter()]) {
    try {
      const label = a.getLabel().toLowerCase();
      const pid = label.includes('jira') ? 'jira' : label.includes('linear') ? 'linear' : label.includes('github projects') ? 'github_projects' : label.includes('coda') ? 'coda' : label.includes('atoms') ? 'atoms' : label;
      map[pid] = a;
    } catch {}
  }
  return map;
}

export async function facadeCreateIssueForProvider(provider: PMProvider, title: string, description?: string): Promise<PMIssue | null> {
  const id = String(provider || '').toLowerCase() as PMProvider;
  if (!isProviderEnabled(id)) return null;
  const map = await getAdapterMap();
  const target = map[id];
  if (!target || !target.createIssue) return null;
  try { if (!(await target.isConfigured())) return null; } catch { return null; }
  try { return await target.createIssue({ title, description }); } catch { return null; }
}

export async function facadeLinkIssueForProvider(provider: PMProvider, key: string): Promise<PMIssue | null> {
  const id = String(provider || '').toLowerCase() as PMProvider;
  if (!isProviderEnabled(id)) return null;
  const map = await getAdapterMap();
  const target = map[id];
  if (!target || !target.linkExisting) return null;
  try { if (!(await target.isConfigured())) return null; } catch { return null; }
  try { return await target.linkExisting(key); } catch { return null; }
}

export async function facadeAddCommentForProvider(provider: string, key: string, body: string) {
  const id = String(provider || '').toLowerCase();
  try { if (!isProviderEnabled(id as any)) return; } catch {}
  const adapters = await getAdapters();
  const map: Record<string, any> = {};
  for (const a of [new JiraAdapter(), new LinearAdapter(), new GitHubProjectsAdapter(), new CodaAdapter(), new AtomsAdapter()]) {
    try { const label = a.getLabel().toLowerCase();
      const pid = label.includes('jira') ? 'jira' : label.includes('linear') ? 'linear' : label.includes('github projects') ? 'github_projects' : label.includes('coda') ? 'coda' : label.includes('atoms') ? 'atoms' : label;
      map[pid] = a;
    } catch {}
  }
  const target = map[id] || null;
  if (!target) return;
  try { if (!(await target.isConfigured())) return; } catch {}
  try { await target.addComment(key, body); } catch {}
}

export async function facadeTransitionForProvider(provider: string, key: string, transitionName: string) {
  const id = String(provider || '').toLowerCase();
  try { if (!isProviderEnabled(id as any)) return; } catch {}
  const adapters = await getAdapters();
  const map: Record<string, any> = {};
  for (const a of [new JiraAdapter(), new LinearAdapter(), new GitHubProjectsAdapter(), new CodaAdapter(), new AtomsAdapter()]) {
    try { const label = a.getLabel().toLowerCase();
      const pid = label.includes('jira') ? 'jira' : label.includes('linear') ? 'linear' : label.includes('github projects') ? 'github_projects' : label.includes('coda') ? 'coda' : label.includes('atoms') ? 'atoms' : label;
      map[pid] = a;
    } catch {}
  }
  const target = map[id] || null;
  if (!target || !target.transitionIssue) return;
  try { if (!(await target.isConfigured())) return; } catch {}
  try { await target.transitionIssue(key, transitionName); } catch {}
}

export async function facadeAssignForProvider(provider: string, key: string, accountId: string) {
  const id = String(provider || '').toLowerCase();
  try { if (!isProviderEnabled(id as any)) return; } catch {}
  const adapters = await getAdapters();
  const map: Record<string, any> = {};
  for (const a of [new JiraAdapter(), new LinearAdapter(), new GitHubProjectsAdapter(), new CodaAdapter(), new AtomsAdapter()]) {
    try { const label = a.getLabel().toLowerCase();
      const pid = label.includes('jira') ? 'jira' : label.includes('linear') ? 'linear' : label.includes('github projects') ? 'github_projects' : label.includes('coda') ? 'coda' : label.includes('atoms') ? 'atoms' : label;
      map[pid] = a;
    } catch {}
  }
  const target = map[id] || null;
  if (!target || !target.assignIssueAccountId) return;
  try { if (!(await target.isConfigured())) return; } catch {}
  try { await target.assignIssueAccountId(key, accountId); } catch {}
}


export async function facadeCreateIssue(title: string, description?: string): Promise<{ results: PMIssue[] }> {
  const adapters = await getAdapters();
  const results: PMIssue[] = [];
  for (const a of adapters) {
    try { if (!(await a.isConfigured())) continue; } catch {}
    try { results.push(await a.createIssue({ title, description })); } catch {}
  }
  return { results };
}

export async function facadeLinkIssue(key: string): Promise<{ results: PMIssue[] }> {
  const adapters = await getAdapters();
  const results: PMIssue[] = [];
  const original = String(key || '').trim();
  for (const a of adapters) {
    try { if (!(await a.isConfigured())) continue; } catch {}
    try {
      let k = original;
      try {
        const label = (a as any)?.getLabel?.()?.toLowerCase?.() || '';
        if (label.includes('jira')) k = normalizeForJiraIfNeeded(original);
      } catch {}
      const r = await a.linkExisting(k);
      if (r) results.push(r);
    } catch {}
  }
  return { results };
}

export async function facadeAddComment(key: string, body: string) {
  const adapters = await getAdapters();
  for (const a of adapters) {
    try { if (!(await a.isConfigured())) continue; } catch {}
    try { await a.addComment(key, body); } catch {}
  }
}

export async function facadeAddCommentFormatted(key: string, body: string, userTag?: string) {
  // Apply timestamp+user formatting for non-Jira providers by using adapters directly
  const adapters = await getAdapters();
  for (const a of adapters) {
    try { if (!(await a.isConfigured())) continue; } catch {}
    try {
      const label = (a as any)?.getLabel?.() || '';
      const isJira = String(label).toLowerCase() === 'jira';
      const text = isJira ? body : formatProviderComment(userTag, body);
      await a.addComment(key, text);
    } catch {}
  }
}

export async function facadeTransition(key: string, transitionName: string) {
  const adapters = await getAdapters();
  for (const a of adapters) {
    if (!a.transitionIssue) continue;
    try { if (!(await a.isConfigured())) continue; } catch {}
    try { await a.transitionIssue(key, transitionName); } catch {}
  }
}

export async function facadeGetIssue(key: string) {
  const adapters = await getAdapters();
  for (const a of adapters) {
    try { if (!(await a.isConfigured())) continue; } catch {}
    if (!a.getIssue) continue;
    try { const r = await a.getIssue(key); if (r) return r; } catch {}
  }
  return null;
}

export async function facadeGetTransitions(key: string) {
  const adapters = await getAdapters();
  for (const a of adapters) {
    if (!a.getTransitions) continue;
    try { if (!(await a.isConfigured())) continue; } catch {}
    try { const list = await a.getTransitions(key); if (list?.length) return list; } catch {}
  }
  return [] as Array<{ id: string; name: string }>;
}

export async function facadeGetTransitionsForProvider(provider: string, key: string) {
  const id = String(provider || '').toLowerCase();
  const adapters = await getAdapters();
  const map: Record<string, any> = {};
  for (const a of [new JiraAdapter(), new LinearAdapter(), new GitHubProjectsAdapter(), new CodaAdapter(), new AtomsAdapter()]) {
    try {
      const label = a.getLabel().toLowerCase();
      const pid = label.includes('jira') ? 'jira' : label.includes('linear') ? 'linear' : label.includes('github projects') ? 'github_projects' : label.includes('coda') ? 'coda' : label.includes('atoms') ? 'atoms' : label;
      map[pid] = a;
    } catch {}
  }
  const target = map[id] || null;
  if (!target || !target.getTransitions) return [];
  try { if (!(await target.isConfigured())) return []; } catch {}
  try { return await target.getTransitions(key); } catch { return []; }
}

export async function facadeAssign(key: string, accountId: string) {
  const adapters = await getAdapters();
  for (const a of adapters) {
    if (!a.assignIssueAccountId) continue;
    try { if (!(await a.isConfigured())) continue; } catch {}
    try { await a.assignIssueAccountId(key, accountId); } catch {}
  }
}
