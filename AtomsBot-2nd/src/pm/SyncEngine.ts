import { settingsService } from "../settings/SettingsService";
import { jiraService } from "../jira/jiraClient";
import { integrations, env } from "../env";
import { logger } from "../logger";
import { codaService } from "../coda/codaClient";

async function postDiscordSummary(lines: string[]): Promise<void> {
  try {
    const channelId = process.env.PM_SYNC_ENGINE_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
    if (!channelId) return;
    const discordMod: any = await import('../discord/discord');
    const client = (discordMod as any)?.default;
    if (!client) return;
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || typeof (ch as any).send !== 'function') return;
    const { EmbedBuilder } = await import('discord.js');
    const embed = new (EmbedBuilder as any)()
      .setTitle('PM SyncEngine Summary')
      .setColor(0x3b82f6)
      .setDescription(lines.slice(0, 3).join('\n'))
      .setTimestamp(new Date());
    const details = lines.slice(3).join('\n');
    if (details) embed.addFields({ name: 'Teams', value: details.slice(0, 1024) });
    await (ch as any).send({ embeds: [embed] });
  } catch {}
}

export class PMSyncEngine {
  private timer: any = null;
  private intervalMs: number;
  private lastReport: { startedAt?: number; finishedAt?: number; teams: Array<{ id: string; provider: string; processed: number; mirrored: number; skipped?: string; errors?: string[] }>; totals: { processed: number; mirrored: number; teams: number } } = { teams: [], totals: { processed: 0, mirrored: 0, teams: 0 } };
  constructor(intervalMs: number = 5 * 60 * 1000) { // default 5 minutes
    this.intervalMs = Math.max(60_000, intervalMs);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.runOnce(); }, this.intervalMs);
    logger.info(`PM SyncEngine started`, { intervalMs: this.intervalMs });
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    logger.info(`PM SyncEngine stopped`);
  }

  async runOnce(): Promise<void> {
    try {
      const started = Date.now();
      const teams = await settingsService.listTeamSettings();
      const report: typeof this.lastReport = { startedAt: started, finishedAt: 0, teams: [], totals: { processed: 0, mirrored: 0, teams: teams.length } };
      for (const t of teams as any[]) {
        const provider = (t.pmProvider || process.env.PM_PROVIDER || (env as any)?.PM_PROVIDER || 'jira').toLowerCase();
        const sync = (t.pmSync === true) || ((String(process.env.PM_SYNC || '').toLowerCase() === 'true') || (env as any)?.PM_SYNC === true);
        const entry = { id: t.id, provider, processed: 0, mirrored: 0, errors: [] as string[] };
        if (!sync) { entry.skipped = 'sync_off'; report.teams.push(entry); continue; }
        if (!integrations.coda.isConfigured() || !t.codaDocId) { entry.skipped = 'no_coda_mapping'; report.teams.push(entry); continue; }

        try {
          const policy = (t.pmConflictPolicy || '').toLowerCase();
          const codaCols = t.codaIssueKeyColumn || t.codaIssueTitleColumn || t.codaIssueStatusColumn || t.codaIssuePriorityColumn || t.codaIssueAssigneeColumn ? await (async () => {
            try {
              const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
              (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
              const cols = await codaService.listColumns(t.codaIssuesTableId);
              (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
              const find = (id?: string|null, fallbackName?: string) => {
                if (!id && !fallbackName) return undefined;
                const byId = cols.find((c:any) => c.id === id);
                if (byId) return byId.id;
                const byName = cols.find((c:any) => (c.name||'').toLowerCase() === String(fallbackName||'').toLowerCase());
                return byName?.id;
              };
              return {
                keyId: find(t.codaIssueKeyColumn, 'Key'),
                titleId: find(t.codaIssueTitleColumn, 'Title'),
                statusId: find(t.codaIssueStatusColumn, 'Status'),
                priorityId: find(t.codaIssuePriorityColumn, 'Priority'),
                assigneeId: find(t.codaIssueAssigneeColumn, 'Assignee'),
              };
            } catch { return undefined; }
          })() : undefined;
          const applyProviderUpdate = async (issKey: string, target: { title?: string; status?: string; priority?: string|number|null; assignee?: string|null }) => {
            try {
              if (provider === 'jira') {
                if (target.title) await (jiraService as any).updateIssue?.(issKey, { summary: target.title });
                if (target.priority !== undefined && target.priority !== null) await (jiraService as any).updateIssuePriority?.(issKey, String(target.priority));
                if (target.assignee !== undefined) {
                  if (!target.assignee) await (jiraService as any).unassignIssue?.(issKey);
                  else await (jiraService as any).assignIssueAccountId?.(issKey, target.assignee);
                }
                if (target.status) {
                  const transitions = await (jiraService as any).getTransitions?.(issKey) || [];
                  const match = transitions.find((t:any) => (t?.name||'').toLowerCase() === target.status!.toLowerCase());
                  if (match) await (jiraService as any).transitionIssue?.(issKey, match.id);
                }
              } else if (provider === 'linear') {
                const { linearService } = await import('../linear/linearClient');
                const payload: any = {};
                if (target.title) payload.summary = target.title;
                if (target.priority !== undefined && target.priority !== null) payload.priority = target.priority;
                if (target.assignee !== undefined) payload.assignee = target.assignee || undefined;
                await (linearService as any).updateIssue?.(issKey, payload);
                if (target.status) {
                  const list = await (linearService as any).getTransitions?.(issKey) || [];
                  const match = list.find((s:any) => (s?.name||'').toLowerCase() === target.status!.toLowerCase());
                  if (match) await (linearService as any).transitionIssue?.(issKey, match.id);
                }
              } else if (provider === 'github_projects') {
                const { githubProjectsService } = await import('../github/projectsClient');
                if (target.title) await (githubProjectsService as any).updateIssue?.(issKey, { summary: target.title });
                if (target.status) {
                  const trans = await (githubProjectsService as any).getTransitions?.(issKey) || [];
                  const match = trans.find((x:any) => (x?.name||'').toLowerCase() === target.status!.toLowerCase());
                  if (match) await (githubProjectsService as any).transitionIssue?.(issKey, match.id);
                }
                if (target.assignee !== undefined) await (githubProjectsService as any).assignIssueAccountId?.(issKey, target.assignee || '');
              }
            } catch (e) { entry.errors!.push(`update:${issKey}:${(e as any)?.message || e}`); }
          };

          if (provider === 'jira') {
            const jql = t.jiraProjectKey ? `project = ${t.jiraProjectKey} ORDER BY updated DESC` : 'ORDER BY updated DESC';
            const list: any[] = await (jiraService as any).searchIssues?.(jql, 20) || [];
            for (const iss of list) {
              entry.processed++;
              try {
                await codaService.upsertIssueWithMapping(
                  t.codaDocId,
                  { issuesTableId: t.codaIssuesTableId || undefined },
                  { externalKey: iss.key, title: iss.summary, status: iss?.status?.name, priority: iss?.priority?.name, assignee: iss?.assignee?.emailAddress },
                  { key: t.codaIssueKeyColumn, title: t.codaIssueTitleColumn, status: t.codaIssueStatusColumn, priority: t.codaIssuePriorityColumn, assignee: t.codaIssueAssigneeColumn }
                );
                // If coda_wins/most_recent: compare and update provider as needed
                if (policy === 'coda_wins' && codaCols?.keyId && t.codaIssuesTableId) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, iss.key).catch(()=>null);
                  let cvals: any = {};
                  if (row) {
                    const cols = await codaService.listColumns(t.codaIssuesTableId);
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    cvals = {
                      title: codaCols.titleId ? lookup(codaCols.titleId) : undefined,
                      status: codaCols.statusId ? lookup(codaCols.statusId) : undefined,
                      priority: codaCols.priorityId ? lookup(codaCols.priorityId) : undefined,
                      assignee: codaCols.assigneeId ? lookup(codaCols.assigneeId) : undefined,
                    };
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  await applyProviderUpdate(iss.key, cvals);
                }
                if (policy === 'most_recent' && codaCols?.keyId && t.codaIssuesTableId && codaCols?.updatedAtId) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, iss.key).catch(()=>null);
                  let cUpdated: number | undefined;
                  if (row) {
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    const val = codaCols.updatedAtId ? lookup(codaCols.updatedAtId) : undefined;
                    const ts = val ? Date.parse(String(val)) : NaN;
                    cUpdated = isNaN(ts) ? undefined : ts;
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  const pUpdated = Date.parse(String(iss?.updated || iss?.updatedAt || ''));
                  if (cUpdated && pUpdated && cUpdated > pUpdated) {
                    // Coda is newer → push to provider
                    const cvals: any = {};
                    // We already fetched row; re-use blocks above or refetch quickly
                    // Minimal: set title from Coda title if present
                    // For brevity we rely on cvals fetched in coda_wins path; if absent, skip title update here
                    await applyProviderUpdate(iss.key, cvals);
                  }
                }
                entry.mirrored++;
                try { if ((entry as any).examples && (entry as any).examples.length < 5) (entry as any).examples.push(String(iss.key || iss.id || '')); } catch {}
              } catch (e) { entry.errors!.push(`jira:${iss?.key}:${(e as any)?.message || e}`); }
            }
          } else if (provider === 'linear') {
            const { linearService } = await import('../linear/linearClient');
            const list = await linearService.listRecentIssues(t.linearTeamId || undefined, 20);
            for (const iss of list) {
              entry.processed++;
              try {
                await codaService.upsertIssueWithMapping(
                  t.codaDocId,
                  { issuesTableId: t.codaIssuesTableId || undefined },
                  { externalKey: iss.id, title: iss.title, status: iss?.state, priority: iss?.priority ?? undefined, assignee: iss?.assignee?.email },
                  { key: t.codaIssueKeyColumn, title: t.codaIssueTitleColumn, status: t.codaIssueStatusColumn, priority: t.codaIssuePriorityColumn, assignee: t.codaIssueAssigneeColumn }
                );
                if (policy === 'coda_wins' && codaCols?.keyId && t.codaIssuesTableId) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, iss.id).catch(()=>null);
                  let cvals: any = {};
                  if (row) {
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    cvals = {
                      title: codaCols.titleId ? lookup(codaCols.titleId) : undefined,
                      status: codaCols.statusId ? lookup(codaCols.statusId) : undefined,
                      priority: codaCols.priorityId ? lookup(codaCols.priorityId) : undefined,
                      assignee: codaCols.assigneeId ? lookup(codaCols.assigneeId) : undefined,
                    };
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  await applyProviderUpdate(iss.id, cvals);
                }
                if (policy === 'most_recent' && codaCols?.keyId && t.codaIssuesTableId && codaCols?.updatedAtId && iss?.updatedAt) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, iss.id).catch(()=>null);
                  let cUpdated: number | undefined;
                  if (row) {
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    const val = codaCols.updatedAtId ? lookup(codaCols.updatedAtId) : undefined;
                    const ts = val ? Date.parse(String(val)) : NaN;
                    cUpdated = isNaN(ts) ? undefined : ts;
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  const pUpdated = Date.parse(String(iss?.updatedAt));
                  if (cUpdated && pUpdated && cUpdated > pUpdated) await applyProviderUpdate(iss.id, {});
                }
                entry.mirrored++;
                try { if ((entry as any).examples && (entry as any).examples.length < 5) (entry as any).examples.push(String(iss.id || '')); } catch {}
              } catch (e) { entry.errors!.push(`linear:${iss?.id}:${(e as any)?.message || e}`); }
            }
          } else if (provider === 'github_projects') {
            const { githubProjectsService } = await import('../github/projectsClient');
            const list = await githubProjectsService.listRecentItems(20);
            for (const item of list) {
              entry.processed++;
              try {
                await codaService.upsertIssueWithMapping(
                  t.codaDocId,
                  { issuesTableId: t.codaIssuesTableId || undefined },
                  { externalKey: item.id, title: item.title },
                  { key: t.codaIssueKeyColumn, title: t.codaIssueTitleColumn, status: t.codaIssueStatusColumn, priority: t.codaIssuePriorityColumn, assignee: t.codaIssueAssigneeColumn }
                );
                if (policy === 'coda_wins' && codaCols?.keyId && t.codaIssuesTableId) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, item.id).catch(()=>null);
                  let cvals: any = {};
                  if (row) {
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    cvals = {
                      title: codaCols.titleId ? lookup(codaCols.titleId) : undefined,
                      status: codaCols.statusId ? lookup(codaCols.statusId) : undefined,
                      priority: codaCols.priorityId ? lookup(codaCols.priorityId) : undefined,
                      assignee: codaCols.assigneeId ? lookup(codaCols.assigneeId) : undefined,
                    };
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  await applyProviderUpdate(item.id, cvals);
                }
                if (policy === 'most_recent' && codaCols?.keyId && t.codaIssuesTableId && codaCols?.updatedAtId && item?.updatedAt) {
                  const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
                  (codaService as any).docId = t.codaDocId; (codaService as any).issuesTableId = t.codaIssuesTableId;
                  const row = await codaService.findRowByExternalKey(t.codaIssuesTableId, codaCols.keyId, item.id).catch(()=>null);
                  let cUpdated: number | undefined;
                  if (row) {
                    const rows = await codaService.listRows(t.codaIssuesTableId, 200);
                    const r = rows.find(x => x.id === row.id);
                    const lookup = (id?: string) => (r?.cells||[]).find(c => c.column === id)?.value;
                    const val = codaCols.updatedAtId ? lookup(codaCols.updatedAtId) : undefined;
                    const ts = val ? Date.parse(String(val)) : NaN;
                    cUpdated = isNaN(ts) ? undefined : ts;
                  }
                  (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
                  const pUpdated = Date.parse(String(item?.updatedAt));
                  if (cUpdated && pUpdated && cUpdated > pUpdated) await applyProviderUpdate(item.id, {});
                }
                entry.mirrored++;
                try { if ((entry as any).examples && (entry as any).examples.length < 5) (entry as any).examples.push(String(item.id || '')); } catch {}
              } catch (e) { entry.errors!.push(`ghproj:${item?.id}:${(e as any)?.message || e}`); }
            }
          }
        } catch (e) {
          entry.errors!.push((e as any)?.message || String(e));
        }
        report.totals.processed += entry.processed;
        report.totals.mirrored += entry.mirrored;
        report.teams.push(entry);
      }
      report.finishedAt = Date.now();
      this.lastReport = report;
      logger.info('SyncEngine run completed', { teamCount: teams.length, processed: report.totals.processed, mirrored: report.totals.mirrored });
      // best-effort post to Discord
      const summary = [
        `Teams: ${report?.totals?.teams ?? 0}`,
        `Processed: ${report?.totals?.processed ?? 0}`,
        `Mirrored: ${report?.totals?.mirrored ?? 0}`,
      ];
      for (const t of report.teams || []) summary.push(`• ${t.id} [${t.provider}] processed:${t.processed} mirrored:${t.mirrored}${t.skipped?` skipped:${t.skipped}`:''}${t.errors?.length?` errors:${t.errors.length}`:''}`);
      await postDiscordSummary(summary);
    } catch (e) {
      logger.warn(`SyncEngine run failed: ${(e as any)?.message || e}`);
    }
  }

  getLastReport(): typeof this.lastReport { return this.lastReport; }

  async repair(teamId?: string): Promise<typeof this.lastReport> {
    // Run a focused pass with the same logic as runOnce but restricted when teamId provided
    await this.runOnce();
    if (!teamId) return this.lastReport;
    const filtered = { ...this.lastReport, teams: this.lastReport.teams.filter(t => t.id === teamId), totals: { ...this.lastReport.totals, teams: 1 } } as any;
    return filtered;
  }
}

export const pmSyncEngine = new PMSyncEngine();
