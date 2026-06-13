/**
 * Server Test Helpers
 * 
 * Utilities for managing HTTP servers in tests to prevent port conflicts
 * and ensure proper cleanup between test runs.
 */

import { Server } from 'http';
import { vi } from 'vitest';

interface ServerTestContext {
  servers: Set<Server>;
  originalEnv: NodeJS.ProcessEnv;
}

/**
 * Creates a test context for managing servers during tests
 */
export function createServerTestContext(): ServerTestContext {
  return {
    servers: new Set<Server>(),
    originalEnv: { ...process.env },
  };
}

/**
 * Gets an available port for testing
 */
export function getTestPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(0, (err: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      const port = server.address()?.port;
      server.close(() => {
        resolve(port || 0);
      });
    });
  });
}

/**
 * Registers a server for cleanup during tests
 */
export function registerTestServer(context: ServerTestContext, server: Server): void {
  context.servers.add(server);
  
  // Auto-remove from set when server closes
  server.on('close', () => {
    context.servers.delete(server);
  });
}

/**
 * Cleans up all registered servers
 */
export function cleanupTestServers(context: ServerTestContext): Promise<void> {
  const closePromises = Array.from(context.servers).map(server => 
    new Promise<void>((resolve) => {
      if (server.listening) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    })
  );

  return Promise.all(closePromises).then(() => {
    context.servers.clear();
  });
}

/**
 * Restores environment variables to original state
 */
export function restoreTestEnvironment(context: ServerTestContext): void {
  process.env = context.originalEnv;
}

/**
 * Sets up test environment with unique port
 */
export async function setupTestEnvironment(context: ServerTestContext): Promise<number> {
  const port = await getTestPort();
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'test';
  return port;
}

/**
 * Complete test setup for server-based tests
 */
export async function setupServerTest(): Promise<{
  context: ServerTestContext;
  port: number;
  cleanup: () => Promise<void>;
}> {
  const context = createServerTestContext();
  const port = await setupTestEnvironment(context);
  
  const cleanup = async () => {
    await cleanupTestServers(context);
    restoreTestEnvironment(context);
    vi.restoreAllMocks();
  };
  
  return { context, port, cleanup };
}

/**
 * Mock GitHub server initialization to prevent actual server startup
 */
export function mockGitHubServer() {
  const mockServer = {
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    address: vi.fn(() => ({ port: 0 })),
    listening: false,
  };

  vi.doMock('../../src/github/github', () => ({
    initGithub: vi.fn().mockResolvedValue({
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn(),
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    server: mockServer,
    activeServers: new Set(),
  }));

  return mockServer;
}

/**
 * Creates a timeout helper for tests that might hang
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}