/**
 * NATS Test Setup and Utilities
 * 
 * NATS test server setup with embedded test server and event bus isolation
 * for integration testing scenarios.
 */

import { NatsConnection, connect, JSONCodec, StringCodec } from 'nats';
import { logger } from '../../src/logger';
import { createNatsConnection, closeNatsConnection } from '../../src/messaging/nats';

// Test NATS configuration
export interface TestNatsConfig {
  servers?: string[];
  isolateTests?: boolean;
  subjectPrefix?: string;
  enableJetStream?: boolean;
}

// Global test NATS connection
let testNatsConnection: NatsConnection | null = null;
let testNatsConfig: TestNatsConfig | null = null;
let testSubjects: Set<string> = new Set();

/**
 * Setup NATS for integration tests
 */
export async function setupTestNats(config: TestNatsConfig = {}): Promise<NatsConnection> {
  try {
    testNatsConfig = {
      servers: config.servers || [process.env.TEST_NATS_URL || 'nats://localhost:4223'],
      isolateTests: config.isolateTests !== false, // Default to true
      subjectPrefix: config.subjectPrefix || 'test',
      enableJetStream: config.enableJetStream || false,
    };

    // Try to connect to test NATS server
    try {
      testNatsConnection = await createNatsConnection({
        servers: testNatsConfig.servers!,
        maxReconnectAttempts: 3,
        reconnectTimeWait: 100,
        timeout: 1000,
      });

      logger.info(`Test NATS connected to ${testNatsConfig.servers!.join(', ')}`);
    } catch (error) {
      logger.warn('NATS server not available for testing, using mock implementation');
      return createMockNatsConnection();
    }

    return testNatsConnection as NatsConnection;

  } catch (error) {
    logger.error('Failed to setup test NATS:', error);
    // Fall back to mock NATS connection for tests
    return createMockNatsConnection();
  }
}

/**
 * Teardown test NATS
 */
export async function teardownTestNats(): Promise<void> {
  try {
    if (testNatsConnection && !(testNatsConnection as any).__isMock) {
      await testNatsConnection.close();
      testNatsConnection = null;
      testNatsConfig = null;
      testSubjects.clear();
      
      logger.info('Test NATS connection closed');
    }
  } catch (error) {
    logger.error('Failed to teardown test NATS:', error);
  }
}

/**
 * Get test NATS connection
 */
export function getTestNatsConnection(): NatsConnection {
  if (!testNatsConnection) {
    throw new Error('Test NATS not initialized. Call setupTestNats first.');
  }
  return testNatsConnection;
}

/**
 * Create isolated test subject namespace
 */
export function createTestSubject(testId: string, subject: string): string {
  const prefix = testNatsConfig?.subjectPrefix || 'test';
  const testSubject = `${prefix}.${testId}.${subject}`;
  testSubjects.add(testSubject);
  return testSubject;
}

/**
 * Clean up test subjects
 */
export async function cleanupTestSubjects(): Promise<void> {
  // NATS subjects don't need explicit cleanup as they're stateless
  // This is more for tracking purposes
  testSubjects.clear();
}

/**
 * Create test event publisher with isolated subjects
 */
export class TestEventPublisher {
  private nc: NatsConnection;
  private jc = JSONCodec();
  private testId: string;

  constructor(testId: string, connection?: NatsConnection) {
    this.testId = testId;
    this.nc = connection || getTestNatsConnection();
  }

  async publish(subject: string, data: any): Promise<void> {
    const testSubject = createTestSubject(this.testId, subject);
    
    try {
      await this.nc.publish(testSubject, this.jc.encode(data));
      logger.debug(`Published to test subject: ${testSubject}`, data);
    } catch (error) {
      logger.error(`Failed to publish to test subject: ${testSubject}`, error);
      throw error;
    }
  }

  async publishRaw(subject: string, data: string): Promise<void> {
    const testSubject = createTestSubject(this.testId, subject);
    
    try {
      const sc = StringCodec();
      await this.nc.publish(testSubject, sc.encode(data));
      logger.debug(`Published raw to test subject: ${testSubject}`);
    } catch (error) {
      logger.error(`Failed to publish raw to test subject: ${testSubject}`, error);
      throw error;
    }
  }
}

/**
 * Create test event subscriber with isolated subjects
 */
export class TestEventSubscriber {
  private nc: NatsConnection;
  private jc = JSONCodec();
  private testId: string;
  private subscriptions: Map<string, any> = new Map();

  constructor(testId: string, connection?: NatsConnection) {
    this.testId = testId;
    this.nc = connection || getTestNatsConnection();
  }

