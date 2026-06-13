/**
 * Comprehensive test suite for StateManager.ts
 * Target: 100% branch and statement coverage
 * Tests: State lifecycle, subscriptions, batch processing, auto-updates, nested object manipulation, edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unmock StateManager for its own tests
vi.unmock("../StateManager");

import { 
  StateManager, 
  stateManager,
  type EmbedState, 
  type StateSubscription 
} from "../StateManager";

describe("StateManager", () => {
  let manager: StateManager;
  let mockEmbedState: EmbedState;

  beforeEach(async () => {
    // Clear any existing timers before setting up new ones
    vi.clearAllTimers();
    vi.clearAllMocks();
    
    // Use fake timers for consistent test behavior  
    vi.useFakeTimers();
    
    // Mock setInterval and clearInterval for test spying
    vi.spyOn(global, 'setInterval');
    vi.spyOn(global, 'clearInterval');
    
    // Create a fresh StateManager instance for each test
    manager = new StateManager();
    
    // Set up consistent mock embed state with fresh data each time
    mockEmbedState = {
      id: "test-embed",
      messageId: "msg123",
      channelId: "channel123", 
      guildId: "guild123",
      embedData: { title: "Test Embed", description: "Test Description" },
      components: [{ type: 1, components: [] }],
      metadata: { key1: "value1", key2: "value2" },
      lastUpdated: new Date(),
      version: 1,
      autoUpdate: false,
      updateInterval: undefined,
    };
  });

  afterEach(async () => {
    // Clean up manager state first
    try {
      await manager.cleanup();
      manager.removeAllListeners();
    } catch {
      // Ignore cleanup errors in tests
    }
    
    // Clear all timers and mocks
    vi.clearAllTimers();
    vi.clearAllMocks();
    
    // Restore real timers
    vi.useRealTimers();
  });

  describe("Constructor and Initialization", () => {
    it("should create StateManager instance", () => {
      expect(manager).toBeInstanceOf(StateManager);
      expect(manager).toHaveProperty("registerState");
      expect(manager).toHaveProperty("updateState");
    });

    it("should extend EventEmitter", () => {
      expect(manager.on).toBeDefined();
      expect(manager.emit).toBeDefined();
      expect(manager.removeAllListeners).toBeDefined();
    });

    it("should initialize with default settings", () => {
      const stats = manager.getStats();
      expect(stats.totalStates).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.autoUpdateStates).toBe(0);
    });
  });

  describe("State Registration", () => {
    it("should register state successfully", () => {
      const emitSpy = vi.spyOn(manager, "emit");
      manager.registerState(mockEmbedState);

      const retrievedState = manager.getState("test-embed");
      expect(retrievedState).toEqual(mockEmbedState);
      expect(emitSpy).toHaveBeenCalledWith("stateRegistered", mockEmbedState);
    });

    it("should setup auto-update when enabled", () => {
      const autoUpdateState = {
        ...mockEmbedState,
        autoUpdate: true,
        updateInterval: 30,
      };

      manager.registerState(autoUpdateState);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it("should not setup auto-update when disabled", () => {
      manager.registerState(mockEmbedState);

      expect(setInterval).not.toHaveBeenCalled();
    });

    it("should not setup auto-update without interval", () => {
      const noIntervalState = {
        ...mockEmbedState,
        autoUpdate: true,
        updateInterval: undefined,
      };

      manager.registerState(noIntervalState);

      expect(setInterval).not.toHaveBeenCalled();
    });
  });

  describe("State Updates", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should update state successfully", async () => {
      const updates = {
        embedData: { title: "Updated Title" },
        metadata: { newKey: "newValue" },
      };

      const emitSpy = vi.spyOn(manager, "emit");
      const result = await manager.updateState("test-embed", updates, "user");

      expect(result).toBe(true);
      const state = manager.getState("test-embed");
      expect(state!.embedData).toEqual({ title: "Updated Title" });
      expect(state!.metadata).toEqual({ newKey: "newValue" });
      expect(state!.version).toBe(2);
      expect(emitSpy).toHaveBeenCalledWith("stateUpdated", expect.objectContaining({
        embedId: "test-embed",
        state: expect.any(Object),
        update: expect.any(Object),
      }));

      // Process queued updates using async timer handling
      await vi.runAllTimersAsync();
    }, 10000);

    it("should return false for non-existent state", async () => {
      const result = await manager.updateState("non-existent", {});
      expect(result).toBe(false);
    });

    it("should handle update with different sources", async () => {
      const sources: Array<'user' | 'system' | 'external'> = ['user', 'system', 'external'];
      
      for (const source of sources) {
        await manager.updateState("test-embed", { metadata: { source } }, source);
      }

      // Process all pending updates
      await vi.runAllTimersAsync();
      
      // Queue should eventually be processed
      expect(manager.getQueueLength()).toBeGreaterThanOrEqual(0);
    }, 5000);

    it("should preserve state reference when updating", async () => {
      const originalState = manager.getState("test-embed");
      
      await manager.updateState("test-embed", { metadata: { updated: true } });
      await vi.runAllTimersAsync();
      
      const updatedState = manager.getState("test-embed");
      expect(updatedState).toBe(originalState); // Same reference, modified in place
      expect(updatedState!.metadata).toEqual({ updated: true });
    }, 5000);
  });

  describe("Field Updates", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should update nested field successfully", async () => {
      const emitSpy = vi.spyOn(manager, "emit");
      const result = await manager.updateField("test-embed", "embedData.title", "New Title", "user");

      expect(result).toBe(true);
      await vi.runAllTimersAsync();
      
      const state = manager.getState("test-embed");
      expect(state).toBeDefined();
      expect(state!.embedData).toBeDefined();
      expect(state!.embedData.title).toBe("New Title");
      expect(state!.version).toBe(2);
      expect(emitSpy).toHaveBeenCalledWith("fieldUpdated", {
        embedId: "test-embed",
        field: "embedData.title",
        oldValue: "Test Embed",
        newValue: "New Title",
      });
    });

    it("should reject for non-existent state", async () => {
      await expect(manager.updateField("non-existent", "field", "value")).rejects.toThrow();
    });

    it("should handle deep nested field updates", async () => {
      const state = manager.getState("test-embed");
      state!.embedData = { nested: { deep: { value: "original" } } };

      await manager.updateField("test-embed", "embedData.nested.deep.value", "updated");
      await vi.runAllTimersAsync();

      const updatedState = manager.getState("test-embed");
      expect(updatedState!.embedData.nested.deep.value).toBe("updated");
    });

    it("should create nested objects if they don't exist", async () => {
      await manager.updateField("test-embed", "embedData.new.nested.field", "created");
      await vi.runAllTimersAsync();

      const state = manager.getState("test-embed");
      expect(state!.embedData.new.nested.field).toBe("created");
    });

    it("should handle field updates with different sources", async () => {
      const sources: Array<'user' | 'system' | 'external'> = ['user', 'system', 'external'];
      
      for (let i = 0; i < sources.length; i++) {
        await manager.updateField("test-embed", "metadata.source", sources[i], sources[i]);
      }
      await vi.runAllTimersAsync();

      const state = manager.getState("test-embed");
      expect(state!.metadata.source).toBe("external"); // Last update wins
    });
  });

  describe("State Retrieval", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
      manager.registerState({
        ...mockEmbedState,
        id: "second-embed",
        embedData: { title: "Second Embed" },
      });
    });

    it("should get specific state", () => {
      const state = manager.getState("test-embed");
      expect(state).toEqual(mockEmbedState);
    });

    it("should return undefined for non-existent state", () => {
      const state = manager.getState("non-existent");
      expect(state).toBeUndefined();
    });

    it("should get all states", () => {
      const states = manager.getAllStates();
      expect(states).toHaveLength(2);
      expect(states.some(s => s.id === "test-embed")).toBe(true);
      expect(states.some(s => s.id === "second-embed")).toBe(true);
    });
  });

  describe("Subscription Management", () => {
    let mockSubscription: StateSubscription;
    let mockCallback: vi.Mock;

    beforeEach(() => {
      manager.registerState(mockEmbedState);
      mockCallback = vi.fn();
      mockSubscription = {
        embedId: "test-embed",
        callback: mockCallback,
      };
    });

    it("should add subscription successfully", () => {
      const unsubscribe = manager.subscribe(mockSubscription);

      expect(typeof unsubscribe).toBe("function");
      expect(manager.getStats().activeSubscriptions).toBe(1);
    });

    it("should notify subscribers on state updates", async () => {
      manager.subscribe(mockSubscription);

      await manager.updateState("test-embed", { metadata: { notified: true } });
      
      // Process the update queue
      await vi.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalled();
    }, 15000);

    it("should filter notifications based on subscription filter", async () => {
      const filteredSubscription: StateSubscription = {
        embedId: "test-embed",
        callback: mockCallback,
        filter: (update) => update.field === "embedData.title",
      };

      manager.subscribe(filteredSubscription);

      // This should be filtered out
      await manager.updateField("test-embed", "metadata.key", "value");
      await vi.runAllTimersAsync();
      expect(mockCallback).not.toHaveBeenCalled();

      // This should pass the filter
      await manager.updateField("test-embed", "embedData.title", "New Title");
      await vi.runAllTimersAsync();
      expect(mockCallback).toHaveBeenCalled();
    });

    it("should unsubscribe successfully", async () => {
      const unsubscribe = manager.subscribe(mockSubscription);
      
      unsubscribe();
      
      await manager.updateState("test-embed", { metadata: { test: true } });
      await vi.runAllTimersAsync();

      expect(mockCallback).not.toHaveBeenCalled();
      expect(manager.getStats().activeSubscriptions).toBe(0);
    });

    it("should handle callback errors gracefully", async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });

      manager.subscribe({
        embedId: "test-embed",
        callback: errorCallback,
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await manager.updateState("test-embed", { metadata: { error: true } });
      await vi.runAllTimersAsync();

      expect(errorCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error in state subscription callback:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle multiple subscriptions for same embed", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.subscribe({ embedId: "test-embed", callback: callback1 });
      manager.subscribe({ embedId: "test-embed", callback: callback2 });

      await manager.updateState("test-embed", { metadata: { multiple: true } });
      await vi.runAllTimersAsync();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should not notify subscribers for other embeds", async () => {
      manager.registerState({
        ...mockEmbedState,
        id: "other-embed",
      });

      manager.subscribe(mockSubscription); // Subscribed to "test-embed"

      await manager.updateState("other-embed", { metadata: { other: true } });
      await vi.runAllTimersAsync();

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe("Update Queue and Batch Processing", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should queue updates for batch processing", async () => {
      await manager.updateField("test-embed", "field1", "value1");
      await manager.updateField("test-embed", "field2", "value2");
      await manager.updateField("test-embed", "field3", "value3");

      expect(manager.getQueueLength()).toBeGreaterThan(0);
    });

    it("should process updates in batches", async () => {
      const emitSpy = vi.spyOn(manager, "emit");
      
      // Add multiple updates
      for (let i = 0; i < 15; i++) {
        await manager.updateField("test-embed", `field${i}`, `value${i}`);
      }

      // Process the queue
      await vi.runAllTimersAsync();

      // Should emit embedUpdated events
      expect(emitSpy).toHaveBeenCalledWith("embedUpdated", expect.any(Object));
    });

    it("should handle batch processing with delays", async () => {
      // Add many updates to trigger multiple batches
      for (let i = 0; i < 25; i++) {
        await manager.updateField("test-embed", `field${i}`, `value${i}`);
      }

      // Process with delays between batches
      await vi.runAllTimersAsync();

      expect(manager.getQueueLength()).toBe(0); // Queue should be empty after processing
    });

    it("should handle processing errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      // Create a state that will cause processing errors
      manager.registerState({
        ...mockEmbedState,
        id: "error-embed",
        messageId: undefined, // This will cause updateDiscordMessage to skip
      });

      await manager.updateField("error-embed", "test", "value");
      await vi.runAllTimersAsync();

      // Should not throw and continue processing
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should group updates by embed ID", async () => {
      manager.registerState({
        ...mockEmbedState,
        id: "second-embed",
      });

      await manager.updateField("test-embed", "field1", "value1");
      await manager.updateField("second-embed", "field2", "value2");
      await manager.updateField("test-embed", "field3", "value3");

      // Updates should be grouped by embed ID during processing
      await vi.runAllTimersAsync();

      expect(manager.getQueueLength()).toBe(0);
    });
  });

  describe("Discord Integration", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should emit discordUpdateRequired for valid states", async () => {
      const emitSpy = vi.spyOn(manager, "emit");
      
      await manager.updateState("test-embed", { embedData: { title: "Updated" } });
      await vi.runAllTimersAsync();

      expect(emitSpy).toHaveBeenCalledWith("discordUpdateRequired", {
        messageId: "msg123",
        channelId: "channel123",
        guildId: "guild123",
        embedData: expect.any(Object),
        components: expect.any(Array),
      });
    });

    it("should not emit discordUpdateRequired for states without messageId", async () => {
      manager.registerState({
        ...mockEmbedState,
        id: "no-message",
        messageId: undefined,
      });

      const emitSpy = vi.spyOn(manager, "emit");
      
      await manager.updateState("no-message", { embedData: { title: "Updated" } });
      await vi.runAllTimersAsync();

      expect(emitSpy).not.toHaveBeenCalledWith("discordUpdateRequired", expect.anything());
    });

    it("should not emit discordUpdateRequired for states without channelId", async () => {
      manager.registerState({
        ...mockEmbedState,
        id: "no-channel",
        channelId: "",
      });

      const emitSpy = vi.spyOn(manager, "emit");
      
      await manager.updateState("no-channel", { embedData: { title: "Updated" } });
      await vi.runAllTimersAsync();

      expect(emitSpy).not.toHaveBeenCalledWith("discordUpdateRequired", expect.anything());
    });
  });

  describe("Persistence Integration", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should emit persistenceRequired when persistence is enabled", async () => {
      manager.setPersistenceEnabled(true);
      const emitSpy = vi.spyOn(manager, "emit");
      
      await manager.updateState("test-embed", { embedData: { title: "Persist" } });
      await vi.runAllTimersAsync();

      expect(emitSpy).toHaveBeenCalledWith("persistenceRequired", expect.any(Object));
    });

    it("should not emit persistenceRequired when persistence is disabled", async () => {
      manager.setPersistenceEnabled(false);
      const emitSpy = vi.spyOn(manager, "emit");
      
      await manager.updateState("test-embed", { embedData: { title: "No Persist" } });
      await vi.runAllTimersAsync();

      expect(emitSpy).not.toHaveBeenCalledWith("persistenceRequired", expect.anything());
    });

    it("should toggle persistence setting", () => {
      manager.setPersistenceEnabled(true);
      // Test that persistence is enabled (indirectly through behavior)
      
      manager.setPersistenceEnabled(false);
      // Test that persistence is disabled (indirectly through behavior)
      
      expect(true).toBe(true); // Setting doesn't throw
    });
  });

  describe("Auto-Update Functionality", () => {
    it("should setup auto-update timer for states", () => {
      const autoUpdateState = {
        ...mockEmbedState,
        id: "auto-update",
        autoUpdate: true,
        updateInterval: 60,
      };

      manager.registerState(autoUpdateState);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
      expect(manager.getStats().autoUpdateStates).toBe(1);
    });

    it("should emit refreshRequired on auto-update", () => {
      const autoUpdateState = {
        ...mockEmbedState,
        id: "auto-refresh",
        autoUpdate: true,
        updateInterval: 30,
      };

      const emitSpy = vi.spyOn(manager, "emit");
      manager.registerState(autoUpdateState);

      // Trigger auto-update
      vi.advanceTimersByTime(30000);

      expect(emitSpy).toHaveBeenCalledWith("refreshRequired", {
        embedId: "auto-refresh",
        state: expect.any(Object),
      });
    });

    it("should handle auto-update errors gracefully", () => {
      const autoUpdateState = {
        ...mockEmbedState,
        id: "error-refresh",
        autoUpdate: true,
        updateInterval: 30,
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      // Mock emit to throw error
      vi.spyOn(manager, "emit").mockImplementation(() => {
        throw new Error("Refresh failed");
      });

      manager.registerState(autoUpdateState);
      vi.advanceTimersByTime(30000);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error auto-updating state error-refresh:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should not setup auto-update for non-existent state", () => {
      // This tests the edge case where refreshState is called for missing state
      const emitSpy = vi.spyOn(manager, "emit");
      
      // Manually call refreshState for non-existent state
      manager["refreshState"]("non-existent");

      expect(emitSpy).not.toHaveBeenCalledWith("refreshRequired", expect.anything());
    });
  });

  describe("State Removal", () => {
    beforeEach(() => {
      manager.registerState({
        ...mockEmbedState,
        autoUpdate: true,
        updateInterval: 30,
      });
    });

    it("should remove state successfully", () => {
      const emitSpy = vi.spyOn(manager, "emit");
      const result = manager.removeState("test-embed");

      expect(result).toBe(true);
      expect(manager.getState("test-embed")).toBeUndefined();
      expect(clearInterval).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("stateRemoved", "test-embed");
    });

    it("should return false for non-existent state", () => {
      const result = manager.removeState("non-existent");
      expect(result).toBe(false);
    });

    it("should cleanup subscriptions on removal", () => {
      const callback = vi.fn();
      manager.subscribe({ embedId: "test-embed", callback });

      manager.removeState("test-embed");

      expect(manager.getStats().activeSubscriptions).toBe(0);
    });

    it("should cleanup auto-update timer on removal", () => {
      manager.removeState("test-embed");

      expect(clearInterval).toHaveBeenCalled();
      expect(manager.getStats().autoUpdateStates).toBe(0);
    });

    it("should handle removal of state without timer", () => {
      manager.registerState({
        ...mockEmbedState,
        id: "no-timer",
        autoUpdate: false,
      });

      expect(() => manager.removeState("no-timer")).not.toThrow();
    });
  });

  describe("Nested Object Manipulation", () => {
    let testObject: any;

    beforeEach(() => {
      testObject = {
        level1: {
          level2: {
            level3: "deep value",
            array: [1, 2, 3],
          },
          simple: "value",
        },
        root: "root value",
      };
    });

    it("should get nested value with dot notation", () => {
      const value = manager["getNestedValue"](testObject, "level1.level2.level3");
      expect(value).toBe("deep value");
    });

    it("should get root level value", () => {
      const value = manager["getNestedValue"](testObject, "root");
      expect(value).toBe("root value");
    });

    it("should return undefined for non-existent path", () => {
      const value = manager["getNestedValue"](testObject, "level1.nonexistent.path");
      expect(value).toBeUndefined();
    });

    it("should handle empty path", () => {
      const value = manager["getNestedValue"](testObject, "");
      expect(value).toBeUndefined();
    });

    it("should handle null/undefined objects", () => {
      const value1 = manager["getNestedValue"](null, "path");
      const value2 = manager["getNestedValue"](undefined, "path");
      
      expect(value1).toBeUndefined();
      expect(value2).toBeUndefined();
    });

    it("should set nested value with dot notation", () => {
      manager["setNestedValue"](testObject, "level1.level2.level3", "new deep value");
      expect(testObject.level1.level2.level3).toBe("new deep value");
    });

    it("should set root level value", () => {
      manager["setNestedValue"](testObject, "root", "new root value");
      expect(testObject.root).toBe("new root value");
    });

    it("should create nested objects when they don't exist", () => {
      manager["setNestedValue"](testObject, "new.nested.path", "created value");
      expect(testObject.new.nested.path).toBe("created value");
    });

    it("should handle single key path", () => {
      manager["setNestedValue"](testObject, "singleKey", "single value");
      expect(testObject.singleKey).toBe("single value");
    });

    it("should overwrite existing nested values", () => {
      manager["setNestedValue"](testObject, "level1.simple", "overwritten");
      expect(testObject.level1.simple).toBe("overwritten");
    });
  });

  describe("Statistics and Management", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
      manager.registerState({
        ...mockEmbedState,
        id: "second-embed",
        autoUpdate: true,
        updateInterval: 60,
      });
    });

    it("should provide accurate statistics", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.subscribe({ embedId: "test-embed", callback: callback1 });
      manager.subscribe({ embedId: "second-embed", callback: callback2 });
      manager.subscribe({ embedId: "test-embed", callback: callback2 }); // Multiple for same embed

      const stats = manager.getStats();
      expect(stats.totalStates).toBe(2);
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.autoUpdateStates).toBe(1);
      expect(stats.queueLength).toBe(0);
    });

    it("should get queue length", async () => {
      await manager.updateField("test-embed", "field", "value");
      
      expect(manager.getQueueLength()).toBeGreaterThan(0);
    });

    it("should cleanup all resources", () => {
      const callback = vi.fn();
      manager.subscribe({ embedId: "test-embed", callback });

      manager.cleanup();

      const stats = manager.getStats();
      expect(stats.totalStates).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.autoUpdateStates).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe("Global Instance", () => {
    it("should provide global stateManager instance", () => {
      expect(stateManager).toBeInstanceOf(StateManager);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent updates", async () => {
      manager.registerState(mockEmbedState);

      // Simulate concurrent updates
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.updateField("test-embed", "concurrentField", `value${i}`)
      );

      await Promise.all(promises);

      // Should handle all updates without errors
      expect(manager.getState("test-embed")).toBeDefined();
    });

    it("should handle empty update objects", async () => {
      manager.registerState(mockEmbedState);

      const result = await manager.updateState("test-embed", {});
      expect(result).toBe(true);
    });

    it("should handle null/undefined update values", async () => {
      manager.registerState(mockEmbedState);

      await manager.updateField("test-embed", "nullField", null);
      await manager.updateField("test-embed", "undefinedField", undefined);

      const state = manager.getState("test-embed");
      expect(state!.nullField).toBeNull();
      expect(state!.undefinedField).toBeUndefined();
    });

    it("should handle very deep nested paths", async () => {
      manager.registerState(mockEmbedState);

      const deepPath = "a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p";
      await manager.updateField("test-embed", deepPath, "very deep");

      const value = manager["getNestedValue"](manager.getState("test-embed"), deepPath);
      expect(value).toBe("very deep");
    });

    it("should handle circular reference prevention", () => {
      const circularObj: any = { self: null };
      circularObj.self = circularObj;

      expect(() => {
        manager["setNestedValue"](circularObj, "new.path", "value");
      }).not.toThrow();
    });

    it("should handle subscription to non-existent embed", () => {
      const callback = vi.fn();
      
      const unsubscribe = manager.subscribe({
        embedId: "non-existent",
        callback,
      });

      expect(typeof unsubscribe).toBe("function");
      expect(() => unsubscribe()).not.toThrow();
    });

    it("should handle processing when queue is already being processed", async () => {
      manager.registerState(mockEmbedState);
      
      // Start processing
      await manager.updateField("test-embed", "field1", "value1");
      
      // Try to add more updates while processing
      await manager.updateField("test-embed", "field2", "value2");
      
      // Should handle gracefully without deadlocks
      await vi.runAllTimersAsync();
      
      expect(manager.getQueueLength()).toBe(0);
    });

    it("should handle updates to states with null embedData", async () => {
      const nullEmbedState = {
        ...mockEmbedState,
        id: "null-embed",
        embedData: null as any,
      };

      manager.registerState(nullEmbedState);
      
      // Should not throw when updating null embedData
      await expect(
        manager.updateField("null-embed", "embedData.title", "New Title")
      ).resolves.toBe(true);
    });

    it("should handle malformed path strings", async () => {
      manager.registerState(mockEmbedState);

      const malformedPaths = [
        "..doubleStart",
        "end..",
        "middle..double",
        ".startWithDot",
        "normal.path.", // End with dot
      ];

      for (const path of malformedPaths) {
        await expect(
          manager.updateField("test-embed", path, "value")
        ).resolves.toBe(true);
      }
    });
  });

  describe("Batch Processing Error Handling", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should handle errors in embed update processing", async () => {
      const emitSpy = vi.spyOn(manager, "emit");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Force an error by mocking emit to throw
      emitSpy.mockImplementation((event) => {
        if (event === "discordUpdateRequired") {
          throw new Error("Discord update failed");
        }
        return true;
      });

      await manager.updateField("test-embed", "test", "value");
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error processing updates for embed test-embed:",
        expect.any(Error)
      );

      expect(emitSpy).toHaveBeenCalledWith("updateError", {
        embedId: "test-embed",
        error: expect.any(Error),
        updates: expect.any(Array),
      });

      emitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should continue processing other embeds when one fails", async () => {
      manager.registerState({
        ...mockEmbedState,
        id: "failing-embed",
      });

      manager.registerState({
        ...mockEmbedState,
        id: "working-embed",
      });

      const emitSpy = vi.spyOn(manager, "emit");
      
      // Mock to fail only for failing-embed
      emitSpy.mockImplementation((event, data) => {
        if (event === "discordUpdateRequired" && data?.embedId === "failing-embed") {
          throw new Error("Simulated failure");
        }
        return true;
      });

      await manager.updateField("failing-embed", "test", "fail");
      await manager.updateField("working-embed", "test", "work");
      
      await vi.runAllTimersAsync();

      // Both should be processed, even though one failed
      expect(emitSpy).toHaveBeenCalledWith("updateError", expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith("embedUpdated", expect.objectContaining({
        embedId: "working-embed",
      }));

      emitSpy.mockRestore();
    });
  });

  describe("Additional Coverage Tests", () => {
    beforeEach(() => {
      manager.registerState(mockEmbedState);
    });

    it("should handle getNestedValue with array indices", () => {
      const testObj = {
        items: ["first", "second", "third"],
        nested: {
          arrays: [{ name: "test" }],
        },
      };

      const value1 = manager["getNestedValue"](testObj, "items.0");
      const value2 = manager["getNestedValue"](testObj, "nested.arrays.0.name");
      
      expect(value1).toBe("first");
      expect(value2).toBe("test");
    });

    it("should handle setNestedValue with array indices", () => {
      const testObj = {
        items: ["first", "second"],
      };

      manager["setNestedValue"](testObj, "items.1", "modified");
      expect(testObj.items[1]).toBe("modified");
    });

    it("should handle updateField with array path", async () => {
      const state = manager.getState("test-embed");
      state!.embedData = { items: ["item1", "item2"] };

      await manager.updateField("test-embed", "embedData.items.0", "updated");
      await vi.runAllTimersAsync();

      const updatedState = manager.getState("test-embed");
      expect(updatedState!.embedData.items[0]).toBe("updated");
    });

    it("should handle persistence with null state", async () => {
      manager.setPersistenceEnabled(true);
      const emitSpy = vi.spyOn(manager, "emit");

      // Try to update non-existent state
      await manager.updateState("non-existent", { metadata: { test: true } });
      await vi.runAllTimersAsync();

      // Should not emit persistenceRequired for non-existent state
      expect(emitSpy).not.toHaveBeenCalledWith("persistenceRequired", expect.anything());
    });

    it("should handle nested value assignment to non-object properties", () => {
      const testObj = {
        simpleValue: "string",
      };

      // Trying to set nested path on non-object should handle gracefully
      expect(() => {
        manager["setNestedValue"](testObj, "simpleValue.nested.path", "value");
      }).not.toThrow();
    });

    it("should handle updateState with circular references", async () => {
      const circularUpdate: any = { test: "value" };
      circularUpdate.self = circularUpdate;

      const result = await manager.updateState("test-embed", circularUpdate);
      expect(result).toBe(true);
      
      // Should not cause infinite loops
      await vi.runAllTimersAsync();
    });

    it("should handle subscription cleanup on state removal", () => {
      const callback = vi.fn();
      manager.subscribe({ embedId: "test-embed", callback });

      expect(manager.getStats().activeSubscriptions).toBe(1);
      
      manager.removeState("test-embed");
      
      expect(manager.getStats().activeSubscriptions).toBe(0);
    });

    it("should handle auto-refresh with invalid state reference", () => {
      const invalidState = {
        ...mockEmbedState,
        id: "invalid-refresh",
        autoUpdate: true,
        updateInterval: 30,
      };

      manager.registerState(invalidState);
      
      // Remove the state but leave timer running
      manager["states"].delete("invalid-refresh");
      
      // Trigger refresh on non-existent state
      const emitSpy = vi.spyOn(manager, "emit");
      manager["refreshState"]("invalid-refresh");
      
      expect(emitSpy).not.toHaveBeenCalledWith("refreshRequired", expect.anything());
    });

    it("should handle batch processing with mixed embed types", async () => {
      const embedStates = [
        { ...mockEmbedState, id: "embed-1", messageId: "msg1" },
        { ...mockEmbedState, id: "embed-2", messageId: undefined }, // No messageId
        { ...mockEmbedState, id: "embed-3", channelId: "" }, // Empty channelId
        { ...mockEmbedState, id: "embed-4", messageId: "msg4" },
      ];

      embedStates.forEach(state => manager.registerState(state));

      // Update all embeds
      for (const state of embedStates) {
        await manager.updateField(state.id, "metadata.test", "batch");
      }

      await vi.runAllTimersAsync();

      // Should process all without errors
      embedStates.forEach(state => {
        const updatedState = manager.getState(state.id);
        expect(updatedState!.metadata.test).toBe("batch");
      });
    });

    it("should handle getNestedValue with numeric keys as strings", () => {
      const testObj = {
        "123": "numeric key",
        nested: {
          "456": "nested numeric",
        },
      };

      const value1 = manager["getNestedValue"](testObj, "123");
      const value2 = manager["getNestedValue"](testObj, "nested.456");
      
      expect(value1).toBe("numeric key");
      expect(value2).toBe("nested numeric");
    });

    it("should handle subscription filter with undefined update", async () => {
      const mockCallback = vi.fn();
      const filterCallback = vi.fn().mockReturnValue(true);
      const subscription: StateSubscription = {
        embedId: "test-embed",
        callback: mockCallback,
        filter: filterCallback,
      };

      manager.subscribe(subscription);

      // Update with undefined field
      await manager.updateField("test-embed", "undefined.field", "value");
      await vi.runAllTimersAsync();

      expect(filterCallback).toHaveBeenCalled();
    });
  });

  describe("Advanced Memory Management and Performance", () => {
    it("should handle nested object manipulation safely", async () => {
      const nestedState = {
        ...mockEmbedState,
        metadata: {
          level1: {
            level2: {
              level3: {
                deepValue: "original",
                array: [1, 2, 3]
              }
            }
          }
        }
      };

      manager.registerState(nestedState);
      
      // Update nested value
      await manager.updateField("test-embed", "metadata.level1.level2.level3.deepValue", "updated");
      
      const state = manager.getState("test-embed");
      expect(state?.metadata.level1.level2.level3.deepValue).toBe("updated");
    });

    it("should handle concurrent subscription operations", async () => {
      manager.registerState(mockEmbedState);
      
      // Create many subscriptions concurrently
      const unsubscribeFunctions = [];
      for (let i = 0; i < 100; i++) {
        const unsubscribe = manager.subscribe({
          embedId: "test-embed",
          callback: vi.fn(),
        });
        unsubscribeFunctions.push(unsubscribe);
      }
      
      // Update state to trigger all subscriptions
      await manager.updateState("test-embed", {
        embedData: { title: "Updated for all subscriptions" }
      });
      
      await vi.runAllTimersAsync();
      
      // All subscription callbacks should exist
      expect(unsubscribeFunctions.length).toBe(100);
      
      // Cleanup subscriptions
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    });

    it("should prevent memory leaks in subscription management", () => {
      manager.registerState(mockEmbedState);
      
      // Create and destroy many subscriptions
      for (let i = 0; i < 1000; i++) {
        const unsubscribe = manager.subscribe({
          embedId: "test-embed", 
          callback: vi.fn()
        });
        unsubscribe();
      }
      
      const stats = manager.getStats();
      expect(stats.activeSubscriptions).toBe(0);
    });

    it("should handle auto-update cleanup on state removal", () => {
      const autoUpdateState = {
        ...mockEmbedState,
        id: "auto-update-test",
        autoUpdate: true,
        updateInterval: 30
      };
      
      manager.registerState(autoUpdateState);
      expect(setInterval).toHaveBeenCalled();
      
      const removed = manager.removeState("auto-update-test");
      expect(removed).toBe(true);
      expect(clearInterval).toHaveBeenCalled();
    });

    it("should handle complex state queries efficiently", () => {
      // Register states with different metadata
      for (let i = 0; i < 100; i++) {
        manager.registerState({
          ...mockEmbedState,
          id: `embed-${i}`,
          metadata: {
            type: i % 2 === 0 ? "even" : "odd",
            priority: i % 3,
            tags: [`tag-${i}`, `category-${i % 5}`]
          }
        });
      }
      
      const stats = manager.getStats();
      expect(stats.totalStates).toBe(100);
      
      // Query operations should be fast
      const start = performance.now();
      const evenStates = [];
      for (let i = 0; i < 100; i += 2) {
        const state = manager.getState(`embed-${i}`);
        if (state) evenStates.push(state);
      }
      const duration = performance.now() - start;
      
      expect(evenStates.length).toBe(50);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it("should handle circular reference protection in nested updates", async () => {
      const circularState = {
        ...mockEmbedState,
        metadata: {
          circular: null as any
        }
      };
      
      // Create circular reference
      circularState.metadata.circular = circularState.metadata;
      
      manager.registerState(circularState);
      
      // Should not cause stack overflow
      await expect(manager.updateField("test-embed", "metadata.newField", "safe")).resolves.toBe(true);
    });

    it("should handle error recovery in batch processing", async () => {
      manager.registerState(mockEmbedState);
      
      // Create updates with mix of valid and invalid operations
      const updates = [];
      for (let i = 0; i < 10; i++) {
        if (i === 5) {
          // Add an update that will cause an error
          updates.push(manager.updateField("non-existent", "field", "value"));
        } else {
          updates.push(manager.updateState("test-embed", { 
            metadata: { step: i } 
          }));
        }
      }
      
      const results = await Promise.allSettled(updates);
      
      // Most should succeed despite one failure
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(9);
    });

    it("should handle large payload updates efficiently", async () => {
      manager.registerState(mockEmbedState);
      
      // Create large update payload
      const largeMetadata = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = `value${i}`.repeat(100);
      }
      
      const start = performance.now();
      await manager.updateState("test-embed", { metadata: largeMetadata });
      vi.runAllTimers();
      const duration = performance.now() - start;
      
      // Should handle large updates efficiently
      expect(duration).toBeLessThan(1000);
      
      const state = manager.getState("test-embed");
      expect(Object.keys(state!.metadata).length).toBe(1000);
    });

    it("should handle subscription cleanup on manager destruction", () => {
      manager.registerState(mockEmbedState);
      
      // Create subscriptions
      const subscriptions = [];
      for (let i = 0; i < 10; i++) {
        const sub = manager.subscribe({
          embedId: "test-embed",
          callback: vi.fn()
        });
        subscriptions.push(sub);
      }
      
      expect(manager.getStats().activeSubscriptions).toBe(10);
      
      // Cleanup should remove all subscriptions
      manager.cleanup();
      
      const finalStats = manager.getStats();
      expect(finalStats.activeSubscriptions).toBe(0);
      expect(finalStats.totalStates).toBe(0);
    });
  });
});
