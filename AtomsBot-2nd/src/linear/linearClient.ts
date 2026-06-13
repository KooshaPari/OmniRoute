import { logger } from "../logger";
import { integrations, env } from "../env";

interface LinearIssue {
  id: string;
  identifier: string; // e.g., ENG-123
  title: string;
  description?: string;
  state?: { id: string; name: string };
  priority?: number | null;
  assignee?: { id: string; name: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  team?: { id: string; key: string; name: string } | null;
  url?: string;
}

export interface CreateLinearIssueData {
  summary: string;
  description?: string;
  issueType?: string; // Linear uses labels/state; optional here
  priority?: string | number;
  assignee?: string; // email or Linear user id
  labels?: string[];
  components?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateLinearIssueData extends Partial<CreateLinearIssueData> {}

async function gql(query: string, variables?: Record<string, any>): Promise<any> {
  const apiKey = integrations.linear.getConfig().apiKey;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Linear GraphQL error: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(`Linear GraphQL errors: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }
  return json.data;
}

function mapPriorityToLinear(priority?: string | number | null): number | null {
  if (priority === null || priority === undefined) return null;
  if (typeof priority === 'number') return priority;
  switch (String(priority).toLowerCase()) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return null;
  }
}

export class LinearService {
  private apiKey: string | undefined;
  private teamId?: string;
  private projectId?: string;

  constructor() {
    const cfg = integrations.linear.getConfig();
    this.apiKey = cfg.apiKey;
    this.teamId = cfg.teamId;
    this.projectId = cfg.projectId;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await gql(`query { viewer { id name } }`);
      logger.info("Linear connection test successful");
      return true;
    } catch (e) {
      logger.error(`Linear connection test failed: ${e}`);
      return false;
    }
  }

  async createIssue(data: CreateLinearIssueData): Promise<LinearIssue | null> {
    if (!this.isConfigured()) return null;
    const priority = mapPriorityToLinear(data.priority ?? null);
    const teamId = this.teamId;
    const projectId = this.projectId;
    const input: any = {
      title: data.summary,
      description: data.description,
      priority: priority ?? undefined,
    };
    if (teamId) input.teamId = teamId;
    if (projectId) input.projectId = projectId;
    if (data.assignee) input.assigneeId = await this.resolveAssigneeId(data.assignee).catch(() => undefined);

    const mutation = `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier title description url state { id name } priority assignee { id name } team { id key name } }
      }
    }`;
    const res = await gql(mutation, { input });
    if (!res?.issueCreate?.success) return null;
    return res.issueCreate.issue as LinearIssue;
  }

  // removed duplicate listTeams/listProjects definitions; consolidated versions are below

  async getIssue(key: string): Promise<LinearIssue | null> {
    if (!this.isConfigured()) return null;
    // key can be identifier like ENG-123 or internal id; try identifier first
    const query = `query GetIssue($id: String!) {
      issue: issueByIdentifier(identifier: $id) { id identifier title description url state { id name } priority assignee { id name email } team { id key name } updatedAt createdAt }
    }`;
    const byIdQuery = `query GetIssueById($id: String!) {
      issue(id: $id) { id identifier title description url state { id name } priority assignee { id name email } team { id key name } updatedAt createdAt }
    }`;
    let data = await gql(query, { id: key }).catch(() => undefined);
    let issue = data?.issue;
    if (!issue) {
      data = await gql(byIdQuery, { id: key }).catch(() => undefined);
      issue = data?.issue;
    }
    return issue || null;
  }

  async updateIssue(key: string, data: UpdateLinearIssueData): Promise<LinearIssue | null> {
    if (!this.isConfigured()) return null;
    const issue = await this.getIssue(key);
    if (!issue) return null;
    const input: any = {};
    if (data.summary) input.title = data.summary;
    if (data.description !== undefined) input.description = data.description;
    if (data.priority !== undefined) input.priority = mapPriorityToLinear(data.priority) ?? undefined;
    if (data.assignee !== undefined) input.assigneeId = data.assignee ? await this.resolveAssigneeId(data.assignee).catch(() => undefined) : null;
    const mutation = `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { id identifier title description url state { id name } priority assignee { id name email } }
      }
    }`;
    const res = await gql(mutation, { id: issue.id, input });
    if (!res?.issueUpdate?.success) return null;
    return res.issueUpdate.issue as LinearIssue;
  }

  async addComment(key: string, body: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const issue = await this.getIssue(key);
    if (!issue) return false;
    const mutation = `mutation Comment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`;
    await gql(mutation, { input: { issueId: issue.id, body } });
    return true;
  }

  async listIssueComments(key: string, limit: number = 10): Promise<Array<{ id: string; body: string; createdAt?: string; author?: string }>> {
    if (!this.isConfigured()) return [];
    try {
      const issue = await this.getIssue(key);
      if (!issue?.id) return [];
      const query = `query($id:String!,$n:Int!){ issue(id:$id){ comments(first:$n){ nodes{ id body createdAt user{ name email } } } } }`;
      const data = await gql(query, { id: issue.id, n: Math.max(1, Math.min(100, limit)) });
      const nodes = data?.issue?.comments?.nodes || [];
      return nodes.map((n:any) => ({ id: n.id, body: n.body || '', createdAt: n.createdAt, author: n?.user?.name || n?.user?.email }));
    } catch { return []; }
  }

  async deleteIssue(key: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const issue = await this.getIssue(key);
    if (!issue) return false;
    const mutation = `mutation DeleteIssue($id: String!) { issueDelete(id: $id) { success } }`;
    const res = await gql(mutation, { id: issue.id });
    return !!res?.issueDelete?.success;
  }

  async assignIssueAccountId(key: string, user: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const issue = await this.getIssue(key);
    if (!issue) return false;
    const assigneeId = await this.resolveAssigneeId(user).catch(() => undefined);
    if (!assigneeId) return false;
    const mutation = `mutation Assign($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
    const res = await gql(mutation, { id: issue.id, input: { assigneeId } });
    return !!res?.issueUpdate?.success;
  }

  async unassignIssue(key: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const issue = await this.getIssue(key);
    if (!issue) return false;
    const mutation = `mutation Unassign($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
    const res = await gql(mutation, { id: issue.id, input: { assigneeId: null } });
    return !!res?.issueUpdate?.success;
  }

  async getTransitions(_key: string): Promise<Array<{ id: string; name: string }>> {
    // Linear doesn't expose transitions like Jira; map states
    // Could fetch team states to present possible transitions
    try {
      const states = await gql(`query($teamId: String) { workflowStates(first: 50, filter: { team: { id: { eq: $teamId }}}) { nodes { id name }}}`, { teamId: this.teamId });
      const list = states?.workflowStates?.nodes || [];
      return list.map((s: any) => ({ id: s.id, name: s.name }));
    } catch {
      return [];
    }
  }

  async transitionIssue(key: string, stateId: string): Promise<boolean> {
    const issue = await this.getIssue(key);
    if (!issue) return false;
    const mutation = `mutation SetState($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
    const res = await gql(mutation, { id: issue.id, input: { stateId } });
    return !!res?.issueUpdate?.success;
  }

  async resolveIssue(key: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    // Find a state that looks like "Done" or "Completed"
    const transitions = await this.getTransitions(key);
    const target = transitions.find(t => /done|complete/i.test(t.name)) || transitions[0];
    if (!target) return { success: false, error: "No states available" };
    const success = await this.transitionIssue(key, target.id);
    return { success, transitionUsed: target.name, error: success ? undefined : "Transition failed" };
  }

  async closeIssue(key: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    // Linear: same as resolve; use a state like "Canceled" if available
    const transitions = await this.getTransitions(key);
    const target = transitions.find(t => /cancel|archive|close/i.test(t.name))
      || transitions.find(t => /done|complete/i.test(t.name))
      || transitions[0];
    if (!target) return { success: false, error: "No states available" };
    const success = await this.transitionIssue(key, target.id);
    return { success, transitionUsed: target.name, error: success ? undefined : "Transition failed" };
  }

  async reopenIssue(key: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    // Choose a state like "Todo" or "Backlog"
    const transitions = await this.getTransitions(key);
    const target = transitions.find(t => /backlog|todo|triage|open/i.test(t.name)) || transitions[0];
    if (!target) return { success: false, error: "No states available" };
    const success = await this.transitionIssue(key, target.id);
    return { success, transitionUsed: target.name, error: success ? undefined : "Transition failed" };
  }

  async setSprintField(_issueKey: string, _sprintId: string): Promise<boolean> {
    // Linear uses cycles; not implemented here
    return true;
  }

  async addComment(key: string, body: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const issue = await this.getIssue(key);
      if (!issue?.id) return false;
      const mutation = `mutation($id:String!,$body:String!){ commentCreate(input:{ issueId:$id, body:$body }){ success } }`;
      const res = await gql(mutation, { id: issue.id, body });
      return !!res?.commentCreate?.success;
    } catch { return false; }
  }

  async resolveAssigneeId(identifier: string): Promise<string> {
    // Try by email, then by name
    const data = await gql(`query($q: String!) { users(first: 50, filter: { name: { containsIgnoreCase: $q } }) { nodes { id name email } } }`, { q: identifier });
    const nodes: Array<{ id: string; name: string; email?: string }> = data?.users?.nodes || [];
    const byEmail = nodes.find(u => (u.email || '').toLowerCase() === identifier.toLowerCase());
    return (byEmail || nodes[0])?.id || "";
  }

  async searchUsers(query: string, maxResults: number = 25): Promise<Array<{ id: string; displayName: string; email?: string }>> {
    if (!this.isConfigured()) return [];
    const data = await gql(`query($q: String!, $n: Int!) { users(first: $n, filter: { name: { containsIgnoreCase: $q } }) { nodes { id name email } } }`, { q: query, n: Math.min(maxResults, 50) });
    const nodes = data?.users?.nodes || [];
    return nodes.map((u: any) => ({ id: u.id, displayName: u.name, email: u.email }));
  }

  async listTeams(limit: number = 50): Promise<Array<{ id: string; name: string }>> {
    if (!this.isConfigured()) return [];
    try {
      const data = await gql(`query($n:Int!){ teams(first:$n){ nodes{ id name } } }`, { n: Math.max(1, Math.min(100, limit)) });
      const nodes = data?.teams?.nodes || [];
      return nodes.map((t: any) => ({ id: t.id, name: t.name }));
    } catch { return []; }
  }

  async listProjects(teamId?: string, limit: number = 50): Promise<Array<{ id: string; name: string; teamId?: string }>> {
    if (!this.isConfigured()) return [];
    try {
      if (teamId) {
        const data = await gql(`query($id:String!,$n:Int!){ team(id:$id){ projects(first:$n){ nodes{ id name } } } }`, { id: teamId, n: Math.max(1, Math.min(100, limit)) });
        const nodes = data?.team?.projects?.nodes || [];
        return nodes.map((p: any) => ({ id: p.id, name: p.name, teamId }));
      }
      const data = await gql(`query($n:Int!){ projects(first:$n){ nodes{ id name team{ id } } } }`, { n: Math.max(1, Math.min(100, limit)) });
      const nodes = data?.projects?.nodes || [];
      return nodes.map((p: any) => ({ id: p.id, name: p.name, teamId: p?.team?.id }));
    } catch { return []; }
  }

  async listRecentIssues(teamId?: string, limit: number = 25): Promise<Array<{ id: string; title: string; state?: string; priority?: number | null; assignee?: { id?: string; name?: string; email?: string }; updatedAt?: string }>> {
    if (!this.isConfigured()) return [];
    try {
      if (teamId) {
        const data = await gql(`query($id:String!,$n:Int!){ team(id:$id){ issues(first:$n, orderBy: updatedAt){ nodes{ id title state{ name } priority assignee{ id name email } updatedAt } } } }`, { id: teamId, n: Math.max(1, Math.min(100, limit)) });
        const nodes = data?.team?.issues?.nodes || [];
        return nodes.map((n: any) => ({ id: n.id, title: n.title, state: n?.state?.name, priority: n?.priority ?? null, assignee: n?.assignee || undefined, updatedAt: n?.updatedAt }));
      }
      const data = await gql(`query($n:Int!){ issues(first:$n, orderBy: updatedAt){ nodes{ id title state{ name } priority assignee{ id name email } updatedAt } } }`, { n: Math.max(1, Math.min(100, limit)) });
      const nodes = data?.issues?.nodes || [];
      return nodes.map((n: any) => ({ id: n.id, title: n.title, state: n?.state?.name, priority: n?.priority ?? null, assignee: n?.assignee || undefined, updatedAt: n?.updatedAt }));
    } catch { return []; }
  }

  // (deprecated duplicates removed; use listTeams(limit) and listProjects(teamId?, limit))
}

export const linearService = new LinearService();
