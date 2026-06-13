#!/usr/bin/env node

const ClaudeCodeClipboardIntegration = require('./claude-code-integration');
const path = require('path');

const commands = {
  start: async () => {
    console.log('Starting Claude-Code Clipboard Handler...');
    const integration = new ClaudeCodeClipboardIntegration();
    await integration.initialize();
    
    process.on('SIGINT', () => {
      console.log('\nShutting down clipboard handler...');
      integration.stop();
      process.exit(0);
    });
    
    console.log('Clipboard handler is running. Press Ctrl+C to stop.');
    
    // Keep the process alive
    setInterval(() => {}, 1000);
  },

  status: async () => {
    const integration = new ClaudeCodeClipboardIntegration();
    const screenshots = await integration.getScreenshotHistory();
    
    console.log('\n=== Claude-Code Clipboard Handler Status ===');
    console.log(`User directory: ${path.join(require('os').homedir(), '.claude-code')}`);
    console.log(`Screenshots stored: ${screenshots.length}`);
    
    if (screenshots.length > 0) {
      console.log('\nRecent screenshots:');
      screenshots.slice(0, 5).forEach((screenshot, index) => {
        console.log(`  ${index + 1}. ${screenshot.filename} (${screenshot.size} bytes) - ${screenshot.created.toISOString()}`);
      });
    }
  },

  cleanup: async () => {
    const integration = new ClaudeCodeClipboardIntegration();
    const deletedCount = await integration.cleanupOldScreenshots(30);
    console.log(`Cleanup completed. Deleted ${deletedCount} old screenshots.`);
  },

  help: () => {
    console.log(`
Claude-Code Clipboard Handler

Usage: node cli.js <command>

Commands:
  start    - Start the clipboard handler
  status   - Show current status and recent screenshots
  cleanup  - Remove screenshots older than 30 days
  help     - Show this help message

Examples:
  node cli.js start
  node cli.js status
  node cli.js cleanup
`);
  }
};

async function main() {
  const command = process.argv[2] || 'help';
  
  if (commands[command]) {
    try {
      await commands[command]();
    } catch (error) {
      console.error(`Error executing command '${command}':`, error.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    commands.help();
    process.exit(1);
  }
}

main();