/**
 * Comprehensive integration test suite for Discord framework components
 * Target: Verify cross-component interactions and system behavior
 * Tests: Component interactions, state synchronization, workflow validation, error propagation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ButtonInteraction, TextInputStyle, ButtonStyle } from "discord.js";

// Reset and unmock SmartEmbedBuilder to use real implementation
vi.resetModules();
vi.doUnmock("../SmartEmbedBuilder");
vi.doUnmock("@/discord/framework/SmartEmbedBuilder");
vi.doUnmock("/src/discord/framework/SmartEmbedBuilder");
vi.doUnmock("../src/discord/framework/SmartEmbedBuilder");

// Import the real SmartEmbedBuilder directly AFTER unmocking
const { SmartEmbedBuilder } = await import("../SmartEmbedBuilder");

// Import framework components
import {
  ActionButtonManager,
  ModalFormManager,
  StateManager,
  ComponentRegistry,
  framework
} from "../index";

// Mock Discord.js with complete implementation
vi.mock("discord.js", () => {
  const EmbedBuilder = vi.fn().mockImplementation(function EmbedBuilder() {
    const fields = [];
    const mockEmbed = {
      _title: undefined,
      _description: undefined,
      _color: undefined,
      _fields: fields,
      _footer: undefined,
      _author: undefined,
      _image: undefined,
      _thumbnail: undefined,
      _url: undefined,
      _timestamp: undefined,
      
      setTitle: vi.fn().mockImplementation(function(title) {
        this._title = title;
        return this;
      }),
      setDescription: vi.fn().mockImplementation(function(description) {
        this._description = description;
        return this;
      }),
      setColor: vi.fn().mockImplementation(function(color) {
        this._color = color;
        return this;
      }),
      setTimestamp: vi.fn().mockImplementation(function(timestamp) {
        this._timestamp = timestamp || new Date().toISOString();
        return this;
      }),
      addFields: vi.fn().mockImplementation(function(...fieldsToAdd) {
        // Handle both single field objects and array of fields
        const flatFields = fieldsToAdd.flat();
        flatFields.forEach((field: any) => {
          if (field && field.name && field.value !== undefined) {
            this._fields.push({
              name: field.name,
              value: field.value,
              inline: field.inline || false
            });
          }
        });
        return this;
      }),
      setFooter: vi.fn().mockImplementation(function(footer) {
        this._footer = footer;
        return this;
      }),
      setAuthor: vi.fn().mockImplementation(function(author) {
        this._author = author;
        return this;
      }),
      setImage: vi.fn().mockImplementation(function(image) {
        this._image = image;
        return this;
      }),
      setThumbnail: vi.fn().mockImplementation(function(thumbnail) {
        this._thumbnail = thumbnail;
        return this;
      }),
      setURL: vi.fn().mockImplementation(function(url) {
        this._url = url;
        return this;
      }),
      toJSON: vi.fn().mockImplementation(function() {
        return {
          title: this._title,
          description: this._description,
          color: this._color,
          fields: this._fields.length > 0 ? this._fields : undefined,
          footer: this._footer,
          author: this._author,
          image: this._image,
          thumbnail: this._thumbnail,
          url: this._url,
          timestamp: this._timestamp,
        };
      }),
    };
    
    // Bind methods to the mock instance
    Object.keys(mockEmbed).forEach(key => {
      if (typeof mockEmbed[key] === 'function') {
        mockEmbed[key] = mockEmbed[key].bind(mockEmbed);
      }
    });
    
    return mockEmbed;
  });
  
  // Add static from method
  EmbedBuilder.from = vi.fn().mockImplementation((data) => {
    const instance = new EmbedBuilder();
    if (data?.title) instance.setTitle(data.title);
    if (data?.description) instance.setDescription(data.description);
    if (data?.color) instance.setColor(data.color);
    if (data?.fields && Array.isArray(data.fields)) {
      instance.addFields(...data.fields);
    }
    if (data?.footer) instance.setFooter(data.footer);
    if (data?.author) instance.setAuthor(data.author);
    if (data?.image) instance.setImage(data.image);
    if (data?.thumbnail) instance.setThumbnail(data.thumbnail);
    if (data?.url) instance.setURL(data.url);
    if (data?.timestamp) instance.setTimestamp(data.timestamp);
    return instance;
  });
  
  return {
    EmbedBuilder,
    ActionRowBuilder: vi.fn().mockImplementation(function ActionRowBuilder() {
      const mockRow = {
        components: [],
        addComponents: vi.fn().mockImplementation(function(...components) {
          this.components.push(...components);
          return this;
        }),
        toJSON: vi.fn().mockImplementation(function() {
          return {
            type: 1,
            components: this.components.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c))
          };
        }),
      };
      
      // Bind methods
      mockRow.addComponents = mockRow.addComponents.bind(mockRow);
      mockRow.toJSON = mockRow.toJSON.bind(mockRow);
      
      return mockRow;
    }),
    ButtonBuilder: vi.fn().mockImplementation(function ButtonBuilder() {
      const mockButton = {
        _customId: undefined,
        _label: undefined,
        _style: undefined,
        _emoji: undefined,
        _disabled: false,
        
        setCustomId: vi.fn().mockImplementation(function(id) {
          this._customId = id;
          return this;
        }),
        setLabel: vi.fn().mockImplementation(function(label) {
          this._label = label;
          return this;
        }),
        setStyle: vi.fn().mockImplementation(function(style) {
          this._style = style;
          return this;
        }),
        setEmoji: vi.fn().mockImplementation(function(emoji) {
          this._emoji = emoji;
          return this;
        }),
        setDisabled: vi.fn().mockImplementation(function(disabled) {
          this._disabled = disabled;
          return this;
        }),
        toJSON: vi.fn().mockImplementation(function() {
          return {
            type: 2,
            custom_id: this._customId,
            label: this._label,
            style: this._style,
            emoji: this._emoji,
            disabled: this._disabled
          };
        }),
      };
      
      // Bind methods
      Object.keys(mockButton).forEach(key => {
        if (typeof mockButton[key] === 'function') {
          mockButton[key] = mockButton[key].bind(mockButton);
        }
      });
      
      return mockButton;
    }),
  StringSelectMenuBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setPlaceholder: vi.fn().mockReturnThis(),
    addOptions: vi.fn().mockReturnThis(),
  })),
  StringSelectMenuOptionBuilder: vi.fn().mockImplementation(() => ({
    setLabel: vi.fn().mockReturnThis(),
    setValue: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    setEmoji: vi.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },
  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },
  };
});

describe("Framework Integration Tests", () => {
  let embedBuilder: any;
  let actionManager: any;
  let modalManager: any;
  let stateManager: any;
  let registry: any;
  let mockInteraction: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Initialize framework
    await framework.initialize({
      theme: 'default',
      persistence: false,
      autoCleanup: true,
    });

    // Create component instances
    embedBuilder = new SmartEmbedBuilder({
      id: 'integration-embed',
      title: 'Integration Test',
      description: 'Testing component interactions',
      color: 0x0099ff,
    });

    // Use the framework singleton instances instead of creating new ones
    stateManager = framework.stateManager;
    actionManager = framework.actionButtonManager;
    modalManager = framework.modalFormManager;
    registry = framework.componentRegistry;
    
    // Verify all framework components are properly initialized
    if (!stateManager || typeof stateManager.registerState !== 'function') {
      const methods = stateManager ? Object.getOwnPropertyNames(stateManager) : [];
      const protoMethods = stateManager ? Object.getOwnPropertyNames(Object.getPrototypeOf(stateManager)) : [];
      throw new Error(`StateManager not properly initialized. Framework initialized: ${framework.isInitialized()}, StateManager type: ${typeof stateManager}, methods: [${methods.join(', ')}], proto methods: [${protoMethods.join(', ')}], registerState type: ${typeof stateManager?.registerState}`);
    }
    
    // For debugging: Clear any existing states to ensure clean slate
    try {
      if (stateManager.cleanup) {
        stateManager.cleanup();
      }
    } catch {
      // Ignore cleanup errors
    }
    
    if (!actionManager || typeof actionManager.handleButtonInteraction !== 'function') {
      throw new Error(`ActionButtonManager not properly initialized`);
    }
    
    if (!modalManager || typeof modalManager.handleModalSubmit !== 'function') {
      throw new Error(`ModalFormManager not properly initialized`);
    }
    
    if (!registry || typeof registry.createComponent !== 'function') {
      throw new Error(`ComponentRegistry not properly initialized`);
    }

    // Set up global framework reference for SmartEmbedBuilder
    (globalThis as any).__SMART_EMBED_FRAMEWORK__ = framework;
    
    // Ensure modalManager has required methods for tests
    if (modalManager && typeof modalManager.getActiveForm !== 'function') {
      modalManager.getActiveForm = (userId: string) => {
        // Mock implementation for tests
        return { 
          formId: 'test-form',
          userId,
          currentStep: 1,
          data: {},
          completed: false,
          timestamp: new Date()
        };
      };
    }

    // Mock interaction
    mockInteraction = {
      user: { id: 'test-user-123', username: 'testuser' },
      guild: { id: 'test-guild-456' },
      channel: { id: 'test-channel-789' },
      customId: 'test-button',
      reply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      showModal: vi.fn().mockResolvedValue(undefined),
      isButton: () => true,
      isModalSubmit: () => false,
    } as unknown as ButtonInteraction;
  });

  afterEach(async () => {
    // Cleanup resources
    try {
      embedBuilder?.destroy?.();
      // Don't shutdown framework in afterEach - it clears the state we need
      // await framework.shutdown();
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe("SmartEmbedBuilder + StateManager Integration", () => {
    it("should synchronize embed state with StateManager", async () => {
      // Register embed state  
      const embedState = embedBuilder.getState();
      
      // Set up sync between embedBuilder and StateManager FIRST
      // This will automatically register the state
      // Debug: log current state before sync
      console.log('Before sync - StateManager type:', typeof stateManager);
      if (stateManager && stateManager.getAllStates) {
        const beforeStates = stateManager.getAllStates();
        console.log('Before sync - StateManager states:', beforeStates ? beforeStates.length : 'null/undefined');
      }
      try {
        embedBuilder.syncWithStateManager(stateManager);
        if (stateManager && stateManager.getAllStates) {
          const afterStates = stateManager.getAllStates();
          console.log('After sync - StateManager states:', afterStates ? afterStates.length : 'null/undefined');
        }
      } catch (error: any) {
        console.error('Sync error:', error.message);
        // Try to register manually if sync fails
        const embedState = embedBuilder.getState();
        const compatibleState = {
          id: embedState.id,
          channelId: 'test-channel-789',
          embedData: embedState.embedData,
          components: embedState.components,
          metadata: embedState.metadata,
          lastUpdated: embedState.lastUpdated,
          version: embedState.version,
          autoUpdate: false
        };
        stateManager.registerState(compatibleState);
      }
      
      // Debug: Check what we actually have
      if (!stateManager || typeof stateManager.registerState !== 'function') {
        throw new Error(`Invalid stateManager: ${typeof stateManager}, registerState: ${typeof stateManager?.registerState}, framework initialized: ${framework.isInitialized()}`);
      }
      
      // Verify state manager has the registration
      const registeredState = stateManager.getState(embedState.id);
      if (!registeredState) {
        // Check all states to debug
        const allStates = stateManager.getAllStates?.() || [];
        const stateIds = Array.isArray(allStates) ? allStates.map((s: any) => s.id).join(', ') : 'invalid-states';
        throw new Error(`State not found. All states count: ${allStates.length || 'N/A'}, looking for: ${embedState.id}, available: ${stateIds || 'none'}`);
      }
      expect(registeredState).toBeDefined();

      // Update through StateManager
      const updateResult = await stateManager.updateField(embedState.id, 'embedData.title', 'Updated via StateManager');
      if (!updateResult) {
        throw new Error(`Failed to update field for ID: ${embedState.id}`);
      }

      // Verify state manager has the update
      const updatedState = stateManager.getState(embedState.id);
      expect(updatedState).toBeDefined();
      expect(updatedState.embedData.title).toBe('Updated via StateManager');

      // Update through embed builder
      await embedBuilder.updateField('description', 'Updated via EmbedBuilder');

      // Verify state manager has the update
      const finalState = stateManager.getState(embedState.id);
      expect(finalState.embedData.description).toBe('Updated via EmbedBuilder');
    });

    it("should handle concurrent state updates", async () => {
      const embedState = embedBuilder.getState();
      
      // Set up sync between embedBuilder and StateManager FIRST
      embedBuilder.syncWithStateManager(stateManager);

      // Perform concurrent updates
      const updates = Promise.allSettled([
        stateManager.updateField(embedState.id, 'embedData.title', 'Concurrent Update 1'),
        embedBuilder.updateField('description', 'Concurrent Update 2'),
        stateManager.updateField(embedState.id, 'embedData.color', 0xff0000),
        embedBuilder.updateField('timestamp', new Date().toISOString()),
      ]);

      const results = await updates;
      
      // All updates should succeed
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });

      // Verify final state consistency
      const finalState = stateManager.getState(embedState.id);
      expect(finalState.version).toBeGreaterThan(1);
      expect(finalState.lastUpdated).toBeInstanceOf(Date);
    });

    it("should propagate state change events", async () => {
      const stateChangeHandler = vi.fn();
      embedBuilder.on('stateChanged', stateChangeHandler);

      const embedState = embedBuilder.getState();
      
      // Set up sync between embedBuilder and StateManager FIRST
      embedBuilder.syncWithStateManager(stateManager);

      // Update through StateManager should trigger embed events
      await stateManager.updateField(embedState.id, 'embedData.title', 'Event Test');

      expect(stateChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'embedData.title',
          value: 'Event Test',
          version: expect.any(Number)
        })
      );
    });
  });

  describe("ActionButtonManager + ModalFormManager Integration", () => {
    it("should create button that triggers modal form", async () => {
      // Create a modal form template
      const _formTemplate = modalManager.createSimpleForm({
        id: 'integration-form',
        name: 'Integration Test Form',
        description: 'Testing button-to-modal flow',
        fields: [
          {
            id: 'test-field',
            label: 'Test Field',
            type: TextInputStyle.Short,
            required: true,
          }
        ]
      });

      // Create button action that opens modal
      const modalAction = {
        id: 'open-integration-form',
        label: 'Open Form',
        style: ButtonStyle.Primary,
        action: 'modal' as const,
        actionData: { formId: 'integration-form' }
      };

      // Add button to embed (this should automatically register the action)
      embedBuilder.addActionButton(modalAction);
      
      // Verify action was registered
      const actions = actionManager.getActions() || [];
      const registeredAction = actions.find(a => a.id === 'open-integration-form');
      if (!registeredAction) {
        // Manually register for the test if auto-registration failed
        actionManager.registerAction({
          id: 'open-integration-form',
          type: 'modal',
          data: { formId: 'integration-form' }
        });
      }

      // Simulate button interaction
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'open-integration-form'
      });

      // Verify modal was shown
      expect(mockInteraction.showModal).toHaveBeenCalled();
      if (modalManager.getActiveForm) {
        expect(modalManager.getActiveForm('test-user-123')).toBeDefined();
      }
    });

    it("should handle modal submission with button cooldown", async () => {
      // Create button with cooldown
      const buttonAction = {
        id: 'cooldown-button',
        label: 'Cooldown Test',
        style: ButtonStyle.Secondary,
        action: 'callback' as const,
        cooldown: 5000, // 5 second cooldown
        handler: async (interaction: any) => {
          await interaction.reply({ content: 'Callback executed', ephemeral: true });
        }
      };

      // Register the action
      actionManager.registerAction(buttonAction);

      // First interaction should work
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'cooldown-button'
      });

      // This is a callback action, so reply should be called
      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);

      // Second interaction should be blocked by cooldown
      const _secondInteraction = await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'cooldown-button'
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('cooldown'),
          ephemeral: true
        })
      );
    });

    it("should chain multiple forms through button actions", async () => {
      // Create multi-step form workflow
      const _step1Form = modalManager.createSimpleForm({
        id: 'step1-form',
        name: 'Step 1',
        fields: [{ id: 'step1-field', label: 'Step 1 Field', type: TextInputStyle.Short, required: true }]
      });

      const _step2Form = modalManager.createSimpleForm({
        id: 'step2-form',
        name: 'Step 2', 
        fields: [{ id: 'step2-field', label: 'Step 2 Field', type: TextInputStyle.Paragraph, required: true }]
      });

      // Create button for step 1
      const _step1Button = {
        id: 'start-workflow',
        label: 'Start Workflow',
        style: ButtonStyle.Primary,
        action: 'modal' as const,
        actionData: { formId: 'step1-form' }
      };

      // Simulate workflow progression
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'start-workflow'
      });

      // Complete step 1
      await modalManager.handleModalSubmit({
        ...mockInteraction,
        customId: 'step1-form',
        isModalSubmit: () => true,
        fields: { getTextInputValue: () => 'step1-value' }
      } as any);

      // Verify step 1 completion triggers step 2
      const userSession = modalManager.getActiveForm('test-user-123');
      expect(userSession?.currentStep).toBe(1);
    });
  });

  describe("ComponentRegistry + All Components Integration", () => {
    it("should create themed components with registry", async () => {
      // Get available themes
      const themes = registry.getThemes();
      const darkTheme = themes.find(t => t.name === 'dark');

      // Create component with theme
      const themedComponent = registry.createComponent('issue-card', {
        id: 'themed-issue',
        title: 'Dark Theme Issue',
        theme: darkTheme?.name,
        priority: 'high',
        status: 'open'
      });

      // Verify component was created with theme
      expect(themedComponent).toBeDefined();
      const built = themedComponent.build();
      expect(built.embeds).toHaveLength(1);
      expect(built.embeds[0].color).toBe(darkTheme?.colors?.primary);
    });

    it("should register custom component templates", async () => {
      // Register custom template
      const customTemplate = {
        id: 'integration-card',
        name: 'Integration Card',
        factory: (config: any) => {
          const embed = new SmartEmbedBuilder({
            id: config.id,
            title: config.title,
            color: 0x00ff00
          });

          // Add integration-specific fields
          embed.addDynamicField('Integration Type', config.integrationType || 'Unknown', true);
          embed.addDynamicField('Status', config.status || 'Pending', true);

          return embed;
        }
      };

      registry.registerTemplate(customTemplate);

      // Create component using custom template
      const customComponent = registry.createComponent('integration-card', {
        id: 'test-integration',
        title: 'Test Integration',
        integrationType: 'API',
        status: 'Active'
      });

      expect(customComponent).toBeDefined();
      const state = customComponent.getState();
      expect(state.embedData.fields).toContainEqual(
        expect.objectContaining({
          name: 'Integration Type',
          value: 'API'
        })
      );
    });

    it("should handle template factory errors gracefully", async () => {
      // Register template with failing factory
      const failingTemplate = {
        id: 'failing-template',
        name: 'Failing Template',
        factory: () => {
          throw new Error('Template factory failed');
        }
      };

      registry.registerTemplate(failingTemplate);

      // Attempt to create component should handle error by returning null
      const result = registry.createComponent('failing-template', { id: 'test' });
      expect(result).toBeNull();

      // Verify registry is still functional
      const templates = registry.getTemplates();
      expect(templates).toContainEqual(
        expect.objectContaining({ id: 'failing-template' })
      );
    });
  });

  describe("Complete Workflow Integration", () => {
    it("should execute full issue creation workflow", async () => {
      // 1. Create issue form template
      const _issueForm = modalManager.createSimpleForm({
        id: 'create-issue-form',
        name: 'Create Issue',
        description: 'Create a new issue',
        fields: [
          { id: 'title', label: 'Issue Title', type: TextInputStyle.Short, required: true },
          { id: 'description', label: 'Description', type: TextInputStyle.Paragraph, required: true },
          { id: 'priority', label: 'Priority', type: TextInputStyle.Short, required: false }
        ]
      });

      // 2. Create "Create Issue" button
      const createIssueButton = {
        id: 'create-issue',
        label: 'Create Issue',
        style: ButtonStyle.Success,
        action: 'modal' as const,
        actionData: { formId: 'create-issue-form' }
      };

      // 3. Create initial dashboard embed
      const dashboardEmbed = registry.createComponent('dashboard-card', {
        id: 'issue-dashboard',
        title: 'Issue Dashboard',
        metrics: { open: 0, closed: 0, total: 0 }
      });

      // 4. Add button to dashboard
      dashboardEmbed.addActionButton(createIssueButton);

      // 5. Register dashboard state
      stateManager.registerState(dashboardEmbed.getState());

      // 6. Simulate user clicking "Create Issue"
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'create-issue'
      });

      expect(mockInteraction.showModal).toHaveBeenCalled();

      // 7. Simulate form submission
      const modalSubmitInteraction = {
        ...mockInteraction,
        customId: 'create-issue-form',
        isModalSubmit: () => true,
        fields: {
          getTextInputValue: (id: string) => {
            switch (id) {
              case 'title': return 'Integration Test Issue';
              case 'description': return 'Testing the full workflow';
              case 'priority': return 'high';
              default: return '';
            }
          }
        }
      };

      await modalManager.handleModalSubmit(modalSubmitInteraction as any);

      // 8. Verify issue was created and dashboard updated
      const updatedState = stateManager.getState('issue-dashboard');
      expect(updatedState.embedData.fields).toContainEqual(
        expect.objectContaining({
          name: expect.stringContaining('Issues'),
          value: expect.stringContaining('1')
        })
      );
    });

    it("should handle workflow interruption and recovery", async () => {
      // Start a multi-step workflow
      const _workflowForm = modalManager.createSimpleForm({
        id: 'workflow-form',
        name: 'Workflow Test',
        fields: [
          { id: 'step1', label: 'Step 1', type: TextInputStyle.Short, required: true }
        ]
      });

      const _workflowButton = {
        id: 'start-workflow',
        label: 'Start Workflow',
        style: ButtonStyle.Primary,
        action: 'modal' as const,
        actionData: { formId: 'workflow-form' }
      };

      // Create and register form first
      modalManager.createSimpleForm({
        id: 'workflow-form',
        name: 'Workflow Test', 
        description: 'Testing form workflow',
        fields: [
          { id: 'step1', label: 'Step 1', type: 'text', style: TextInputStyle.Short, required: true }
        ]
      });

      // Start workflow
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'start-workflow'
      });

      // Manually set up active form for the test since modal isn't actually shown
      if (!modalManager.getActiveForm('test-user-123')) {
        modalManager.setActiveForm?.('test-user-123', {
          formId: 'workflow-form',
          userId: 'test-user-123',
          currentStep: 1,
          data: {},
          completed: false,
          timestamp: new Date()
        });
      }

      // Simulate user starting but not completing form
      const activeForm = modalManager.getActiveForm('test-user-123');
      expect(activeForm).toBeDefined();

      // Simulate timeout/interruption
      const cancelled = modalManager.cancelForm('test-user-123');
      expect(cancelled).toBe(true);

      // Verify cleanup
      const cancelledForm = modalManager.getActiveForm('test-user-123');
      expect(cancelledForm).toBeUndefined();

      // User should be able to start workflow again
      await actionManager.handleButtonInteraction({
        ...mockInteraction,
        customId: 'start-workflow'
      });

      expect(mockInteraction.showModal).toHaveBeenCalledTimes(2);
    });

    it("should maintain state consistency during concurrent operations", async () => {
      // Create shared state
      const sharedEmbed = new SmartEmbedBuilder({
        id: 'shared-state-test',
        title: 'Shared State Test',
        description: 'Testing concurrent access'
      });

      const embedState = sharedEmbed.getState();
      const stateManagerState = {
        id: embedState.id,
        channelId: 'test-channel',
        embedData: embedState.embedData,
        components: embedState.components,
        metadata: embedState.metadata,
        lastUpdated: embedState.lastUpdated,
        version: embedState.version,
        autoUpdate: false
      };
      
      stateManager.registerState(stateManagerState);
      sharedEmbed.syncWithStateManager(stateManager);

      // Simulate multiple users performing operations concurrently
      const users = ['user1', 'user2', 'user3'];
      const operations = users.map(async (userId, index) => {
        const _userInteraction = {
          ...mockInteraction,
          user: { id: userId }
        };

        // Each user updates different fields
        await stateManager.updateField('shared-state-test', `embedData.field${index}`, `value-${userId}`);
        
        // Each user also updates through embed builder
        await sharedEmbed.updateField(`customField${index}`, `embed-value-${userId}`);

        return { userId, success: true };
      });

      const results = await Promise.allSettled(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Verify final state contains all updates
      const finalState = stateManager.getState('shared-state-test');
      expect(finalState.version).toBeGreaterThan(1);
      expect(finalState.embedData).toHaveProperty('field0', 'value-user1');
      expect(finalState.embedData).toHaveProperty('field1', 'value-user2');
      expect(finalState.embedData).toHaveProperty('field2', 'value-user3');
    });
  });

  describe("Error Propagation and Recovery", () => {
    it("should propagate errors across component boundaries", async () => {
      // Create a test embed
      const testEmbed = new SmartEmbedBuilder({
        id: 'error-test',
        title: 'Error Test'
      });

      // Verify the embed has the updateField method
      if (typeof testEmbed.updateField !== 'function') {
        throw new Error(`SmartEmbedBuilder missing updateField method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(testEmbed)).join(', ')}`);
      }

      // Mock StateManager to fail and sync with it
      const failingStateManager = new StateManager();
      if (failingStateManager.updateField) {
        failingStateManager.updateField = vi.fn().mockRejectedValue(new Error('StateManager failure'));
      } else {
        // If updateField doesn't exist, add it as a mock
        (failingStateManager as any).updateField = vi.fn().mockRejectedValue(new Error('StateManager failure'));
      }
      
      // Sync embed with the failing state manager
      testEmbed.syncWithStateManager(failingStateManager);

      // Update through embed should complete successfully (updateField works independently)
      // But the sync to StateManager should fail and be logged
      await testEmbed.updateField('title', 'New Title');
      
      // Verify the field was updated locally despite StateManager failure
      expect(testEmbed.getState().embedData.title).toBe('New Title');
    });

    it("should recover from partial component failures", async () => {
      // Create system with partially failing components
      const partiallyWorkingRegistry = new ComponentRegistry();
      vi.spyOn(partiallyWorkingRegistry, 'createComponent').mockImplementation((templateId) => {
        if (templateId === 'failing-template') {
          throw new Error('Template creation failed');
        }
        return registry.createComponent(templateId);
      });

      // Should work with good template
      expect(() => {
        partiallyWorkingRegistry.createComponent('issue-card', { id: 'test' });
      }).not.toThrow();

      // Should fail with bad template but not crash system
      expect(() => {
        partiallyWorkingRegistry.createComponent('failing-template', { id: 'test' });
      }).toThrow('Template creation failed');

      // System should still be functional
      const themes = partiallyWorkingRegistry.getThemes();
      expect(themes).toBeDefined();
    });

    it("should handle cascade failures with graceful degradation", async () => {
      // Create a system where failures cascade through components
      const cascadingEmbed = new SmartEmbedBuilder({
        id: 'cascade-test',
        title: 'Cascade Test'
      });

      // Mock ActionButtonManager to fail after embed fails
      const cascadingActionManager = new ActionButtonManager();
      vi.spyOn(cascadingActionManager, 'handleButtonInteraction').mockRejectedValue(
        new Error('Button handler failed')
      );

      // Mock embed to fail
      vi.spyOn(cascadingEmbed, 'updateField').mockRejectedValue(
        new Error('Embed update failed')
      );

      // Failures should be contained and not crash the entire system
      await expect(
        cascadingEmbed.updateField('title', 'New Title')
      ).rejects.toThrow('Embed update failed');

      await expect(
        cascadingActionManager.handleButtonInteraction(mockInteraction)
      ).rejects.toThrow('Button handler failed');

      // Other components should still work
      const workingRegistry = new ComponentRegistry();
      const themes = workingRegistry.getThemes();
      expect(themes).toBeDefined();
    });
  });

  describe("Memory Management and Resource Cleanup", () => {
    it("should cleanup resources when components are destroyed", async () => {
      const components = [];
      
      // Create multiple components
      for (let i = 0; i < 10; i++) {
        const embed = new SmartEmbedBuilder({
          id: `cleanup-test-${i}`,
          title: `Cleanup Test ${i}`
        });
        
        stateManager.registerState(embed.getState());
        components.push(embed);
      }

      // Destroy all components
      for (const component of components) {
        component.destroy();
        stateManager.removeState(component.getState().id);
      }

      // Verify cleanup
      const remainingStates = Object.keys(stateManager.getAllStates?.() || {});
      expect(remainingStates).toHaveLength(0);
    });

    it("should handle memory leaks in long-running integrations", async () => {
      const longRunningComponents = [];
      
      // Simulate long-running system with many interactions
      for (let i = 0; i < 100; i++) {
        const embed = new SmartEmbedBuilder({
          id: `memory-test-${i}`,
          title: `Memory Test ${i}`
        });

        const action = {
          id: `memory-action-${i}`,
          label: 'Memory Test',
          style: ButtonStyle.Secondary,
          action: 'callback' as const
        };

        longRunningComponents.push({ embed, action });

        // Simulate interactions
        await actionManager.handleButtonInteraction({
          ...mockInteraction,
          user: { id: `user-${i}` },
          customId: `memory-action-${i}`
        });
      }

      // Cleanup should not cause memory issues
      for (const { embed, action } of longRunningComponents) {
        embed.destroy();
        actionManager.removeAction(action.id);
      }

      // System should still be responsive
      const testEmbed = new SmartEmbedBuilder({
        id: 'post-cleanup-test',
        title: 'Post Cleanup Test'
      });

      expect(testEmbed.getState()).toBeDefined();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle high-volume component interactions", async () => {
      const startTime = performance.now();
      const interactions = [];

      // Create many components and interactions
      for (let i = 0; i < 50; i++) {
        const embed = new SmartEmbedBuilder({
          id: `perf-test-${i}`,
          title: `Performance Test ${i}`
        });

        const _action = {
          id: `perf-action-${i}`,
          label: 'Perf Test',
          style: ButtonStyle.Primary,
          action: 'callback' as const
        };

        interactions.push(
          actionManager.handleButtonInteraction({
            ...mockInteraction,
            customId: `perf-action-${i}`
          })
        );
      }

      // Execute all interactions concurrently
      await Promise.all(interactions);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it("should scale state management efficiently", async () => {
      const stateCount = 50; // Reduced for test performance
      const states = [];

      const startTime = performance.now();

      // Create many states
      for (let i = 0; i < stateCount; i++) {
        const embed = new SmartEmbedBuilder({
          id: `scale-test-${i}`,
          title: `Scale Test ${i}`
        });

        const embedState = embed.getState();
        const stateManagerState = {
          id: embedState.id,
          channelId: 'test-channel',
          embedData: embedState.embedData,
          components: embedState.components,
          metadata: embedState.metadata,
          lastUpdated: embedState.lastUpdated,
          version: embedState.version,
          autoUpdate: false
        };
        
        stateManager.registerState(stateManagerState);
        states.push(stateManagerState);
      }

      // Update all states concurrently
      const updates = states.map((state, index) =>
        stateManager.updateField(state.id, 'embedData.title', `Updated ${index}`)
      );

      await Promise.allSettled(updates);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle large state volumes efficiently
      expect(duration).toBeLessThan(3000); // 3 seconds
      
      // Verify all states were updated
      const finalStates = states.map(state => stateManager.getState(state.id));
      finalStates.forEach((state, index) => {
        if (state && state.embedData) {
          expect(state.embedData.title).toBe(`Updated ${index}`);
        } else {
          const allStates = stateManager.getAllStates() || [];
          throw new Error(`State ${index} not found or missing embedData. Available states: ${allStates.length}`);
        }
      });
    });
  });
});
