#!/bin/bash

# Discord Bot Remote Deployment Script
# This script sets up and deploys the Discord bot on a remote PC

set -e  # Exit on any error

echo "🚀 Starting Discord Bot Remote Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js $(node --version) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm $(npm --version) detected"

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build the project
print_status "Building the project..."
npm run build

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << 'EOF'
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here

# Jira Configuration (Optional)
JIRA_HOST=your_jira_host_here
JIRA_EMAIL=your_jira_email_here
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=your_jira_project_key_here

# Coda Configuration (Optional)
CODA_API_TOKEN=your_coda_api_token_here
CODA_DOC_ID=your_coda_doc_id_here

# Server Configuration
PORT=3000
NODE_ENV=production
EOF
    print_warning "Please edit .env file with your actual configuration values"
    print_warning "The bot will not work until you configure the environment variables"
fi

# Create systemd service file for Linux systems
if command -v systemctl &> /dev/null; then
    print_status "Creating systemd service file..."
    
    # Get current directory
    CURRENT_DIR=$(pwd)
    USER=$(whoami)
    
    sudo tee /etc/systemd/system/discord-bot.service > /dev/null << EOF
[Unit]
Description=Discord Bot Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    print_success "Systemd service file created at /etc/systemd/system/discord-bot.service"
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable discord-bot
    
    print_success "Discord bot service enabled"
    print_status "You can now use the following commands:"
    echo "  sudo systemctl start discord-bot    # Start the bot"
    echo "  sudo systemctl stop discord-bot     # Stop the bot"
    echo "  sudo systemctl restart discord-bot  # Restart the bot"
    echo "  sudo systemctl status discord-bot   # Check bot status"
    echo "  journalctl -u discord-bot -f        # View bot logs"
fi

# Create PM2 ecosystem file for PM2 process manager
print_status "Creating PM2 ecosystem file..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'discord-bot',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

print_success "PM2 ecosystem file created"

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    print_status "PM2 detected. You can use PM2 to manage the bot:"
    echo "  pm2 start ecosystem.config.js  # Start the bot"
    echo "  pm2 stop discord-bot           # Stop the bot"
    echo "  pm2 restart discord-bot        # Restart the bot"
    echo "  pm2 logs discord-bot           # View bot logs"
    echo "  pm2 monit                      # Monitor bot performance"
else
    print_warning "PM2 not installed. Install with: npm install -g pm2"
fi

# Create start script
print_status "Creating start script..."
cat > start-bot.sh << 'EOF'
#!/bin/bash

# Simple start script for the Discord bot
echo "🚀 Starting Discord Bot..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create and configure it first."
    exit 1
fi

# Start the bot
node server.js
EOF

chmod +x start-bot.sh

print_success "Start script created (start-bot.sh)"

# Create deployment info
print_status "Creating deployment information..."
cat > DEPLOYMENT_INFO.md << 'EOF'
# Discord Bot Deployment Information

## Server Details
- **Server Type**: Node.js Express Server
- **Port**: 3000 (configurable via PORT environment variable)
- **Process Manager**: Systemd service or PM2

## Endpoints
- `GET /` - Server status and endpoint list
- `GET /health` - Health check
- `POST /api/discord/interactions` - Discord interactions
- `POST /api/webhooks/github` - GitHub webhooks
- `POST /api/webhooks/jira` - Jira webhooks

## Management Commands

### Using Systemd (Linux)
```bash
sudo systemctl start discord-bot     # Start the bot
sudo systemctl stop discord-bot      # Stop the bot
sudo systemctl restart discord-bot   # Restart the bot
sudo systemctl status discord-bot    # Check status
journalctl -u discord-bot -f         # View logs
```

### Using PM2
```bash
pm2 start ecosystem.config.js        # Start the bot
pm2 stop discord-bot                 # Stop the bot
pm2 restart discord-bot              # Restart the bot
pm2 logs discord-bot                 # View logs
pm2 monit                            # Monitor performance
```

### Manual Start
```bash
./start-bot.sh                       # Simple start script
# OR
node server.js                       # Direct start
```

## Configuration
Edit the `.env` file with your actual values before starting the bot.

## Logs
- Systemd logs: `journalctl -u discord-bot`
- PM2 logs: `./logs/` directory
- Manual logs: Console output

## Discord Application Setup
1. Set your Discord application's Interactions Endpoint URL to:
   `http://your-server-ip:3000/api/discord/interactions`
2. Make sure your server is accessible from the internet
3. Consider using a reverse proxy (nginx) for production
EOF

print_success "Deployment completed successfully!"
print_status "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Configure Discord application Interactions Endpoint URL"
echo "3. Start the bot using one of the management methods above"
echo "4. Check logs to ensure everything is working"

print_warning "Important: Make sure port 3000 is accessible from the internet for Discord interactions"
print_warning "Consider setting up a reverse proxy (nginx) and SSL certificate for production use"
