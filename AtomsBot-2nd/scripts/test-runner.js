#!/usr/bin/env node

/**
 * Test runner script for Discord bot with comprehensive coverage reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.output 
    };
  }
}

async function checkTestFiles() {
  logHeader('Checking Test Coverage');
  
  const testPatterns = [
    'src/**/__tests__/**/*.test.{js,ts,tsx}',
    'src/**/*.test.{js,ts,tsx}',
  ];
  
  const testFiles = [];
  
  function findTestFiles(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        findTestFiles(fullPath);
      } else if (file.endsWith('.test.ts') || file.endsWith('.test.js')) {
        testFiles.push(fullPath);
      }
    }
  }
  
  findTestFiles('src');
  
  logInfo(`Found ${testFiles.length} test files:`);
  testFiles.forEach(file => log(`  • ${file}`, 'reset'));
  
  if (testFiles.length === 0) {
    logWarning('No test files found!');
    return false;
  }
  
  return true;
}

async function runLinting() {
  logHeader('Running Linter');
  
  const lintCommand = 'npm run lint';
  const result = await runCommand(lintCommand, { silent: true });
  
  if (result.success) {
    logSuccess('Linting passed');
    return true;
  } else {
    logWarning('Linting issues found (continuing with tests)');
    if (result.output) {
      console.log(result.output);
    }
    return false;
  }
}

async function runTypecheck() {
  logHeader('Running TypeScript Compiler Check');
  
  const typecheckCommand = 'npx tsc --noEmit';
  const result = await runCommand(typecheckCommand, { silent: true });
  
  if (result.success) {
    logSuccess('TypeScript compilation passed');
    return true;
  } else {
    logError('TypeScript compilation failed');
    if (result.output) {
      console.log(result.output);
    }
    return false;
  }
}

async function runTests() {
  logHeader('Running Test Suite');
  
  const testCommand = 'npm test -- --coverage --verbose';
  const result = await runCommand(testCommand);
  
  if (result.success) {
    logSuccess('All tests passed');
    return true;
  } else {
    logError('Some tests failed');
    return false;
  }
}

async function generateCoverageReport() {
  logHeader('Generating Coverage Report');
  
  const coverageDir = path.join(process.cwd(), 'coverage');
  
  if (fs.existsSync(coverageDir)) {
    logSuccess('Coverage report generated');
    logInfo(`Coverage report available at: ${path.join(coverageDir, 'index.html')}`);
    
    // Try to parse coverage summary
    const summaryPath = path.join(coverageDir, 'coverage-summary.json');
    if (fs.existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        const total = summary.total;
        
        logInfo('Coverage Summary:');
        log(`  Lines: ${total.lines.pct}%`, total.lines.pct >= 90 ? 'green' : total.lines.pct >= 80 ? 'yellow' : 'red');
        log(`  Branches: ${total.branches.pct}%`, total.branches.pct >= 90 ? 'green' : total.branches.pct >= 80 ? 'yellow' : 'red');
        log(`  Functions: ${total.functions.pct}%`, total.functions.pct >= 90 ? 'green' : total.functions.pct >= 80 ? 'yellow' : 'red');
        log(`  Statements: ${total.statements.pct}%`, total.statements.pct >= 90 ? 'green' : total.statements.pct >= 80 ? 'yellow' : 'red');
        
        if (total.lines.pct >= 90 && total.branches.pct >= 90 && 
            total.functions.pct >= 90 && total.statements.pct >= 90) {
          logSuccess('Excellent coverage! All metrics above 90%');
        } else if (total.lines.pct >= 80) {
          logWarning('Good coverage, but room for improvement');
        } else {
          logError('Coverage below recommended threshold (80%)');
        }
        
      } catch (error) {
        logWarning('Could not parse coverage summary');
      }
    }
    
    return true;
  } else {
    logWarning('Coverage report not found');
    return false;
  }
}

async function runSpecificTestSuite(pattern) {
  logHeader(`Running Specific Tests: ${pattern}`);
  
  const testCommand = `npm test -- --testPathPattern="${pattern}" --coverage`;
  const result = await runCommand(testCommand);
  
  return result.success;
}

async function watchMode() {
  logHeader('Starting Watch Mode');
  logInfo('Tests will re-run automatically when files change');
  logInfo('Press Ctrl+C to exit watch mode');
  
  const watchCommand = 'npm test -- --watch --coverage';
  await runCommand(watchCommand);
}

