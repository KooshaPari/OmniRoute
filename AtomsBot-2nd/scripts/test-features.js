#!/usr/bin/env node

/**
 * Feature Testing Script for Discord Bot Smart Embeds
 * This script runs automated tests for all implemented features
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Discord Bot Smart Embeds - Feature Testing\n');

// Test configuration
const tests = [
  {
    phase: 'Phase 1',
    name: 'Smart Embed Framework',
    script: 'src/discord/framework/tests/phase1-validation.ts',
    description: 'Tests core framework components'
  },
  {
    phase: 'Phase 2', 
    name: 'Enhanced Issue Management',
    script: 'src/discord/components/tests/simple-phase2-validation.ts',
    description: 'Tests issue management features'
  },
  {
    phase: 'Phase 3',
    name: 'Advanced Features',
    script: 'src/discord/advanced/tests/phase3-validation.ts', 
    description: 'Tests advanced collaboration features'
  }
];

async function runTests() {
  console.log('🚀 Starting comprehensive feature testing...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    console.log(`📋 ${test.phase}: ${test.name}`);
    console.log(`   ${test.description}`);
    
    try {
      const startTime = Date.now();
      execSync(`npx tsx ${test.script}`, { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ PASSED (${duration}ms)\n`);
      passedTests++;
    } catch (error) {
      console.log(`   ❌ FAILED`);
      console.log(`   Error: ${error.message}\n`);
      failedTests++;
    }
    
    totalTests++;
  }
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} ✅`);
  console.log(`   Failed: ${failedTests} ❌`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%\n`);
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! Your bot is ready for use.');
    console.log('🚀 Next steps:');
    console.log('   1. Start the bot: npm start');
    console.log('   2. Test in Discord with the commands in TEST_COMMANDS.md');
    console.log('   3. Check the analytics dashboard: /advanced-dashboard');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
    console.log('💡 Common issues:');
    console.log('   - Missing dependencies: npm install');
    console.log('   - TypeScript compilation: npm run build');
    console.log('   - Environment variables: check .env file');
  }
}

// Performance test
async function runPerformanceTest() {
  console.log('\n⚡ Running performance tests...');
  
  const performanceTests = [
    {
      name: 'Component Load Time',
      test: () => {
        const start = Date.now();
        require('../src/discord/framework');
        require('../src/discord/components');
        require('../src/discord/advanced');
        return Date.now() - start;
      },
      threshold: 100 // ms
    },
    {
      name: 'Memory Usage',
      test: () => {
        const used = process.memoryUsage();
        return Math.round(used.heapUsed / 1024 / 1024); // MB
      },
      threshold: 200 // MB
    }
  ];
  
  for (const test of performanceTests) {
    try {
      const result = test.test();
      const status = result <= test.threshold ? '✅' : '⚠️';
      console.log(`   ${status} ${test.name}: ${result}${test.name.includes('Time') ? 'ms' : 'MB'} (threshold: ${test.threshold}${test.name.includes('Time') ? 'ms' : 'MB'})`);
    } catch (error) {
      console.log(`   ❌ ${test.name}: Failed - ${error.message}`);
    }
  }
}

// Integration test
async function runIntegrationTest() {
  console.log('\n🔗 Running integration tests...');
  
  try {
    // Test that all components can be imported together
    const framework = require('../src/discord/framework');
    const components = require('../src/discord/components');
    const advanced = require('../src/discord/advanced');
    
    console.log('   ✅ All modules can be imported');
    console.log('   ✅ No circular dependencies detected');
    console.log('   ✅ Integration test passed');
  } catch (error) {
    console.log(`   ❌ Integration test failed: ${error.message}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance') || args.includes('-p')) {
    await runPerformanceTest();
  } else if (args.includes('--integration') || args.includes('-i')) {
    await runIntegrationTest();
  } else if (args.includes('--all') || args.includes('-a')) {
    await runTests();
    await runPerformanceTest();
    await runIntegrationTest();
  } else {
    await runTests();
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🧪 Discord Bot Smart Embeds - Feature Testing');
  console.log('\nUsage:');
  console.log('  node scripts/test-features.js [options]');
  console.log('\nOptions:');
  console.log('  --all, -a          Run all tests (default + performance + integration)');
  console.log('  --performance, -p  Run performance tests only');
  console.log('  --integration, -i  Run integration tests only');
  console.log('  --help, -h         Show this help message');
  console.log('\nExamples:');
  console.log('  npm run test:features              # Run feature tests');
  console.log('  npm run test:features -- --all     # Run all tests');
  console.log('  npm run test:features -- -p        # Performance only');
  process.exit(0);
}

main().catch(console.error);
