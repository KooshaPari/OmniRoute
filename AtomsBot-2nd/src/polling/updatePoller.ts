import { octokit, repoCredentials } from '../github/githubActions';
import { jiraService } from '../jira/jiraClient';
import { integrations } from '../env';
import { atomsService } from '../atoms/atomsClient';
import { githubProjectsService } from '../github/projectsClient';

function isTrue(s?: string | null): boolean { return String(s || '').toLowerCase() === 'true'; }

function providerEnabledEnv(id: string): boolean {
  const v = (process.env as any)[`PM_ENABLED_${id.toUpperCase()}`];
  // default enabled when unset
  return v === undefined ? true : isTrue(v);
}

const state = {
  github: {
    lastIssuesISO: new Date(Date.now() - 60_000).toISOString(),
    lastCommentsISO: new Date(Date.now() - 60_000).toISOString(),
  },
  jira: {
    lastUpdatedMs: Date.now() - 60_000,
  },
  linear: {
    lastISO: new Date(Date.now() - 60_000).toISOString(),
  },
  atoms: {
    lastMs: Date.now() - 60_000,
  },
  projects: {
    lastMs: Date.now() - 60_000,
  },
};

async function pollGithub() {
  try {
    if (!providerEnabledEnv('github')) return;
    const { owner, repo } = repoCredentials;
    // Issues updated since
    const since = state.github.lastIssuesISO;
    const issuesRes = await octokit.rest.issues.listForRepo({ owner, repo, since, per_page: 25 });
    const items = Array.isArray(issuesRes?.data) ? issuesRes.data : [];
    for (const it of items) {
      if ((it as any).pull_request) continue; // skip PRs
      const updated = Date.parse(String((it as any).updated_at || (it as any).created_at));
      if (!Number.isFinite(updated)) continue;
      const url = (it as any).html_url as string | undefined;
      const number = (it as any).number as number | undefined;
      const title = (it as any).title as string | undefined;
      const action = (Date.parse(String((it as any).created_at)) >= Date.parse(since)) ? 'opened' : 'updated';
      try {
        const { postProviderUpdate } = await import('../notifications/pmNotify');
        await postProviderUpdate('github', {
          action,
          id: number,
          title,
          url,
          color: action === 'opened' ? 0x238636 : 0x60a5fa,
        });
      } catch {}
    }
    if (items.length) state.github.lastIssuesISO = new Date().toISOString();

    // Comments since
    const cSince = state.github.lastCommentsISO;
    const commentsRes = await octokit.rest.issues.listCommentsForRepo({ owner, repo, since: cSince, per_page: 50 });
    const comments = Array.isArray(commentsRes?.data) ? commentsRes.data : [];
    for (const c of comments) {
      const created = Date.parse(String((c as any).created_at));
      if (!Number.isFinite(created)) continue;
      const url = (c as any).html_url as string | undefined;
      const body = (c as any).body as string | undefined;
      const author = (c as any).user?.login as string | undefined;
      const issueUrl = (c as any).issue_url as string | undefined;
      const numMatch = String(issueUrl || '').match(/\/issues\/(\d+)/);
      const number = numMatch ? Number(numMatch[1]) : undefined;
      try {
        const { postProviderUpdate } = await import('../notifications/pmNotify');
        await postProviderUpdate('github', {
          action: 'commented',
          id: (c as any).id,
          title: number ? `#${number}` : undefined,
          url,
          description: body,
          details: { Author: author },
          color: 0x60a5fa,
          upsertKeySuffix: String(number ?? ''),
        });
      } catch {}
    }
    if (comments.length) state.github.lastCommentsISO = new Date().toISOString();
  } catch {}
}

