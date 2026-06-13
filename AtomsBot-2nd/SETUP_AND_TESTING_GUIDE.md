# 🚀 Discord Bot Smart Embeds - Setup & Testing Guide

## 📋 **Prerequisites**

### Required Software
- **Node.js**: v18.0.0 or higher
- **npm/yarn/bun**: Latest version
- **TypeScript**: v5.0.0 or higher
- **Discord.js**: v14.0.0 or higher

### Discord Requirements
- **Discord Bot Token**: From Discord Developer Portal
- **Guild (Server) Access**: Admin permissions for testing
- **Voice Channel Access**: For voice integration features

---

## 🔧 **Environment Variables Setup**

Create a `.env` file in your project root with the following variables:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here

# Database Configuration (Optional - uses in-memory by default)
DATABASE_URL=postgresql://user:password@localhost:5432/atomsbot
REDIS_URL=redis://localhost:6379

# External API Integration (Optional)
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO_OWNER=your_github_username
GITHUB_REPO_NAME=your_repository_name

JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_jira_email@example.com
JIRA_API_TOKEN=your_jira_api_token

CODA_API_TOKEN=your_coda_api_token
CODA_DOC_ID=your_coda_document_id

# AI/ML Services (Optional - for advanced features)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Voice Integration (Optional)
SPEECH_TO_TEXT_API_KEY=your_speech_api_key
SPEECH_TO_TEXT_PROVIDER=openai # or google, azure, aws

# Analytics & Monitoring (Optional)
ANALYTICS_ENABLED=true
PERFORMANCE_MONITORING=true
ERROR_REPORTING_DSN=your_sentry_dsn

# Feature Flags
ENABLE_PROJECT_ROOMS=true
ENABLE_VOICE_INTEGRATION=true
ENABLE_WORKFLOW_AUTOMATION=true
ENABLE_REAL_TIME_COLLABORATION=true
ENABLE_AI_FEATURES=true

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
```

---

## 🛠️ **Installation & Setup**

### 1. Install Dependencies
```bash
# Using npm
npm install

# Using yarn
yarn install

# Using bun
bun install
```

### 2. Build the Project
```bash
# Compile TypeScript
npm run build

# Or for development with watch mode
npm run dev
```

### 3. Database Setup (Optional)
```bash
# If using PostgreSQL
npm run db:migrate
npm run db:seed

# If using in-memory storage (default)
# No additional setup required
```

### 4. Discord Bot Setup

#### Create Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "AtomsBot Enhanced")
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the bot token to your `.env` file

#### Set Bot Permissions
Required permissions for full functionality:
- `Send Messages`
- `Use Slash Commands`
- `Manage Messages`
- `Manage Threads`
- `Create Public Threads`
- `Create Private Threads`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Use Voice Activity`
- `Connect` (for voice features)
- `Speak` (for voice features)

#### Invite Bot to Server
1. Go to "OAuth2" > "URL Generator"
2. Select "bot" and "applications.commands" scopes
3. Select the permissions listed above
4. Copy the generated URL and invite the bot to your test server

---

## 🧪 **Testing Guide**

### Phase 1: Smart Embed Framework Testing

#### Test 1: Basic Smart Embed
```bash
# Start the bot
npm start

# In Discord, use slash command:
/test-embed
```

**Expected Result**: Interactive embed with buttons and auto-refresh

#### Test 2: Action Buttons
```bash
# Click buttons on the embed
# Try different button types: Primary, Secondary, Success, Danger
```

**Expected Result**: Button interactions work with proper cooldowns

#### Test 3: Modal Forms
```bash
# Use command that opens a modal
/create-issue

# Fill out the multi-step form
```

**Expected Result**: Multi-step form with validation

### Phase 2: Enhanced Issue Management Testing

#### Test 4: Smart Issue Cards
```bash
# Create an issue
/create-issue-card

# Interact with the issue card:
# - Change status
# - Update priority
# - Assign users
# - Add comments
```

**Expected Result**: Real-time updates on issue card

#### Test 5: Bug Report Forms
```bash
# Open bug report form
/report-bug

# Try different templates:
# - UI Bug
# - Backend Bug
# - Performance Bug
# - Security Bug
```

**Expected Result**: Template-specific forms with validation

#### Test 6: Feature Request Workflow
```bash
# Create feature request
/request-feature

# Vote on existing requests
# Check approval workflow
```

**Expected Result**: Voting system with approval process

### Phase 3: Advanced Features Testing