  async subscribe(
    subject: string, 
    handler: (data: any) => Promise<void> | void,
    options: { queue?: string; maxMessages?: number } = {}
  ): Promise<string> {
    const testSubject = createTestSubject(this.testId, subject);
    
    try {
      const subscription = this.nc.subscribe(testSubject, {
        queue: options.queue,
        max: options.maxMessages,
      });

      const subscriptionId = `${testSubject}-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);

      // Process messages in background
      this.processMessages(subscription, handler, testSubject);

      logger.debug(`Subscribed to test subject: ${testSubject}`);
      return subscriptionId;
    } catch (error) {
      logger.error(`Failed to subscribe to test subject: ${testSubject}`, error);
      throw error;
    }
  }

  private async processMessages(subscription: any, handler: Function, subject: string): Promise<void> {
    try {
      for await (const msg of subscription) {
        try {
          const data = this.jc.decode(msg.data);
          await handler(data);
        } catch (error) {
          logger.error(`Error processing message from ${subject}:`, error);
        }
      }
    } catch (error) {
      logger.error(`Subscription error for ${subject}:`, error);
    }
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      logger.debug(`Unsubscribed: ${subscriptionId}`);
    }
  }

  async unsubscribeAll(): Promise<void> {
    for (const [id, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
    logger.debug(`Unsubscribed from all test subjects for ${this.testId}`);
  }
}

/**
 * Create mock NATS connection for testing when NATS server is not available
 */
function createMockNatsConnection(): NatsConnection {
  const mockSubscriptions = new Map();
  const mockMessages: Array<{ subject: string; data: any; timestamp: number }> = [];

  const mockConnection = {
    __isMock: true,
    
    async publish(subject: string, data: any): Promise<void> {
      const message = { 
        subject, 
        data, 
        timestamp: Date.now() 
      };
      mockMessages.push(message);

      // Simulate message delivery to subscribers
      for (const [subId, subscription] of mockSubscriptions) {
        if (subscription.subject === subject || subscription.subject.endsWith('*')) {
          try {
            subscription.handler(data);
          } catch (error) {
            logger.error(`Mock subscription handler error for ${subject}:`, error);
          }
        }
      }
    },

    subscribe(subject: string, options: any = {}) {
      const subscriptionId = `mock-sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const mockSubscription = {
        subject,
        options,
        unsubscribe: () => {
          mockSubscriptions.delete(subscriptionId);
        },
        [Symbol.asyncIterator]: async function* () {
          // This would normally yield messages, but for testing
          // we'll just yield a simple mock message
          yield {
            subject,
            data: new Uint8Array(),
            headers: undefined,
            respond: () => {},
          };
        },
      };

      mockSubscriptions.set(subscriptionId, {
        subscription: mockSubscription,
        subject,
        handler: options.handler || (() => {}),
      });

      return mockSubscription;
    },

    async request(subject: string, data: any, options: any = {}): Promise<any> {
      // Mock request-response - just echo back the data
      return {
        subject: `response.${subject}`,
        data,
        headers: undefined,
      };
    },

    async close(): Promise<void> {
      mockSubscriptions.clear();
      mockMessages.length = 0;
    },

    closed(): Promise<void | Error> {
      return Promise.resolve();
    },

    info: {
      server_id: 'mock-nats-server',
      version: '0.0.0-mock',
      proto: 1,
      max_payload: 1048576,
    },

    // Mock stats for testing
    stats() {
      return {
        inMsgs: mockMessages.length,
        outMsgs: mockMessages.length,
        inBytes: mockMessages.reduce((sum, m) => sum + JSON.stringify(m.data).length, 0),
        outBytes: mockMessages.reduce((sum, m) => sum + JSON.stringify(m.data).length, 0),
        reconnects: 0,
      };
    },

    // Mock message history for testing verification
    getMessageHistory() {
      return [...mockMessages];
    },

    clearMessageHistory() {
      mockMessages.length = 0;
    },
  } as any;

  logger.info('Using mock NATS connection for testing');
  return mockConnection;
}

/**
 * Verify NATS test environment
 */
export async function verifyTestNatsEnvironment(): Promise<{
  isConnected: boolean;
  isMock: boolean;
  stats: any;
}> {
  try {
    const connection = getTestNatsConnection();
    const isMock = !!(connection as any).__isMock;
    
    if (isMock) {
      const mockStats = (connection as any).stats();
      return {
        isConnected: true,
        isMock: true,
        stats: mockStats,
      };
    }
    
    const info = connection.info;
    return {
      isConnected: !!info,
      isMock: false,
      stats: {
        server_id: info?.server_id,
        version: info?.version,
        max_payload: info?.max_payload,
      },
    };
  } catch (error) {
    return {
      isConnected: false,
      isMock: false,
      stats: null,
    };
  }
}

/**
 * Wait for messages on a test subject (useful for async testing)
 */
export async function waitForMessages(
  testId: string,
  subject: string,
  expectedCount: number = 1,
  timeoutMs: number = 5000
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const subscriber = new TestEventSubscriber(testId);
    const timeout = setTimeout(() => {
      subscriber.unsubscribeAll();
      reject(new Error(`Timeout waiting for ${expectedCount} messages on ${subject}`));
    }, timeoutMs);

    subscriber.subscribe(subject, (data: any) => {
      messages.push(data);
      if (messages.length >= expectedCount) {
        clearTimeout(timeout);
        subscriber.unsubscribeAll();
        resolve(messages);
      }
    });
  });
}

export default {
  setupTestNats,
  teardownTestNats,
  getTestNatsConnection,
  createTestSubject,
  cleanupTestSubjects,
  TestEventPublisher,
  TestEventSubscriber,
  verifyTestNatsEnvironment,
  waitForMessages,
};