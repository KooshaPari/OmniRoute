import { Version3Client } from "jira.js";
import { config } from "../config";
import { secretsStore } from "../settings/SecretsStore";
import { settingsService } from "../settings/SettingsService";
import { logger } from "../logger";
import { env } from "../env";

export interface JiraCredentials {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  url?: string;
  summary: string;
  description?: string;
  status: {
    id: string;
    name: string;
    statusCategory: {
      key: string | undefined;
      name: string | undefined;
    };
  };
  priority: {
    id: string | undefined;
    name: string | undefined;
  };
  assignee?: {
    accountId: string;
    displayName: string;
    emailAddress: string;
  };
  reporter: {
    accountId: string;
    displayName: string;
    emailAddress: string;
  };
  created: string;
  updated: string;
  labels: string[];
  components: Array<{
    id: string;
    name: string;
  }>;
  issueType: {
    id: string;
    name: string;
    iconUrl: string;
  };
  project: {
    id: string;
    key: string;
    name: string;
  };
  customFields?: Record<string, any>;
}

export interface CreateJiraIssueData {
  summary: string;
  description?: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateJiraIssueData {
  summary?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  customFields?: Record<string, any>;
}

export class JiraService {
  private client!: Version3Client;
  private credentials: JiraCredentials;

  constructor() {
    this.credentials = {
      host: config.JIRA_HOST || "",
      email: config.JIRA_EMAIL || "",
      apiToken: config.JIRA_API_TOKEN || "",
      projectKey: config.JIRA_PROJECT_KEY || "",
    };

    if (
      !this.credentials.host ||
      !this.credentials.email ||
      !this.credentials.apiToken
    ) {
      logger.warn(
        "Jira credentials not configured. Jira integration will be disabled.",
      );
      return;
    }

    this.client = new Version3Client({
      host: `https://${this.credentials.host}`,
      authentication: {
        basic: {
          email: this.credentials.email,
          apiToken: this.credentials.apiToken,
        },
      },
    });

    logger.info("Jira client initialized successfully");
    logger.info(
      `Jira configuration: host=${this.credentials.host}, email=${this.credentials.email}, hasToken=${!!this.credentials.apiToken}, projectKey=${this.credentials.projectKey}`,
    );

    // Test the connection
    this.testConnection();
  };

  /** Lazily ensure Jira client exists (useful when global instance created before mocks). */
  private ensureClient(): void {
    const needsInit = !this.client
      || !(this.client as any).issues
      || !(this.client as any).myself
      || typeof (this.client as any).issues.getIssue !== 'function';
    if (!this.isConfigured() || !needsInit) return;
    try {
      this.client = new Version3Client({
        host: `https://${this.credentials.host}`,
        authentication: { basic: { email: this.credentials.email, apiToken: this.credentials.apiToken } },
      });
    } catch {}
  }

  private safeLogError(message: string): void {
    try {
      logger.error(message);
    } catch {}
  }

  /** Map Jira API issue response to JiraIssue with safe fallbacks. */
  private static mapIssueResponse(issueKeyParam: string, response: any): JiraIssue {
    const fields = (response && typeof response.fields === 'object' && response.fields) ? response.fields : {};
    const status = fields?.status || {};
    const priority = fields?.priority || {};
    const assignee = fields?.assignee;
    const reporter = fields?.reporter || {};
    const componentsArr = Array.isArray(fields?.components) ? fields.components : [];
    const issueType = fields?.issuetype || {};
    const project = fields?.project || {};

    return {
      id: response?.id ?? '',
      key: response?.key ?? issueKeyParam,
      summary: fields?.summary ?? '',
      description:
        fields?.description?.content?.[0]?.content?.[0]?.text || '',
      status: {
        id: status?.id ?? '',
        name: status?.name ?? '',
        statusCategory: {
          key: status?.statusCategory?.key ?? '',
          name: status?.statusCategory?.name ?? '',
        },
      },
      priority: {
        id: priority?.id ?? '',
        name: priority?.name ?? '',
      },
      assignee: assignee
        ? {
            accountId: assignee.accountId ?? '',
            displayName: assignee.displayName ?? '',
            emailAddress: assignee.emailAddress ?? '',
          }
        : undefined,
      reporter: {
        accountId: reporter?.accountId ?? '',
        displayName: reporter?.displayName ?? '',
        emailAddress: reporter?.emailAddress ?? '',
      },
      created: fields?.created ?? '',
      updated: fields?.updated ?? '',
      labels: Array.isArray(fields?.labels) ? (fields.labels as string[]) : [],
      components:
        componentsArr.map((c: any) => ({ id: c?.id ?? '', name: c?.name ?? '' })) || [],
      issueType: {
        id: issueType?.id ?? '',
        name: issueType?.name ?? '',
        iconUrl: issueType?.iconUrl ?? '',
      },
      project: {
        id: project?.id ?? '',
        key: project?.key ?? '',
        name: project?.name ?? '',
      },
    };
  }

  getHost(): string {
    return this.credentials.host;
  }

  getProjectKey(): string {
    return this.credentials.projectKey;
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.host &&
      this.credentials.email &&
      this.credentials.apiToken
    );
  }

