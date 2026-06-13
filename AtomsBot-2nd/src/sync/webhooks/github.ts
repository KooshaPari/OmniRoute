import { syncOrchestrator } from '../Orchestrator';

export async function processGithubWebhook(payload: any) {
  try {
    if (payload?.action === 'opened' && payload?.issue) {
      await syncOrchestrator.handleEvent({ source: 'github', type: 'created', title: payload.issue.title, description: payload.issue.body });
    } else if (payload?.action === 'created' && payload?.comment && payload?.issue) {
      await syncOrchestrator.handleEvent({ source: 'github', type: 'commented', key: String(payload.issue.number), comment: payload.comment.body });
    }
  } catch {}
}

