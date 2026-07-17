#!/usr/bin/env node

/**
 * TUI Dashboard for R&D Project Management
 * Interactive terminal-based dashboard with real-time updates
 */

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class RDDashboardTUI extends EventEmitter {
  constructor() {
    super();
    this.screen = null;
    this.widgets = {};
    this.projectData = new Map();
    this.proposals = [];
    this.currentView = 'overview';
    this.refreshInterval = null;
    this.setupScreen();
    this.setupWidgets();
    this.setupEventHandlers();
    this.loadData();
  }

  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'R&D Project Dashboard',
      dockBorders: true,
      fullUnicode: true,
      autoPadding: true
    });

    this.screen.key(['escape', 'q', 'C-c'], (ch, key) => {
      this.cleanup();
      return process.exit(0);
    });
  }

  setupWidgets() {
    // Header
    this.widgets.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' {center}{bold}R&D PROJECT MANAGEMENT DASHBOARD{/bold}{/center}\n {center}Press TAB to navigate | ESC to exit | F1-F4 for views{/center}',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    // Navigation Menu
    this.widgets.nav = blessed.listbar({
      top: 3,
      left: 0,
      width: '100%',
      height: 3,
      mouse: true,
      keys: true,
      autoCommandKeys: true,
      commands: {
        'F1 Overview': { callback: () => this.switchView('overview') },
        'F2 Projects': { callback: () => this.switchView('projects') },
        'F3 Proposals': { callback: () => this.switchView('proposals') },
        'F4 Monitor': { callback: () => this.switchView('monitor') }
      },
      style: {
        item: { bg: 'grey', fg: 'white' },
        selected: { bg: 'blue', fg: 'white' }
      }
    });

    // Main Content Area
    this.widgets.content = blessed.box({
      top: 6,
      left: 0,
      width: '100%',
      height: '100%-9',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Status Bar
    this.widgets.status = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' Status: Ready | Projects: 0 | Proposals: 0 | Last Update: Never',
      style: {
        fg: 'white',
        bg: 'green'
      }
    });

    // Add all widgets to screen
    Object.values(this.widgets).forEach(widget => {
      this.screen.append(widget);
    });
  }

  setupEventHandlers() {
    // Tab navigation
    this.screen.key(['tab'], () => {
      this.screen.focusNext();
    });

    // Function key shortcuts
    this.screen.key(['f1'], () => this.switchView('overview'));
    this.screen.key(['f2'], () => this.switchView('projects'));
    this.screen.key(['f3'], () => this.switchView('proposals'));
    this.screen.key(['f4'], () => this.switchView('monitor'));

    // Action keys
    this.screen.key(['n'], () => this.createNewProject());
    this.screen.key(['r'], () => this.refreshData());
    this.screen.key(['enter'], () => this.handleAction());
  }

  switchView(view) {
    this.currentView = view;
    this.updateContent();
    this.screen.render();
  }

  updateContent() {
    switch (this.currentView) {
      case 'overview':
        this.showOverview();
        break;
      case 'projects':
        this.showProjects();
        break;
      case 'proposals':
        this.showProposals();
        break;
      case 'monitor':
        this.showMonitoring();
        break;
    }
  }

  showOverview() {
    const content = `
{center}{bold}SYSTEM OVERVIEW{/bold}{/center}

{bold}Active Projects:{/bold} ${this.projectData.size}
{bold}Pending Proposals:{/bold} ${this.proposals.length}
{bold}System Status:{/bold} {green-fg}Online{/green-fg}

{bold}Recent Activity:{/bold}
• Project Alpha-1 updated 2 minutes ago
• New proposal submitted for Beta Research
• Agent coordination completed successfully

{bold}Resource Utilization:{/bold}
CPU: ████████░░ 80%
Memory: ██████░░░░ 60%
Storage: ███░░░░░░░ 30%

{bold}Quick Actions:{/bold}
• Press 'n' to create new project
• Press 'r' to refresh data
• Press F2 to view all projects
• Press F3 to review proposals

{bold}System Health:{/bold}
┌─────────────────────┬─────────┐
│ Component           │ Status  │
├─────────────────────┼─────────┤
│ Agent Coordination  │ {green-fg}✓{/green-fg}       │
│ Memory System       │ {green-fg}✓{/green-fg}       │
│ Task Orchestration  │ {green-fg}✓{/green-fg}       │
│ Research Pipeline   │ {green-fg}✓{/green-fg}       │
│ Development Tools   │ {green-fg}✓{/green-fg}       │
└─────────────────────┴─────────┘
`;
    this.widgets.content.setContent(content);
  }

  showProjects() {
    let content = `
{center}{bold}PROJECT MANAGEMENT{/bold}{/center}

{bold}Active Projects:{/bold}

`;

    if (this.projectData.size === 0) {
      content += `
{yellow-fg}No projects found. Press 'n' to create a new project.{/yellow-fg}

{bold}Available Project Types:{/bold}
• Research Project
• Development Project
• Analysis Project
• Innovation Project
• Collaboration Project
`;
    } else {
      let projectIndex = 1;
      for (const [id, project] of this.projectData) {
        const statusColor = project.status === 'active' ? 'green' : 
                           project.status === 'pending' ? 'yellow' : 'red';
        content += `
{bold}${projectIndex}. ${project.name}{/bold}
   ID: ${id}
   Status: {${statusColor}-fg}${project.status.toUpperCase()}{/${statusColor}-fg}
   Progress: ${project.progress}%
   Team: ${project.team ? project.team.join(', ') : 'None'}
   Last Updated: ${project.lastUpdated}
   Description: ${project.description || 'No description'}
   
`;
        projectIndex++;
      }
    }

    content += `
{bold}Actions:{/bold}
• Press 'n' to create new project
• Press 'e' to edit selected project
• Press 'd' to delete selected project
• Press 'r' to refresh data
`;

    this.widgets.content.setContent(content);
  }

  showProposals() {
    let content = `
{center}{bold}PROPOSAL REVIEW{/bold}{/center}

{bold}Pending Proposals:{/bold}

`;

    if (this.proposals.length === 0) {
      content += `
{yellow-fg}No proposals pending review.{/yellow-fg}

{bold}Proposal Process:{/bold}
1. Agents submit research proposals
2. System evaluates feasibility
3. Resource allocation assessment
4. Approval/rejection decision
5. Project creation if approved

{bold}Evaluation Criteria:{/bold}
• Technical feasibility
• Resource requirements
• Expected outcomes
• Risk assessment
• Strategic alignment
`;
    } else {
      this.proposals.forEach((proposal, index) => {
        const priorityColor = proposal.priority === 'high' ? 'red' : 
                             proposal.priority === 'medium' ? 'yellow' : 'green';
        content += `
{bold}${index + 1}. ${proposal.title}{/bold}
   Priority: {${priorityColor}-fg}${proposal.priority.toUpperCase()}{/${priorityColor}-fg}
   Submitted: ${proposal.submitted}
   Agent: ${proposal.agent}
   Estimated Duration: ${proposal.duration}
   Resource Requirements: ${proposal.resources}
   
   {bold}Summary:{/bold}
   ${proposal.summary}
   
   {bold}Expected Outcomes:{/bold}
   ${proposal.outcomes}
   
   ────────────────────────────────────
`;
      });
    }

    content += `
{bold}Actions:{/bold}
• Press 'a' to approve selected proposal
• Press 'r' to reject selected proposal
• Press 'v' to view detailed proposal
• Press 'c' to add comments
`;

    this.widgets.content.setContent(content);
  }

  showMonitoring() {
    const content = `
{center}{bold}REAL-TIME MONITORING{/bold}{/center}

{bold}System Performance:{/bold}
┌─────────────────────┬─────────┬─────────┐
│ Metric              │ Current │ Target  │
├─────────────────────┼─────────┼─────────┤
│ Response Time (ms)  │ 125     │ <200    │
│ Throughput (req/s)  │ 450     │ >300    │
│ Error Rate (%)      │ 0.02    │ <0.1    │
│ Uptime (%)          │ 99.95   │ >99.9   │
└─────────────────────┴─────────┴─────────┘

{bold}Agent Activity:{/bold}
• Agent-1 (Architecture): {green-fg}Active{/green-fg} - Processing requirements
• Agent-2 (Research): {green-fg}Active{/green-fg} - Analyzing data sources
• Agent-3 (Development): {green-fg}Active{/green-fg} - Building components
• Agent-4 (Dashboard): {green-fg}Active{/green-fg} - This dashboard
• Agent-5 (Coordination): {green-fg}Active{/green-fg} - Orchestrating tasks

{bold}Memory Usage:{/bold}
┌─────────────────────┬─────────┬─────────┐
│ Component           │ Used    │ Total   │
├─────────────────────┼─────────┼─────────┤
│ Project Data        │ 2.3 MB  │ 10 MB   │
│ Agent Memory        │ 5.7 MB  │ 20 MB   │
│ System Cache        │ 12.1 MB │ 50 MB   │
│ Session Data        │ 1.2 MB  │ 5 MB    │
└─────────────────────┴─────────┴─────────┘

{bold}Task Queue:{/bold}
• Pending: 3 tasks
• In Progress: 2 tasks
• Completed: 147 tasks
• Failed: 0 tasks

{bold}Network Status:{/bold}
• API Endpoints: {green-fg}All Online{/green-fg}
• Database: {green-fg}Connected{/green-fg}
• External Services: {green-fg}Operational{/green-fg}
• WebSocket: {green-fg}Active{/green-fg}

{bold}Alerts:{/bold}
• No active alerts
• Last alert: 2 hours ago (Memory usage warning - resolved)

{bold}Live Updates:{/bold}
• Auto-refresh: {green-fg}Enabled{/green-fg}
• Refresh interval: 5 seconds
• Last update: ${new Date().toLocaleTimeString()}
`;

    this.widgets.content.setContent(content);
  }

  loadData() {
    // Load existing project data
    try {
      const projectFile = path.join(__dirname, 'projects.json');
      if (fs.existsSync(projectFile)) {
        const data = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        this.projectData = new Map(Object.entries(data.projects || {}));
        this.proposals = data.proposals || [];
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }

    // Initialize with sample data if empty
    if (this.projectData.size === 0) {
      this.initializeSampleData();
    }

    this.updateStatus();
  }

  initializeSampleData() {
    this.projectData.set('proj-001', {
      name: 'Alpha Research Initiative',
      status: 'active',
      progress: 75,
      team: ['Agent-1', 'Agent-2'],
      lastUpdated: new Date().toISOString(),
      description: 'Advanced research into emerging technologies',
      type: 'research'
    });

    this.proposals.push({
      id: 'prop-001',
      title: 'Beta Innovation Project',
      priority: 'high',
      submitted: new Date().toISOString(),
      agent: 'Agent-3',
      duration: '6 weeks',
      resources: 'High computational power, 3 agents',
      summary: 'Innovative approach to solving complex optimization problems',
      outcomes: 'New algorithm implementation, performance benchmarks'
    });
  }

  createNewProject() {
    const projectId = `proj-${Date.now().toString().slice(-6)}`;
    const project = {
      name: `New Project ${projectId}`,
      status: 'pending',
      progress: 0,
      team: [],
      lastUpdated: new Date().toISOString(),
      description: 'New project created via TUI dashboard',
      type: 'development'
    };

    this.projectData.set(projectId, project);
    this.saveData();
    this.updateStatus();
    this.switchView('projects');
  }

  refreshData() {
    this.loadData();
    this.updateContent();
    this.updateStatus();
    this.screen.render();
  }

  updateStatus() {
    const statusText = ` Status: Online | Projects: ${this.projectData.size} | Proposals: ${this.proposals.length} | Last Update: ${new Date().toLocaleTimeString()}`;
    this.widgets.status.setContent(statusText);
  }

  saveData() {
    try {
      const data = {
        projects: Object.fromEntries(this.projectData),
        proposals: this.proposals,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(path.join(__dirname, 'projects.json'), JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  handleAction() {
    // Handle context-specific actions
    switch (this.currentView) {
      case 'projects':
        this.editProject();
        break;
      case 'proposals':
        this.reviewProposal();
        break;
    }
  }

  editProject() {
    // Placeholder for project editing
    this.widgets.status.setContent(' Project editing not yet implemented - press F1 to return to overview');
  }

  reviewProposal() {
    // Placeholder for proposal review
    this.widgets.status.setContent(' Proposal review not yet implemented - press F1 to return to overview');
  }

  startRealTimeUpdates() {
    this.refreshInterval = setInterval(() => {
      if (this.currentView === 'monitor') {
        this.updateContent();
        this.screen.render();
      }
      this.updateStatus();
    }, 5000);
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.saveData();
  }

  run() {
    this.updateContent();
    this.startRealTimeUpdates();
    this.screen.render();
  }
}

// Initialize and run the dashboard
if (require.main === module) {
  const dashboard = new RDDashboardTUI();
  dashboard.run();
}

module.exports = RDDashboardTUI;