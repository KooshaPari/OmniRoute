import { secretsStore } from "../settings/SecretsStore";
import { settingsService } from "../settings/SettingsService";
import { logger } from "../logger";

// Minimal Jira-like issue shape used across the app
export interface PMIssueLike {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: { id: string; name: string; statusCategory: { key: string | undefined; name: string | undefined } };
  priority: { id: string | undefined; name: string | undefined };
  assignee?: { accountId: string; displayName: string; emailAddress: string };
  reporter: { accountId: string; displayName: string; emailAddress: string };
  created: string;
  updated: string;
  labels: string[];
  components: Array<{ id: string; name: string }>;
  issueType: { id: string; name: string; iconUrl: string };
  project: { id: string; key: string; name: string };
  customFields?: Record<string, any>;
  url?: string;
}

type CreateData = {
  summary: string;
  description?: string;
  priority?: string;
  assignee?: string; // user id
  labels?: string[];
  customFields?: Record<string, any>;
};

type UpdateData = Partial<CreateData> & { status?: string };

function buildHeaders(apiKey: string, accessToken?: string) {
  const token = accessToken || apiKey;
  return {
    'apikey': apiKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  } as Record<string, string>;
}

async function getAtomsConfig(): Promise<{
  supabaseUrl?: string;
  serviceRoleKey?: string;
  anonKey?: string;
  webUrl?: string;
  orgId?: string;
  projectId?: string;
  requirementsDocumentId?: string;
  requirementsBlockId?: string;
  accessToken?: string;
  refreshToken?: string;
}> {
  // Secrets
  const supabaseUrl = process.env.ATOMS_SUPABASE_URL || await secretsStore.get('atoms_supabase_url');
  const serviceRoleKey = process.env.ATOMS_SUPABASE_SERVICE_ROLE_KEY || await secretsStore.get('atoms_supabase_service_role_key');
  const anonKey = process.env.ATOMS_SUPABASE_ANON_KEY || await secretsStore.get('atoms_supabase_anon_key');
  const accessToken = process.env.ATOMS_ACCESS_TOKEN || await secretsStore.get('atoms_access_token');
  const refreshToken = process.env.ATOMS_REFRESH_TOKEN || await secretsStore.get('atoms_refresh_token');
  const webUrl = process.env.ATOMS_WEB_URL || await secretsStore.get('atoms_web_url');
  // Settings (non-secrets)
  const orgId = await secretsStore.get('atoms_org_id');
  const projectId = await secretsStore.get('atoms_project_id');
  const requirementsDocumentId = await secretsStore.get('atoms_requirements_document_id');
  const requirementsBlockId = await secretsStore.get('atoms_requirements_block_id');
  return { supabaseUrl: supabaseUrl || undefined, serviceRoleKey: serviceRoleKey || undefined, anonKey: anonKey || undefined, webUrl: webUrl || undefined, orgId: orgId || undefined, projectId: projectId || undefined, requirementsDocumentId, requirementsBlockId, accessToken: accessToken || undefined, refreshToken: refreshToken || undefined };
}

async function refreshAccessToken(cfg: { supabaseUrl?: string; anonKey?: string; serviceRoleKey?: string; refreshToken?: string; }): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    if (!cfg.supabaseUrl || !cfg.refreshToken) return null;
    const apiKey = cfg.anonKey || cfg.serviceRoleKey!;
    const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' } as any,
      body: JSON.stringify({ refresh_token: cfg.refreshToken }),
    } as any);
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.access_token) {
      await secretsStore.set('atoms_access_token', j.access_token);
      if (j.refresh_token) await secretsStore.set('atoms_refresh_token', j.refresh_token);
      return { access_token: j.access_token, refresh_token: j.refresh_token };
    }
  } catch (e) {
    try { logger.warn(`Atoms refresh token failed: ${(e as any)?.message || e}`); } catch {}
  }
  return null;
}

