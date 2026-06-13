import { facadeAddComment, facadeCreateIssue, facadeLinkIssue, facadeTransition } from '../pm/facade';

export type NormalizedEvent = {
  source: 'github'|'jira'|'linear'|'projects'|'coda'|'atoms';
  type: 'created'|'updated'|'commented'|'transitioned'|'assigned';
  key?: string;
  title?: string;
  description?: string;
  comment?: string;
  transition?: string;
  assigneeId?: string;
};

export class SyncOrchestrator {
  async handleEvent(evt: NormalizedEvent) {
    try {
      switch (evt.type) {
        case 'created':
          if (evt.title) await facadeCreateIssue(evt.title, evt.description);
          break;
        case 'commented':
          if (evt.key && evt.comment) await facadeAddComment(evt.key, evt.comment);
          break;
        case 'transitioned':
          if (evt.key && evt.transition) await facadeTransition(evt.key, evt.transition);
          break;
        case 'updated':
        case 'assigned':
          // TODO: add update/assign facade calls when adapters expose them
          break;
      }
    } catch {}
  }
}

export const syncOrchestrator = new SyncOrchestrator();

