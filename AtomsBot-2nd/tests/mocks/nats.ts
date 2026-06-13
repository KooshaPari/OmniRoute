/**
 * NATS Messaging Service Mock Implementation
 * 
 * Comprehensive mock for NATS event publishing and subscription
 * Provides in-memory event simulation with error conditions
 */

import { vi } from "vitest";
import type { EventTypes } from "../../src/messaging/nats";

// In-memory event storage for testing
let publishedEvents: Array<{ subject: string; data: any; timestamp: number }> = [];
let subscriptions = new Map<string, Array<(data: any) => void>>();

/**
 * Mock Event Publisher
 */
export const mockEventPublisher = {
  init: vi.fn().mockResolvedValue(undefined),

  publish: vi.fn().mockImplementation(async <K extends keyof EventTypes>(
    subject: K,
    data: EventTypes[K]
  ): Promise<void> => {
    // Store the published event
    publishedEvents.push({
      subject: subject as string,
      data,
      timestamp: Date.now(),
    });

    // Notify any subscribers
    const handlers = subscriptions.get(subject as string) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${subject}:`, error);
      }
    });
  }),

  publishRaw: vi.fn().mockImplementation(async (subject: string, data: any): Promise<void> => {
    publishedEvents.push({
      subject,
      data,
      timestamp: Date.now(),
    });

    // Notify any subscribers
    const handlers = subscriptions.get(subject) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${subject}:`, error);
      }
    });
  }),
};

/**
 * Mock Event Subscriber
 */
export const mockEventSubscriber = {
  init: vi.fn().mockResolvedValue(undefined),

  subscribe: vi.fn().mockImplementation(async <K extends keyof EventTypes>(
    subject: K | string,
    handler: (data: EventTypes[K]) => Promise<void> | void,
    options?: { queue?: string; maxMessages?: number }
  ): Promise<string> => {
    const subscriptionId = `${subject}-${Date.now()}-${Math.random()}`;
    
    if (!subscriptions.has(subject as string)) {
      subscriptions.set(subject as string, []);
    }
    
    subscriptions.get(subject as string)!.push(handler);
    
    return subscriptionId;
  }),

  unsubscribe: vi.fn().mockImplementation(async (subscriptionId: string): Promise<void> => {
    // In a real implementation, we'd track subscription IDs properly
    // For mocking, this is sufficient
  }),

  unsubscribeAll: vi.fn().mockImplementation(async (): Promise<void> => {
    subscriptions.clear();
  }),
};

/**
 * Mock Request-Response Service
 */
export const mockRequestResponseService = {
  init: vi.fn().mockResolvedValue(undefined),

  request: vi.fn().mockImplementation(async <T = any>(
    subject: string,
    data: any,
    timeout: number = 5000
  ): Promise<T> => {
    // Simulate request-response pattern
    publishedEvents.push({
      subject: `request.${subject}`,
      data,
      timestamp: Date.now(),
    });

    // Return mock response
    return { status: 'success', data: { response: 'mock-response' } } as T;
  }),

  respond: vi.fn().mockImplementation(async (
    subject: string,
    handler: (data: any) => Promise<any> | any,
    options?: { queue?: string }
  ): Promise<string> => {
    const subscriptionId = `responder-${subject}-${Date.now()}`;
    
    if (!subscriptions.has(`request.${subject}`)) {
      subscriptions.set(`request.${subject}`, []);
    }
    
    subscriptions.get(`request.${subject}`)!.push(async (data: any) => {
      try {
        const response = await handler(data);
        publishedEvents.push({
          subject: `response.${subject}`,
          data: response,
          timestamp: Date.now(),
        });
      } catch (error) {
        publishedEvents.push({
          subject: `response.${subject}`,
          data: { error: error instanceof Error ? error.message : String(error) },
          timestamp: Date.now(),
        });
      }
    });
    
    return subscriptionId;
  }),
};

/**
 * Mock NATS Connection
 */
export const mockNatsConnection = {
  info: { server_id: 'mock-nats-server' },
  closed: vi.fn().mockReturnValue(Promise.resolve()),
  close: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockImplementation((subject: string, data: any) => {
    publishedEvents.push({
      subject,
      data: typeof data === 'string' ? JSON.parse(data) : data,
      timestamp: Date.now(),
    });
  }),
  request: vi.fn().mockResolvedValue({
    data: JSON.stringify({ status: 'success' }),
  }),
  subscribe: vi.fn().mockReturnValue({
    unsubscribe: vi.fn(),
    [Symbol.asyncIterator]: async function* () {
      // Mock async iterator for subscription messages
      yield {
        subject: 'test.subject',
        data: JSON.stringify({ test: 'data' }),
        respond: vi.fn(),
      };
    },
  }),
};

