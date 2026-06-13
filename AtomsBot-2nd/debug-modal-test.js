// Quick debug test to see if modal builders work
const { describe, it, expect, vi, beforeEach } = require("vitest");

// Mock Discord.js exactly as in integration tests
vi.mock("discord.js", () => {
  const EmbedBuilder = vi.fn().mockImplementation(function EmbedBuilder() {
    return {
      setTitle: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({}),
    };
  });
  
  const ModalBuilder = vi.fn().mockImplementation(function ModalBuilder() {
    return {
      setCustomId: vi.fn().mockReturnThis(),
      setTitle: vi.fn().mockReturnThis(),
      addComponents: vi.fn().mockReturnThis(),
    };
  });
  
  const TextInputBuilder = vi.fn().mockImplementation(function TextInputBuilder() {
    return {
      setCustomId: vi.fn().mockReturnThis(),
      setLabel: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis(),
      setPlaceholder: vi.fn().mockReturnThis(),
      setRequired: vi.fn().mockReturnThis(),
    };
  });
  
  const ActionRowBuilder = vi.fn().mockImplementation(function ActionRowBuilder() {
    return {
      addComponents: vi.fn().mockReturnThis(),
    };
  });
  
  return {
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle: {
      Short: 1,
      Paragraph: 2,
    },
  };
});

describe("Modal Builder Test", () => {
  it("should create modal builders properly", () => {
    const { ModalBuilder, TextInputBuilder, ActionRowBuilder } = require("discord.js");
    
    const modal = new ModalBuilder();
    modal.setCustomId('test-modal');
    modal.setTitle('Test Modal');
    
    const textInput = new TextInputBuilder();
    textInput.setCustomId('test-input');
    textInput.setLabel('Test Input');
    textInput.setStyle(1);
    
    const actionRow = new ActionRowBuilder();
    actionRow.addComponents(textInput);
    
    modal.addComponents(actionRow);
    
    expect(modal).toBeDefined();
    console.log('Modal builder test passed');
  });
});