  async updateCredentialsFromDb(teamId?: string): Promise<void> {
    try {
      const host = (await secretsStore.get('jira_host')) || this.credentials.host || config.JIRA_HOST || "";
      const email = (await secretsStore.get('jira_email')) || this.credentials.email || config.JIRA_EMAIL || "";
      const apiToken = (await secretsStore.get('jira_api_token')) || this.credentials.apiToken || config.JIRA_API_TOKEN || "";
      let projectKey = this.credentials.projectKey || config.JIRA_PROJECT_KEY || "";
      if (teamId) {
        try {
          const team = await settingsService.getTeamSettings(teamId);
          if (team?.jiraProjectKey) projectKey = team.jiraProjectKey;
        } catch {}
      } else {
        const pk = await secretsStore.get('jira_project_key');
        if (pk) projectKey = pk;
      }

      const mustRecreate = !this.client || host !== this.credentials.host || email !== this.credentials.email || apiToken !== this.credentials.apiToken;
      this.credentials = { host, email, apiToken, projectKey };
      if (mustRecreate && host && email && apiToken) {
        this.client = new Version3Client({
          host: `https://${host}`,
          authentication: { basic: { email, apiToken } },
        });
      }
    } catch {}
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      this.ensureClient();
      await this.client.myself.getCurrentUser();
      logger.info("Jira connection test successful");
      return true;
    } catch (error) {
      this.safeLogError(`Jira connection test failed: ${error}`);
      return false;
    }
  }

  async createIssue(data: CreateJiraIssueData): Promise<JiraIssue | null> {
    if (!this.isConfigured()) {
      logger.warn("Jira not configured, skipping issue creation");
      return null;
    }

    try {
      this.ensureClient();
      logger.info(
        `Attempting to create Jira issue with project key: ${this.credentials.projectKey}`,
      );

      const issueData = {
        fields: {
          project: { key: this.credentials.projectKey },
          summary: data.summary,
          description: data.description
            ? {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: data.description,
                      },
                    ],
                  },
                ],
              }
            : undefined,
          issuetype: { name: data.issueType || "Story" },
          // Priority field is not available in this project's screen configuration
          assignee: data.assignee ? { emailAddress: data.assignee } : undefined,
          // labels: removed - labels must exist in Jira project before assignment
          // components: removed - components must exist in Jira project
          ...data.customFields,
        },
      };

      logger.info(`Jira issue data: ${JSON.stringify(issueData, null, 2)}`);
      const response = await this.client.issues.createIssue(issueData);
      logger.info(`Created Jira issue: ${response.key}`);

      // Fetch the full issue details
      const full = await this.getIssue(response.key!);
      if (full) return full;
      // Fallback to minimal result if fetching full details failed
      return JiraService.mapIssueResponse(response.key!, {
        id: response.id,
        key: response.key,
        fields: {
          summary: data.summary,
          description: data.description
            ? { content: [{ content: [{ text: data.description }] }] }
            : undefined,
          issuetype: { name: data.issueType },
          project: { key: this.credentials.projectKey },
          labels: data.labels ?? [],
          components: (data.components ?? []).map((name) => ({ name })),
        },
      });
    } catch (error) {
      this.safeLogError(`Failed to create Jira issue: ${error}`);
      return null;
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      this.ensureClient();
      const response = await this.client.issues.getIssue({
        issueIdOrKey: issueKey,
        expand: ["renderedFields"],
      });
      // If fields exist but contain no usable data, treat as malformed
      if (response && typeof response.fields === 'object' && response.fields && Object.keys(response.fields).length === 0) {
        return null;
      }
      return JiraService.mapIssueResponse(issueKey, response);
    } catch (error) {
      this.safeLogError(`Failed to get Jira issue ${issueKey}: ${error}`);
      return null;
    }
  }

  async updateIssue(
    issueKey: string,
    data: UpdateJiraIssueData,
  ): Promise<JiraIssue | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      this.ensureClient();
      const updateData = {
        fields: {
          summary: data.summary,
          description: data.description
            ? {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: data.description,
                      },
                    ],
                  },
                ],
              }
            : undefined,
          priority: data.priority ? { name: data.priority } : undefined,
          assignee: data.assignee ? { emailAddress: data.assignee } : undefined,
          labels: data.labels,
          components: data.components?.map((name) => ({ name })),
          ...data.customFields,
        },
      };

      // Remove undefined fields
      Object.keys(updateData.fields).forEach((key) => {
        if (
          updateData.fields[key as keyof typeof updateData.fields] === undefined
        ) {
          delete updateData.fields[key as keyof typeof updateData.fields];
        }
      });

      await this.client.issues.editIssue({
        issueIdOrKey: issueKey,
        ...updateData,
      });

      logger.info(`Updated Jira issue: ${issueKey}`);
      return await this.getIssue(issueKey);
    } catch (error) {
      this.safeLogError(`Failed to update Jira issue ${issueKey}: ${error}`);
      return null;
    }

  }

  /** Convenience helper used by integration tests */
  async updateIssuePriority(issueKey: string, priority: string): Promise<boolean> {
    const updated = await this.updateIssue(issueKey, { priority });
    return !!updated;
  }

  /**
   * Set the sprint field for an issue using the configured sprint custom field id.
   * Expects env var JIRA_SPRINT_FIELD (e.g., "customfield_10020").
   */
  async setIssueSprintField(issueKey: string, sprintId: string | number | null): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const fieldId = (config as any).JIRA_SPRINT_FIELD as string | undefined;
    if (!fieldId) {
      logger.debug('Jira sprint field id not configured (JIRA_SPRINT_FIELD)');
      return false;
    }
    try {
      this.ensureClient();
      const payload: any = { fields: { } };
      payload.fields[fieldId] = sprintId === null ? null : sprintId;
      await (this.client as any).issues.editIssue({ issueIdOrKey: issueKey, ...payload });
      logger.info(`Set Jira sprint field for ${issueKey} -> ${sprintId}`);
      return true;
    } catch (e) {
      try {
        logger.warn('Failed to set Jira sprint field', { issueKey, sprintId, error: (e as any)?.message || e });
      } catch {}
      return false;
    }
  }

  // Assign using Jira accountId (preferred for Cloud)
  assignIssueAccountId = async (
    issueKey: string,
    accountId: string,
  ): Promise<boolean> => {
    if (!this.isConfigured()) return false;
    try {
      this.ensureClient();
      await this.client.issues.editIssue({
        issueIdOrKey: issueKey,
        fields: {
          assignee: { accountId },
        } as any,
      });
      logger.info(
        `Assigned Jira issue ${issueKey} to accountId ${accountId}`,
      );
      return true;
    } catch (error) {
      this.safeLogError(`Failed to assign Jira issue ${issueKey}: ${error}`);
      return false;
    }
  }

  // Unassign an issue (clear assignee)
  unassignIssue = async (issueKey: string): Promise<boolean> => {
    if (!this.isConfigured()) return false;
    try {
      this.ensureClient();
      await this.client.issues.editIssue({
        issueIdOrKey: issueKey,
        fields: {
          assignee: null as any,
        },
      } as any);
      logger.info(`Unassigned Jira issue ${issueKey}`);
      return true;
    } catch (error) {
      this.safeLogError(`Failed to unassign Jira issue ${issueKey}: ${error}`);
      return false;
    }
  }



  async transitionIssue(
    issueKey: string,
    transitionId: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.error('Jira not configured - cannot transition issue');
      return false;
    }

    try {
      this.ensureClient();
      // Get available transitions for validation
      const transitions = await this.getTransitions(issueKey);
      const targetTransition = transitions.find(t => t.id === transitionId);

      if (!targetTransition) {
        logger.error(`Transition ${transitionId} not available for issue ${issueKey}. Available: ${transitions.map(t => `${t.name}(${t.id})`).join(', ')}`);
        return false;
      }

      await this.client.issues.doTransition({
        issueIdOrKey: issueKey,
        transition: { id: transitionId },
      });

      logger.info(
        `Successfully transitioned Jira issue ${issueKey} to '${targetTransition.name}' (ID: ${transitionId})`,
      );
      return true;
    } catch (error) {
      this.safeLogError(`Failed to transition Jira issue ${issueKey} to transition ${transitionId}: ${error}`);

      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('400')) {
          this.safeLogError('Bad Request - Transition may not be valid for current issue status');
        } else if (error.message.includes('403')) {
          this.safeLogError('Permission denied - User may lack transition permission');
        } else if (error.message.includes('404')) {
          this.safeLogError('Not Found - Issue or transition may not exist');
        }
      }

      return false;
    }
  }

  /**
   * Attempt to resolve an issue using the best available transition
   * @param issueKey Jira issue key
   * @returns Success status and transition used
   */
  async resolveIssue(issueKey: string): Promise<{
    success: boolean;
    transitionUsed?: string;
    error?: string;
  }> {
    let transition = await this.findResolveTransition(issueKey);

    if (!transition) {
      // Fallback preference: Done/Complete/Resolved over arbitrary transitions
      const all = await this.getTransitions(issueKey);
      const prefer = [/^done$/i, /done/i, /complete/i, /resolved?/i, /finish/i];
      let picked = null as { id: string; name: string } | null;
      for (const rx of prefer) {
        picked = all.find(t => rx.test(t.name)) || picked;
        if (picked && /^done$/i.test(picked.name)) break; // exact Done wins
      }
      if (picked) {
        logger.warn(`No resolve match; preferring fallback '${picked.name}'`);
        transition = { id: picked.id, name: picked.name, confidence: 0 };
      } else {
        const last = all[all.length - 1];
        if (last) {
          logger.warn(`No resolve match; falling back to last transition '${last.name}'`);
          transition = { id: last.id, name: last.name, confidence: 0 };
        } else {
          return {
            success: false,
            error: 'No suitable resolve transition found',
          };
        }
      }
    }

    const success = await this.transitionIssue(issueKey, transition.id);
    return {
      success,
      transitionUsed: success ? transition.name : undefined,
      error: success ? undefined : 'Transition failed'
    };
  }

  /**
   * Attempt to reject an issue using the best available transition
   * @param issueKey Jira issue key
   * @returns Success status and transition used
   */
  async closeIssue(issueKey: string): Promise<{
    success: boolean;
    transitionUsed?: string;
    error?: string;
  }> {
    let transition = await this.findCloseTransition(issueKey);

    if (!transition) {
      // Fallback: choose first available transition (best-effort close)
      const all = await this.getTransitions(issueKey);
      const first = all[0];
      if (first) {
        logger.warn(`No close match; falling back to first transition '${first.name}'`);
        transition = { id: first.id, name: first.name, confidence: 0 };
      } else {
        return {
          success: false,
          error: 'No suitable close transition found',
        };
      }
    }

    const success = await this.transitionIssue(issueKey, transition.id);
    return {
      success,
      transitionUsed: success ? transition.name : undefined,
      error: success ? undefined : 'Transition failed'
    };
  }

  /**
   * Attempt to reopen an issue using the best available transition
   * @param issueKey Jira issue key
   * @returns Success status and transition used
   */
  async reopenIssue(issueKey: string): Promise<{
    success: boolean;
    transitionUsed?: string;
    error?: string;
  }> {
    let transition = await this.findReopenTransition(issueKey);

    if (!transition) {
      // Fallback: choose first available transition to reopen
      const all = await this.getTransitions(issueKey);
      const first = all[0];
      if (first) {
        logger.warn(`No reopen match; falling back to first transition '${first.name}'`);
        transition = { id: first.id, name: first.name, confidence: 0 };
      } else {
        return {
          success: false,
          error: 'No suitable reopen transition found',
        };
      }
    }

    const success = await this.transitionIssue(issueKey, transition.id);
    return {
      success,
      transitionUsed: success ? transition.name : undefined,
      error: success ? undefined : 'Transition failed'
    };
  }

  /**
   * Attempt to reject an issue using the best available transition (alias for closeIssue)
   * @param issueKey Jira issue key
   * @returns Success status and transition used
   */
  async rejectIssue(issueKey: string): Promise<{
    success: boolean;
    transitionUsed?: string;
    error?: string;
  }> {
    return await this.closeIssue(issueKey);
  }

  async getTransitions(
    issueKey: string,
  ): Promise<Array<{ id: string; name: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      this.ensureClient();
      const response = await this.client.issues.getTransitions({
        issueIdOrKey: issueKey,
      });

      const transitions = (Array.isArray(response?.transitions) ? response.transitions : [])
        .filter((t: any) => t && t.id && t.name)
        .map((t: any) => ({ id: String(t.id), name: String(t.name) }));

      // Rich diagnostics: list names and IDs
      logger.info(
        `Jira transitions for ${issueKey} (${transitions.length}): ` +
          transitions.map(t => `${t.name} [${t.id}]`).join(', '),
      );
      // Show custom mappings in effect for transparency
      const customResolve = JiraTransitionMapper['getCustomTransitionNames']?.('resolve') || [];
      const customClose = JiraTransitionMapper['getCustomTransitionNames']?.('close') || [];
      const customReopen = JiraTransitionMapper['getCustomTransitionNames']?.('reopen') || [];
      if (customResolve.length || customClose.length || customReopen.length) {
        logger.info(
          `Custom Jira transition mappings` +
            ` | resolve: [${customResolve.join(', ')}]` +
            ` | close: [${customClose.join(', ')}]` +
            ` | reopen: [${customReopen.join(', ')}]`,
        );
      }
      return transitions;
    } catch (error) {
      this.safeLogError(
        `Failed to get transitions for Jira issue ${issueKey}: ${error}`,
      );
      return [];
    }
  }

  /**
   * Find the best transition for resolving an issue
   * @param issueKey Jira issue key
   * @returns Best resolve transition or null if none found
   */
  async findResolveTransition(
    issueKey: string,
  ): Promise<{ id: string; name: string; confidence: number } | null> {
    const transitions = await this.getTransitions(issueKey);
    const match = JiraTransitionMapper.findBestTransition(transitions, 'resolve');

    if (match) {
      logger.info(`Found resolve transition for ${issueKey}: ${match.transition.name} (confidence: ${match.confidence})`);
      return {
        id: match.transition.id,
        name: match.transition.name,
        confidence: match.confidence,
      };
    }

    logger.warn(`No resolve transition found for ${issueKey}. Available: ${transitions.map(t => t.name).join(', ')}`);
    return null;
  }

  /**
   * Find the best transition for rejecting an issue (won't do)
   * @param issueKey Jira issue key
   * @returns Best wontdo transition or null if none found
   */
  async findCloseTransition(
    issueKey: string,
  ): Promise<{ id: string; name: string; confidence: number } | null> {
    const transitions = await this.getTransitions(issueKey);
    const match = JiraTransitionMapper.findBestTransition(transitions, 'close');

    if (match) {
      logger.info(`Found close transition for ${issueKey}: ${match.transition.name} (confidence: ${match.confidence})`);
      return {
        id: match.transition.id,
        name: match.transition.name,
        confidence: match.confidence,
      };
    }

    logger.warn(`No close transition found for ${issueKey}. Available: ${transitions.map(t => t.name).join(', ')}`);
    return null;
  }

  /**
   * Find the best transition for reopening an issue
   * @param issueKey Jira issue key
   * @returns Best reopen transition or null if none found
   */
  async findReopenTransition(
    issueKey: string,
  ): Promise<{ id: string; name: string; confidence: number } | null> {
    const transitions = await this.getTransitions(issueKey);
    const match = JiraTransitionMapper.findBestTransition(transitions, 'reopen');

    if (match) {
      logger.info(`Found reopen transition for ${issueKey}: ${match.transition.name} (confidence: ${match.confidence})`);
      return {
        id: match.transition.id,
        name: match.transition.name,
        confidence: match.confidence,
      };
    }

    logger.warn(`No reopen transition found for ${issueKey}. Available: ${transitions.map(t => t.name).join(', ')}`);
    return null;
  }

  /**
   * Analyze workflow compatibility for the current project
   * @param issueKey Sample issue key to check transitions
   * @returns Workflow analysis
   */
  async analyzeProjectWorkflow(issueKey: string) {
    const transitions = await this.getTransitions(issueKey);
    const analysis = JiraTransitionMapper.analyzeWorkflow(transitions);

    logger.info(`Workflow analysis for project ${this.credentials.projectKey}:`);
    logger.info(`- Coverage: ${analysis.coverage}%`);
    logger.info(`- Resolve: ${analysis.resolve.available ? analysis.resolve.bestMatch : 'Not available'}`);
    logger.info(`- Close: ${analysis.close.available ? analysis.close.bestMatch : 'Not available'}`);
    logger.info(`- Reopen: ${analysis.reopen.available ? analysis.reopen.bestMatch : 'Not available'}`);

    return analysis;
  }

  async addComment(issueKey: string, comment: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      this.ensureClient();
      await this.client.issueComments.addComment({
        issueIdOrKey: issueKey,
        comment: comment,
      });

      logger.info(`Added comment to Jira issue: ${issueKey}`);
      return true;
    } catch (error) {
      this.safeLogError(`Failed to add comment to Jira issue ${issueKey}: ${error}`);
      return false;
    }
  }

  async deleteIssue(issueKey: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      this.ensureClient();
      await this.client.issues.deleteIssue({
        issueIdOrKey: issueKey,
      });

      logger.info(`Deleted Jira issue: ${issueKey}`);
      return true;
    } catch (error) {
      this.safeLogError(`Failed to delete Jira issue ${issueKey}: ${error}`);
      return false;
    }
  }

  async searchIssues(
    jql: string,
    maxResults: number = 50,
  ): Promise<JiraIssue[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      this.ensureClient();
      const response = await this.client.issueSearch.searchForIssuesUsingJql({
        jql,
        maxResults,
        expand: ["renderedFields"],
      });

      const mapped = (Array.isArray(response?.issues) ? response.issues : []).map((issue: any) =>
        JiraService.mapIssueResponse(issue?.key ?? '', issue)
      );
      return mapped as JiraIssue[];
    } catch (error) {
      this.safeLogError(`Failed to search Jira issues: ${error}`);
      return [];
    }
  }
}

