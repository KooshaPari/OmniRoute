#!/usr/bin/env tsx
/**
 * Database initialization script
 * This script will:
 * 1. Create database file if using SQLite
 * 2. Run Prisma migrations
 * 3. Seed initial data if needed
 * 4. Verify database setup
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDatabaseClient, checkDatabaseHealth } from '../src/database/config';
import { logger } from '../src/logger';

const execAsync = promisify(exec);

class DatabaseInitializer {
  private databasePath = path.join(process.cwd(), 'data', 'bot.db');
  
  async run(): Promise<void> {
    try {
      logger.info('Starting database initialization...');
      
      // Step 1: Ensure data directory exists
      await this.ensureDataDirectory();
      
      // Step 2: Run Prisma migrations
      await this.runPrismaMigrations();
      
      // Step 3: Verify database setup
      await this.verifyDatabase();
      
      // Step 4: Seed initial data if needed
      await this.seedInitialData();
      
      logger.info('Database initialization completed successfully!');
      
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    logger.info('Ensuring data directory exists...');
    
    const dataDir = path.dirname(this.databasePath);
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
      logger.info('Data directory ready', { path: dataDir });
    } catch (error) {
      logger.error('Failed to create data directory', { error });
      throw error;
    }
  }

  private async runPrismaMigrations(): Promise<void> {
    logger.info('Running Prisma migrations...');
    
    try {
      // For SQLite, we can use db push for development
      const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss');
      
      if (stderr && !stderr.includes('warnings')) {
        logger.warn('Prisma migration warnings', { stderr });
      }
      
      logger.info('Prisma migrations completed', { stdout: stdout.trim() });
    } catch (error) {
      logger.error('Failed to run Prisma migrations', { error });
      throw error;
    }
  }

  private async verifyDatabase(): Promise<void> {
    logger.info('Verifying database setup...');
    
    try {
      const isHealthy = await checkDatabaseHealth();
      
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }
      
      // Test basic operations
      const client = getDatabaseClient();
      
      // Test table creation by counting records
      const counts = await Promise.all([
        client.thread.count(),
        client.githubIssue.count(),
        client.jiraIssue.count(),
        client.discordUser.count(),
      ]);
      
      logger.info('Database verification passed', {
        tables: {
          threads: counts[0],
          githubIssues: counts[1],
          jiraIssues: counts[2],
          discordUsers: counts[3],
        },
      });
      
    } catch (error) {
      logger.error('Database verification failed', { error });
      throw error;
    }
  }

  private async seedInitialData(): Promise<void> {
    logger.info('Seeding initial data...');
    
    try {
      const client = getDatabaseClient();
      
      // Create a default guild if none exists
      const guildCount = await client.guild.count();
      if (guildCount === 0) {
        await client.guild.create({
          data: {
            id: 'default-guild',
            name: 'Default Guild',
          },
        });
        
        // Create a default channel
        await client.channel.create({
          data: {
            id: 'default-channel',
            guildId: 'default-guild',
            name: 'Default Channel',
            type: 15, // Forum channel type
          },
        });
        
        logger.info('Created default guild and channel');
      }
      
      logger.info('Initial data seeding completed');
      
    } catch (error) {
      logger.error('Failed to seed initial data', { error });
      throw error;
    }
  }
}

// Environment setup helper
export async function setupDatabaseEnvironment(): Promise<void> {
  // Ensure data directory exists so SQLite can create the file
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (e) {
    logger.warn('Could not create data directory (may already exist)', { dataDir, e });
  }

  // Set default DATABASE_URL if not provided
  if (!process.env.DATABASE_URL) {
    const defaultUrl = `file:${path.join(dataDir, 'bot.db')}`;
    process.env.DATABASE_URL = defaultUrl;
    logger.info('Set default DATABASE_URL', { url: defaultUrl });
  }
}

// Run initialization only when this specific script is invoked directly (not when bundled)
{
  const modulePath = new URL(import.meta.url).pathname;
  const argvPath = process.argv[1] || "";
  const isThisScript = /[\/\\]scripts[\/\\]init-database\.(ts|js)$/.test(modulePath);
  const isArgThisScript = /[\/\\]scripts[\/\\]init-database\.(ts|js)$/.test(argvPath);
  if (isThisScript && isArgThisScript) {
    (async () => {
      try {
        await setupDatabaseEnvironment();
        const initializer = new DatabaseInitializer();
        await initializer.run();
        console.log('Database initialization completed successfully!');
        process.exit(0);
      } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
      }
    })();
  }
}

export { DatabaseInitializer };