/**
 * Mock NATS connection functions
 */
export const mockNatsFunctions = {
  createNatsConnection: vi.fn().mockResolvedValue(mockNatsConnection),
  getNatsConnection: vi.fn().mockResolvedValue(mockNatsConnection),
  closeNatsConnection: vi.fn().mockResolvedValue(undefined),
  checkNatsHealth: vi.fn().mockResolvedValue(true),
};

/**
 * Error simulation utilities
 */
export const simulateNatsError = (
  errorType: 'connection' | 'publish' | 'timeout' = 'connection',
  affectedOperations: Array<'publish' | 'subscribe' | 'request'> = ['publish']
) => {
  const errorMap = {
    connection: new Error('NATS connection lost'),
    publish: new Error('Failed to publish message'),
    timeout: new Error('Request timeout'),
  };

  const error = errorMap[errorType];
  
  affectedOperations.forEach(operation => {
    if (operation === 'publish') {
      mockEventPublisher.publish.mockRejectedValueOnce(error);
      mockEventPublisher.publishRaw.mockRejectedValueOnce(error);
    } else if (operation === 'subscribe') {
      mockEventSubscriber.subscribe.mockRejectedValueOnce(error);
    } else if (operation === 'request') {
      mockRequestResponseService.request.mockRejectedValueOnce(error);
    }
  });
};

/**
 * Simulate slow NATS operations
 */
export const simulateSlowNats = (delayMs: number = 1000) => {
  [mockEventPublisher, mockEventSubscriber, mockRequestResponseService].forEach(service => {
    Object.values(service).forEach(method => {
      if (typeof method === 'function') {
        method.mockImplementationOnce(async (...args: any[]) => {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return method.getMockImplementation()?.(...args);
        });
      }
    });
  });
};

/**
 * Reset all mock NATS data and calls
 */
export const resetNatsMocks = () => {
  publishedEvents = [];
  subscriptions.clear();
  
  // Reset all mock functions
  [mockEventPublisher, mockEventSubscriber, mockRequestResponseService].forEach(service => {
    Object.values(service).forEach(method => {
      if (typeof method === 'function') {
        method.mockClear();
      }
    });
  });

  Object.values(mockNatsFunctions).forEach(method => {
    if (typeof method === 'function') {
      method.mockClear();
    }
  });
};

/**
 * Get published events for testing
 */
export const getPublishedEvents = (subjectPattern?: string) => {
  if (!subjectPattern) {
    return [...publishedEvents];
  }
  
  const regex = new RegExp(subjectPattern.replace('*', '.*').replace('>', '.*'));
  return publishedEvents.filter(event => regex.test(event.subject));
};

/**
 * Get events by subject
 */
export const getEventsBySubject = <K extends keyof EventTypes>(subject: K) => {
  return publishedEvents
    .filter(event => event.subject === subject)
    .map(event => event.data as EventTypes[K]);
};

/**
 * Wait for specific event to be published
 */
export const waitForEvent = <K extends keyof EventTypes>(
  subject: K,
  timeout: number = 1000
): Promise<EventTypes[K]> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Event ${subject} not published within ${timeout}ms`));
    }, timeout);

    const checkForEvent = () => {
      const event = publishedEvents.find(e => e.subject === subject);
      if (event) {
        clearTimeout(timeoutId);
        resolve(event.data as EventTypes[K]);
      } else {
        setTimeout(checkForEvent, 10);
      }
    };

    checkForEvent();
  });
};

/**
 * Trigger event handlers manually
 */
export const triggerEventHandlers = async (subject: string, data: any) => {
  const handlers = subscriptions.get(subject) || [];
  
  for (const handler of handlers) {
    try {
      await handler(data);
    } catch (error) {
      console.error(`Error in event handler for ${subject}:`, error);
    }
  }
};

/**
 * NATS statistics for monitoring
 */
export const getNatsStats = () => ({
  totalPublishedEvents: publishedEvents.length,
  totalSubscriptions: Array.from(subscriptions.values()).reduce((sum, handlers) => sum + handlers.length, 0),
  eventsBySubject: publishedEvents.reduce((acc, event) => {
    acc[event.subject] = (acc[event.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  lastEventTimestamp: publishedEvents.length > 0 ? publishedEvents[publishedEvents.length - 1].timestamp : null,
});

// Default exports
export default {
  eventPublisher: mockEventPublisher,
  eventSubscriber: mockEventSubscriber,
  requestResponseService: mockRequestResponseService,
  ...mockNatsFunctions,
};