// Basic user search for Jira Cloud (phenotype.atlassian). Returns up to 25 matches by display name or email.
export async function jiraSearchUsers(query: string, maxResults: number = 25): Promise<Array<{ accountId?: string; displayName: string; emailAddress?: string; active?: boolean; accountType?: string; id?: string }>> {
  // If provider is Linear, leverage its user search
  try {
    const provider = (env as any)?.PM_PROVIDER || process.env.PM_PROVIDER || 'jira';
    if (String(provider).toLowerCase() === 'linear') {
      const { linearService } = await import('../linear/linearClient');
      const users = await linearService.searchUsers(query, maxResults);
      return users.map((u: any) => ({ id: u.id, displayName: u.displayName, emailAddress: u.email }));
    }
    if (String(provider).toLowerCase() === 'atoms') {
      const { atomsService } = await import('../atoms/atomsClient');
      const users = await atomsService.searchUsers(query, maxResults);
      return users.map((u: any) => ({ id: u.id, displayName: u.displayName, emailAddress: u.email }));
    }
    if (String(provider).toLowerCase() === 'github_projects') {
      // Not applicable for Projects items; return empty
      return [];
    }
  } catch {}
  if (!jiraService.isConfigured()) return [];
  try {
    const creds: any = (jiraService as any).credentials;
    const url = `https://${creds.host}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64'),
        'Accept': 'application/json',
      },
    } as any);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((u: any) => u?.active === true && (u?.accountType ?? 'atlassian') === 'atlassian')
      .map((u: any) => ({ accountId: u.accountId, displayName: u.displayName, emailAddress: u.emailAddress, active: u.active, accountType: u.accountType }))
      .slice(0, maxResults);
  } catch (e) {
    logger.warn(`Jira searchUsers failed: ${e}`);
    return [];
  }
}

/**
 * Fetch members of a Jira group (Cloud). Useful to restrict to org-visible active users.
 */
export async function jiraGetGroupMembers(groupName: string, maxResults: number = 100): Promise<Array<{ accountId?: string; displayName: string; emailAddress?: string; active?: boolean; accountType?: string; id?: string }>> {
  try {
    const provider = (env as any)?.PM_PROVIDER || process.env.PM_PROVIDER || 'jira';
    if (String(provider).toLowerCase() !== 'jira') {
      // Groups aren't relevant outside Jira
      return [];
    }
  } catch {}
  if (!jiraService.isConfigured()) return [];
  try {
    const creds: any = (jiraService as any).credentials;
    let startAt = 0;
    const out: any[] = [];
    // Paginate until we collect up to maxResults
    while (out.length < maxResults) {
      const url = `https://${creds.host}/rest/api/3/group/member?groupname=${encodeURIComponent(groupName)}&startAt=${startAt}&maxResults=${Math.min(50, maxResults - out.length)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64'),
          'Accept': 'application/json',
        },
      } as any);
      if (!res.ok) break;
      const data = await res.json();
      const values = Array.isArray(data?.values) ? data.values : [];
      out.push(...values);
      if (data?.isLast || values.length === 0) break;
      startAt = (data?.startAt || 0) + (data?.maxResults || values.length);
    }
    return out
      .filter((u: any) => u?.active === true && (u?.accountType ?? 'atlassian') === 'atlassian')
      .map((u: any) => ({ accountId: u.accountId, displayName: u.displayName, emailAddress: u.emailAddress, active: u.active, accountType: u.accountType }));
  } catch (e) {
    logger.warn(`Jira group members failed for '${groupName}': ${e}`);
    return [];
  }
}

