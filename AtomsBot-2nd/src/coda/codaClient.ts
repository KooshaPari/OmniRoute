import { integrations, env } from "../env";
import { logger } from "../logger";

interface CodaRowUpsert {
  key?: string; // external key (e.g., Jira key or GH number)
  title?: string;
  description?: string;
  status?: string;
  priority?: string | number;
  assignee?: string; // email or display name
  labels?: string[];
  updatedAt?: string | number | Date;
}

async function codaFetch(path: string, init?: RequestInit): Promise<any> {
  const cfg = integrations.coda.getConfig();
  const res = await fetch(`https://coda.io/apis/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  } as any);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coda API ${path} failed: ${res.status} ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function getCodaToken(): string | undefined {
  try { return process.env.CODA_API_TOKEN || (env as any)?.CODA_API_TOKEN; } catch { return process.env.CODA_API_TOKEN; }
}

async function codaFetchTokenOnly(path: string, init?: RequestInit): Promise<any> {
  const token = getCodaToken();
  if (!token) throw new Error('Coda token not set');
  const res = await fetch(`https://coda.io/apis/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  } as any);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coda API ${path} failed: ${res.status} ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export class CodaService {
  private configured: boolean;
  private docId?: string;
  private issuesTableId?: string;

  constructor() {
    this.configured = integrations.coda.isConfigured();
    if (this.configured) {
      const cfg = integrations.coda.getConfig();
      this.docId = cfg.docId;
      this.issuesTableId = process.env.CODA_ISSUES_TABLE_ID || env.CODA_ISSUES_TABLE_ID;
    }
  }

  isConfigured(): boolean {
    return !!this.configured;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.isConfigured()) {
        await codaFetch(`/docs/${this.docId}`);
      } else {
        await codaFetchTokenOnly(`/whoami`);
      }
      logger.info("Coda connection test successful");
      return true;
    } catch (e) {
      logger.warn(`Coda connection test failed: ${(e as any)?.message || e}`);
      return false;
    }
  }

  async listTables(): Promise<Array<{ id: string; name: string }>> {
    if (!this.isConfigured()) return [];
    const data = await codaFetch(`/docs/${this.docId}/tables`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((t: any) => ({ id: t.id, name: t.name }));
  }
  async listTablesForDoc(docId: string): Promise<Array<{ id: string; name: string }>> {
    if (!this.isConfigured()) return [];
    const data = await codaFetch(`/docs/${docId}/tables`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((t: any) => ({ id: t.id, name: t.name }));
  }

  async listDocs(limit: number = 100, pageToken?: string, query?: string): Promise<{ items: Array<{ id: string; name: string }>; nextPageToken?: string }> {
    // Allow listing with token only (before doc selection)
    const params = new URLSearchParams();
    params.set('limit', String(Math.max(1, Math.min(100, limit))));
    if (pageToken) params.set('pageToken', pageToken);
    if (query) params.set('query', query);
    const data = await codaFetchTokenOnly(`/docs?${params.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return { items: items.map((d: any) => ({ id: d.id, name: d.name })), nextPageToken: data?.nextPageToken };
  }

  async listColumns(tableId: string): Promise<Array<{ id: string; name: string; type?: string }>> {
    if (!this.isConfigured()) return [];
    const data = await codaFetch(`/docs/${this.docId}/tables/${tableId}/columns`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
  }

  async listRows(tableId: string, limit: number = 100): Promise<Array<{ id: string; cells: Array<{ column: string; value: any }> }>> {
    if (!this.isConfigured()) return [];
    const data = await codaFetch(`/docs/${this.docId}/tables/${tableId}/rows?limit=${Math.max(1, Math.min(500, limit))}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((r: any) => {
      const cells = Array.isArray(r.cells) ? r.cells : Array.isArray(r.values) ? Object.entries(r.values).map(([column, value]) => ({ column, value })) : [];
      return { id: r.id, cells };
    });
  }

  async findRowByExternalKey(tableId: string, keyColumnId: string, externalKey: string, limit: number = 200): Promise<{ id: string } | null> {
    const rows = await this.listRows(tableId, limit);
    for (const r of rows) {
      const cell: any = (r as any).cells?.find((c: any) => {
        const col = c?.column;
        const colId = typeof col === 'string' ? col : (col?.id as string | undefined);
        return colId === keyColumnId;
      });
      const val = (cell?.value ?? '').toString();
      if (val === externalKey) return { id: (r as any).id };
    }
    return null;
  }

  /**
   * List users from a configured users table. Returns best-effort name/email mapping.
   * Uses CODA_DOC_ID and CODA_USERS_TABLE_ID. If columns are unknown, uses the first 1–2 text columns.
   */
  async listUsers(query: string = 'a', limit: number = 50): Promise<Array<{ id: string; name?: string; email?: string }>> {
    try {
      const tableId = process.env.CODA_USERS_TABLE_ID || (env as any)?.CODA_USERS_TABLE_ID;
      if (tableId) {
        return await this.listUsersFromTable(this.docId as any, tableId, query, limit);
      }
      if (!this.docId) return [];
      // Auto-detect a likely users/people table in the bound doc
      const tables = await this.listTables();
      const pickScore = (t: { id: string; name: string }) => {
        const n = (t.name || '').toLowerCase();
        let score = 0;
        if (/users?|people|members|person|assignees?|owners?/i.test(n)) score += 5;
        if (/team|contributors?/i.test(n)) score += 2;
        return score;
      };
      const sorted = tables.slice().sort((a, b) => pickScore(b) - pickScore(a));
      for (const t of sorted) {
        try {
          const cols = await this.listColumns(t.id);
          const hasEmail = cols.some(c => /email/i.test(c.name));
          const hasName = cols.some(c => /name|full\s*name/i.test(c.name));
          if (!hasEmail && !hasName) continue;
          const users = await this.listUsersFromTable(this.docId as any, t.id, query, limit);
          if (users.length) return users;
        } catch {}
      }
      return [];
    } catch (e) {
      logger.warn(`Coda listUsers failed: ${(e as any)?.message || e}`);
      return [];
    }
  }

  private async listUsersFromTable(docId: string, tableId: string, query: string, limit: number) {
    try {
      const columns = await this.listColumns(tableId);
      const nameCol = this.getColumnIdByName(columns, 'Name') || columns.find(c => /name|full\s*name/i.test(c.name))?.id || columns[0]?.id;
      const emailCol = this.getColumnIdByName(columns, 'Email') || columns.find(c => /email/i.test(c.name))?.id;
      const rows = await codaFetch(`/docs/${docId}/tables/${tableId}/rows?limit=${Math.max(1, Math.min(100, limit))}`);
      const items: any[] = Array.isArray(rows?.items) ? rows.items : [];
      const q = (query || '').toLowerCase();
      const mapped = items.map((r: any) => {
        const cells: Array<{ column: string; value: any }> = Array.isArray(r?.values) ? r.values : (r?.cells || []);
        const byCol = new Map<string, any>();
        (Array.isArray(cells) ? cells : []).forEach((c: any) => {
          const col = c.column || c.columnId;
          if (col) byCol.set(col, c.value ?? c.displayValue ?? c.text ?? c);
        });
        const name = nameCol ? (byCol.get(nameCol) ?? undefined) : undefined;
        const email = emailCol ? (byCol.get(emailCol) ?? undefined) : undefined;
        return { id: String(r.id || name || email || ''), name: typeof name === 'string' ? name : undefined, email: typeof email === 'string' ? email : undefined };
      }).filter(u => {
        if (!q) return true;
        const n = (u.name || '').toLowerCase();
        const e = (u.email || '').toLowerCase();
        return n.includes(q) || e.includes(q);
      });
      return mapped.slice(0, Math.max(1, Math.min(100, limit)));
    } catch {
      return [];
    }
  }

  parseCodaUrl(url: string): { docId?: string; anchorId?: string } {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      // Look for segment with _d-<docId>
      let docId: string | undefined;
      for (const p of parts) {
        const m = p.match(/_d-([A-Za-z0-9_\-]+)/);
        if (m) { docId = m[1]; break; }
      }
      let anchorId: string | undefined;
      if (u.hash) {
        const m2 = u.hash.match(/_([A-Za-z0-9]{6,})$/);
        if (m2) anchorId = m2[1];
      }
      return { docId, anchorId };
    } catch {
      return {};
    }
  }

  private getColumnIdByName(columns: Array<{ id: string; name: string }>, name?: string): string | undefined {
    if (!name) return undefined;
    const target = columns.find((c) => (c.name || '').toLowerCase() === (name || '').toLowerCase());
    return target?.id;
  }

  private normalizePriority(value?: string | number | null): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return String(value);
    return value;
  }

  /**
   * Create or update an issue row in Coda "Issues" table. Requires CODA_ISSUES_TABLE_ID and column hints or reasonable defaults.
   * If table/columns are not configured, logs a warning and no-ops.
   */
  async upsertIssue(data: CodaRowUpsert & { externalKey?: string }): Promise<{ rowId?: string } | null> {
    if (!this.isConfigured()) return null;
    if (!this.issuesTableId) {
      logger.warn("Coda upsertIssue skipped: CODA_ISSUES_TABLE_ID not configured. Run /setup coda to configure.");
      return null;
    }
    try {
      const columns = await this.listColumns(this.issuesTableId);
      const colKey = this.getColumnIdByName(columns, process.env.CODA_ISSUE_KEY_COLUMN || env.CODA_ISSUE_KEY_COLUMN || 'Key');
      const colTitle = this.getColumnIdByName(columns, process.env.CODA_ISSUE_TITLE_COLUMN || env.CODA_ISSUE_TITLE_COLUMN || 'Title');
      const colStatus = this.getColumnIdByName(columns, process.env.CODA_ISSUE_STATUS_COLUMN || env.CODA_ISSUE_STATUS_COLUMN || 'Status');
      const colPriority = this.getColumnIdByName(columns, process.env.CODA_ISSUE_PRIORITY_COLUMN || env.CODA_ISSUE_PRIORITY_COLUMN || 'Priority');
      const colAssignee = this.getColumnIdByName(columns, process.env.CODA_ISSUE_ASSIGNEE_COLUMN || env.CODA_ISSUE_ASSIGNEE_COLUMN || 'Assignee');
      const colUpdatedAt = this.getColumnIdByName(columns, process.env.CODA_ISSUE_UPDATED_AT_COLUMN || env.CODA_ISSUE_UPDATED_AT_COLUMN || 'Updated At');

      const cells: any[] = [];
      if (colKey && (data.externalKey || data.key)) cells.push({ column: colKey, value: data.externalKey || data.key });
      if (colTitle && data.title) cells.push({ column: colTitle, value: data.title });
      if (colStatus && data.status) cells.push({ column: colStatus, value: data.status });
      if (colPriority && data.priority !== undefined) cells.push({ column: colPriority, value: this.normalizePriority(data.priority) });
      if (colAssignee && data.assignee) cells.push({ column: colAssignee, value: data.assignee });
      if (colUpdatedAt && data.updatedAt !== undefined) {
        const v = data.updatedAt instanceof Date ? data.updatedAt.toISOString() : typeof data.updatedAt === 'number' ? new Date(data.updatedAt).toISOString() : String(data.updatedAt);
        cells.push({ column: colUpdatedAt, value: v });
      }

      if (cells.length === 0) {
        logger.warn("Coda upsertIssue: no mapped columns available; configure column hints via /setup coda");
        return null;
      }

      // Upsert via external key if available, else create
      if (data.externalKey && colKey) {
        const res = await codaFetch(`/docs/${this.docId}/tables/${this.issuesTableId}/rows`, {
          method: 'POST',
          body: JSON.stringify({ rows: [{ cells }], keyColumns: [colKey] }),
        } as any);
        const rowId = res?.addedRowIds?.[0] || res?.rows?.[0]?.id;
        return { rowId };
      } else {
        const res = await codaFetch(`/docs/${this.docId}/tables/${this.issuesTableId}/rows`, {
          method: 'POST',
          body: JSON.stringify({ rows: [{ cells }] }),
        } as any);
        const rowId = res?.addedRowIds?.[0] || res?.rows?.[0]?.id;
        return { rowId };
      }
    } catch (e) {
      logger.warn(`Coda upsertIssue failed: ${(e as any)?.message || e}`);
      return null;
    }
  }

  /** Upsert an issue into a specific doc/table mapping (per-team override). */
  async upsertIssueWithMapping(docId: string, tableIds: { issuesTableId?: string | null }, data: CodaRowUpsert & { externalKey?: string }, columns?: { key?: string | null; title?: string | null; status?: string | null; priority?: string | null; assignee?: string | null; updatedAt?: string | null }): Promise<{ rowId?: string } | null> {
    const prevDoc = this.docId;
    const prevIssues = this.issuesTableId;
    const prevEnv = {
      key: process.env.CODA_ISSUE_KEY_COLUMN,
      title: process.env.CODA_ISSUE_TITLE_COLUMN,
      status: process.env.CODA_ISSUE_STATUS_COLUMN,
      priority: process.env.CODA_ISSUE_PRIORITY_COLUMN,
      assignee: process.env.CODA_ISSUE_ASSIGNEE_COLUMN,
      updatedAt: process.env.CODA_ISSUE_UPDATED_AT_COLUMN,
    };
    try {
      this.docId = docId;
      this.issuesTableId = tableIds.issuesTableId || this.issuesTableId;
      if (columns) {
        if (columns.key) process.env.CODA_ISSUE_KEY_COLUMN = columns.key || '';
        if (columns.title) process.env.CODA_ISSUE_TITLE_COLUMN = columns.title || '';
        if (columns.status) process.env.CODA_ISSUE_STATUS_COLUMN = columns.status || '';
        if (columns.priority) process.env.CODA_ISSUE_PRIORITY_COLUMN = columns.priority || '';
        if (columns.assignee) process.env.CODA_ISSUE_ASSIGNEE_COLUMN = columns.assignee || '';
        if (columns.updatedAt) process.env.CODA_ISSUE_UPDATED_AT_COLUMN = columns.updatedAt || '';
      }
      return await this.upsertIssue(data);
    } finally {
      this.docId = prevDoc;
      this.issuesTableId = prevIssues;
      process.env.CODA_ISSUE_KEY_COLUMN = prevEnv.key;
      process.env.CODA_ISSUE_TITLE_COLUMN = prevEnv.title;
      process.env.CODA_ISSUE_STATUS_COLUMN = prevEnv.status;
      process.env.CODA_ISSUE_PRIORITY_COLUMN = prevEnv.priority;
      process.env.CODA_ISSUE_ASSIGNEE_COLUMN = prevEnv.assignee;
      process.env.CODA_ISSUE_UPDATED_AT_COLUMN = prevEnv.updatedAt;
    }
  }

  async addComment(payload: { issueKey?: string; text: string; author?: string; createdAt?: string | Date }): Promise<boolean> {
    // Optional: if a comments table is configured, append a row with issueKey reference
    if (!this.isConfigured()) return false;
    const commentsTable = process.env.CODA_COMMENTS_TABLE_ID || env.CODA_COMMENTS_TABLE_ID;
    if (!commentsTable) return false;
    try {
      const columns = await this.listColumns(commentsTable);
      const colKey = this.getColumnIdByName(columns, 'Issue');
      const colText = this.getColumnIdByName(columns, 'Comment');
      const colAuthor = this.getColumnIdByName(columns, 'Author');
      const colCreated = this.getColumnIdByName(columns, 'Created At');
      const cells: any[] = [];
      if (colKey && payload.issueKey) cells.push({ column: colKey, value: payload.issueKey });
      if (colText && payload.text) cells.push({ column: colText, value: payload.text });
      if (colAuthor && payload.author) cells.push({ column: colAuthor, value: payload.author });
      if (colCreated && payload.createdAt) cells.push({ column: colCreated, value: (payload.createdAt instanceof Date) ? payload.createdAt.toISOString() : String(payload.createdAt) });
      if (cells.length === 0) return false;
      await codaFetch(`/docs/${this.docId}/tables/${commentsTable}/rows`, { method: 'POST', body: JSON.stringify({ rows: [{ cells }] }) } as any);
      return true;
    } catch (e) {
      logger.warn(`Coda addComment failed: ${(e as any)?.message || e}`);
      return false;
    }
  }

  // --- JiraService-compatible methods (best-effort stubs for parity) ---
  async createIssue(data: any): Promise<any | null> {
    // Generate a synthetic key when none is provided
    const key = data?.externalKey || `CODA-${Date.now()}`;
    await this.upsertIssue({ externalKey: key, title: data?.summary, description: data?.description, status: data?.status, priority: data?.priority, assignee: data?.assignee });
    return {
      id: key,
      key,
      summary: data?.summary || '',
      description: data?.description || '',
      status: { id: '', name: data?.status || '', statusCategory: { key: '', name: '' } },
      priority: { id: '', name: data?.priority || '' },
      assignee: data?.assignee ? { accountId: '', displayName: data?.assignee, emailAddress: data?.assignee } : undefined,
      reporter: { accountId: '', displayName: '', emailAddress: '' },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      labels: [],
      components: [],
      issueType: { id: '', name: 'Row', iconUrl: '' },
      project: { id: '', key: '', name: '' },
      customFields: {},
    };
  }

  async getIssue(_key: string): Promise<any | null> {
    // Generic lookup is non-trivial without configured columns; return null
    return null;
  }

  async updateIssue(key: string, data: any): Promise<any | null> {
    await this.upsertIssue({ externalKey: key, title: data?.summary, status: data?.status, priority: data?.priority, assignee: data?.assignee });
    return {
      id: key, key,
      summary: data?.summary || '',
      description: data?.description || '',
      status: { id: '', name: data?.status || '', statusCategory: { key: '', name: '' } },
      priority: { id: '', name: data?.priority || '' },
      reporter: { accountId: '', displayName: '', emailAddress: '' },
      created: '', updated: '', labels: [], components: [], issueType: { id: '', name: 'Row', iconUrl: '' }, project: { id: '', key: '', name: '' }, customFields: {}
    };
  }

  async updateIssuePriority(key: string, priority: string): Promise<boolean> {
    await this.upsertIssue({ externalKey: key, priority });
    return true;
  }

  async transitionIssue(key: string, _transitionId: string): Promise<boolean> {
    // Without explicit mapping, just no-op
    await this.upsertIssue({ externalKey: key });
    return true;
  }

  async resolveIssue(key: string): Promise<boolean> { return this.transitionIssue(key, 'resolve'); }
  async closeIssue(key: string): Promise<boolean> { return this.transitionIssue(key, 'close'); }
  async reopenIssue(key: string): Promise<boolean> { return this.transitionIssue(key, 'reopen'); }
  async getTransitions(_key: string): Promise<Array<{ id: string; name: string }>> { return []; }
  async assignIssueAccountId(key: string, user: string): Promise<boolean> { await this.upsertIssue({ externalKey: key, assignee: user }); return true; }
  async unassignIssue(key: string): Promise<boolean> { await this.upsertIssue({ externalKey: key, assignee: '' }); return true; }
  async deleteIssue(_key: string): Promise<boolean> { return false; }
  async setIssueSprintField(_key: string, _sprintId: string | number | null): Promise<boolean> { return false; }
  getHost(): string { return 'coda.io'; }
  getProjectKey(): string { return ''; }
  async searchIssues(_jql: string): Promise<any[]> { return []; }
}

export const codaService = new CodaService();
