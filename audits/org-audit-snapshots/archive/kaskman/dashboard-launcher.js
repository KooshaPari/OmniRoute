#!/usr/bin/env node

/**
 * Dashboard Launcher - Unified entry point for R&D Project Management Dashboard
 * Coordinates TUI and Web interfaces with real-time synchronization
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

class DashboardLauncher {
    constructor() {
        this.processes = new Map();
        this.isRunning = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.setupSignalHandlers();
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down dashboard system...');
            this.stopAll();
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down...');
            this.stopAll();
        });
    }

    showBanner() {
        console.clear();
        console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   🔬 R&D PROJECT MANAGEMENT DASHBOARD SYSTEM                                  ║
║                                                                               ║
║   🚀 Persistent Research & Development Platform                               ║
║   🤖 Multi-Agent Swarm Coordination                                          ║
║   📊 Real-time Project Monitoring                                            ║
║   🎯 Interactive Proposal Review                                             ║
║                                                                               ║
║   Agent-4: Dashboard Manager                                                  ║
║   Status: Online and Ready                                                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
    }

    showMenu() {
        console.log(`
🎮 Dashboard Launch Options:

  1. 🖥️  Launch TUI Dashboard (Terminal Interface)
  2. 🌐 Launch Web Dashboard (Browser Interface)
  3. 🔗 Launch Both (TUI + Web)
  4. 📊 Launch Web Server Only
  5. 🔧 System Configuration
  6. 📈 View System Status
  7. 🗂️  Data Management
  8. ❌ Exit

📋 Quick Commands:
  • tui        - Launch TUI dashboard
  • web        - Launch web dashboard
  • both       - Launch both interfaces
  • server     - Launch web server only
  • status     - Show system status
  • config     - System configuration
  • data       - Data management
  • help       - Show this menu
  • exit       - Exit launcher

`);
    }

    async promptUser() {
        return new Promise((resolve) => {
            this.rl.question('🎯 Select option (1-8 or command): ', (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    }

    async launchTUI() {
        console.log('\n🖥️  Launching TUI Dashboard...');
        
        // Check if blessed is available
        if (!this.checkDependencies(['blessed'])) {
            console.log('📦 Installing required dependencies...');
            await this.installDependencies();
        }

        const tuiProcess = spawn('node', [path.join(__dirname, 'dashboard-tui.js')], {
            stdio: 'inherit',
            cwd: __dirname
        });

        this.processes.set('tui', tuiProcess);

        tuiProcess.on('close', (code) => {
            console.log(`\n🖥️  TUI Dashboard closed with code ${code}`);
            this.processes.delete('tui');
        });

        tuiProcess.on('error', (error) => {
            console.error('❌ Error launching TUI:', error.message);
            this.processes.delete('tui');
        });
    }

    async launchWeb() {
        console.log('\n🌐 Launching Web Dashboard...');
        
        // Check if web dependencies are available
        if (!this.checkDependencies(['express', 'cors', 'ws'])) {
            console.log('📦 Installing required dependencies...');
            await this.installDependencies();
        }

        const webProcess = spawn('node', [path.join(__dirname, 'dashboard-server.js')], {
            stdio: 'inherit',
            cwd: __dirname
        });

        this.processes.set('web', webProcess);

        webProcess.on('close', (code) => {
            console.log(`\n🌐 Web Dashboard closed with code ${code}`);
            this.processes.delete('web');
        });

        webProcess.on('error', (error) => {
            console.error('❌ Error launching Web Dashboard:', error.message);
            this.processes.delete('web');
        });

        // Wait a moment for server to start
        setTimeout(() => {
            console.log('\n🎯 Web Dashboard should be available at: http://localhost:3000');
            console.log('🔗 Opening browser automatically...');
            this.openBrowser('http://localhost:3000');
        }, 2000);
    }

    async launchBoth() {
        console.log('\n🔗 Launching Both TUI and Web Dashboards...');
        
        // Launch web server first
        await this.launchWeb();
        
        // Wait for web server to start
        setTimeout(async () => {
            console.log('\n🔄 Now launching TUI Dashboard...');
            await this.launchTUI();
        }, 3000);
    }

    async launchServerOnly() {
        console.log('\n📊 Launching Web Server Only (no browser)...');
        
        if (!this.checkDependencies(['express', 'cors', 'ws'])) {
            console.log('📦 Installing required dependencies...');
            await this.installDependencies();
        }

        const serverProcess = spawn('node', [path.join(__dirname, 'dashboard-server.js')], {
            stdio: 'inherit',
            cwd: __dirname
        });

        this.processes.set('server', serverProcess);

        serverProcess.on('close', (code) => {
            console.log(`\n📊 Web Server closed with code ${code}`);
            this.processes.delete('server');
        });

        serverProcess.on('error', (error) => {
            console.error('❌ Error launching Web Server:', error.message);
            this.processes.delete('server');
        });
    }

    checkDependencies(deps) {
        for (const dep of deps) {
            try {
                require.resolve(dep);
            } catch (error) {
                return false;
            }
        }
        return true;
    }

    async installDependencies() {
        return new Promise((resolve, reject) => {
            console.log('📦 Installing dependencies: blessed, express, cors, ws...');
            
            const installProcess = spawn('npm', ['install', 'blessed', 'express', 'cors', 'ws'], {
                stdio: 'inherit',
                cwd: __dirname
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Dependencies installed successfully!');
                    resolve();
                } else {
                    console.error('❌ Failed to install dependencies');
                    reject(new Error(`npm install failed with code ${code}`));
                }
            });

            installProcess.on('error', (error) => {
                console.error('❌ Error installing dependencies:', error.message);
                reject(error);
            });
        });
    }

    openBrowser(url) {
        const { spawn } = require('child_process');
        const platform = process.platform;
        
        let command;
        if (platform === 'darwin') {
            command = 'open';
        } else if (platform === 'win32') {
            command = 'start';
        } else {
            command = 'xdg-open';
        }

        try {
            spawn(command, [url], { detached: true, stdio: 'ignore' });
        } catch (error) {
            console.log(`🔗 Please open your browser and navigate to: ${url}`);
        }
    }

    showSystemStatus() {
        console.log('\n📈 System Status:');
        console.log('═══════════════════════════════════════════════════════════');
        
        console.log(`📊 Dashboard System: ${this.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
        console.log(`🖥️  TUI Process: ${this.processes.has('tui') ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`🌐 Web Process: ${this.processes.has('web') ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`📊 Server Process: ${this.processes.has('server') ? '🟢 Active' : '🔴 Inactive'}`);
        
        console.log('\n📂 File System:');
        const files = [
            'dashboard-tui.js',
            'dashboard-web.html',
            'dashboard-web.css',
            'dashboard-web.js',
            'dashboard-server.js',
            'package.json'
        ];
        
        files.forEach(file => {
            const exists = fs.existsSync(path.join(__dirname, file));
            console.log(`   ${exists ? '✅' : '❌'} ${file}`);
        });
        
        console.log('\n🔧 Dependencies:');
        const deps = ['blessed', 'express', 'cors', 'ws'];
        deps.forEach(dep => {
            const available = this.checkDependencies([dep]);
            console.log(`   ${available ? '✅' : '❌'} ${dep}`);
        });
        
        console.log('\n💾 Data Files:');
        const dataFiles = ['dashboard-data.json', 'projects.json'];
        dataFiles.forEach(file => {
            const exists = fs.existsSync(path.join(__dirname, file));
            console.log(`   ${exists ? '✅' : '❌'} ${file}`);
        });
    }

    async configureSystem() {
        console.log('\n🔧 System Configuration:');
        console.log('═══════════════════════════════════════════════════════════');
        
        const config = {
            version: '1.0.0',
            interfaces: {
                tui: {
                    enabled: true,
                    theme: 'default',
                    refreshInterval: 5000
                },
                web: {
                    enabled: true,
                    port: 3000,
                    host: 'localhost',
                    autoOpenBrowser: true
                }
            },
            features: {
                realTimeUpdates: true,
                webSocketSupport: true,
                dataSync: true,
                autoSave: true
            },
            agents: {
                maxAgents: 5,
                coordinationMode: 'centralized',
                swarmStrategy: 'research'
            }
        };
        
        console.log(JSON.stringify(config, null, 2));
        
        const configPath = path.join(__dirname, 'dashboard-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`\n✅ Configuration saved to: ${configPath}`);
    }

    async manageData() {
        console.log('\n🗂️  Data Management:');
        console.log('═══════════════════════════════════════════════════════════');
        
        const dataPath = path.join(__dirname, 'dashboard-data.json');
        const projectsPath = path.join(__dirname, 'projects.json');
        
        console.log('📊 Data Files:');
        
        if (fs.existsSync(dataPath)) {
            const stats = fs.statSync(dataPath);
            console.log(`✅ dashboard-data.json (${stats.size} bytes, modified: ${stats.mtime.toLocaleString()})`);
        } else {
            console.log('❌ dashboard-data.json (not found)');
        }
        
        if (fs.existsSync(projectsPath)) {
            const stats = fs.statSync(projectsPath);
            console.log(`✅ projects.json (${stats.size} bytes, modified: ${stats.mtime.toLocaleString()})`);
        } else {
            console.log('❌ projects.json (not found)');
        }
        
        console.log('\n🔄 Data Operations:');
        console.log('1. Backup current data');
        console.log('2. Clear all data');
        console.log('3. Reset to sample data');
        console.log('4. Return to main menu');
        
        const choice = await this.promptUser();
        
        switch (choice) {
            case '1':
                this.backupData();
                break;
            case '2':
                this.clearData();
                break;
            case '3':
                this.resetToSampleData();
                break;
            case '4':
                return;
        }
    }

    backupData() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        
        const files = ['dashboard-data.json', 'projects.json'];
        files.forEach(file => {
            const sourcePath = path.join(__dirname, file);
            if (fs.existsSync(sourcePath)) {
                const backupPath = path.join(backupDir, `${file}-${timestamp}`);
                fs.copyFileSync(sourcePath, backupPath);
                console.log(`✅ Backed up ${file} to ${backupPath}`);
            }
        });
    }

    clearData() {
        const files = ['dashboard-data.json', 'projects.json'];
        files.forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted ${file}`);
            }
        });
        console.log('✅ All data cleared');
    }

    resetToSampleData() {
        const sampleData = {
            projects: {
                'proj-001': {
                    id: 'proj-001',
                    name: 'Alpha Research Initiative',
                    description: 'Advanced research into emerging technologies',
                    type: 'research',
                    status: 'active',
                    priority: 'high',
                    progress: 75,
                    team: ['Agent-1', 'Agent-2'],
                    startDate: '2024-01-15',
                    dueDate: '2024-03-15',
                    lastUpdated: new Date().toISOString()
                }
            },
            proposals: [
                {
                    id: 'prop-001',
                    title: 'Delta Innovation Project',
                    summary: 'Innovative approach to solving complex optimization problems',
                    priority: 'high',
                    status: 'pending',
                    agent: 'Agent-3',
                    submittedDate: '2024-02-15',
                    estimatedDuration: '6 weeks',
                    resourceRequirements: 'High computational power, 3 agents',
                    expectedOutcomes: 'New algorithm implementation, performance improvements',
                    technicalDetails: 'Quantum-inspired optimization algorithms'
                }
            ],
            agents: [
                {
                    id: 'agent-001',
                    name: 'Agent-1',
                    role: 'System Architect',
                    status: 'active',
                    currentTask: 'Designing system architecture',
                    capabilities: ['Architecture Design', 'System Integration', 'Performance Optimization'],
                    workload: 75
                }
            ],
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(path.join(__dirname, 'dashboard-data.json'), JSON.stringify(sampleData, null, 2));
        console.log('✅ Sample data restored');
    }

    stopAll() {
        console.log('\n🛑 Stopping all dashboard processes...');
        
        this.processes.forEach((process, name) => {
            console.log(`🔴 Stopping ${name}...`);
            process.kill('SIGINT');
        });
        
        this.processes.clear();
        this.isRunning = false;
        
        setTimeout(() => {
            console.log('✅ All processes stopped');
            this.rl.close();
            process.exit(0);
        }, 1000);
    }

    async run() {
        this.showBanner();
        this.isRunning = true;
        
        while (this.isRunning) {
            this.showMenu();
            const choice = await this.promptUser();
            
            try {
                switch (choice) {
                    case '1':
                    case 'tui':
                        await this.launchTUI();
                        break;
                    case '2':
                    case 'web':
                        await this.launchWeb();
                        break;
                    case '3':
                    case 'both':
                        await this.launchBoth();
                        break;
                    case '4':
                    case 'server':
                        await this.launchServerOnly();
                        break;
                    case '5':
                    case 'config':
                        await this.configureSystem();
                        break;
                    case '6':
                    case 'status':
                        this.showSystemStatus();
                        break;
                    case '7':
                    case 'data':
                        await this.manageData();
                        break;
                    case '8':
                    case 'exit':
                        this.stopAll();
                        return;
                    case 'help':
                        // Menu will be shown again
                        break;
                    default:
                        console.log('❌ Invalid option. Please try again.');
                }
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
            
            if (this.isRunning) {
                console.log('\n⏸️  Press Enter to continue...');
                await this.promptUser();
            }
        }
    }
}

// Run the launcher
if (require.main === module) {
    const launcher = new DashboardLauncher();
    launcher.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = DashboardLauncher;