#### Test 7: Project Rooms
```bash
# Create a project room
/create-project-room

# Select template:
# - Development
# - Design
# - Research
# - Support

# Test auto-thread creation
```

**Expected Result**: Project room with organized threads

#### Test 8: Voice Integration
```bash
# Join a voice channel
# Start a meeting
/start-meeting

# Try voice commands:
# - "start meeting"
# - "end meeting"
# - "action item: [description]"
# - "take note: [note]"
# - "meeting summary"
```

**Expected Result**: Meeting automation with transcription

#### Test 9: Workflow Automation
```bash
# Create custom workflow
/create-workflow

# Test triggers:
# - Send message with "bug" keyword
# - React to messages
# - Join voice channel
```

**Expected Result**: Automated actions based on triggers

#### Test 10: Real-Time Collaboration
```bash
# Start collaboration session
/start-collaboration

# Invite multiple users
# Test simultaneous editing
# Create conflicts and resolve them
```

**Expected Result**: Live cursors and conflict resolution

---

## 🔍 **Debugging & Troubleshooting**

### Common Issues

#### Bot Not Responding
```bash
# Check bot token
echo $DISCORD_BOT_TOKEN

# Check bot permissions in Discord server
# Verify bot is online in Discord

# Check logs
npm run logs
```

#### Database Connection Issues
```bash
# Test database connection
npm run db:test

# Check database URL
echo $DATABASE_URL

# Reset database (development only)
npm run db:reset
```

#### Voice Features Not Working
```bash
# Check voice permissions
# Verify SPEECH_TO_TEXT_API_KEY is set
# Test voice channel access

# Enable voice debugging
export LOG_LEVEL=debug
npm start
```

### Debug Commands

#### Enable Debug Mode
```bash
# Set environment variable
export NODE_ENV=development
export LOG_LEVEL=debug

# Start with debug logging
npm run dev:debug
```

#### Test Individual Components
```bash
# Test Phase 1 components
npm run test:phase1

# Test Phase 2 components
npm run test:phase2

# Test Phase 3 components
npm run test:phase3

# Test all components
npm run test:all
```

#### Performance Testing
```bash
# Run performance benchmarks
npm run benchmark

# Test with multiple concurrent users
npm run load-test

# Monitor memory usage
npm run monitor
```

---

## 📊 **Monitoring & Analytics**

### Built-in Dashboard
```bash
# Access analytics dashboard
/advanced-dashboard

# View system health
/system-health

# Export analytics data
/export-analytics
```

### Performance Monitoring
```bash
# Check component load times
/performance-stats

# View real-time metrics
/real-time-metrics

# System resource usage
/resource-usage
```

---

## 🎯 **Feature Testing Checklist**

### ✅ Phase 1 - Smart Embed Framework
- [ ] Smart embeds render correctly
- [ ] Action buttons respond to clicks
- [ ] Modal forms open and validate input
- [ ] State management persists data
- [ ] Auto-refresh works properly

### ✅ Phase 2 - Enhanced Issue Management
- [ ] Issue cards display all information
- [ ] Status updates work in real-time
- [ ] Bug report forms validate correctly
- [ ] Feature requests can be voted on
- [ ] External API integration works

### ✅ Phase 3 - Advanced Features
- [ ] Project rooms create threads automatically
- [ ] Voice meetings start and record properly
- [ ] Workflows trigger on correct events
- [ ] Real-time collaboration shows live cursors
- [ ] Cross-feature integration works seamlessly

---

## 🚀 **Production Deployment**

### Environment Setup
```bash
# Set production environment
export NODE_ENV=production

# Disable debug logging
export LOG_LEVEL=info

# Enable performance monitoring
export PERFORMANCE_MONITORING=true
```

### Health Checks
```bash
# Verify all systems
npm run health-check

# Test external API connections
npm run api-test

# Validate configuration
npm run config-validate
```

---

## 📞 **Support & Documentation**

### Additional Resources
- **API Documentation**: `/docs/api`
- **Component Reference**: `/docs/components`
- **Integration Guide**: `/docs/integration`
- **Best Practices**: `/docs/best-practices`

### Getting Help
- **Debug Logs**: Check console output for detailed error messages
- **Test Commands**: Use built-in test commands to isolate issues
- **Performance Metrics**: Monitor system health through dashboard
- **Configuration Validation**: Verify all environment variables are set correctly

---

**Ready to test!** 🎉 Start with Phase 1 basic features and progressively test advanced functionality. Each phase builds upon the previous one, so ensure earlier phases work before testing advanced features.