/**
 * Discover group names using Jira groups picker API.
 */
export async function jiraListGroups(query: string = "a", maxResults: number = 100): Promise<string[]> {
  try {
    const provider = (env as any)?.PM_PROVIDER || process.env.PM_PROVIDER || 'jira';
    if (String(provider).toLowerCase() !== 'jira') {
      return [];
    }
  } catch {}
  if (!jiraService.isConfigured()) return [];
  try {
    const creds: any = (jiraService as any).credentials;
    const url = `https://${creds.host}/rest/api/3/groups/picker?query=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64'),
        'Accept': 'application/json',
      },
    } as any);
    if (!res.ok) return [];
    const data = await res.json();
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    return groups.map((g: any) => g.name).filter(Boolean);
  } catch (e) {
    logger.warn(`Jira list groups failed: ${e}`);
    return [];
  }
}

// Provider proxy: expose a Jira-compatible service, but route to Linear, GitHub Projects, or Coda when selected.
// When PM sync is enabled and Coda is configured, mirror key mutations into Coda for cross-system synchronization.
let jiraService: any;
try {
  const provider = process.env.PM_PROVIDER || (env as any)?.PM_PROVIDER || 'jira';
  if (String(provider).toLowerCase() === 'linear') {
    const { linearService } = await import('../linear/linearClient');
    const map = (iss: any) => iss ? ({
      id: iss.id || '',
      key: iss.identifier || iss.id || '',
      summary: iss.title || '',
      description: iss.description || '',
      status: { id: iss.state?.id || '', name: iss.state?.name || '', statusCategory: { key: '', name: '' } },
      priority: { id: '', name: (iss.priority != null ? String(iss.priority) : '') },
      assignee: iss.assignee ? { accountId: iss.assignee.id || '', displayName: iss.assignee.name || '', emailAddress: iss.assignee.email || '' } : undefined,
      reporter: { accountId: '', displayName: '', emailAddress: '' },
      created: iss.createdAt || '',
      updated: iss.updatedAt || '',
      labels: [],
      components: [],
      issueType: { id: '', name: '', iconUrl: '' },
      project: { id: iss.team?.id || '', key: iss.team?.key || '', name: iss.team?.name || '' },
      customFields: {},
      url: iss.url || ''
    }) : null;
    jiraService = {
      isConfigured: () => linearService.isConfigured(),
      testConnection: () => linearService.testConnection(),
      createIssue: async (data: any) => map(await linearService.createIssue(data)),
      getIssue: async (key: string) => map(await linearService.getIssue(key)),
      updateIssue: async (key: string, data: any) => map(await linearService.updateIssue(key, data)),
      addComment: (key: string, body: string) => linearService.addComment(key, body),
      deleteIssue: (key: string) => linearService.deleteIssue(key),
      assignIssueAccountId: (key: string, user: string) => linearService.assignIssueAccountId(key, user),
      unassignIssue: (key: string) => linearService.unassignIssue(key),
      getTransitions: (key: string) => linearService.getTransitions(key),
      transitionIssue: (key: string, id: string) => linearService.transitionIssue(key, id),
      resolveIssue: (key: string) => linearService.resolveIssue(key),
      closeIssue: (key: string) => linearService.closeIssue(key),
      reopenIssue: (key: string) => linearService.reopenIssue(key),
      setIssueSprintField: (key: string, sprintId: string | number | null) => linearService.setSprintField(key, sprintId as any),
      getHost: () => '',
      getProjectKey: () => '',
    };
  } else if (String(provider).toLowerCase() === 'github_projects') {
    const { githubProjectsService } = await import('../github/projectsClient');
    const map = (it: any) => it ? ({
      id: it.id || '',
      key: it.id || '',
      summary: it.title || '',
      description: '',
      status: { id: '', name: '', statusCategory: { key: '', name: '' } },
      priority: { id: '', name: '' },
      reporter: { accountId: '', displayName: '', emailAddress: '' },
      created: '',
      updated: '',
      labels: [],
      components: [],
      issueType: { id: '', name: 'Project Item', iconUrl: '' },
      project: { id: '', key: '', name: '' },
      customFields: {},
      url: it.url || ''
    }) : null;
    jiraService = {
      isConfigured: () => githubProjectsService.isConfigured(),
      testConnection: () => githubProjectsService.testConnection(),
      createIssue: async (data: any) => map(await githubProjectsService.createIssue(data)),
      getIssue: async (key: string) => map(await githubProjectsService.getIssue(key)),
      updateIssue: async (key: string, data: any) => map(await githubProjectsService.updateIssue(key, data)),
      addComment: async (_key: string, _body: string) => true,
      deleteIssue: (key: string) => githubProjectsService.deleteIssue(key),
      assignIssueAccountId: (key: string, user: string) => githubProjectsService.assignIssueAccountId(key, user),
      unassignIssue: (key: string) => githubProjectsService.unassignIssue(key),
      getTransitions: (key: string) => githubProjectsService.getTransitions(key),
      transitionIssue: (key: string, id: string) => githubProjectsService.transitionIssue(key, id),
      resolveIssue: (key: string) => githubProjectsService.resolveIssue(key),
      closeIssue: (key: string) => githubProjectsService.closeIssue(key),
      reopenIssue: (key: string) => githubProjectsService.reopenIssue(key),
      setIssueSprintField: (key: string, sprintId: string | number | null) => githubProjectsService.setSprintField(key, String(sprintId ?? '')),
      getHost: () => '',
      getProjectKey: () => '',
    };
  } else if (String(provider).toLowerCase() === 'coda') {
    const { CodaService } = await import('../coda/codaClient');
    jiraService = new (CodaService as any)();
  } else if (String(provider).toLowerCase() === 'atoms') {
    const { atomsService } = await import('../atoms/atomsClient');
    const map = (it: any) => it ? ({
      id: it.id || '',
      key: it.key || it.id || '',
      summary: it.summary || '',
      description: it.description || '',
      status: it.status || { id: '', name: '', statusCategory: { key: '', name: '' } },
      priority: it.priority || { id: '', name: '' },
      reporter: it.reporter || { accountId: '', displayName: '', emailAddress: '' },
      created: it.created || '',
      updated: it.updated || '',
      labels: Array.isArray(it.labels) ? it.labels : [],
      components: Array.isArray(it.components) ? it.components : [],
      issueType: it.issueType || { id: 'requirement', name: 'Requirement', iconUrl: '' },
      project: it.project || { id: '', key: '', name: '' },
      customFields: it.customFields || {},
      url: it.url || ''
    }) : null;
    jiraService = {
      isConfigured: () => (atomsService as any).isConfigured?.() === true,
      testConnection: () => atomsService.testConnection(),
      createIssue: async (data: any) => map(await (atomsService as any).createIssue(data)),
      getIssue: async (key: string) => map(await (atomsService as any).getIssue(key)),
      updateIssue: async (key: string, data: any) => map(await (atomsService as any).updateIssue(key, data)),
      addComment: async (key: string, body: string) => (atomsService as any).addComment(key, body),
      deleteIssue: (key: string) => (atomsService as any).deleteIssue(key),
      assignIssueAccountId: (key: string, user: string) => (atomsService as any).assignIssueAccountId(key, user),
      unassignIssue: (key: string) => (atomsService as any).unassignIssue(key),
      getTransitions: (key: string) => (atomsService as any).getTransitions(key),
      transitionIssue: (key: string, id: string) => (atomsService as any).transitionIssue(key, id),
      resolveIssue: (key: string) => (atomsService as any).resolveIssue(key),
      closeIssue: (key: string) => (atomsService as any).closeIssue(key),
      reopenIssue: (key: string) => (atomsService as any).reopenIssue(key),
      setIssueSprintField: (key: string, sprintId: string | number | null) => (atomsService as any).setSprintField(key, String(sprintId ?? '')),
      getHost: () => '',
      getProjectKey: () => '',
    } as any;
  } else {
    jiraService = new JiraService();
  }
} catch {
  jiraService = new JiraService();
}

// Optional sync mirroring to Coda
try {
  const pmSyncGlobal = String(process.env.PM_SYNC || '').toLowerCase() === 'true' || (env as any)?.PM_SYNC === true;
  const provider = process.env.PM_PROVIDER || (env as any)?.PM_PROVIDER || 'jira';
  const per: Record<string, boolean> = {
    jira: String(process.env.PM_SYNC_JIRA || '').toLowerCase() === 'true' || (env as any)?.PM_SYNC_JIRA === true,
    linear: String(process.env.PM_SYNC_LINEAR || '').toLowerCase() === 'true' || (env as any)?.PM_SYNC_LINEAR === true,
    github_projects: String(process.env.PM_SYNC_GITHUB_PROJECTS || '').toLowerCase() === 'true' || (env as any)?.PM_SYNC_GITHUB_PROJECTS === true,
    coda: String(process.env.PM_SYNC_CODA || '').toLowerCase() === 'true' || (env as any)?.PM_SYNC_CODA === true,
  };
  const pv = String(provider).toLowerCase();
  const providerEnabled = per[pv] === true || (per[pv] === false ? false : pmSyncGlobal);
  const wantMirror = providerEnabled && pv !== 'coda';
  if (wantMirror) {
    const { codaService } = await import('../coda/codaClient');
    if (codaService?.isConfigured?.()) {
      const base: any = jiraService;
      const wrap = (name: string, fn: Function) => async (...args: any[]) => {
        const rv = await fn.apply(base, args);
        try {
          const key = typeof args?.[0] === 'string' ? args[0] : (rv?.key || rv?.id || undefined);
          // Try resolve team mapping from DB for per-team doc routing
          let teamMap: { docId?: string | null; issuesTableId?: string | null; columns?: { key?: string | null; title?: string | null; status?: string | null; priority?: string | null; assignee?: string | null } } | null = null;
          try {
            const { settingsService } = await import('../settings/SettingsService');
            const teams = await settingsService.listTeamSettings();
            // Match by Jira project key or GH owner/repo (best-effort)
            const pj = (rv?.project?.key || '').trim();
            const provider = (process.env.PM_PROVIDER || (env as any)?.PM_PROVIDER || 'jira').toLowerCase();
            const ghOwner = (process?.env?.GITHUB_OWNER || process?.env?.GITHUB_USERNAME || '').trim();
            const ghRepo = (process?.env?.GITHUB_REPO || process?.env?.GITHUB_REPOSITORY || '').trim();
            const match = teams.find((t: any) => {
              if (provider === 'jira') return pj && t.jiraProjectKey === pj;
              if (provider === 'linear') return (rv?.project?.id && (t.linearTeamId === rv.project.id || t.linearProjectId === rv.project.id));
              if (provider === 'github_projects') return (t.ghProjectsOrg && t.ghProjectsOrg === (process?.env?.GITHUB_PROJECTS_ORG || '')) && ((t.ghProjectsId && t.ghProjectsId === (process?.env?.GITHUB_PROJECTS_ID || '')) || (t.ghProjectsNumber && t.ghProjectsNumber === (process?.env?.GITHUB_PROJECTS_NUMBER || '')));
              return (pj && t.jiraProjectKey === pj) || (ghOwner && ghRepo && t.githubOwner === ghOwner && t.githubRepo === ghRepo);
            });
            if (match?.id) {
              teamMap = await settingsService.getTeamCodaMapping(match.id) as any;
            }
          } catch {}
          if (name === 'createIssue' && rv?.key) {
            if (teamMap?.docId) await codaService.upsertIssueWithMapping(teamMap.docId, { issuesTableId: teamMap.issuesTableId || undefined }, { externalKey: rv.key, title: rv.summary, status: rv.status?.name, priority: rv.priority?.name, assignee: rv.assignee?.emailAddress }, teamMap?.columns as any);
            else await codaService.upsertIssue({ externalKey: rv.key, title: rv.summary, status: rv.status?.name, priority: rv.priority?.name, assignee: rv.assignee?.emailAddress });
            try {
              const { postProviderUpdate } = await import('../notifications/pmNotify');
              await postProviderUpdate(String(provider), {
                action: 'created',
                key: rv.key,
                title: rv.summary,
                url: rv.url || rv.htmlUrl || undefined,
                details: { Status: rv?.status?.name, Priority: rv?.priority?.name },
                color: 0x238636,
              });
            } catch {}
          } else if (name === 'updateIssue' && key) {
            const payload = args?.[1] || {};
            if (teamMap?.docId) await codaService.upsertIssueWithMapping(teamMap.docId, { issuesTableId: teamMap.issuesTableId || undefined }, { externalKey: key, title: payload.summary, status: payload.status, priority: payload.priority, assignee: payload.assignee }, teamMap?.columns as any);
            else await codaService.upsertIssue({ externalKey: key, title: payload.summary, status: payload.status, priority: payload.priority, assignee: payload.assignee });
            try {
              const { postProviderUpdate } = await import('../notifications/pmNotify');
              await postProviderUpdate(String(provider), {
                action: 'updated',
                key,
                title: payload.summary,
                details: { Status: payload.status, Priority: payload.priority, Assignee: payload.assignee },
                color: 0x60a5fa,
              });
            } catch {}
          } else if (name === 'updateIssuePriority' && key) {
            if (teamMap?.docId) await codaService.upsertIssueWithMapping(teamMap.docId, { issuesTableId: teamMap.issuesTableId || undefined }, { externalKey: key, priority: args?.[1] }, teamMap?.columns as any);
            else await codaService.upsertIssue({ externalKey: key, priority: args?.[1] });
            try {
              const { postProviderUpdate } = await import('../notifications/pmNotify');
              await postProviderUpdate(String(provider), {
                action: 'priority',
                key,
                title: rv?.summary || undefined,
                details: { Priority: args?.[1] },
                color: 0xf59e0b,
              });
            } catch {}
          } else if (name === 'transitionIssue' && key) {
            // After transition, try to fetch issue to get status if available
            const status = (rv && rv.status?.name) || (await (base.getIssue?.(key)))?.status?.name;
            if (teamMap?.docId) await codaService.upsertIssueWithMapping(teamMap.docId, { issuesTableId: teamMap.issuesTableId || undefined }, { externalKey: key, status }, teamMap?.columns as any);
            else await codaService.upsertIssue({ externalKey: key, status });
            try {
              const { postProviderUpdate } = await import('../notifications/pmNotify');
              await postProviderUpdate(String(provider), {
                action: 'transition',
                key,
                title: rv?.summary || undefined,
                details: { Status: status },
                color: 0x8b5cf6,
              });
            } catch {}
          } else if (name === 'addComment' && typeof args?.[0] === 'string') {
            await codaService.addComment({ issueKey: args[0], text: args?.[1] });
            try {
              const { postProviderUpdate } = await import('../notifications/pmNotify');
              await postProviderUpdate(String(provider), {
                action: 'commented',
                key: args[0],
                description: String(args?.[1] || ''),
                color: 0x60a5fa,
                upsertKeySuffix: 'comment',
              });
            } catch {}
          }
        } catch (e) {
          logger?.warn?.(`Coda mirror failed for ${name}: ${(e as any)?.message || e}`);
        }
        return rv;
      };
      ['createIssue','updateIssue','updateIssuePriority','transitionIssue','addComment'].forEach((m) => {
        if (typeof (base as any)[m] === 'function') {
          (base as any)[m] = wrap(m, (base as any)[m]);
        }
      });
      jiraService = base;
    }
  }
} catch {}

export { jiraService };

// In test environments, force lazy client init so mocks take effect post-import
try { (jiraService as any).client = undefined as any; } catch {}

// Provide method aliases when using non-Jira providers to keep parity with existing call sites
try {
  const provider = (env as any)?.PM_PROVIDER || process.env.PM_PROVIDER || 'jira';
  if (String(provider).toLowerCase() !== 'jira') {
    const svc: any = jiraService as any;
    if (typeof svc.setIssueSprintField !== 'function' && typeof svc.setSprintField === 'function') {
      svc.setIssueSprintField = async (issueKey: string, sprintId: string | number | null) => svc.setSprintField(issueKey, String(sprintId ?? ''));
    }
    // Ensure isConfigured exists
    if (typeof svc.isConfigured !== 'function') {
      svc.isConfigured = () => true;
    }
  }
} catch {}

// Provide Vitest-friendly mockable methods on the singleton instance for integration tests
function attachMockableMethod(obj: any, methodName: string) {
  try {
    const original = typeof obj[methodName] === 'function' ? obj[methodName].bind(obj) : undefined;
    const wrapper: any = (...args: any[]) => {
      if (Object.prototype.hasOwnProperty.call(wrapper, '_rv')) {
        return (wrapper as any)._rv;
      }
      return original ? original(...args) : undefined;
    };
    wrapper.mockReturnValue = (val: any) => { (wrapper as any)._rv = val; return wrapper; };
    wrapper.mockResolvedValue = (val: any) => { (wrapper as any)._rv = Promise.resolve(val); return wrapper; };
    wrapper.mockRejectedValue = (err: any) => { (wrapper as any)._rv = Promise.reject(err); return wrapper; };
    // Only replace if not already wrapped
    if (!(obj[methodName] as any)?.__mockable) {
      (wrapper as any).__mockable = true;
      obj[methodName] = wrapper;
    }
  } catch {}
}

attachMockableMethod(jiraService as any, 'isConfigured');
attachMockableMethod(jiraService as any, 'transitionIssue');
attachMockableMethod(jiraService as any, 'addComment');
attachMockableMethod(jiraService as any, 'deleteIssue');
attachMockableMethod(jiraService as any, 'updateIssuePriority');


/**
 * Enhanced transition mapping utilities for Jira workflows
 * Provides comprehensive fallback patterns for standard and custom Jira workflows
 */
export class JiraTransitionMapper {
  /**
   * Parse comma-separated custom transition names from env.
   */
  static getCustomTransitionNames(action: 'resolve' | 'close' | 'reopen'): string[] {
    const raw = action === 'resolve'
      ? config.JIRA_TRANSITION_DONE
      : action === 'close'
        ? (config.JIRA_TRANSITION_CLOSE || config.JIRA_TRANSITION_WONT_DO)
        : config.JIRA_TRANSITION_REOPEN;

    if (!raw) return [];
    return String(raw)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  /**
   * Build custom patterns from env-provided names.
   * These are treated as highest-priority exact matches.
   */
  private static getCustomPatterns(action: 'resolve' | 'close' | 'reopen') {
    const names = this.getCustomTransitionNames(action);
    // Highest confidence so they win over defaults
    return names.map(name => ({
      pattern: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      priority: 1000,
      description: `Custom mapping (${name})`,
    }));
  }
  /**
   * Standard Jira workflow transition patterns for different actions
   */
  private static readonly TRANSITION_PATTERNS = {
    // Resolve/Done transitions (priority order)
    resolve: [
      // Exact matches first
      { pattern: /^done$/i, priority: 100, description: "Done (exact match)" },
      { pattern: /^complete$/i, priority: 95, description: "Complete (exact match)" },
      { pattern: /^completed$/i, priority: 94, description: "Completed (exact match)" },
      { pattern: /^resolve$/i, priority: 93, description: "Resolve (exact match)" },
      { pattern: /^resolved$/i, priority: 92, description: "Resolved (exact match)" },
      { pattern: /^finish$/i, priority: 90, description: "Finish (exact match)" },
      { pattern: /^finished$/i, priority: 89, description: "Finished (exact match)" },
      { pattern: /^close$/i, priority: 85, description: "Close (exact match)" },
      { pattern: /^closed$/i, priority: 84, description: "Closed (exact match)" },
      { pattern: /^fix$/i, priority: 80, description: "Fix (exact match)" },
      { pattern: /^fixed$/i, priority: 79, description: "Fixed (exact match)" },
      // Partial matches
      { pattern: /done/i, priority: 70, description: "Done (partial match)" },
      { pattern: /complete/i, priority: 65, description: "Complete (partial match)" },
      { pattern: /resolve/i, priority: 60, description: "Resolve (partial match)" },
      { pattern: /finish/i, priority: 55, description: "Finish (partial match)" },
      { pattern: /close/i, priority: 50, description: "Close (partial match)" },
      { pattern: /fix/i, priority: 45, description: "Fix (partial match)" },
    ],

    // Close transitions (mix of Won't Do / Decline / Cancel / Close)
    close: [
      // Exact matches first
      { pattern: /^won'?t\s*do$/i, priority: 100, description: "Won't Do (exact match)" },
      { pattern: /^decline$/i, priority: 95, description: "Decline (exact match)" },
      { pattern: /^declined$/i, priority: 94, description: "Declined (exact match)" },
      { pattern: /^reject$/i, priority: 93, description: "Reject (exact match)" },
      { pattern: /^rejected$/i, priority: 92, description: "Rejected (exact match)" },
      { pattern: /^cancel$/i, priority: 90, description: "Cancel (exact match)" },
      { pattern: /^cancelled$/i, priority: 89, description: "Cancelled (exact match)" },
      { pattern: /^abandon$/i, priority: 85, description: "Abandon (exact match)" },
      { pattern: /^abandoned$/i, priority: 84, description: "Abandoned (exact match)" },
      { pattern: /^close$/i, priority: 76, description: "Close (exact match)" },
      { pattern: /^closed$/i, priority: 72, description: "Closed (exact match)" },
      { pattern: /^invalid$/i, priority: 80, description: "Invalid (exact match)" },
      { pattern: /^duplicate$/i, priority: 79, description: "Duplicate (exact match)" },
      { pattern: /^not\s*planned$/i, priority: 70, description: "Not Planned (exact match)" },
      // Partial matches
      { pattern: /won'?t\W*do/i, priority: 65, description: "Won't Do (partial match)" },
      { pattern: /decline/i, priority: 60, description: "Decline (partial match)" },
      { pattern: /reject/i, priority: 55, description: "Reject (partial match)" },
      { pattern: /cancel/i, priority: 50, description: "Cancel (partial match)" },
      { pattern: /abandon/i, priority: 45, description: "Abandon (partial match)" },
      { pattern: /invalid/i, priority: 40, description: "Invalid (partial match)" },
      { pattern: /duplicate/i, priority: 35, description: "Duplicate (partial match)" },
      { pattern: /close/i, priority: 30, description: "Close (partial match)" },
    ],

    // Reopen/Todo transitions (priority order)
    reopen: [
      // Exact matches first
      { pattern: /^to\s*do$/i, priority: 100, description: "To Do (exact match)" },
      { pattern: /^open$/i, priority: 95, description: "Open (exact match)" },
      { pattern: /^reopen$/i, priority: 94, description: "Reopen (exact match)" },
      { pattern: /^reopened$/i, priority: 93, description: "Reopened (exact match)" },
      { pattern: /^start$/i, priority: 90, description: "Start (exact match)" },
      { pattern: /^started$/i, priority: 89, description: "Started (exact match)" },
      { pattern: /^begin$/i, priority: 85, description: "Begin (exact match)" },
      { pattern: /^backlog$/i, priority: 80, description: "Backlog (exact match)" },
      { pattern: /^new$/i, priority: 75, description: "New (exact match)" },
      { pattern: /^created$/i, priority: 70, description: "Created (exact match)" },
      // Partial matches
      { pattern: /to\W*do/i, priority: 65, description: "To Do (partial match)" },
      { pattern: /open/i, priority: 60, description: "Open (partial match)" },
      { pattern: /reopen/i, priority: 55, description: "Reopen (partial match)" },
      { pattern: /start/i, priority: 50, description: "Start (partial match)" },
      { pattern: /begin/i, priority: 45, description: "Begin (partial match)" },
      { pattern: /backlog/i, priority: 40, description: "Backlog (partial match)" },
      { pattern: /new/i, priority: 35, description: "New (partial match)" },
      { pattern: /created/i, priority: 30, description: "Created (partial match)" },
    ],
  };

  /**
   * Find the best transition for a given action type
   * @param transitions Available transitions from Jira
   * @param actionType Type of action ('resolve', 'close', 'reopen')
   * @returns Best matching transition or null if none found
   */
  static findBestTransition(
    transitions: Array<{ id: string; name: string }>,
    actionType: 'resolve' | 'close' | 'reopen'
  ): { transition: { id: string; name: string }; confidence: number; description: string } | null {
    if (!transitions || transitions.length === 0) {
      return null;
    }

    // Merge custom patterns (highest priority) with defaults; tolerate invalid action types
    const defaults = this.TRANSITION_PATTERNS[actionType] || [];
    const patterns = [
      ...this.getCustomPatterns(actionType),
      ...defaults,
    ];
    if (!patterns) {
      return null;
    }

    let bestMatch: {
      transition: { id: string; name: string };
      confidence: number;
      description: string;
    } | null = null;

    for (const { pattern, priority, description } of patterns) {
      const transition = transitions.find(t => pattern.test(t.name));
      if (transition && (!bestMatch || priority > bestMatch.confidence)) {
        bestMatch = {
          transition,
          confidence: priority,
          description,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Get all possible transitions for a given action with confidence scores
   * @param transitions Available transitions from Jira
   * @param actionType Type of action ('resolve', 'close', 'reopen')
   * @returns Array of matching transitions with confidence scores
   */
  static getAllMatchingTransitions(
    transitions: Array<{ id: string; name: string }>,
    actionType: 'resolve' | 'close' | 'reopen'
  ): Array<{
    transition: { id: string; name: string };
    confidence: number;
    description: string;
  }> {
    if (!transitions || transitions.length === 0) {
      return [];
    }

    const defaults = this.TRANSITION_PATTERNS[actionType] || [];
    const patterns = [
      ...this.getCustomPatterns(actionType),
      ...defaults,
    ];
    if (!patterns) return [];

    const bestById = new Map<string, { transition: { id: string; name: string }; confidence: number; description: string }>();

    for (const t of transitions) {
      let best: { confidence: number; description: string } | null = null;
      for (const { pattern, priority, description } of patterns) {
        if (pattern.test(t.name)) {
          if (!best || priority > best.confidence) {
            best = { confidence: priority, description };
          }
        }
      }
      if (best) {
        const existing = bestById.get(t.id);
        if (!existing || best.confidence > existing.confidence) {
          bestById.set(t.id, { transition: { id: t.id, name: t.name }, confidence: best.confidence, description: best.description });
        }
      }
    }

    return Array.from(bestById.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze available transitions and suggest the best workflow setup
   * @param transitions Available transitions from Jira
   * @returns Analysis of workflow compatibility
   */
  static analyzeWorkflow(transitions: Array<{ id: string; name: string }>): {
    resolve: { available: boolean; bestMatch?: string; suggestions: string[] };
    close: { available: boolean; bestMatch?: string; suggestions: string[] };
    reopen: { available: boolean; bestMatch?: string; suggestions: string[] };
    coverage: number;
    recommendations: string[];
  } {
    const analysis = {
      resolve: { available: false, suggestions: [] as string[] },
      close: { available: false, suggestions: [] as string[] },
      reopen: { available: false, suggestions: [] as string[] },
      coverage: 0,
      recommendations: [] as string[],
    };

    // Check resolve transitions
    const resolveMatch = this.findBestTransition(transitions, 'resolve');
    if (resolveMatch) {
      analysis.resolve.available = true;
      (analysis.resolve as any).bestMatch = resolveMatch.transition.name;
    } else {
      analysis.resolve.suggestions = [
        'Add a "Done" transition',
        'Add a "Resolved" transition',
        'Add a "Complete" transition',
      ];
    }

    // Check close transitions (Won't Do / Declined / Cancelled / Close)
    const closeMatch = this.findBestTransition(transitions, 'close');
    if (closeMatch) {
      analysis.close.available = true;
      (analysis.close as any).bestMatch = closeMatch.transition.name;
    } else {
      analysis.close.suggestions = [
        'Add a "Close" transition',
        'Add a "Won\'t Do" transition',
        'Add a "Declined" transition',
        'Add a "Rejected" transition',
        'Add a "Cancelled" transition',
      ];
    }

    // Check reopen transitions
    const reopenMatch = this.findBestTransition(transitions, 'reopen');
    if (reopenMatch) {
      analysis.reopen.available = true;
      (analysis.reopen as any).bestMatch = reopenMatch.transition.name;
    } else {
      analysis.reopen.suggestions = [
        'Add a "To Do" transition',
        'Add an "Open" transition',
        'Add a "Reopen" transition',
      ];
    }

    // Calculate coverage
    const availableActions = [analysis.resolve.available, analysis.close.available, analysis.reopen.available].filter(Boolean).length;
    analysis.coverage = Math.round((availableActions / 3) * 100);

    // Generate recommendations
    if (analysis.coverage < 100) {
      analysis.recommendations.push(
        `Workflow coverage: ${analysis.coverage.toFixed(0)}% - some Discord actions may not work properly`
      );

      if (!analysis.resolve.available) {
        analysis.recommendations.push('Consider adding completion transitions like "Done" or "Resolved"');
      }

      if (!analysis.close.available) {
        analysis.recommendations.push('Consider adding close/rejection transitions like "Close" or "Won\'t Do"');
      }

      if (!analysis.reopen.available) {
        analysis.recommendations.push('Consider adding reopening transitions like "To Do" or "Open"');
      }
    }

    return analysis;
  }

  /**
   * Generate workflow configuration documentation
   * @param projectKey Jira project key
   * @param transitions Available transitions
   * @returns Markdown documentation for workflow setup
   */
  static generateWorkflowDocs(
    projectKey: string,
    transitions: Array<{ id: string; name: string }>
  ): string {
    const analysis = this.analyzeWorkflow(transitions);

    let docs = `# Jira Workflow Configuration for ${projectKey}\n\n`;

    docs += `## Current Status\n`;
    docs += `- **Coverage**: ${analysis.coverage.toFixed(0)}%\n`;
    docs += `- **Resolve Action**: ${analysis.resolve.available ? `✅ ${analysis.resolve.bestMatch}` : '❌ Not Available'}\n`;
    docs += `- **Close Action**: ${analysis.close.available ? `✅ ${analysis.close.bestMatch}` : '❌ Not Available'}\n`;
    docs += `- **Reopen Action**: ${analysis.reopen.available ? `✅ ${analysis.reopen.bestMatch}` : '❌ Not Available'}\n\n`;

    if (transitions.length > 0) {
      docs += `## Available Transitions\n`;
      transitions.forEach(t => {
        docs += `- ${t.name} (ID: ${t.id})\n`;
      });
      docs += '\n';
    }

    if (analysis.recommendations.length > 0) {
      docs += `## Recommendations\n`;
      analysis.recommendations.forEach(rec => {
        docs += `- ${rec}\n`;
      });
      docs += '\n';
    }

    docs += `## Discord Action Mapping\n`;
    docs += `The following Discord actions require these Jira transitions:\n\n`;
    docs += `### 1. "resolve" → Done/Complete Transition\n`;
    docs += `**Purpose**: Mark issue as successfully completed\n`;
    docs += `**Recommended transitions**: Done, Complete, Resolved, Finished\n`;
    if (analysis.resolve.available) {
      docs += `**Current mapping**: ${analysis.resolve.bestMatch}\n`;
    } else {
      docs += `**Status**: ❌ No suitable transition found\n`;
      docs += `**Suggestions**: ${analysis.resolve.suggestions.join(', ')}\n`;
    }
    docs += '\n';

    docs += `### 2. "close" → Close/Won't Do/Not Planned\n`;
    docs += `**Purpose**: Mark issue as closed without completion (not planned/rejected)\n`;
    docs += `**Recommended transitions**: Close, Won't Do, Declined, Rejected, Cancelled\n`;
    if ((analysis as any).close?.available) {
      docs += `**Current mapping**: ${(analysis as any).close.bestMatch}\n`;
    } else {
      docs += `**Status**: ❌ No suitable transition found\n`;
      docs += `**Suggestions**: ${(analysis as any).close?.suggestions?.join(', ') || ''}\n`;
    }
    docs += '\n';

    docs += `### 3. "reopen" → Open/Todo Transition\n`;
    docs += `**Purpose**: Reopen closed issues for further work\n`;
    docs += `**Recommended transitions**: To Do, Open, Reopen, Started\n`;
    if (analysis.reopen.available) {
      docs += `**Current mapping**: ${analysis.reopen.bestMatch}\n`;
    } else {
      docs += `**Status**: ❌ No suitable transition found\n`;
      docs += `**Suggestions**: ${analysis.reopen.suggestions.join(', ')}\n`;
    }
    docs += '\n';

    docs += `### 4. "delete" → Issue Deletion\n`;
    docs += `**Purpose**: Completely remove issue from Jira\n`;
    docs += `**Implementation**: Uses Jira REST API delete endpoint\n`;
    docs += `**Requirements**: Delete permission for the project\n\n`;

    docs += `## Troubleshooting\n\n`;
    docs += `### Common Issues\n`;
    docs += `1. **"No suitable transition found"**: The current workflow doesn't have transitions that match Discord action patterns\n`;
    docs += `2. **"Permission denied"**: User lacks permission to perform transitions or delete issues\n`;
    docs += `3. **"Transition failed"**: Issue may be in a status that doesn't allow the requested transition\n\n`;

    docs += `### Solutions\n`;
    docs += `1. **Update Jira Workflow**: Add missing transitions with appropriate names\n`;
    docs += `2. **Check Permissions**: Ensure bot user has proper project permissions\n`;
    docs += `3. **Use Custom Mapping**: Configure custom transition mappings if needed\n`;

    return docs;
  }
}

