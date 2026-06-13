/**
 * NATS Messaging Service Stub
 * 
 * This is a stub implementation that will be replaced with actual NATS
 * integration. For now, it provides a no-op interface that can be mocked in tests.
 */

import { logger } from '../logger';

// Simple in-memory event bus used by the stub to simulate
// publish/subscribe behavior for tests and local runs.
type Callback = (data: any, subject: string) => void | Promise<void>;
const bus: Map<string, Map<string, Callback>> = new Map(); // subject -> (id -> cb)
let subCounter = 0;

function dispatch(subject: string, data: any) {
  const subs = bus.get(subject);
  if (!subs) return;
  for (const [, cb] of subs) {
    try { void cb(data, subject); } catch { /* no-op in stub */ }
  }
}

export class EventPublisher {
  // Disabled: no external messaging; no-ops only
  private isEnabled = false;

  // Getter for testing purposes
  get enabled(): boolean {
    return this.isEnabled;
  }

  async init(): Promise<void> {
    // No-op init for stub; real impl would connect to NATS
    logger.debug('Event publisher init (stub)', {});
  }

  async publish(_subject: string, _data: any): Promise<void> { /* no-op */ }

  async publishBatch(_messages: Array<{ subject: string; data: any }>): Promise<void> { /* no-op */ }

  async publishRaw(subject: string, data: any): Promise<void> {
    // Raw publish helper used in tests
    dispatch(subject, data);
  }

  subscribe(_subject: string, _callback: (data: any, subject: string) => void): string { return 'stub-subscription'; }

  unsubscribe(_subscriptionId: string): void { /* no-op */ }
}

export const eventPublisher = new EventPublisher();
export default eventPublisher;
export const getEventPublisher = () => eventPublisher;

// Lightweight subscriber stub with same shared bus
export class EventSubscriber {
  async init(): Promise<void> { /* no-op */ }
  async subscribe(_subject: string, _callback: Callback): Promise<string> { return `sub-${++subCounter}`; }
  async unsubscribe(_subscriptionId: string): Promise<void> { /* no-op */ }
}

export const eventSubscriber = new EventSubscriber();
export const getEventSubscriber = () => eventSubscriber;

// Lightweight connection-style helpers to satisfy test utilities. These are stubs
// that simulate a NATS connection without requiring an actual server.
export async function createNatsConnection(_opts?: any): Promise<any> {
  const mockSubscriptions = new Map<string, any>();
  const conn: any = {
    publish: async (_subject: string, _data?: Uint8Array) => {},
    subscribe: (subject: string, _options?: any) => {
      const sub = {
        subject,
        unsubscribe: () => {
          mockSubscriptions.delete(subject);
        },
        [Symbol.asyncIterator]: async function* () {
          // no-op iterator for compatibility
        },
      };
      mockSubscriptions.set(subject, sub);
      return sub;
    },
    request: async (_subject: string, _data?: Uint8Array) => ({ data: new Uint8Array() }),
    close: async () => { mockSubscriptions.clear(); },
    info: { server_id: 'stub-nats', version: '0.0.0-stub', max_payload: 1048576, proto: 1 },
  };
  try { logger.info('NATS stub connection created'); } catch {}
  return conn;
}

export async function closeNatsConnection(_conn?: any): Promise<void> {
  // no-op for stub
}
