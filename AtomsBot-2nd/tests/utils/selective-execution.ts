/**
 * Selective Test Execution System
 * 
 * This module provides intelligent test selection and execution strategies
 * to optimize development workflow by running only relevant tests.
 */

import { glob } from "glob";
import { readFileSync, existsSync, statSync } from "fs";
import { join, relative, dirname } from "path";

interface TestExecutionPlan {
  unit: string[];
  integration: string[];
  affected: string[];
  all: string[];
  estimated_time_seconds: number;
}

interface FileChange {
  path: string;
  type: 'modified' | 'added' | 'deleted';
  timestamp: number;
}

interface TestMetadata {
  path: string;
  dependencies: string[];
  estimatedDuration: number; // in milliseconds
  lastRun: number;
  success: boolean;
  tags: string[];
}

class TestSelector {
  private projectRoot: string;
  private testMetadataCache: Map<string, TestMetadata> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.loadTestMetadata();
    this.buildDependencyGraph();
  }

  /**
   * Get all test files with their metadata
   */
  async getAllTestFiles(): Promise<string[]> {
    const patterns = [
      "src/**/*.test.{ts,js}",
      "src/**/*.spec.{ts,js}",
      "tests/**/*.test.{ts,js}",
      "tests/**/*.spec.{ts,js}"
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: this.projectRoot });
      allFiles.push(...files.map(f => join(this.projectRoot, f)));
    }

    return Array.from(new Set(allFiles));
  }

  /**
   * Build dependency graph by analyzing imports
   */
  private async buildDependencyGraph(): Promise<void> {
    const testFiles = await this.getAllTestFiles();
    
    for (const testFile of testFiles) {
      const dependencies = this.extractDependencies(testFile);
      this.dependencyGraph.set(testFile, new Set(dependencies));
    }
  }

  /**
   * Extract dependencies from a test file
   */
  private extractDependencies(filePath: string): string[] {
    if (!existsSync(filePath)) return [];

    try {
      const content = readFileSync(filePath, 'utf-8');
      const dependencies: string[] = [];
      
      // Extract import statements
      const importRegex = /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];
        
        // Skip node_modules dependencies
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
          continue;
        }
        
        // Resolve relative paths
        if (importPath.startsWith('.')) {
          const absolutePath = join(dirname(filePath), importPath);
          
          // Try different extensions
          for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) {
            const fullPath = absolutePath + ext;
            if (existsSync(fullPath)) {
              dependencies.push(fullPath);
              break;
            }
          }
        } else if (importPath.startsWith('@/')) {
          // Handle alias imports (assuming @/ maps to src/)
          const srcPath = importPath.replace('@/', 'src/');
          const absolutePath = join(this.projectRoot, srcPath);
          
          for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) {
            const fullPath = absolutePath + ext;
            if (existsSync(fullPath)) {
              dependencies.push(fullPath);
              break;
            }
          }
        }
      }
      
      return dependencies;
    } catch (error) {
      console.warn(`Failed to analyze dependencies for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get changed files based on git status or file timestamps
   */
  async getChangedFiles(since?: Date): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    
    // Try to use git first
    try {
      const { execSync } = require('child_process');
      const sinceArg = since ? `--since="${since.toISOString()}"` : '';
      const gitOutput = execSync(
        `git diff --name-status HEAD ${sinceArg}`,
        { cwd: this.projectRoot, encoding: 'utf-8' }
      ).trim();

      if (gitOutput) {
        const lines = gitOutput.split('\n');
        for (const line of lines) {
          const [status, path] = line.split('\t');
          let type: 'modified' | 'added' | 'deleted' = 'modified';
          
          if (status === 'A') type = 'added';
          else if (status === 'D') type = 'deleted';
          
          changes.push({
            path: join(this.projectRoot, path),
            type,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      // Fallback to file timestamp analysis
      const allFiles = await this.getAllTestFiles();
      const cutoff = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const file of allFiles) {
        try {
          const stats = statSync(file);
          if (stats.mtime > cutoff) {
            changes.push({
              path: file,
              type: 'modified',
              timestamp: stats.mtime.getTime(),
            });
          }
        } catch (error) {
          // File might not exist, skip it
        }
      }
    }
    
    return changes;
  }

  /**
   * Find tests affected by changed files
   */
  async getAffectedTests(changedFiles: FileChange[]): Promise<string[]> {
    const affectedTests = new Set<string>();
    const changedPaths = new Set(changedFiles.map(f => f.path));

    // Direct test file changes
    for (const change of changedFiles) {
      if (this.isTestFile(change.path)) {
        affectedTests.add(change.path);
      }
    }

    // Find tests that depend on changed source files
    for (const [testFile, dependencies] of this.dependencyGraph.entries()) {
      for (const dep of dependencies) {
        if (changedPaths.has(dep)) {
          affectedTests.add(testFile);
          break;
        }
      }
    }

    return Array.from(affectedTests);
  }

  /**
   * Select tests based on execution strategy
   */
  async selectTests(strategy: 'affected' | 'fast' | 'full' | 'failed', options: {
    changedSince?: Date;
    maxDuration?: number; // in seconds
    tags?: string[];
  } = {}): Promise<TestExecutionPlan> {
    const allTests = await this.getAllTestFiles();
    let selectedTests: string[] = [];

    switch (strategy) {
      case 'affected': {
        const changedFiles = await this.getChangedFiles(options.changedSince);
        selectedTests = await this.getAffectedTests(changedFiles);
        break;
      }
      
      case 'fast': {
        selectedTests = allTests.filter(test => {
          const metadata = this.testMetadataCache.get(test);
          return !metadata || metadata.estimatedDuration < 5000; // Under 5 seconds
        });
        break;
      }
      
      case 'failed': {
        selectedTests = allTests.filter(test => {
          const metadata = this.testMetadataCache.get(test);
          return metadata && !metadata.success;
        });
        break;
      }
      
      case 'full':
      default:
        selectedTests = allTests;
        break;
    }

    // Filter by tags if specified
    if (options.tags && options.tags.length > 0) {
      selectedTests = selectedTests.filter(test => {
        const metadata = this.testMetadataCache.get(test);
        return metadata && metadata.tags.some(tag => options.tags!.includes(tag));
      });
    }

    // Filter by duration if specified
    if (options.maxDuration) {
      const maxMs = options.maxDuration * 1000;
      selectedTests = selectedTests.filter(test => {
        const metadata = this.testMetadataCache.get(test);
        return !metadata || metadata.estimatedDuration <= maxMs;
      });
    }

    return this.createExecutionPlan(selectedTests);
  }

  /**
   * Create optimized execution plan
   */
  private createExecutionPlan(testFiles: string[]): TestExecutionPlan {
    const unit: string[] = [];
    const integration: string[] = [];
    const affected = testFiles;

    let estimatedTime = 0;

    for (const testFile of testFiles) {
      if (testFile.includes('integration') || testFile.includes('e2e')) {
        integration.push(testFile);
      } else {
        unit.push(testFile);
      }

      const metadata = this.testMetadataCache.get(testFile);
      estimatedTime += metadata?.estimatedDuration || 3000; // Default 3 seconds
    }

    return {
      unit,
      integration,
      affected,
      all: testFiles,
      estimated_time_seconds: Math.round(estimatedTime / 1000),
    };
  }

  /**
   * Load test metadata from cache
   */
  private loadTestMetadata(): void {
    const metadataFile = join(this.projectRoot, '.vitest', 'test-metadata.json');
    
    if (existsSync(metadataFile)) {
      try {
        const metadata = JSON.parse(readFileSync(metadataFile, 'utf-8'));
        for (const [path, data] of Object.entries(metadata)) {
          this.testMetadataCache.set(path, data as TestMetadata);
        }
      } catch (error) {
        console.warn('Failed to load test metadata:', error);
      }
    }
  }

  /**
   * Save test metadata to cache
   */
  saveTestMetadata(): void {
    const metadataFile = join(this.projectRoot, '.vitest', 'test-metadata.json');
    const metadata = Object.fromEntries(this.testMetadataCache.entries());
    
    try {
      const { mkdirSync, writeFileSync } = require('fs');
      mkdirSync(dirname(metadataFile), { recursive: true });
      writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn('Failed to save test metadata:', error);
    }
  }

  /**
   * Update test metadata after execution
   */
  updateTestMetadata(testPath: string, duration: number, success: boolean, tags: string[] = []): void {
    const existing = this.testMetadataCache.get(testPath) || {
      path: testPath,
      dependencies: [],
      estimatedDuration: 3000,
      lastRun: 0,
      success: false,
      tags: [],
    };

    this.testMetadataCache.set(testPath, {
      ...existing,
      estimatedDuration: Math.round((existing.estimatedDuration + duration) / 2), // Moving average
      lastRun: Date.now(),
      success,
      tags: Array.from(new Set([...existing.tags, ...tags])),
    });
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|js)$/.test(filePath);
  }

  /**
   * Get test execution recommendation
   */
  async getExecutionRecommendation(): Promise<{
    strategy: 'affected' | 'fast' | 'full';
    reason: string;
    estimatedTime: number;
  }> {
    const changedFiles = await this.getChangedFiles(new Date(Date.now() - 60 * 60 * 1000)); // Last hour
    
    if (changedFiles.length === 0) {
      return {
        strategy: 'fast',
        reason: 'No recent changes detected, running fast tests only',
        estimatedTime: 30,
      };
    }

    if (changedFiles.length < 5) {
      const affectedTests = await this.getAffectedTests(changedFiles);
      return {
        strategy: 'affected',
        reason: `${changedFiles.length} files changed, running ${affectedTests.length} affected tests`,
        estimatedTime: affectedTests.length * 3, // Estimate 3 seconds per test
      };
    }

    return {
      strategy: 'full',
      reason: `Many files changed (${changedFiles.length}), running full test suite`,
      estimatedTime: 120,
    };
  }
}

/**
 * Test execution utilities
 */
export class TestExecutor {
  private selector: TestSelector;

  constructor(projectRoot?: string) {
    this.selector = new TestSelector(projectRoot);
  }

  /**
   * Generate vitest command for selective execution
   */
  generateCommand(plan: TestExecutionPlan, options: {
    coverage?: boolean;
    watch?: boolean;
    parallel?: boolean;
    reporter?: string;
  } = {}): string {
    const baseCmd = 'vitest';
    const args: string[] = [];

    // Add run mode
    if (!options.watch) {
      args.push('run');
    }

    // Add coverage
    if (options.coverage) {
      args.push('--coverage');
    }

    // Add reporter
    if (options.reporter) {
      args.push('--reporter', options.reporter);
    }

    // Add parallel execution optimization
    if (options.parallel && plan.all.length > 10) {
      const workers = Math.min(8, Math.max(2, Math.floor(plan.all.length / 5)));
      args.push('--threads', workers.toString());
    }

    // Add test files
    if (plan.all.length > 0) {
      args.push(...plan.all);
    }

    return [baseCmd, ...args].join(' ');
  }

  /**
   * Execute tests with optimization
   */
  async executeTests(strategy: 'affected' | 'fast' | 'full' | 'failed' = 'affected'): Promise<void> {
    console.log('🔍 Analyzing test execution requirements...');
    
    const plan = await this.selector.selectTests(strategy);
    console.log(`📊 Test Plan: ${plan.all.length} tests selected (estimated ${plan.estimated_time_seconds}s)`);
    
    if (plan.all.length === 0) {
      console.log('✅ No tests to run');
      return;
    }

    const command = this.generateCommand(plan, {
      coverage: strategy === 'full',
      parallel: plan.all.length > 5,
      reporter: process.env.CI ? 'json' : 'verbose',
    });

    console.log(`🚀 Executing: ${command}`);
    
    try {
      const { execSync } = require('child_process');
      execSync(command, { 
        stdio: 'inherit', 
        cwd: this.selector['projectRoot'] 
      });
      console.log('✅ Tests completed successfully');
    } catch (error) {
      console.error('❌ Tests failed');
      process.exit(1);
    }
  }

  /**
   * Get test selector for advanced usage
   */
  getSelector(): TestSelector {
    return this.selector;
  }
}

// Export utilities
export const testSelector = new TestSelector();
export const testExecutor = new TestExecutor();

export default {
  TestSelector,
  TestExecutor,
  testSelector,
  testExecutor,
};