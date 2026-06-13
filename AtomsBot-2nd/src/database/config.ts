import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// Database configuration
export interface DatabaseConfig {
  url?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  enableLogging?: boolean;
}

// Singleton Prisma client
// Use 'var' to avoid temporal dead zone during circular ESM initialization
// This ensures early calls to getDatabaseClient don't throw before declaration executes
var prisma: PrismaClient | null = null;

export function createDatabaseClient(config?: DatabaseConfig): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const databaseUrl = config?.url || process.env.DATABASE_URL || 'file:./data/bot.db';

  const isDevelopment = process.env.NODE_ENV === 'development';
  const enableLogging = config?.enableLogging ?? isDevelopment;

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: enableLogging
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
        ]
      : ['error'],
  });

  // Log database queries in development
  if (enableLogging && isDevelopment) {
    const anyPrisma = prisma as any;
    if (typeof anyPrisma.$on === 'function') {
      anyPrisma.$on('query', (e: any) => {
        logger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });

      anyPrisma.$on('error', (e: any) => {
        logger.error('Database Error', { error: e });
      });
    }
  }

  return prisma;
}

export function getDatabaseClient(): PrismaClient {
  if (!prisma) {
    prisma = createDatabaseClient({
      enableLogging: process.env.NODE_ENV === 'development',
    });
  }
  return prisma;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch {
      // Swallow disconnect errors per tests
    } finally {
      prisma = null;
    }
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getDatabaseClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}

// Migration utilities
export async function runMigrations(): Promise<void> {
  try {
    const client = getDatabaseClient();
    // Note: In production, use Prisma CLI for migrations
    // This is for development/testing only
    await client.$executeRaw`PRAGMA foreign_keys = ON;`;
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Database migration failed', { error });
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(
  operation: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const client = getDatabaseClient();
  return client.$transaction((tx) => operation(tx as PrismaClient));
}

// Cleanup expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const client = getDatabaseClient();
    const result = await client.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    if (result?.count > 0) {
      logger.info(`Cleaned up ${result.count} expired sessions`);
    }

    return result?.count ?? 0;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error });
    return 0;
  }
}

// Database statistics
export async function getDatabaseStats(): Promise<{
  threads: number;
  messages: number;
  githubIssues: number;
  jiraIssues: number;
  users: number;
  activeSessions: number;
}> {
  const client = getDatabaseClient();
  
  const [
    threads,
    messages,
    githubIssues,
    jiraIssues,
    users,
    activeSessions,
  ] = await Promise.all([
    client.thread.count(),
    client.message.count({ where: { deletedAt: null } }),
    client.githubIssue.count(),
    client.jiraIssue.count(),
    client.discordUser.count(),
    client.userSession.count({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    }),
  ]);

  return {
    threads,
    messages,
    githubIssues,
    jiraIssues,
    users,
    activeSessions,
  };
}

// Export the client getter as default
export default getDatabaseClient;