async function supaFetch(cfg: any, path: string, init?: RequestInit): Promise<Response> {
  const apiKey = cfg.serviceRoleKey || cfg.anonKey!;
  const headers: any = Object.assign({}, buildHeaders(apiKey, cfg.accessToken), init?.headers || {});
  const url = path.startsWith('http') ? path : `${cfg.supabaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  let res = await fetch(url, { ...(init || {}), headers } as any);
  if (res.status === 401 && cfg.refreshToken) {
    const refreshed = await refreshAccessToken(cfg);
    if (refreshed?.access_token) {
      headers['Authorization'] = `Bearer ${refreshed.access_token}`;
      res = await fetch(url, { ...(init || {}), headers } as any);
    }
  }
  return res;
}

function mapRequirementToIssue(req: any, ctx: { orgId?: string; projectId?: string; webUrl?: string }): PMIssueLike | null {
  if (!req) return null;
  const id = String(req.id);
  const url = ctx.webUrl && ctx.orgId && ctx.projectId ? `${ctx.webUrl}/org/${ctx.orgId}/project/${ctx.projectId}/requirements/${id}` : undefined;
  return {
    id,
    key: id,
    summary: req.name || '',
    description: req.description || '',
    status: { id: req.status || '', name: req.status || '', statusCategory: { key: req.status || '', name: req.status || '' } },
    priority: { id: req.priority || '', name: req.priority || '' },
    assignee: undefined,
    reporter: { accountId: '', displayName: '', emailAddress: '' },
    created: req.created_at || '',
    updated: req.updated_at || '',
    labels: Array.isArray(req.tags) ? req.tags : [],
    components: [],
    issueType: { id: 'requirement', name: 'Requirement', iconUrl: '' },
    project: { id: ctx.projectId || '', key: '', name: '' },
    customFields: req.properties || {},
    url,
  };
}

export class AtomsService {
  isConfigured(): boolean {
    // We check env quickly; /setup stores in SecretsStore which we read on demand per call
    return !!(process.env.ATOMS_SUPABASE_URL && (process.env.ATOMS_SUPABASE_SERVICE_ROLE_KEY || process.env.ATOMS_SUPABASE_ANON_KEY));
  }

  async testConnection(): Promise<boolean> {
    try {
      const cfg = await getAtomsConfig();
      if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return false;
      const resp = await supaFetch(cfg, `/rest/v1/projects?select=id&limit=1`, { method: 'GET' });
      return resp.ok;
    } catch (e) {
      try { logger.warn(`Atoms testConnection failed: ${(e as any)?.message || e}`); } catch {}
      return false;
    }
  }

  async ensureIssuesDocAndBlock(): Promise<{ documentId: string; blockId: string } | null> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey) || !cfg.projectId) return null;
    let documentId = cfg.requirementsDocumentId;
    let blockId = cfg.requirementsBlockId;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      if (!documentId) {
        // Create a document named "Issues"
        const r = await supaFetch(cfg, `/rest/v1/documents`, { method: 'POST', headers, body: JSON.stringify({ project_id: cfg.projectId, name: 'Issues', description: 'Project Issues' }) } as any);
        const j = await r.json();
        documentId = j?.[0]?.id || j?.id || undefined;
        if (documentId) await secretsStore.set('atoms_requirements_document_id', String(documentId));
      }
      if (documentId && !blockId) {
        const r2 = await supaFetch(cfg, `/rest/v1/blocks`, { method: 'POST', headers, body: JSON.stringify({ document_id: documentId, type: 'table', position: 1, content: {} }) } as any);
        const j2 = await r2.json();
        blockId = j2?.[0]?.id || j2?.id || undefined;
        if (blockId) await secretsStore.set('atoms_requirements_block_id', String(blockId));
      }
      if (documentId && blockId) return { documentId: String(documentId), blockId: String(blockId) };
      return null;
    } catch (e) {
      try { logger.warn(`Atoms ensureIssuesDocAndBlock failed: ${(e as any)?.message || e}`); } catch {}
      return null;
    }
  }

  async createIssue(data: CreateData): Promise<PMIssueLike | null> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey) || !cfg.projectId) return null;
    let { requirementsDocumentId, requirementsBlockId } = cfg;
    if (!requirementsDocumentId || !requirementsBlockId) {
      const ensured = await this.ensureIssuesDocAndBlock();
      if (!ensured) return null;
      requirementsDocumentId = ensured.documentId;
      requirementsBlockId = ensured.blockId;
    }
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    const body = {
      document_id: requirementsDocumentId,
      block_id: requirementsBlockId,
      name: data.summary,
      description: data.description,
      status: 'active',
      priority: data.priority,
      tags: Array.isArray(data.labels) ? data.labels : [],
      properties: data.customFields || {},
    } as any;
    try {
      const res = await supaFetch(cfg, `/rest/v1/requirements`, { method: 'POST', headers, body: JSON.stringify(body) } as any);
      if (!res.ok) return null;
      const j = await res.json();
      const created = Array.isArray(j) ? j[0] : j;
      // Assignment
      if (data.assignee) {
        try { await this.assignIssueAccountId(String(created.id), data.assignee); } catch {}
      }
      return mapRequirementToIssue(created, { orgId: cfg.orgId, projectId: cfg.projectId, webUrl: cfg.webUrl });
    } catch (e) {
      try { logger.warn(`Atoms createIssue failed: ${(e as any)?.message || e}`); } catch {}
      return null;
    }
  }

  async getIssue(issueId: string): Promise<PMIssueLike | null> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return null;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const res = await supaFetch(cfg, `/rest/v1/requirements?id=eq.${encodeURIComponent(issueId)}&select=*`, { method: 'GET', headers } as any);
      if (!res.ok) return null;
      const j = await res.json();
      const row = Array.isArray(j) ? j[0] : j;
      return mapRequirementToIssue(row, { orgId: cfg.orgId, projectId: cfg.projectId, webUrl: cfg.webUrl });
    } catch (e) {
      try { logger.warn(`Atoms getIssue failed: ${(e as any)?.message || e}`); } catch {}
      return null;
    }
  }

  async updateIssue(issueId: string, data: UpdateData): Promise<PMIssueLike | null> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return null;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    const patch: any = {};
    if (data.summary !== undefined) patch.name = data.summary;
    if (data.description !== undefined) patch.description = data.description;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.labels !== undefined) patch.tags = data.labels;
    if (data.customFields !== undefined) patch.properties = data.customFields;
    if (data.status !== undefined) patch.status = data.status;
    try {
      const res = await supaFetch(cfg, `/rest/v1/requirements?id=eq.${encodeURIComponent(issueId)}`, { method: 'PATCH', headers, body: JSON.stringify(patch) } as any);
      if (!res.ok) return null;
      const j = await res.json();
      const row = Array.isArray(j) ? j[0] : j;
      return mapRequirementToIssue(row, { orgId: cfg.orgId, projectId: cfg.projectId, webUrl: cfg.webUrl });
    } catch (e) {
      try { logger.warn(`Atoms updateIssue failed: ${(e as any)?.message || e}`); } catch {}
      return null;
    }
  }

  async deleteIssue(issueId: string): Promise<boolean> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return false;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const res = await supaFetch(cfg, `/rest/v1/requirements?id=eq.${encodeURIComponent(issueId)}`, { method: 'DELETE', headers } as any);
      return res.ok;
    } catch {
      return false;
    }
  }

  async addComment(issueId: string, text: string): Promise<boolean> {
    // Append to properties.notes array on requirement
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return false;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const existing = await this.getIssue(issueId);
      const props = (existing?.customFields || {});
      const notes = Array.isArray((props as any).notes) ? (props as any).notes : [];
      notes.push({ text, created_at: new Date().toISOString() });
      const res = await supaFetch(cfg, `/rest/v1/requirements?id=eq.${encodeURIComponent(issueId)}`, { method: 'PATCH', headers, body: JSON.stringify({ properties: { ...props, notes } }) } as any);
      return res.ok;
    } catch (e) {
      try { logger.warn(`Atoms addComment failed: ${(e as any)?.message || e}`); } catch {}
      return false;
    }
  }

  async assignIssueAccountId(issueId: string, userId: string): Promise<boolean> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return false;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const payload = { entity_id: issueId, entity_type: 'requirement', role: 'assignee', user_id: userId };
      const res = await supaFetch(cfg, `/rest/v1/assignments`, { method: 'POST', headers, body: JSON.stringify(payload) } as any);
      return res.ok;
    } catch {
      return false;
    }
  }

  async unassignIssue(issueId: string): Promise<boolean> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return false;
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const url = `/rest/v1/assignments?entity_id=eq.${encodeURIComponent(issueId)}&entity_type=eq.requirement&role=eq.assignee`;
      const res = await supaFetch(cfg, url, { method: 'DELETE', headers } as any);
      return res.ok;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.anonKey || cfg.serviceRoleKey)) return false;
    const apiKey = cfg.anonKey || cfg.serviceRoleKey!;
    try {
      const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' } as any,
        body: JSON.stringify({ email, password })
      } as any);
      if (!res.ok) return false;
      const j: any = await res.json();
      if (j?.access_token) {
        await secretsStore.set('atoms_access_token', j.access_token);
        if (j.refresh_token) await secretsStore.set('atoms_refresh_token', j.refresh_token);
        return true;
      }
    } catch (e) {
      try { logger.warn(`Atoms login failed: ${(e as any)?.message || e}`); } catch {}
    }
    return false;
  }

  async whoami(): Promise<any | null> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.anonKey || cfg.serviceRoleKey) || !cfg.accessToken) return null;
    try {
      const res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: { 'apikey': (cfg.anonKey || cfg.serviceRoleKey)!, 'Authorization': `Bearer ${cfg.accessToken}` } as any,
      } as any);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getTransitions(_issueId: string): Promise<Array<{ id: string; name: string }>> {
    // Provide fixed, documented statuses
    const statuses = ['draft','active','in_progress','in_review','approved','rejected','archived'];
    return statuses.map(s => ({ id: s, name: s }));
  }

  async transitionIssue(issueId: string, status: string): Promise<boolean> {
    const rv = await this.updateIssue(issueId, { status });
    return !!rv;
  }

  async resolveIssue(issueId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    const ok = await this.transitionIssue(issueId, 'approved');
    return { success: ok, transitionUsed: ok ? 'approved' : undefined, error: ok ? undefined : 'failed' };
  }

  async closeIssue(issueId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    const ok = await this.transitionIssue(issueId, 'rejected');
    return { success: ok, transitionUsed: ok ? 'rejected' : undefined, error: ok ? undefined : 'failed' };
  }

  async reopenIssue(issueId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    const ok = await this.transitionIssue(issueId, 'active');
    return { success: ok, transitionUsed: ok ? 'active' : undefined, error: ok ? undefined : 'failed' };
  }

  async updateIssuePriority(issueId: string, priority: string): Promise<boolean> {
    const rv = await this.updateIssue(issueId, { priority });
    return !!rv;
  }

  async listRecentIssues(limit: number = 25, sinceMinutes: number = 5): Promise<PMIssueLike[]> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return [];
    const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
    try {
      const since = new Date(Date.now() - Math.max(1, sinceMinutes) * 60_000).toISOString();
      const url = `/rest/v1/requirements?select=*&order=updated.desc&updated=gte.${encodeURIComponent(since)}&limit=${Math.max(1, Math.min(100, limit))}`;
      const res = await supaFetch(cfg, url, { method: 'GET', headers } as any);
      if (!res.ok) return [];
      const rows = await res.json();
      const arr = Array.isArray(rows) ? rows : [];
      const mapped: PMIssueLike[] = [];
      for (const r of arr) {
        const m = mapRequirementToIssue(r, { orgId: cfg.orgId, projectId: cfg.projectId, webUrl: cfg.webUrl });
        if (m) mapped.push(m);
      }
      return mapped;
    } catch {
      return [];
    }
  }

  // Placeholder to satisfy call sites; not used for Atoms
  setSprintField(_issueKey: string, _sprintId: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  getHost(): string { return ''; }
  getProjectKey(): string { return ''; }

  async refreshIfNeeded(): Promise<boolean> {
    try {
      const cfg = await getAtomsConfig();
      if (!cfg.accessToken || !(cfg.anonKey || cfg.serviceRoleKey) || !cfg.supabaseUrl) return false;
      const parts = cfg.accessToken.split('.');
      if (parts.length < 2) return false;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as { exp?: number };
      const now = Math.floor(Date.now() / 1000);
      const exp = payload?.exp || 0;
      const secondsLeft = exp - now;
      if (secondsLeft > 300) return false; // more than 5 minutes left
      if (!cfg.refreshToken) return false;
      const rv = await refreshAccessToken(cfg);
      return !!rv?.access_token;
    } catch {
      return false;
    }
  }

  async searchUsers(query: string, maxResults: number = 25): Promise<Array<{ id: string; displayName: string; email: string }>> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return [];
    if (!cfg.projectId) return [];
    try {
      // Get project member user ids
      const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
      const r1 = await supaFetch(cfg, `/rest/v1/project_members?project_id=eq.${encodeURIComponent(cfg.projectId)}&select=user_id`, { method: 'GET', headers } as any);
      if (!r1.ok) return [];
      const members = await r1.json();
      const ids = (Array.isArray(members) ? members : []).map((m: any) => m.user_id).filter(Boolean);
      if (ids.length === 0) return [];
      const listParam = ids.map((id: string) => id).join(',');
      const r2 = await supaFetch(cfg, `/rest/v1/profiles?id=in.(${encodeURIComponent(listParam)})&select=id,email,full_name`, { method: 'GET', headers } as any);
      if (!r2.ok) return [];
      const profs = await r2.json();
      const q = (query || '').toLowerCase();
      const filtered = (Array.isArray(profs) ? profs : []).filter((p: any) => {
        const full = String(p.full_name || '').toLowerCase();
        const email = String(p.email || '').toLowerCase();
        return full.includes(q) || email.includes(q);
      }).slice(0, maxResults);
      return filtered.map((p: any) => ({ id: String(p.id), displayName: p.full_name || p.email || p.id, email: p.email || '' }));
    } catch {
      return [];
    }
  }

  // --- Linkable resources for UI comboboxes ---
  async listProjects(): Promise<Array<{ id: string; name: string; orgId?: string }>> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return [];
    try {
      const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
      const res = await supaFetch(cfg, `/rest/v1/projects?select=id,name,org_id&order=name.asc`, { method: 'GET', headers } as any);
      if (!res.ok) return [];
      const rows = await res.json();
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({ id: String(r.id), name: String(r.name || r.id), orgId: r.org_id ? String(r.org_id) : undefined }));
    } catch {
      return [];
    }
  }

  async listDocuments(projectId?: string): Promise<Array<{ id: string; name: string }>> {
    const cfg = await getAtomsConfig();
    if (!cfg.supabaseUrl || !(cfg.serviceRoleKey || cfg.anonKey)) return [];
    try {
      const headers = buildHeaders(cfg.serviceRoleKey || cfg.anonKey!, cfg.accessToken);
      const filter = projectId ? `&project_id=eq.${encodeURIComponent(projectId)}` : '';
      const res = await supaFetch(cfg, `/rest/v1/documents?select=id,name${filter}&order=updated.desc`, { method: 'GET', headers } as any);
      if (!res.ok) return [];
      const rows = await res.json();
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({ id: String(r.id), name: String(r.name || r.id) }));
    } catch {
      return [];
    }
  }
}

export const atomsService = new AtomsService();
