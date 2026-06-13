import { JiraService } from "../jira/jiraClient";
import { LinearService } from "../linear/linearClient";
import { GitHubProjectsService } from "../github/projectsClient";
import { CodaService } from "../coda/codaClient";

type Capability = 'create'|'get'|'update'|'addComment'|'delete'|'assign'|'unassign'|'getTransitions'|'transition'|'resolve'|'close'|'reopen'|'setSprint'|'search'|'listRecent';

export interface ProviderAuditResult {
  provider: string;
  configured: boolean;
  connected?: boolean;
  capabilities: Partial<Record<Capability, 'supported'|'partial'|'missing'>>;
}

async function safeCall<T>(fn: (() => Promise<T>) | undefined): Promise<T | undefined> {
  try { return fn ? await fn() : undefined; } catch { return undefined; }
}

function has(obj: any, name: string): boolean { try { return typeof obj?.[name] === 'function'; } catch { return false; } }

export async function runParityAudit(): Promise<ProviderAuditResult[]> {
  const results: ProviderAuditResult[] = [];

  // Jira
  try {
    const jira = new JiraService();
    const caps: ProviderAuditResult['capabilities'] = {
      create: has(jira, 'createIssue') ? 'supported' : 'missing',
      get: has(jira, 'getIssue') ? 'supported' : 'missing',
      update: has(jira, 'updateIssue') ? 'supported' : 'missing',
      addComment: has(jira, 'addComment') ? 'supported' : 'missing',
      delete: has(jira, 'deleteIssue') ? 'supported' : 'missing',
      assign: has(jira, 'assignIssueAccountId') ? 'supported' : 'missing',
      unassign: has(jira, 'unassignIssue') ? 'supported' : 'missing',
      getTransitions: has(jira, 'getTransitions') ? 'supported' : 'missing',
      transition: has(jira, 'transitionIssue') ? 'supported' : 'missing',
      resolve: has(jira, 'resolveIssue') ? 'supported' : 'missing',
      close: has(jira, 'closeIssue') ? 'supported' : 'missing',
      reopen: has(jira, 'reopenIssue') ? 'supported' : 'missing',
      setSprint: has(jira, 'setIssueSprintField') ? 'supported' : 'missing',
      search: has(jira, 'searchIssues') ? 'supported' : 'missing',
    };
    results.push({ provider: 'jira', configured: jira.isConfigured?.() === true, connected: await safeCall(() => jira.testConnection?.()), capabilities: caps });
  } catch {}

  // Linear
  try {
    const linear = new LinearService();
    const caps: ProviderAuditResult['capabilities'] = {
      create: has(linear, 'createIssue') ? 'supported' : 'missing',
      get: has(linear, 'getIssue') ? 'supported' : 'missing',
      update: has(linear, 'updateIssue') ? 'supported' : 'missing',
      addComment: has(linear, 'addComment') ? 'supported' : 'missing',
      delete: has(linear, 'deleteIssue') ? 'supported' : 'missing',
      assign: has(linear, 'assignIssueAccountId') ? 'supported' : 'missing',
      unassign: has(linear, 'unassignIssue') ? 'supported' : 'missing',
      getTransitions: has(linear, 'getTransitions') ? 'supported' : 'missing',
      transition: has(linear, 'transitionIssue') ? 'supported' : 'missing',
      resolve: has(linear, 'resolveIssue') ? 'supported' : 'missing',
      close: has(linear, 'closeIssue') ? 'supported' : 'missing',
      reopen: has(linear, 'reopenIssue') ? 'supported' : 'missing',
      listRecent: has(linear, 'listRecentIssues') ? 'supported' : 'missing',
    };
    results.push({ provider: 'linear', configured: linear.isConfigured?.() === true, connected: await safeCall(() => linear.testConnection?.()), capabilities: caps });
  } catch {}

  // GitHub Projects
  try {
    const ghp = new GitHubProjectsService();
    const caps: ProviderAuditResult['capabilities'] = {
      create: has(ghp, 'createIssue') ? 'supported' : 'missing',
      get: has(ghp, 'getIssue') ? 'supported' : 'missing',
      update: has(ghp, 'updateIssue') ? 'supported' : 'missing',
      addComment: has(ghp, 'addComment') ? 'supported' : 'missing',
      delete: has(ghp, 'deleteIssue') ? 'supported' : 'missing',
      assign: has(ghp, 'assignIssueAccountId') ? 'supported' : 'missing',
      unassign: has(ghp, 'unassignIssue') ? 'supported' : 'missing',
      getTransitions: has(ghp, 'getTransitions') ? 'supported' : 'missing',
      transition: has(ghp, 'transitionIssue') ? 'supported' : 'missing',
      resolve: has(ghp, 'resolveIssue') ? 'supported' : 'missing',
      close: has(ghp, 'closeIssue') ? 'supported' : 'missing',
      reopen: has(ghp, 'reopenIssue') ? 'supported' : 'missing',
      listRecent: has(ghp, 'listRecentItems') ? 'supported' : 'missing',
    };
    results.push({ provider: 'github_projects', configured: ghp.isConfigured?.() === true, connected: await safeCall(() => ghp.testConnection?.()), capabilities: caps });
  } catch {}

  // Coda (as DB mirror provider)
  try {
    const coda = new CodaService();
    const caps: ProviderAuditResult['capabilities'] = {
      create: has(coda, 'createIssue') ? 'supported' : 'partial',
      get: has(coda, 'getIssue') ? 'supported' : 'partial',
      update: has(coda, 'updateIssue') ? 'supported' : 'partial',
      addComment: has(coda, 'addComment') ? 'supported' : 'supported',
      delete: has(coda, 'deleteIssue') ? 'supported' : 'missing',
      assign: has(coda, 'assignIssueAccountId') ? 'supported' : 'partial',
      unassign: has(coda, 'unassignIssue') ? 'supported' : 'partial',
      getTransitions: 'missing',
      transition: 'partial',
      resolve: 'partial',
      close: 'partial',
      reopen: 'partial',
    };
    results.push({ provider: 'coda', configured: coda.isConfigured?.() === true, connected: await safeCall(() => coda.testConnection?.()), capabilities: caps });
  } catch {}

  return results;
}

