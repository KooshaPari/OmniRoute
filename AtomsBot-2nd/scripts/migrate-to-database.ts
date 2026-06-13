#!/usr/bin/env tsx
/**
 * Migration script to move from JSON file storage to database
 * This script will:
 * 1. Read existing JSON data
 * 2. Initialize database with schema
 * 3. Import all data to database
 * 4. Verify data integrity
 * 5. Create backup of JSON files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getDatabaseClient, runMigrations } from '../src/database/config';
import { databaseService } from '../src/database/DatabaseService';
import { logger } from '../src/logger';

interface LegacyLinkMappings {
  jiraLinks: Array<{
    threadId: string;
    jiraKey: string;
    githubNumber?: number;
    createdAt: number;
  }>;
  githubLinks: Array<{
    threadId: string;
    number: number;
    owner?: string;
    repo?: string;
    createdAt: number;
  }>;
  version?: number;
  updatedAt?: number;
}

interface LegacyThread {
  id: string;
  title: string;
  appliedTags: string[];
  archived: boolean;
  locked: boolean;
  comments: Array<{
    id: string;
    content: string;
    author: string;
    timestamp: string;
  }>;
  jiraKey?: string;
  githubNumber?: number;
}

class DatabaseMigration {
  private jsonDataPath = path.join(process.cwd(), '.data', 'link-mappings.json');
  private backupDir = path.join(process.cwd(), '.data', 'backup');
  
  async run(): Promise<void> {
    try {
      logger.info('Starting database migration...');
      
      // Step 1: Initialize database
      await this.initializeDatabase();
      
      // Step 2: Read legacy data
      const legacyData = await this.readLegacyData();
      
      // Step 3: Validate legacy data
      await this.validateLegacyData(legacyData);
      
      // Step 4: Import data to database
      await this.importToDatabase(legacyData);
      
      // Step 5: Verify migration
      await this.verifyMigration(legacyData);
      
      // Step 6: Create backup
      await this.createBackup();
      
      logger.info('Database migration completed successfully!');
      
    } catch (error) {
      logger.error('Database migration failed', { error });
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    logger.info('Initializing database...');
    
    try {
      // Run any pending migrations
      await runMigrations();
      
      // Initialize database service
      await databaseService.initialize();
      
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  private async readLegacyData(): Promise<{
    linkMappings: LegacyLinkMappings;
    threads: LegacyThread[];
  }> {
    logger.info('Reading legacy data...');
    
    let linkMappings: LegacyLinkMappings = {
      jiraLinks: [],
      githubLinks: [],
    };
    
    // Read link mappings
    try {
      if (await this.fileExists(this.jsonDataPath)) {
        const data = await fs.readFile(this.jsonDataPath, 'utf-8');
        linkMappings = JSON.parse(data);
        logger.info('Loaded link mappings', {
          jiraLinks: linkMappings.jiraLinks.length,
          githubLinks: linkMappings.githubLinks.length,
        });
      } else {
        logger.warn('No existing link mappings found');
      }
    } catch (error) {
      logger.error('Failed to read link mappings', { error });
      throw error;
    }

    // For threads, we'll need to get them from the current store
    // Since they're stored in memory, we'll create placeholder data
    const threads: LegacyThread[] = [];
    
    return { linkMappings, threads };
  }

  private async validateLegacyData(data: {
    linkMappings: LegacyLinkMappings;
    threads: LegacyThread[];
  }): Promise<void> {
    logger.info('Validating legacy data...');
    
    const { linkMappings, threads } = data;
    
    // Validate Jira links
    for (const link of linkMappings.jiraLinks) {
      if (!link.threadId || !link.jiraKey) {
        throw new Error(`Invalid Jira link: ${JSON.stringify(link)}`);
      }
    }
    
    // Validate GitHub links
    for (const link of linkMappings.githubLinks) {
      if (!link.threadId || !link.number) {
        throw new Error(`Invalid GitHub link: ${JSON.stringify(link)}`);
      }
    }
    
    // Validate threads
    for (const thread of threads) {
      if (!thread.id || !thread.title) {
        throw new Error(`Invalid thread: ${JSON.stringify(thread)}`);
      }
    }
    
    logger.info('Legacy data validation passed');
  }

  private async importToDatabase(data: {
    linkMappings: LegacyLinkMappings;
    threads: LegacyThread[];
  }): Promise<void> {
    logger.info('Importing data to database...');
    
    const { linkMappings, threads } = data;
    const client = getDatabaseClient();
    
    try {
      await client.$transaction(async (tx) => {
        // Import threads first
        for (const thread of threads) {
          await tx.thread.upsert({
            where: { id: thread.id },
            create: {
              id: thread.id,
              channelId: 'unknown', // Will need to be updated later
              title: thread.title,
              archived: thread.archived,
              locked: thread.locked,
            },
            update: {
              title: thread.title,
              archived: thread.archived,
              locked: thread.locked,
            },
          });
          
          // Import messages/comments
          for (const comment of thread.comments) {
            await tx.message.upsert({
              where: { id: comment.id },
              create: {
                id: comment.id,
                threadId: thread.id,
                authorId: 'unknown',
                authorUsername: comment.author,
                content: comment.content,
                createdAt: new Date(comment.timestamp),
              },
              update: {
                content: comment.content,
                authorUsername: comment.author,
              },
            });
          }
        }
        
        // Import Jira issues and links
        for (const link of linkMappings.jiraLinks) {
          // Create Jira issue if it doesn't exist
          await tx.jiraIssue.upsert({
            where: { key: link.jiraKey },
            create: {
              id: link.jiraKey,
              key: link.jiraKey,
              projectKey: link.jiraKey.split('-')[0],
              summary: 'Migrated from legacy store',
              status: 'Unknown',
              createdAt: new Date(link.createdAt),
              updatedAt: new Date(link.createdAt),
            },
            update: {},
          });
          
          // Create thread-Jira link
          await tx.threadJiraLink.upsert({
            where: {
              threadId_jiraIssueId: {
                threadId: link.threadId,
                jiraIssueId: link.jiraKey,
              },
            },
            create: {
              threadId: link.threadId,
              jiraIssueId: link.jiraKey,
              createdAt: new Date(link.createdAt),
            },
            update: {},
          });
        }
        
        // Import GitHub issues and links
        for (const link of linkMappings.githubLinks) {
          const githubId = `${link.owner || 'unknown'}-${link.repo || 'unknown'}-${link.number}`;
          
          // Create GitHub issue if it doesn't exist
          await tx.githubIssue.upsert({
            where: {
              owner_repo_number: {
                owner: link.owner || 'unknown',
                repo: link.repo || 'unknown',
                number: link.number,
              },
            },
            create: {
              id: Date.now() + Math.random(), // Temporary unique ID
              number: link.number,
              owner: link.owner || 'unknown',
              repo: link.repo || 'unknown',
              title: 'Migrated from legacy store',
              state: 'open',
              createdAt: new Date(link.createdAt),
              updatedAt: new Date(link.createdAt),
            },
            update: {},
          });
          
          // Get the created GitHub issue to get its ID
          const githubIssue = await tx.githubIssue.findUnique({
            where: {
              owner_repo_number: {
                owner: link.owner || 'unknown',
                repo: link.repo || 'unknown',
                number: link.number,
              },
            },
          });
          
          if (githubIssue) {
            // Create thread-GitHub link
            await tx.threadGithubLink.upsert({
              where: {
                threadId_githubIssueId: {
                  threadId: link.threadId,
                  githubIssueId: githubIssue.id,
                },
              },
              create: {
                threadId: link.threadId,
                githubIssueId: githubIssue.id,
                createdAt: new Date(link.createdAt),
              },
              update: {},
            });
          }
        }
      });
      
      logger.info('Data import completed successfully');
    } catch (error) {
      logger.error('Failed to import data to database', { error });
      throw error;
    }
  }

  private async verifyMigration(originalData: {
    linkMappings: LegacyLinkMappings;
    threads: LegacyThread[];
  }): Promise<void> {
    logger.info('Verifying migration...');
    
    const client = getDatabaseClient();
    
    // Count records in database
    const [threadCount, jiraLinkCount, githubLinkCount] = await Promise.all([
      client.thread.count(),
      client.threadJiraLink.count(),
      client.threadGithubLink.count(),
    ]);
    
    logger.info('Migration verification', {
      database: {
        threads: threadCount,
        jiraLinks: jiraLinkCount,
        githubLinks: githubLinkCount,
      },
      original: {
        threads: originalData.threads.length,
        jiraLinks: originalData.linkMappings.jiraLinks.length,
        githubLinks: originalData.linkMappings.githubLinks.length,
      },
    });
    
    // Verify that we have at least the same number of links
    if (jiraLinkCount < originalData.linkMappings.jiraLinks.length) {
      throw new Error('Jira link count mismatch after migration');
    }
    
    if (githubLinkCount < originalData.linkMappings.githubLinks.length) {
      throw new Error('GitHub link count mismatch after migration');
    }
    
    logger.info('Migration verification passed');
  }

  private async createBackup(): Promise<void> {
    logger.info('Creating backup of JSON files...');
    
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create timestamp for backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Backup link mappings if they exist
      if (await this.fileExists(this.jsonDataPath)) {
        const backupPath = path.join(this.backupDir, `link-mappings-${timestamp}.json`);
        await fs.copyFile(this.jsonDataPath, backupPath);
        logger.info('Created backup', { backupPath });
      }
      
      logger.info('Backup completed successfully');
    } catch (error) {
      logger.error('Failed to create backup', { error });
      throw error;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new DatabaseMigration();
  migration.run()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { DatabaseMigration };