function showHelp() {
  log('\n🧪 Discord Bot Test Runner', 'bright');
  log('\nUsage: node scripts/test-runner.js [options]\n');
  
  log('Options:', 'yellow');
  log('  --help, -h          Show this help message');
  log('  --watch, -w         Run tests in watch mode');
  log('  --coverage, -c      Generate coverage report only');
  log('  --lint, -l          Run linter only');
  log('  --typecheck, -t     Run TypeScript compiler check only');
  log('  --pattern <pattern> Run specific test pattern');
  log('  --discord           Run Discord command tests only');
  log('  --handlers          Run handler tests only');
  log('  --forms             Run form/modal tests only');
  log('  --all              Run complete test suite (default)');
  
  log('\nExamples:', 'cyan');
  log('  npm run test:full                    # Run all tests with coverage');
  log('  node scripts/test-runner.js --watch  # Watch mode');
  log('  node scripts/test-runner.js --discord # Discord tests only');
  log('  node scripts/test-runner.js --pattern="link"  # Link command tests');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  log('🧪 Discord Bot Test Suite Runner', 'bright');
  log(`📅 ${new Date().toLocaleString()}`, 'reset');
  
  // Quick checks first
  const hasTestFiles = await checkTestFiles();
  if (!hasTestFiles && !args.includes('--coverage')) {
    process.exit(1);
  }
  
  let success = true;
  
  try {
    if (args.includes('--watch') || args.includes('-w')) {
      await watchMode();
      return;
    }
    
    if (args.includes('--coverage') || args.includes('-c')) {
      await generateCoverageReport();
      return;
    }
    
    if (args.includes('--lint') || args.includes('-l')) {
      const lintSuccess = await runLinting();
      process.exit(lintSuccess ? 0 : 1);
    }
    
    if (args.includes('--typecheck') || args.includes('-t')) {
      const typecheckSuccess = await runTypecheck();
      process.exit(typecheckSuccess ? 0 : 1);
    }
    
    // Specific test patterns
    const patternIndex = args.indexOf('--pattern');
    if (patternIndex !== -1 && args[patternIndex + 1]) {
      const pattern = args[patternIndex + 1];
      const testSuccess = await runSpecificTestSuite(pattern);
      await generateCoverageReport();
      process.exit(testSuccess ? 0 : 1);
    }
    
    if (args.includes('--discord')) {
      const testSuccess = await runSpecificTestSuite('commands');
      await generateCoverageReport();
      process.exit(testSuccess ? 0 : 1);
    }
    
    if (args.includes('--handlers')) {
      const testSuccess = await runSpecificTestSuite('handlers');
      await generateCoverageReport();
      process.exit(testSuccess ? 0 : 1);
    }
    
    if (args.includes('--forms')) {
      const testSuccess = await runSpecificTestSuite('Modal|Form');
      await generateCoverageReport();
      process.exit(testSuccess ? 0 : 1);
    }
    
    // Default: run full test suite
    logInfo('Running complete test suite...');
    
    // Optional: run linting first
    if (!args.includes('--no-lint')) {
      await runLinting();
    }
    
    // Optional: run type checking
    if (!args.includes('--no-typecheck')) {
      const typecheckSuccess = await runTypecheck();
      if (!typecheckSuccess) {
        logError('TypeScript compilation failed - aborting tests');
        process.exit(1);
      }
    }
    
    // Run the main test suite
    const testSuccess = await runTests();
    success = success && testSuccess;
    
    // Generate coverage report
    await generateCoverageReport();
    
  } catch (error) {
    logError(`Test runner error: ${error.message}`);
    success = false;
  }
  
  // Summary
  logHeader('Test Summary');
  if (success) {
    logSuccess('All tests completed successfully! 🎉');
    log('\nNext steps:', 'cyan');
    log('• Review coverage report in coverage/index.html');
    log('• Check for any warnings or suggestions above');
    log('• Consider adding more tests for uncovered areas');
  } else {
    logError('Some tests failed or checks did not pass');
    log('\nTroubleshooting:', 'yellow');
    log('• Check test output above for specific failures');
    log('• Ensure all dependencies are installed (npm install)');
    log('• Verify environment variables are set correctly');
    log('• Try running individual test suites to isolate issues');
  }
  
  process.exit(success ? 0 : 1);
}

// Handle process interruption gracefully
process.on('SIGINT', () => {
  log('\n\nTest runner interrupted by user', 'yellow');
  process.exit(130);
});

process.on('unhandledRejection', (error) => {
  logError(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});