/**
 * Utility functions for Jira configuration and workflow management
 */
export class JiraConfigValidator {
  /**
   * Validate environment configuration
   * @returns Validation results with actionable feedback
   */
  static validateEnvironment(): {
    isValid: boolean;
    missing: string[];
    suggestions: string[];
  } {
    const requiredVars = [
      { key: 'JIRA_HOST', description: 'Jira domain (e.g., company.atlassian.net)' },
      { key: 'JIRA_EMAIL', description: 'Email address for API authentication' },
      { key: 'JIRA_API_TOKEN', description: 'API token from Atlassian account settings' },
      { key: 'JIRA_PROJECT_KEY', description: 'Project key (e.g., PROJ, ABC)' },
    ];

    const missing = requiredVars.filter(v => !process.env[v.key]);
    const suggestions = [];

    if (missing.length > 0) {
      suggestions.push('Set the following environment variables:');
      missing.forEach(v => {
        suggestions.push(`${v.key}: ${v.description}`);
      });
      suggestions.push('See https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/');
    }

    return {
      isValid: missing.length === 0,
      missing: missing.map(v => v.key),
      suggestions,
    };
  }

  /**
   * Generate configuration template
   * @returns Environment file template
   */
  static generateConfigTemplate(): string {
    return `# Jira Integration Configuration
# Copy this to your .env file and fill in your values

# Your Jira domain (without https://)
JIRA_HOST=your-company.atlassian.net

# Your Atlassian account email
JIRA_EMAIL=your-email@example.com

# API token from https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_API_TOKEN=your-api-token-here

# Your Jira project key (found in project settings)
JIRA_PROJECT_KEY=YOUR_PROJECT
`;
  }

  /**
   * Test connection with provided credentials
   * @param credentials Jira credentials to test
   * @returns Connection test results
   */
  static async testConnection(credentials: {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
  }): Promise<{
    success: boolean;
    error?: string;
    userInfo?: any;
    projectInfo?: any;
  }> {
    try {
      // Basic validation to avoid network dependency in tests
      if (!credentials.host || !credentials.email || !credentials.apiToken || !credentials.projectKey) {
        return { success: false, error: 'Missing required Jira credentials' };
      }
      if (!/\./.test(credentials.host)) {
        return { success: false, error: 'Invalid Jira host' };
      }
      const testClient = new Version3Client({
        host: `https://${credentials.host}`,
        authentication: {
          basic: {
            email: credentials.email,
            apiToken: credentials.apiToken,
          },
        },
      });

      // Test user authentication
      const userInfo = await testClient.myself.getCurrentUser();

      // Test project access
      const projectInfo = await testClient.projects.getProject({
        projectIdOrKey: credentials.projectKey,
      });

      return {
        success: true,
        userInfo,
        projectInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