async function pollJira() {
  try {
    if (!providerEnabledEnv('jira')) return;
    if (!(jiraService as any).isConfigured?.()) return;
    // Query recently updated issues
    const updatedMs = state.jira.lastUpdatedMs;
    // Use a simple JQL for the last 5 minutes
    const jql = 'updated >= -5m order by updated desc';
    const list: any[] = await (jiraService as any).searchIssues?.(jql, 25);
    if (!Array.isArray(list)) return;
    let maxSeen = updatedMs;
    for (const issue of list) {
      const updStr = String(issue?.updated || issue?.fields?.updated || '');
      const upd = Date.parse(updStr) || Date.now();
      if (upd <= updatedMs) continue;
      if (upd > maxSeen) maxSeen = upd;
      const key = issue?.key || issue?.id || '';
      const title = issue?.summary || issue?.fields?.summary || '';
      let url: string | undefined;
      try {
        const host = (jiraService as any).getHost?.();
        if (host && key) url = `https://${host}/browse/${key}`;
      } catch {}
      try {
        const { postProviderUpdate } = await import('../notifications/pmNotify');
        await postProviderUpdate('jira', {
          action: 'updated',
          key,
          title,
          url,
          details: { Status: issue?.status?.name || issue?.fields?.status?.name },
          color: 0x60a5fa,
        });
      } catch {}
    }
    state.jira.lastUpdatedMs = maxSeen || Date.now();
  } catch {}
}

async function pollLinear() {
  try {
    if (!providerEnabledEnv('linear')) return;
    if (!integrations.linear.isConfigured()) return;
    const apiKey = integrations.linear.getConfig().apiKey as string;
    if (!apiKey) return;
    const since = state.linear.lastISO;
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
      body: JSON.stringify({ query: `query($ts: DateTime!) { issues(first: 25, filter: { updatedAt: { gte: $ts } }) { nodes { id identifier title url updatedAt } } }`, variables: { ts: since } }),
    } as any);
    if (!res.ok) return;
    const json: any = await res.json();
    const items: any[] = json?.data?.issues?.nodes || [];
    for (const it of items) {
      const upd = Date.parse(String(it?.updatedAt || it?.createdAt));
      if (!Number.isFinite(upd)) continue;
      const { postProviderUpdate } = await import('../notifications/pmNotify');
      await postProviderUpdate('linear', {
        action: 'updated',
        key: it?.identifier || it?.id,
        title: it?.title,
        url: it?.url,
        color: 0x60a5fa,
      });
    }
    if (items.length) state.linear.lastISO = new Date().toISOString();
  } catch {}
}

async function pollAtoms() {
  try {
    if (!providerEnabledEnv('atoms')) return;
    const sinceMs = state.atoms.lastMs;
    const list = await atomsService.listRecentIssues?.(25, 5).catch(() => [] as any[]);
    if (!Array.isArray(list)) return;
    let maxSeen = sinceMs;
    for (const it of list) {
      const upd = Date.parse(String(it?.updated || it?.updatedAt));
      if (Number.isFinite(upd) && upd > sinceMs) {
        if (upd > maxSeen) maxSeen = upd;
        const { postProviderUpdate } = await import('../notifications/pmNotify');
        await postProviderUpdate('atoms', {
          action: 'updated',
          key: it?.key || it?.id,
          title: it?.summary,
          url: it?.url,
          color: 0x60a5fa,
        });
      }
    }
    state.atoms.lastMs = maxSeen;
  } catch {}
}

async function pollGitHubProjects() {
  try {
    if (!providerEnabledEnv('github_projects')) return;
    if (!githubProjectsService.isConfigured()) return;
    const items = await githubProjectsService.listRecentItems(25);
    if (!Array.isArray(items) || !items.length) return;
    let maxSeen = state.projects.lastMs;
    for (const it of items) {
      const upd = Date.parse(String(it.updatedAt || '')) || Date.now();
      if (upd <= state.projects.lastMs) continue;
      if (upd > maxSeen) maxSeen = upd;
      const { postProviderUpdate } = await import('../notifications/pmNotify');
      await postProviderUpdate('github_projects', {
        action: 'updated',
        id: it.id,
        title: it.title,
        url: it.url,
        color: 0x60a5fa,
      });
    }
    state.projects.lastMs = maxSeen;
  } catch {}
}

let timer: NodeJS.Timer | undefined;
export function startUpdatePolling() {
  if (timer) return;
  const periodMs = Math.max(5, Math.min(15, Number(process.env.UPDATE_POLL_SECONDS || 12))) * 1000;
  timer = setInterval(() => { void Promise.all([pollGithub(), pollJira(), pollLinear(), pollAtoms(), pollGitHubProjects()]); }, periodMs);
  // kick once after small delay
  setTimeout(() => { void Promise.all([pollGithub(), pollJira(), pollLinear(), pollAtoms(), pollGitHubProjects()]); }, 2_000);
}
