
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  framework, 
  SmartEmbedFramework,
  SmartEmbedBuilder,
  ActionButtonManager,
  ModalFormManager,
  StateManager,
  ComponentRegistry,
  smartEmbedManager,
  stateManager,
  actionButtonManager,
  modalFormManager,
  componentRegistry,
  createIssueCard,
  createDashboardCard,
  createFormCard,
  createStatusCard
} from '../index';

vi.mock('../SmartEmbedBuilder');
vi.mock('../ActionButtonManager');
vi.mock('../ModalFormManager');
vi.mock('../StateManager');
vi.mock('../ComponentRegistry');

describe('SmartEmbedFramework', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    (SmartEmbedFramework as any).instance = undefined;
  });

  it('should be a singleton', () => {
    const instance1 = SmartEmbedFramework.getInstance();
    const instance2 = SmartEmbedFramework.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize correctly', async () => {
    await framework.initialize();
    expect(framework.isInitialized()).toBe(true);
  });

  it('should initialize with options', async () => {
    const options = {
      theme: 'dark' as const,
      persistence: true,
      autoCleanup: true,
    };
    
    await framework.initialize(options);
    expect(framework.isInitialized()).toBe(true);
  });

  it('should handle initialize when already initialized', async () => {
    await framework.initialize();
    await framework.initialize(); // Second call should not throw
    expect(framework.isInitialized()).toBe(true);
  });

  it('should shutdown correctly', async () => {
    await framework.initialize();
    await framework.shutdown();
    expect(framework.isInitialized()).toBe(false);
  });

  it('should handle shutdown when not initialized', async () => {
    // Should not throw when shutting down non-initialized framework
    await expect(framework.shutdown()).resolves.not.toThrow();
    expect(framework.isInitialized()).toBe(false);
  });

  it('should get stats', async () => {
    const stats = await framework.getStats();
    expect(stats).toHaveProperty('embeds');
    expect(stats).toHaveProperty('actions');
    expect(stats).toHaveProperty('templates');
    expect(stats).toHaveProperty('themes');
    expect(stats).toHaveProperty('stateManager');
  });

  it('should get stats when not initialized', async () => {
    // Should return default stats even when not initialized
    const stats = await framework.getStats();
    expect(stats).toBeDefined();
  });

  it('should provide access to managers', () => {
    const instance = SmartEmbedFramework.getInstance();
    
    // These should be accessible even before initialization
    expect(instance).toHaveProperty('stateManager');
    expect(instance).toHaveProperty('actionButtonManager');
    expect(instance).toHaveProperty('modalFormManager');
    expect(instance).toHaveProperty('componentRegistry');
  });
});

describe('Helper Functions', () => {
  describe('createIssueCard', () => {
    it('should create issue card with full config', async () => {
      const config = {
        id: 'test-issue',
        title: 'Test Issue',
        description: 'Test description',
        status: 'open' as const,
        priority: 'high' as const,
        assignee: 'testuser',
        theme: 'dark' as const,
      };

      const card = await createIssueCard(config);
      expect(card).toBeDefined();
    });

    it('should create issue card with minimal config', async () => {
      const config = {
        id: 'minimal-issue',
        title: 'Minimal Issue',
      };

      const card = await createIssueCard(config);
      expect(card).toBeDefined();
    });

    it('should handle null/undefined values in config', async () => {
      const config = {
        id: 'null-test',
        title: 'Null Test',
        description: null as any,
        status: undefined as any,
        priority: null as any,
        assignee: undefined as any,
      };

      const card = await createIssueCard(config);
      expect(card).toBeDefined();
    });
  });

  describe('createDashboardCard', () => {
    it('should create dashboard card with full config', async () => {
      const config = {
        id: 'test-dashboard',
        title: 'Test Dashboard',
        description: 'Dashboard description',
        metrics: {
          users: '1000',
          revenue: '$50K',
        },
        progress: {
          current: 7,
          total: 10,
        },
        refreshInterval: 60,
      };

      const card = await createDashboardCard(config);
      expect(card).toBeDefined();
    });

    it('should create dashboard card with minimal config', async () => {
      const config = {
        id: 'minimal-dashboard',
        title: 'Minimal Dashboard',
      };

      const card = await createDashboardCard(config);
      expect(card).toBeDefined();
    });

    it('should handle empty metrics and progress', async () => {
      const config = {
        id: 'empty-dashboard',
        title: 'Empty Dashboard',
        metrics: {},
        progress: null as any,
      };

      const card = await createDashboardCard(config);
      expect(card).toBeDefined();
    });
  });

  describe('createFormCard', () => {
    it('should create form card with fields', async () => {
      const config = {
        id: 'test-form',
        title: 'Test Form',
        description: 'Form description',
        fields: [
          { label: 'Name', placeholder: 'Enter your name' },
          { label: 'Email', placeholder: 'Enter your email' },
        ],
      };

      const card = await createFormCard(config);
      expect(card).toBeDefined();
    });

    it('should create form card with minimal config', async () => {
      const config = {
        id: 'minimal-form',
        title: 'Minimal Form',
      };

      const card = await createFormCard(config);
      expect(card).toBeDefined();
    });
  });

  describe('createStatusCard', () => {
    it('should create status card with all options', async () => {
      const config = {
        id: 'test-status',
        title: 'Test Service',
        status: 'online' as const,
        uptime: '99.9%',
        refreshInterval: 30,
      };

      const card = await createStatusCard(config);
      expect(card).toBeDefined();
    });

    it('should create status card with different statuses', async () => {
      const statuses = ['online', 'warning', 'offline'] as const;
      
      for (const status of statuses) {
        const config = {
          id: `status-${status}`,
          title: `${status} Service`,
          status,
        };

        const card = await createStatusCard(config);
        expect(card).toBeDefined();
      }
    });
  });
});

describe('Module Exports', () => {
  it('should export all required classes', () => {
    expect(SmartEmbedBuilder).toBeDefined();
    expect(ActionButtonManager).toBeDefined();
    expect(ModalFormManager).toBeDefined();
    expect(StateManager).toBeDefined();
    expect(ComponentRegistry).toBeDefined();
  });

  it('should export framework instance', () => {
    expect(framework).toBeDefined();
    expect(framework).toBeInstanceOf(SmartEmbedFramework);
  });

  it('should export helper functions', () => {
    expect(createIssueCard).toBeDefined();
    expect(createDashboardCard).toBeDefined();
    expect(createFormCard).toBeDefined();
    expect(createStatusCard).toBeDefined();
    expect(typeof createIssueCard).toBe('function');
    expect(typeof createDashboardCard).toBe('function');
    expect(typeof createFormCard).toBeDefined();
    expect(typeof createStatusCard).toBeDefined();
  });

  it('should export manager instances', () => {
    expect(smartEmbedManager).toBeDefined();
    expect(stateManager).toBeDefined();
    expect(actionButtonManager).toBeDefined();
    expect(modalFormManager).toBeDefined();
    expect(componentRegistry).toBeDefined();
  });
});
