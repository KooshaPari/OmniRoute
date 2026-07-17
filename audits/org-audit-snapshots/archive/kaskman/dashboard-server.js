#!/usr/bin/env node

/**
 * Web Server for R&D Project Management Dashboard
 * Serves the web UI and provides real-time API endpoints
 */

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const http = require('http');

class DashboardServer {
    constructor(options = {}) {
        this.port = options.port || 3000;
        this.host = options.host || 'localhost';
        this.isDev = options.dev || false;
        
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.clients = new Set();
        this.projectData = new Map();
        this.proposals = [];
        this.agents = [];
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.loadData();
        this.startBroadcastLoop();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(__dirname));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            if (this.isDev) {
                console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            }
            next();
        });
    }

    setupRoutes() {
        // Serve main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'dashboard-web.html'));
        });

        // API Routes
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                services: {
                    dashboard: 'online',
                    websocket: 'online',
                    api: 'online'
                }
            });
        });

        this.app.get('/api/projects', (req, res) => {
            res.json({
                projects: Array.from(this.projectData.values()),
                total: this.projectData.size
            });
        });

        this.app.get('/api/projects/:id', (req, res) => {
            const project = this.projectData.get(req.params.id);
            if (project) {
                res.json(project);
            } else {
                res.status(404).json({ error: 'Project not found' });
            }
        });

        this.app.post('/api/projects', (req, res) => {
            const projectId = `proj-${Date.now()}`;
            const project = {
                id: projectId,
                ...req.body,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            this.projectData.set(projectId, project);
            this.saveData();
            this.broadcastUpdate('project_created', project);
            
            res.status(201).json(project);
        });

        this.app.put('/api/projects/:id', (req, res) => {
            const project = this.projectData.get(req.params.id);
            if (project) {
                const updatedProject = {
                    ...project,
                    ...req.body,
                    lastUpdated: new Date().toISOString()
                };
                
                this.projectData.set(req.params.id, updatedProject);
                this.saveData();
                this.broadcastUpdate('project_updated', updatedProject);
                
                res.json(updatedProject);
            } else {
                res.status(404).json({ error: 'Project not found' });
            }
        });

        this.app.delete('/api/projects/:id', (req, res) => {
            if (this.projectData.has(req.params.id)) {
                this.projectData.delete(req.params.id);
                this.saveData();
                this.broadcastUpdate('project_deleted', { id: req.params.id });
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Project not found' });
            }
        });

        this.app.get('/api/proposals', (req, res) => {
            res.json({
                proposals: this.proposals,
                total: this.proposals.length
            });
        });

        this.app.post('/api/proposals/:id/approve', (req, res) => {
            const proposal = this.proposals.find(p => p.id === req.params.id);
            if (proposal) {
                proposal.status = 'approved';
                proposal.approvedAt = new Date().toISOString();
                
                // Create project from approved proposal
                const newProject = {
                    id: `proj-${Date.now()}`,
                    name: proposal.title,
                    description: proposal.summary,
                    type: 'research',
                    status: 'pending',
                    priority: proposal.priority,
                    progress: 0,
                    team: [proposal.agent],
                    startDate: new Date().toISOString().split('T')[0],
                    lastUpdated: new Date().toISOString()
                };

                this.projectData.set(newProject.id, newProject);
                this.saveData();
                this.broadcastUpdate('proposal_approved', { proposal, project: newProject });
                
                res.json({ proposal, project: newProject });
            } else {
                res.status(404).json({ error: 'Proposal not found' });
            }
        });

        this.app.post('/api/proposals/:id/reject', (req, res) => {
            const proposal = this.proposals.find(p => p.id === req.params.id);
            if (proposal) {
                proposal.status = 'rejected';
                proposal.rejectedAt = new Date().toISOString();
                proposal.rejectionReason = req.body.reason || 'No reason provided';
                
                this.saveData();
                this.broadcastUpdate('proposal_rejected', proposal);
                
                res.json(proposal);
            } else {
                res.status(404).json({ error: 'Proposal not found' });
            }
        });

        this.app.get('/api/agents', (req, res) => {
            res.json({
                agents: this.agents,
                total: this.agents.length
            });
        });

        this.app.get('/api/metrics', (req, res) => {
            res.json({
                timestamp: new Date().toISOString(),
                system: {
                    responseTime: Math.floor(Math.random() * 100) + 50,
                    throughput: Math.floor(Math.random() * 200) + 400,
                    errorRate: Math.random() * 0.1,
                    uptime: 99.95
                },
                resources: {
                    cpu: Math.floor(Math.random() * 40) + 60,
                    memory: Math.floor(Math.random() * 30) + 50,
                    storage: Math.floor(Math.random() * 20) + 20
                },
                tasks: {
                    pending: Math.floor(Math.random() * 5) + 1,
                    inProgress: Math.floor(Math.random() * 3) + 1,
                    completed: Math.floor(Math.random() * 50) + 100,
                    failed: Math.floor(Math.random() * 2)
                }
            });
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            this.clients.add(ws);
            console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);
            
            // Send initial data
            ws.send(JSON.stringify({
                type: 'initial_data',
                data: {
                    projects: Array.from(this.projectData.values()),
                    proposals: this.proposals,
                    agents: this.agents
                }
            }));

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log('WebSocket client disconnected');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
    }

    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
            case 'subscribe':
                // Handle subscription to specific data types
                ws.subscriptions = data.subscriptions || [];
                break;
            case 'request_update':
                // Send current data
                ws.send(JSON.stringify({
                    type: 'data_update',
                    data: {
                        projects: Array.from(this.projectData.values()),
                        proposals: this.proposals,
                        agents: this.agents
                    }
                }));
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    broadcastUpdate(type, data) {
        const message = JSON.stringify({
            type: 'update',
            updateType: type,
            data: data,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    loadData() {
        try {
            const dataFile = path.join(__dirname, 'dashboard-data.json');
            if (fs.existsSync(dataFile)) {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                this.projectData = new Map(Object.entries(data.projects || {}));
                this.proposals = data.proposals || [];
                this.agents = data.agents || [];
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }

        // Initialize with sample data if empty
        if (this.projectData.size === 0) {
            this.initializeSampleData();
        }
    }

    initializeSampleData() {
        // Sample projects
        this.projectData.set('proj-001', {
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
        });

        this.projectData.set('proj-002', {
            id: 'proj-002',
            name: 'Beta Development Platform',
            description: 'Next-generation development tools',
            type: 'development',
            status: 'active',
            priority: 'medium',
            progress: 45,
            team: ['Agent-3', 'Agent-4'],
            startDate: '2024-02-01',
            dueDate: '2024-04-01',
            lastUpdated: new Date().toISOString()
        });

        // Sample proposals
        this.proposals = [
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
                technicalDetails: 'Quantum-inspired optimization algorithms with ML integration'
            }
        ];

        // Sample agents
        this.agents = [
            {
                id: 'agent-001',
                name: 'Agent-1',
                role: 'System Architect',
                status: 'active',
                currentTask: 'Designing system architecture',
                capabilities: ['Architecture Design', 'System Integration', 'Performance Optimization'],
                workload: 75
            },
            {
                id: 'agent-002',
                name: 'Agent-2',
                role: 'Research Specialist',
                status: 'active',
                currentTask: 'Analyzing data sources',
                capabilities: ['Data Analysis', 'Research Coordination', 'Report Generation'],
                workload: 60
            },
            {
                id: 'agent-003',
                name: 'Agent-3',
                role: 'Development Lead',
                status: 'active',
                currentTask: 'Building core components',
                capabilities: ['Software Development', 'Code Review', 'Testing'],
                workload: 85
            },
            {
                id: 'agent-004',
                name: 'Agent-4',
                role: 'Dashboard Manager',
                status: 'active',
                currentTask: 'Managing dashboard interfaces',
                capabilities: ['UI/UX Design', 'Data Visualization', 'User Experience'],
                workload: 50
            },
            {
                id: 'agent-005',
                name: 'Agent-5',
                role: 'Task Coordinator',
                status: 'active',
                currentTask: 'Orchestrating agent tasks',
                capabilities: ['Task Management', 'Agent Coordination', 'Resource Allocation'],
                workload: 70
            }
        ];

        this.saveData();
    }

    saveData() {
        try {
            const data = {
                projects: Object.fromEntries(this.projectData),
                proposals: this.proposals,
                agents: this.agents,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(path.join(__dirname, 'dashboard-data.json'), JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    startBroadcastLoop() {
        // Broadcast updates every 10 seconds
        setInterval(() => {
            // Update agent workloads (simulate activity)
            this.agents.forEach(agent => {
                agent.workload = Math.max(20, Math.min(95, agent.workload + (Math.random() - 0.5) * 10));
            });

            this.broadcastUpdate('agents_updated', this.agents);
        }, 10000);
    }

    start() {
        this.server.listen(this.port, this.host, () => {
            console.log(`\n🚀 R&D Dashboard Server started!`);
            console.log(`📊 Web Dashboard: http://${this.host}:${this.port}`);
            console.log(`🔌 WebSocket: ws://${this.host}:${this.port}`);
            console.log(`📡 API Base: http://${this.host}:${this.port}/api`);
            console.log(`💡 Mode: ${this.isDev ? 'Development' : 'Production'}`);
            console.log(`\n🎯 Available endpoints:`);
            console.log(`   GET  /              - Main dashboard`);
            console.log(`   GET  /api/status    - System status`);
            console.log(`   GET  /api/projects  - List projects`);
            console.log(`   GET  /api/proposals - List proposals`);
            console.log(`   GET  /api/agents    - List agents`);
            console.log(`   GET  /api/metrics   - System metrics`);
            console.log(`   GET  /health        - Health check`);
            console.log(`\n⚡ Real-time updates via WebSocket`);
            console.log(`📈 Broadcasting agent updates every 10 seconds`);
            console.log(`\nPress Ctrl+C to stop the server\n`);
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down dashboard server...');
            this.server.close(() => {
                console.log('📴 Server stopped');
                process.exit(0);
            });
        });
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        port: 3000,
        host: 'localhost',
        dev: false
    };

    args.forEach(arg => {
        if (arg === '--dev') {
            options.dev = true;
        } else if (arg.startsWith('--port=')) {
            options.port = parseInt(arg.split('=')[1]) || 3000;
        } else if (arg.startsWith('--host=')) {
            options.host = arg.split('=')[1] || 'localhost';
        }
    });

    const server = new DashboardServer(options);
    server.start();
}

module.exports = DashboardServer;