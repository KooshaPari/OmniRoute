/**
 * R&D Project Management Dashboard JavaScript
 * Interactive web dashboard with real-time updates
 */

class RDDashboard {
    constructor() {
        this.currentView = 'overview';
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.projectData = new Map();
        this.proposals = [];
        this.agents = [];
        this.currentProject = null;
        this.currentProposal = null;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.startAutoUpdate();
        this.updateView();
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshDashboard();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.createNewProject();
                        break;
                }
            }
        });

        // Modal close on click outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Form submissions
        document.getElementById('projectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProject();
        });
    }

    loadData() {
        // Load existing data or initialize with sample data
        try {
            const savedData = localStorage.getItem('rdDashboardData');
            if (savedData) {
                const data = JSON.parse(savedData);
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
            description: 'Advanced research into emerging technologies and their applications',
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
            description: 'Next-generation development tools and frameworks',
            type: 'development',
            status: 'active',
            priority: 'medium',
            progress: 45,
            team: ['Agent-3', 'Agent-4'],
            startDate: '2024-02-01',
            dueDate: '2024-04-01',
            lastUpdated: new Date().toISOString()
        });

        this.projectData.set('proj-003', {
            id: 'proj-003',
            name: 'Gamma Analysis Suite',
            description: 'Comprehensive data analysis and visualization tools',
            type: 'analysis',
            status: 'completed',
            priority: 'low',
            progress: 100,
            team: ['Agent-2', 'Agent-5'],
            startDate: '2024-01-01',
            dueDate: '2024-02-28',
            lastUpdated: new Date().toISOString()
        });

        // Sample proposals
        this.proposals = [
            {
                id: 'prop-001',
                title: 'Delta Innovation Project',
                summary: 'Innovative approach to solving complex optimization problems using advanced algorithms',
                priority: 'high',
                status: 'pending',
                agent: 'Agent-3',
                submittedDate: '2024-02-15',
                estimatedDuration: '6 weeks',
                resourceRequirements: 'High computational power, 3 dedicated agents',
                expectedOutcomes: 'New algorithm implementation, 25% performance improvement',
                technicalDetails: 'Implementation of quantum-inspired optimization algorithms with machine learning integration'
            },
            {
                id: 'prop-002',
                title: 'Epsilon Security Enhancement',
                summary: 'Comprehensive security audit and enhancement of existing systems',
                priority: 'medium',
                status: 'pending',
                agent: 'Agent-1',
                submittedDate: '2024-02-20',
                estimatedDuration: '4 weeks',
                resourceRequirements: 'Security tools, 2 agents',
                expectedOutcomes: 'Enhanced security posture, vulnerability assessment report',
                technicalDetails: 'Automated security scanning, penetration testing, and remediation recommendations'
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
                currentTask: 'Managing dashboard interface',
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
            localStorage.setItem('rdDashboardData', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    updateView() {
        switch (this.currentView) {
            case 'overview':
                this.updateOverview();
                break;
            case 'projects':
                this.updateProjects();
                break;
            case 'proposals':
                this.updateProposals();
                break;
            case 'agents':
                this.updateAgents();
                break;
            case 'monitor':
                this.updateMonitor();
                break;
        }
        this.updateLastUpdateTime();
    }

    updateOverview() {
        // Update stats
        document.getElementById('activeProjects').textContent = 
            Array.from(this.projectData.values()).filter(p => p.status === 'active').length;
        document.getElementById('pendingProposals').textContent = 
            this.proposals.filter(p => p.status === 'pending').length;
        document.getElementById('activeAgents').textContent = 
            this.agents.filter(a => a.status === 'active').length;
        document.getElementById('completedTasks').textContent = 
            Math.floor(Math.random() * 50) + 100; // Simulated task count

        // Update recent activity
        this.updateRecentActivity();
    }

    updateRecentActivity() {
        const activityList = document.getElementById('activityList');
        const activities = [
            {
                icon: 'fas fa-project-diagram',
                title: 'Project Alpha-1 Updated',
                time: '2 minutes ago'
            },
            {
                icon: 'fas fa-clipboard-list',
                title: 'New Proposal Submitted',
                time: '5 minutes ago'
            },
            {
                icon: 'fas fa-robot',
                title: 'Agent Coordination Complete',
                time: '10 minutes ago'
            },
            {
                icon: 'fas fa-chart-line',
                title: 'System Performance Check',
                time: '15 minutes ago'
            }
        ];

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <i class="${activity.icon}"></i>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }

    updateProjects() {
        const projectsGrid = document.getElementById('projectsGrid');
        const projects = Array.from(this.projectData.values());

        if (projects.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-project-diagram"></i>
                    <h3>No Projects Found</h3>
                    <p>Create your first project to get started.</p>
                    <button class="btn btn-primary" onclick="dashboard.createNewProject()">
                        <i class="fas fa-plus"></i> Create Project
                    </button>
                </div>
            `;
            return;
        }

        projectsGrid.innerHTML = projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <h3 class="project-title">${project.name}</h3>
                    <span class="project-status ${project.status}">${project.status}</span>
                </div>
                <p class="project-description">${project.description}</p>
                <div class="project-progress">
                    <div class="progress-label">
                        <span>Progress</span>
                        <span>${project.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress}%"></div>
                    </div>
                </div>
                <div class="project-team">
                    <i class="fas fa-users"></i>
                    <span>${project.team.join(', ')}</span>
                </div>
                <div class="project-actions">
                    <button class="btn btn-secondary" onclick="dashboard.editProject('${project.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="dashboard.deleteProject('${project.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateProposals() {
        const proposalsList = document.getElementById('proposalsList');
        const proposals = this.proposals;

        if (proposals.length === 0) {
            proposalsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No Proposals Found</h3>
                    <p>No proposals are currently pending review.</p>
                </div>
            `;
            return;
        }

        proposalsList.innerHTML = proposals.map(proposal => `
            <div class="proposal-card">
                <div class="proposal-header">
                    <h3 class="proposal-title">${proposal.title}</h3>
                    <span class="proposal-priority ${proposal.priority}">${proposal.priority}</span>
                </div>
                <div class="proposal-meta">
                    <span><i class="fas fa-user"></i> ${proposal.agent}</span>
                    <span><i class="fas fa-clock"></i> ${proposal.estimatedDuration}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(proposal.submittedDate).toLocaleDateString()}</span>
                </div>
                <p class="proposal-summary">${proposal.summary}</p>
                <div class="proposal-actions">
                    <button class="btn btn-primary" onclick="dashboard.viewProposal('${proposal.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-success" onclick="dashboard.approveProposal('${proposal.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger" onclick="dashboard.rejectProposal('${proposal.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateAgents() {
        const agentsGrid = document.getElementById('agentsGrid');
        const agents = this.agents;

        agentsGrid.innerHTML = agents.map(agent => `
            <div class="agent-card">
                <div class="agent-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <h3 class="agent-name">${agent.name}</h3>
                <p class="agent-role">${agent.role}</p>
                <div class="agent-status ${agent.status}">${agent.status}</div>
                <div class="agent-workload">
                    <div class="progress-label">
                        <span>Workload</span>
                        <span>${agent.workload}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${agent.workload}%"></div>
                    </div>
                </div>
                <p class="agent-task">${agent.currentTask}</p>
            </div>
        `).join('');
    }

    updateMonitor() {
        // Update performance metrics with simulated data
        const metrics = [
            { value: Math.floor(Math.random() * 50) + 100, max: 200 },
            { value: Math.floor(Math.random() * 200) + 400, max: 600 },
            { value: Math.random() * 0.1, max: 0.1 }
        ];

        const metricBars = document.querySelectorAll('.metric-fill');
        metricBars.forEach((bar, index) => {
            if (metrics[index]) {
                const percentage = (metrics[index].value / metrics[index].max) * 100;
                bar.style.width = `${Math.min(percentage, 100)}%`;
            }
        });

        // Update resource chart
        this.updateResourceChart();
    }

    updateResourceChart() {
        const canvas = document.getElementById('chartCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw simple line chart
        const data = [];
        for (let i = 0; i < 20; i++) {
            data.push(Math.random() * 100);
        }

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((value, index) => {
            const x = (index / (data.length - 1)) * canvas.width;
            const y = canvas.height - (value / 100) * canvas.height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    updateLastUpdateTime() {
        const timeElement = document.getElementById('lastUpdateTime');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString();
        }
    }

    startAutoUpdate() {
        this.refreshInterval = setInterval(() => {
            if (this.autoRefresh) {
                this.updateView();
            }
        }, 5000);
    }

    // Navigation methods
    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        document.getElementById(`${viewName}-view`).classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[onclick="showView('${viewName}')"]`).classList.add('active');

        this.currentView = viewName;
        this.updateView();
    }

    // Project management methods
    createNewProject() {
        this.currentProject = null;
        this.openModal('projectModal');
        this.clearProjectForm();
    }

    editProject(projectId) {
        this.currentProject = this.projectData.get(projectId);
        if (this.currentProject) {
            this.openModal('projectModal');
            this.populateProjectForm(this.currentProject);
        }
    }

    deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project?')) {
            this.projectData.delete(projectId);
            this.saveData();
            this.updateView();
        }
    }

    saveProject() {
        const form = document.getElementById('projectForm');
        const formData = new FormData(form);
        
        const projectData = {
            id: this.currentProject ? this.currentProject.id : `proj-${Date.now()}`,
            name: formData.get('name'),
            description: formData.get('description'),
            type: formData.get('type'),
            priority: formData.get('priority'),
            status: this.currentProject ? this.currentProject.status : 'pending',
            progress: this.currentProject ? this.currentProject.progress : 0,
            team: this.currentProject ? this.currentProject.team : [],
            startDate: this.currentProject ? this.currentProject.startDate : new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString()
        };

        this.projectData.set(projectData.id, projectData);
        this.saveData();
        this.closeModal('projectModal');
        this.updateView();
    }

    clearProjectForm() {
        document.getElementById('projectForm').reset();
    }

    populateProjectForm(project) {
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDescription').value = project.description;
        document.getElementById('projectType').value = project.type;
        document.getElementById('projectPriority').value = project.priority;
    }

    // Proposal management methods
    viewProposal(proposalId) {
        const proposal = this.proposals.find(p => p.id === proposalId);
        if (proposal) {
            this.currentProposal = proposal;
            this.openModal('proposalModal');
            this.populateProposalDetails(proposal);
        }
    }

    populateProposalDetails(proposal) {
        const detailsContainer = document.getElementById('proposalDetails');
        detailsContainer.innerHTML = `
            <div class="proposal-detail">
                <h4>${proposal.title}</h4>
                <div class="proposal-meta">
                    <span><strong>Priority:</strong> ${proposal.priority}</span>
                    <span><strong>Agent:</strong> ${proposal.agent}</span>
                    <span><strong>Duration:</strong> ${proposal.estimatedDuration}</span>
                </div>
                <div class="proposal-section">
                    <h5>Summary</h5>
                    <p>${proposal.summary}</p>
                </div>
                <div class="proposal-section">
                    <h5>Resource Requirements</h5>
                    <p>${proposal.resourceRequirements}</p>
                </div>
                <div class="proposal-section">
                    <h5>Expected Outcomes</h5>
                    <p>${proposal.expectedOutcomes}</p>
                </div>
                <div class="proposal-section">
                    <h5>Technical Details</h5>
                    <p>${proposal.technicalDetails}</p>
                </div>
            </div>
        `;
    }

    approveProposal(proposalId) {
        const proposal = this.proposals.find(p => p.id === proposalId);
        if (proposal) {
            proposal.status = 'approved';
            
            // Create new project from approved proposal
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
            this.updateView();
            this.closeModal('proposalModal');
        }
    }

    rejectProposal(proposalId) {
        const proposal = this.proposals.find(p => p.id === proposalId);
        if (proposal) {
            proposal.status = 'rejected';
            this.saveData();
            this.updateView();
            this.closeModal('proposalModal');
        }
    }

    filterProposals(status) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Filter proposals (simplified - in real app would re-render list)
        this.updateProposals();
    }

    // Agent management methods
    refreshAgents() {
        // Simulate agent status updates
        this.agents.forEach(agent => {
            agent.workload = Math.floor(Math.random() * 50) + 25;
            agent.currentTask = [
                'Processing data',
                'Analyzing requirements',
                'Building components',
                'Testing functionality',
                'Coordinating tasks'
            ][Math.floor(Math.random() * 5)];
        });
        this.saveData();
        this.updateView();
    }

    // Monitor methods
    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        const button = document.querySelector('.toggle-btn');
        if (this.autoRefresh) {
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-pause"></i> Auto-Refresh';
        } else {
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-play"></i> Auto-Refresh';
        }
    }

    // Modal methods
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // Utility methods
    refreshDashboard() {
        this.loadData();
        this.updateView();
        
        // Show refresh animation
        const refreshBtn = document.querySelector('.refresh-btn i');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 1s linear';
            setTimeout(() => {
                refreshBtn.style.animation = '';
            }, 1000);
        }
    }

    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new RDDashboard();
});

// Global functions for HTML onclick handlers
window.showView = (viewName) => dashboard.showView(viewName);
window.refreshDashboard = () => dashboard.refreshDashboard();
window.createNewProject = () => dashboard.createNewProject();
window.editProject = (id) => dashboard.editProject(id);
window.deleteProject = (id) => dashboard.deleteProject(id);
window.saveProject = () => dashboard.saveProject();
window.viewProposal = (id) => dashboard.viewProposal(id);
window.approveProposal = (id) => dashboard.approveProposal(id);
window.rejectProposal = (id) => dashboard.rejectProposal(id);
window.filterProposals = (status) => dashboard.filterProposals(status);
window.refreshAgents = () => dashboard.refreshAgents();
window.toggleAutoRefresh = () => dashboard.toggleAutoRefresh();
window.closeModal = (modalId) => dashboard.closeModal(modalId);

// CSS animation for refresh button
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RDDashboard;
}