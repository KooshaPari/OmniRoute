#!/usr/bin/env node

/**
 * Quick Start Script for Discord Bot Smart Embeds
 * This script helps you set up and test the bot quickly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Discord Bot Smart Embeds - Quick Start Setup\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  
  const envTemplate = `# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here

# Feature Flags (Enable/Disable Features)
ENABLE_PROJECT_ROOMS=true
ENABLE_VOICE_INTEGRATION=true
ENABLE_WORKFLOW_AUTOMATION=true
ENABLE_REAL_TIME_COLLABORATION=true
ENABLE_AI_FEATURES=false

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000

# Optional: External API Integration
# GITHUB_TOKEN=your_github_token
# JIRA_BASE_URL=https://your-domain.atlassian.net
# JIRA_EMAIL=your_email@example.com
# JIRA_API_TOKEN=your_jira_token
# CODA_API_TOKEN=your_coda_token

# Optional: AI/ML Services
# OPENAI_API_KEY=your_openai_key
# SPEECH_TO_TEXT_API_KEY=your_speech_api_key

# Analytics & Monitoring
ANALYTICS_ENABLED=true
PERFORMANCE_MONITORING=true
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ .env file created! Please edit it with your Discord bot token.\n');
}

// Check if node_modules exists
if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Build the project
console.log('🔨 Building the project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Project built successfully!\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.log('💡 Try running: npm run build:dev for development build\n');
}

// Check if Discord token is set
require('dotenv').config();
if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN === 'your_discord_bot_token_here') {
  console.log('⚠️  Discord bot token not configured!');
  console.log('📋 Next steps:');
  console.log('   1. Go to https://discord.com/developers/applications');
  console.log('   2. Create a new application');
  console.log('   3. Go to Bot section and create a bot');
  console.log('   4. Copy the bot token');
  console.log('   5. Edit .env file and replace DISCORD_BOT_TOKEN');
  console.log('   6. Set DISCORD_CLIENT_ID and DISCORD_GUILD_ID');
  console.log('   7. Run: npm start\n');
} else {
  console.log('✅ Discord bot token configured!');
  console.log('🚀 Ready to start the bot!\n');
  
  console.log('📋 Quick commands:');
  console.log('   npm start          - Start the bot');
  console.log('   npm run dev        - Start in development mode');
  console.log('   npm run test:all   - Run all tests');
  console.log('   npm run dashboard  - Open analytics dashboard\n');
  
  // Ask if user wants to start the bot
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('🤖 Would you like to start the bot now? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('🚀 Starting the bot...\n');
      try {
        execSync('npm start', { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
      }
    } else {
      console.log('👍 Bot setup complete! Run "npm start" when ready.');
    }
    rl.close();
  });
}

// Create test commands file
const testCommandsPath = path.join(process.cwd(), 'TEST_COMMANDS.md');
if (!fs.existsSync(testCommandsPath)) {
  const testCommands = `# 🧪 Test Commands for Discord Bot

## Phase 1: Smart Embed Framework
\`\`\`
/test-embed                    # Test basic smart embed
/test-buttons                  # Test action buttons
/test-modal                    # Test modal forms
/test-state                    # Test state management
\`\`\`

## Phase 2: Enhanced Issue Management
\`\`\`
/create-issue-card             # Create smart issue card
/report-bug                    # Open bug report form
/request-feature               # Create feature request
/test-integration              # Test external API integration
\`\`\`

## Phase 3: Advanced Features
\`\`\`
/create-project-room           # Create project room
/start-meeting                 # Start voice meeting
/create-workflow               # Create custom workflow
/start-collaboration           # Start real-time collaboration
\`\`\`

## Analytics & Monitoring
\`\`\`
/advanced-dashboard            # View analytics dashboard
/system-health                 # Check system health
/performance-stats             # View performance metrics
/export-analytics              # Export analytics data
\`\`\`

## Voice Commands (in voice channel)
\`\`\`
"start meeting"                # Start meeting session
"end meeting"                  # End meeting session
"action item: [description]"   # Add action item
"take note: [note]"           # Add meeting note
"meeting summary"              # Generate summary
\`\`\`

## Testing Workflow
1. Start with Phase 1 commands to test basic functionality
2. Progress to Phase 2 for issue management features
3. Test Phase 3 advanced features
4. Use analytics commands to monitor performance
5. Try voice commands in a voice channel

## Troubleshooting Commands
\`\`\`
/debug-info                    # Show debug information
/test-permissions              # Test bot permissions
/validate-config               # Validate configuration
/health-check                  # Run health check
\`\`\`
`;

  fs.writeFileSync(testCommandsPath, testCommands);
  console.log('📝 Test commands guide created: TEST_COMMANDS.md');
}

console.log('\n🎉 Quick start setup complete!');
console.log('📖 Check SETUP_AND_TESTING_GUIDE.md for detailed instructions');
console.log('🧪 Check TEST_COMMANDS.md for testing commands');
