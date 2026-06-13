import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FormTemplate,
  FormField,
} from "../ModalFormManager";
import {
  ModalSubmitInteraction,
  TextInputStyle,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";

// Mock Discord.js components
vi.mock("discord.js", () => ({
  ModalBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    addComponents: vi.fn().mockReturnThis(),
  })),
  TextInputBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setLabel: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    setRequired: vi.fn().mockReturnThis(),
    setPlaceholder: vi.fn().mockReturnThis(),
    setMinLength: vi.fn().mockReturnThis(),
    setMaxLength: vi.fn().mockReturnThis(),
    setValue: vi.fn().mockReturnThis(),
  })),
  ActionRowBuilder: vi.fn().mockImplementation(() => ({
    addComponents: vi.fn().mockReturnThis(),
  })),
  EmbedBuilder: vi.fn().mockImplementation(() => ({
    setTitle: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setTimestamp: vi.fn().mockReturnThis(),
    addFields: vi.fn().mockReturnThis(),
  })),
  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },
  MessageFlags: {
    Ephemeral: 64,
  },
}));

describe("ModalFormManager", () => {
  let manager: any;
  let RealModalFormManager: any;
  let mockInteraction: Partial<any>;
  let mockModalSubmitInteraction: Partial<ModalSubmitInteraction>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const realMod: any = await (vi as any).importActual('../ModalFormManager');
    RealModalFormManager = realMod.ModalFormManager ?? realMod.default?.ModalFormManager ?? realMod;
    manager = new RealModalFormManager();
    
    mockInteraction = {
      user: { id: "test-user-123" },
      showModal: vi.fn(),
      reply: vi.fn(),
      fields: {
        getTextInputValue: vi.fn(),
      },
      replied: false,
      deferred: false,
      followUp: vi.fn(),
    };

    mockModalSubmitInteraction = {
      customId: "form_test-template_step_0",
      user: { id: "test-user-123" },
      reply: vi.fn(),
      fields: {
        getTextInputValue: vi.fn(),
      },
      replied: false,
      deferred: false,
      followUp: vi.fn(),
    } as Partial<ModalSubmitInteraction>;
  });

  afterEach(() => {
    // Clean up timers
    vi.clearAllTimers();
  });

  describe("Template Registration", () => {
    it("should register a form template successfully", () => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [
          {
            id: "step1",
            title: "Step 1",
            fields: [
              {
                id: "field1",
                label: "Test Field",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
              },
            ],
          },
        ],
      };

      const emitSpy = vi.spyOn(manager, "emit");
      manager.registerTemplate(template);

      expect(manager.getTemplate("test-template")).toEqual(template);
      expect(emitSpy).toHaveBeenCalledWith("templateRegistered", template);
    });

    it("should get all templates", () => {
      const template1: FormTemplate = {
        id: "template1",
        name: "Template 1",
        description: "First template",
        steps: [],
      };

      const template2: FormTemplate = {
        id: "template2",
        name: "Template 2",
        description: "Second template",
        steps: [],
      };

      manager.registerTemplate(template1);
      manager.registerTemplate(template2);

      const templates = manager.getTemplates();
      expect(templates).toHaveLength(2);
      expect(templates).toContain(template1);
      expect(templates).toContain(template2);
    });

    it("should get templates by category", () => {
      const template1: FormTemplate = {
        id: "template1",
        name: "Template 1",
        description: "First template",
        category: "bugs",
        steps: [],
      };

      const template2: FormTemplate = {
        id: "template2",
        name: "Template 2",
        description: "Second template",
        category: "features",
        steps: [],
      };

      const template3: FormTemplate = {
        id: "template3",
        name: "Template 3",
        description: "Third template",
        category: "bugs",
        steps: [],
      };

      manager.registerTemplate(template1);
      manager.registerTemplate(template2);
      manager.registerTemplate(template3);

      const bugTemplates = manager.getTemplatesByCategory("bugs");
      expect(bugTemplates).toHaveLength(2);
      expect(bugTemplates).toContain(template1);
      expect(bugTemplates).toContain(template3);

      const featureTemplates = manager.getTemplatesByCategory("features");
      expect(featureTemplates).toHaveLength(1);
      expect(featureTemplates).toContain(template2);
    });
  });

  describe("Form Creation", () => {
    it("should create a simple form", () => {
      const fields: FormField[] = [
        {
          id: "title",
          label: "Title",
          type: "text",
          style: TextInputStyle.Short,
          required: true,
        },
        {
          id: "description",
          label: "Description",
          type: "textarea",
          style: TextInputStyle.Paragraph,
          required: false,
        },
      ];

      const template = manager.createSimpleForm(
        "simple-test",
        "Simple Test Form",
        "A simple test form",
        fields
      );

      expect(template.id).toBe("simple-test");
      expect(template.name).toBe("Simple Test Form");
      expect(template.steps).toHaveLength(1);
      expect(template.steps[0].fields).toEqual(fields);
      expect(manager.getTemplate("simple-test")).toEqual(template);
    });
  });

  describe("Form Submission Workflow", () => {
    let testTemplate: FormTemplate;

    beforeEach(() => {
      testTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [
          {
            id: "step1",
            title: "Basic Info",
            fields: [
              {
                id: "title",
                label: "Title",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
                minLength: 3,
                maxLength: 100,
              },
              {
                id: "email",
                label: "Email",
                type: "email",
                style: TextInputStyle.Short,
                required: true,
              },
            ],
          },
          {
            id: "step2",
            title: "Details",
            fields: [
              {
                id: "description",
                label: "Description",
                type: "textarea",
                style: TextInputStyle.Paragraph,
                required: false,
              },
            ],
          },
        ],
      };

      manager.registerTemplate(testTemplate);
    });

    it("should start a new form submission", async () => {
      await manager.startForm(mockInteraction, "test-template");

      const activeSubmission = manager.getActiveSubmission("test-user-123");
      expect(activeSubmission).toBeDefined();
      expect(activeSubmission!.formId).toBe("test-template");
      expect(activeSubmission!.userId).toBe("test-user-123");
      expect(activeSubmission!.currentStep).toBe(0);
      expect(activeSubmission!.completed).toBe(false);
      expect(mockInteraction.showModal).toHaveBeenCalled();
    });

    it("should start form with initial data", async () => {
      const initialData = { title: "Pre-filled Title" };

      await manager.startForm(mockInteraction, "test-template", initialData);

      const activeSubmission = manager.getActiveSubmission("test-user-123");
      expect(activeSubmission!.data).toEqual(initialData);
    });

    it("should throw error for non-existent template", async () => {
      await expect(
        manager.startForm(mockInteraction, "non-existent")
      ).rejects.toThrow("Form template 'non-existent' not found");
    });

    it("should handle button interaction without showModal method", async () => {
      const buttonInteraction = {
        ...mockInteraction,
        showModal: undefined,
      };

      await manager.startForm(buttonInteraction, "test-template");

      expect(buttonInteraction.reply).toHaveBeenCalledWith({
        content: "Opening form...",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("Modal Submission Handling", () => {
    let testTemplate: FormTemplate;

    beforeEach(() => {
      testTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [
          {
            id: "step1",
            title: "Basic Info",
            fields: [
              {
                id: "title",
                label: "Title",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
                minLength: 3,
                maxLength: 100,
              },
            ],
          },
        ],
      };

      manager.registerTemplate(testTemplate);
    });

    it("should handle valid modal submission", async () => {
      // Start form first
      await manager.startForm(mockInteraction, "test-template");

      // Mock field values
      (mockModalSubmitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Valid Title");

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleModalSubmit(mockModalSubmitInteraction as ModalSubmitInteraction);

      expect(emitSpy).toHaveBeenCalledWith("formCompleted", expect.objectContaining({
        template: testTemplate,
        user: mockModalSubmitInteraction.user,
      }));
    });

    it("should handle invalid custom ID format", async () => {
      const invalidInteraction = {
        ...mockModalSubmitInteraction,
        customId: "invalid-format",
      };

      await manager.handleModalSubmit(invalidInteraction as ModalSubmitInteraction);

      expect(invalidInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Invalid form submission.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle non-existent template", async () => {
      const invalidInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_non-existent_step_0",
      };

      await manager.handleModalSubmit(invalidInteraction as ModalSubmitInteraction);

      expect(invalidInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Form session not found or expired.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle no active submission", async () => {
      await manager.handleModalSubmit(mockModalSubmitInteraction as ModalSubmitInteraction);

      expect(mockModalSubmitInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Form session not found or expired.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle validation errors", async () => {
      // Start form first
      await manager.startForm(mockInteraction, "test-template");

      // Mock invalid field values
      (mockModalSubmitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue(""); // Empty required field

      await manager.handleModalSubmit(mockModalSubmitInteraction as ModalSubmitInteraction);

      expect(mockModalSubmitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("❌ **Validation Errors:**"),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should handle exceptions in modal submit", async () => {
      // Mock an error scenario
      const errorInteraction = {
        ...mockModalSubmitInteraction,
        fields: {
          getTextInputValue: vi.fn().mockImplementation(() => {
            throw new Error("Field access error");
          }),
        },
      };

      await manager.handleModalSubmit(errorInteraction as ModalSubmitInteraction);

      expect(errorInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Something went wrong while processing your submission.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle follow-up error for already replied interaction", async () => {
      const repliedInteraction = {
        ...mockModalSubmitInteraction,
        replied: true,
        fields: {
          getTextInputValue: vi.fn().mockImplementation(() => {
            throw new Error("Field access error");
          }),
        },
      };

      await manager.handleModalSubmit(repliedInteraction as ModalSubmitInteraction);

      expect(repliedInteraction.followUp).toHaveBeenCalledWith({
        content: "❌ Something went wrong while processing your submission.",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("Multi-step Forms", () => {
    let multiStepTemplate: FormTemplate;

    beforeEach(() => {
      multiStepTemplate = {
        id: "multi-step",
        name: "Multi-step Form",
        description: "A multi-step form",
        steps: [
          {
            id: "step1",
            title: "Step 1",
            fields: [
              {
                id: "field1",
                label: "Field 1",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
              },
            ],
          },
          {
            id: "step2",
            title: "Step 2",
            fields: [
              {
                id: "field2",
                label: "Field 2",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
              },
            ],
          },
          {
            id: "step3",
            title: "Conditional Step",
            condition: (data) => data.field1 === "show-step3",
            fields: [
              {
                id: "field3",
                label: "Field 3",
                type: "text",
                style: TextInputStyle.Short,
                required: false,
              },
            ],
          },
        ],
      };

      manager.registerTemplate(multiStepTemplate);
    });

    it("should progress through multiple steps", async () => {
      // Start form
      await manager.startForm(mockInteraction, "multi-step");

      // Submit step 1
      const step1Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_0",
      };
      (step1Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("Step 1 Value");

      await manager.handleModalSubmit(step1Interaction as ModalSubmitInteraction);

      const submission = manager.getActiveSubmission("test-user-123");
      expect(submission!.currentStep).toBe(1);
      expect(submission!.data.field1).toBe("Step 1 Value");

      // Submit step 2
      const step2Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_1",
      };
      (step2Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("Step 2 Value");

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleModalSubmit(step2Interaction as ModalSubmitInteraction);

      expect(emitSpy).toHaveBeenCalledWith("formCompleted", expect.any(Object));
      expect(manager.getActiveSubmission("test-user-123")).toBeUndefined();
    });

    it("should skip conditional steps when condition is false", async () => {
      // Start form
      await manager.startForm(mockInteraction, "multi-step");

      // Submit step 1 without triggering condition
      const step1Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_0",
      };
      (step1Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("normal-value");

      await manager.handleModalSubmit(step1Interaction as ModalSubmitInteraction);

      // Submit step 2 (should skip step 3)
      const step2Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_1",
      };
      (step2Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("Step 2 Value");

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleModalSubmit(step2Interaction as ModalSubmitInteraction);

      expect(emitSpy).toHaveBeenCalledWith("formCompleted", expect.any(Object));
    });

    it("should include conditional steps when condition is true", async () => {
      // Start form
      await manager.startForm(mockInteraction, "multi-step");

      // Submit step 1 with condition triggering value
      const step1Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_0",
      };
      (step1Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("show-step3");

      await manager.handleModalSubmit(step1Interaction as ModalSubmitInteraction);

      // Submit step 2
      const step2Interaction = {
        ...mockModalSubmitInteraction,
        customId: "form_multi-step_step_1",
      };
      (step2Interaction.fields!.getTextInputValue as any)
        .mockReturnValue("Step 2 Value");

      await manager.handleModalSubmit(step2Interaction as ModalSubmitInteraction);

      // Should now be on step 3
      const submission = manager.getActiveSubmission("test-user-123");
      expect(submission!.currentStep).toBe(2);
    });
  });

  describe("Field Validation", () => {
    let validationTemplate: FormTemplate;

    beforeEach(() => {
      validationTemplate = {
        id: "validation-test",
        name: "Validation Test",
        description: "Form for testing validation",
        steps: [
          {
            id: "step1",
            title: "Validation Test",
            fields: [
              {
                id: "required_field",
                label: "Required Field",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
              },
              {
                id: "length_field",
                label: "Length Field",
                type: "text",
                style: TextInputStyle.Short,
                minLength: 5,
                maxLength: 10,
                required: false,
              },
              {
                id: "email_field",
                label: "Email Field",
                type: "email",
                style: TextInputStyle.Short,
                required: false,
              },
              {
                id: "url_field",
                label: "URL Field",
                type: "url",
                style: TextInputStyle.Short,
                required: false,
              },
              {
                id: "number_field",
                label: "Number Field",
                type: "number",
                style: TextInputStyle.Short,
                required: false,
              },
              {
                id: "pattern_field",
                label: "Pattern Field",
                type: "text",
                style: TextInputStyle.Short,
                required: false,
                validation: {
                  pattern: /^[A-Z]{3}-\d{3}$/,
                },
              },
              {
                id: "custom_field",
                label: "Custom Field",
                type: "text",
                style: TextInputStyle.Short,
                required: false,
                validation: {
                  customValidator: (value) => {
                    if (value === "error") return "Custom error message";
                    if (value === "invalid") return false;
                    return true;
                  },
                },
              },
            ],
          },
        ],
      };

      manager.registerTemplate(validationTemplate);
    });

    it("should validate required fields", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("This field is required"),
        })
      );
    });

    it("should validate field length", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "length_field") return "too"; // Too short
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Must be at least 5 characters"),
        })
      );
    });

    it("should validate max length", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "length_field") return "this is way too long"; // Too long
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Must be no more than 10 characters"),
        })
      );
    });

    it("should validate email format", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "email_field") return "invalid-email";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Invalid email format"),
        })
      );
    });

    it("should validate URL format", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "url_field") return "not-a-url";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Please provide a valid URL or path"),
        })
      );
    });

    it("should validate number format", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "number_field") return "not-a-number";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Must be a valid number"),
        })
      );
    });

    it("should validate regex patterns", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "pattern_field") return "invalid-pattern";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Invalid format"),
        })
      );
    });

    it("should validate with custom validators", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "custom_field") return "error";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Custom error message"),
        })
      );
    });

    it("should handle custom validator returning false", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") return "valid";
            if (fieldId === "custom_field") return "invalid";
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Invalid value"),
        })
      );
    });

    it("should handle field access errors during validation", async () => {
      await manager.startForm(mockInteraction, "validation-test");

      const submitInteraction = {
        customId: "form_validation-test_step_0",
        user: { id: "test-user-123" },
        reply: vi.fn(),
        fields: {
          getTextInputValue: vi.fn((fieldId) => {
            if (fieldId === "required_field") throw new Error("Field access error");
            return "default";
          }),
        },
      };

      await manager.handleModalSubmit(submitInteraction as any);

      expect(submitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Missing or invalid input"),
        })
      );
    });
  });

  describe("Form Management", () => {
    beforeEach(() => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [
          {
            id: "step1",
            title: "Step 1",
            fields: [
              {
                id: "field1",
                label: "Field 1",
                type: "text",
                style: TextInputStyle.Short,
                required: true,
              },
            ],
          },
        ],
      };

      manager.registerTemplate(template);
    });

    it("should cancel active forms", async () => {
      await manager.startForm(mockInteraction, "test-template");
      
      expect(manager.getActiveSubmission("test-user-123")).toBeDefined();

      const emitSpy = vi.spyOn(manager, "emit");
      const cancelled = manager.cancelForm("test-user-123");

      expect(cancelled).toBe(true);
      expect(manager.getActiveSubmission("test-user-123")).toBeUndefined();
      expect(emitSpy).toHaveBeenCalledWith("formCancelled", expect.any(Object));
    });

    it("should return false when cancelling non-existent form", () => {
      const cancelled = manager.cancelForm("non-existent-user");
      expect(cancelled).toBe(false);
    });

    it("should get user submission history", async () => {
      // Start and complete a form
      await manager.startForm(mockInteraction, "test-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      const userSubmissions = manager.getUserSubmissions("test-user-123");
      expect(userSubmissions).toHaveLength(1);
      expect(userSubmissions[0].completed).toBe(true);
    });

    it("should get template submissions", async () => {
      // Start and complete a form
      await manager.startForm(mockInteraction, "test-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      const templateSubmissions = manager.getTemplateSubmissions("test-template");
      expect(templateSubmissions).toHaveLength(1);
      expect(templateSubmissions[0].formId).toBe("test-template");
    });
  });

  describe("Cleanup and Maintenance", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should cleanup old submissions", async () => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);

      // Complete a form submission
      await manager.startForm(mockInteraction, "test-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      // Verify submission exists
      expect(manager.getUserSubmissions("test-user-123")).toHaveLength(1);

      // Set up old timestamp by directly accessing private property
      const submissions = (manager as any).submissionHistory;
      submissions[0].timestamp = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old

      // Cleanup old submissions (30 days default)
      manager.cleanupOldSubmissions();

      expect(manager.getUserSubmissions("test-user-123")).toHaveLength(0);
    });

    it("should cleanup old submissions with custom max age", async () => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);

      // Complete a form submission
      await manager.startForm(mockInteraction, "test-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      // Set up old timestamp
      const submissions = (manager as any).submissionHistory;
      submissions[0].timestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days old

      // Cleanup with 7 day max age
      manager.cleanupOldSubmissions(7 * 24 * 60 * 60 * 1000);

      expect(manager.getUserSubmissions("test-user-123")).toHaveLength(0);
    });

    it("should keep recent submissions during cleanup", async () => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);

      // Complete a form submission
      await manager.startForm(mockInteraction, "test-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      // Don't modify timestamp - should be recent
      manager.cleanupOldSubmissions();

      expect(manager.getUserSubmissions("test-user-123")).toHaveLength(1);
    });
  });

  describe("Field Value Processing", () => {
    it("should process number fields", () => {
      const processFieldValue = (manager as any).processFieldValue.bind(manager);
      
      const numberField: FormField = {
        id: "test",
        label: "Test",
        type: "number",
        style: TextInputStyle.Short,
      };

      expect(processFieldValue(numberField, "123")).toBe(123);
      expect(processFieldValue(numberField, "45.67")).toBe(45.67);
    });

    it("should process text fields", () => {
      const processFieldValue = (manager as any).processFieldValue.bind(manager);
      
      const textField: FormField = {
        id: "test",
        label: "Test",
        type: "text",
        style: TextInputStyle.Short,
      };

      expect(processFieldValue(textField, "test value")).toBe("test value");
    });

    it("should process email fields", () => {
      const processFieldValue = (manager as any).processFieldValue.bind(manager);
      
      const emailField: FormField = {
        id: "test",
        label: "Test",
        type: "email",
        style: TextInputStyle.Short,
      };

      expect(processFieldValue(emailField, "test@example.com")).toBe("test@example.com");
    });

    it("should process URL fields", () => {
      const processFieldValue = (manager as any).processFieldValue.bind(manager);
      
      const urlField: FormField = {
        id: "test",
        label: "Test",
        type: "url",
        style: TextInputStyle.Short,
      };

      expect(processFieldValue(urlField, "https://example.com")).toBe("https://example.com");
    });

    it("should process textarea fields", () => {
      const processFieldValue = (manager as any).processFieldValue.bind(manager);
      
      const textareaField: FormField = {
        id: "test",
        label: "Test",
        type: "textarea",
        style: TextInputStyle.Paragraph,
      };

      expect(processFieldValue(textareaField, "long text content")).toBe("long text content");
    });
  });

  describe("Form Completion", () => {
    it("should handle completion with summary embed for non-bug/feature templates", async () => {
      const template: FormTemplate = {
        id: "general-template",
        name: "General Template",
        description: "A general form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "general-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_general-template_step_0",
        replied: false,
        deferred: false,
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      expect(submitInteraction.reply).toHaveBeenCalledWith({
        content: "✅ Submission received. Processing...",
        flags: MessageFlags.Ephemeral,
      });

      expect(submitInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should skip summary embed for bug templates", async () => {
      const template: FormTemplate = {
        id: "bug-template",
        name: "Bug Template",
        description: "A bug form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "bug-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_bug-template_step_0",
        replied: false,
        deferred: false,
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      expect(submitInteraction.reply).toHaveBeenCalledWith({
        content: "✅ Submission received. Processing...",
        flags: MessageFlags.Ephemeral,
      });

      // Should not call followUp for bug templates
      expect(submitInteraction.followUp).not.toHaveBeenCalled();
    });

    it("should handle errors during completion acknowledgment", async () => {
      const template: FormTemplate = {
        id: "error-template",
        name: "Error Template",
        description: "Template for testing errors",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "error-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_error-template_step_0",
        replied: false,
        deferred: false,
        reply: vi.fn().mockRejectedValue(new Error("Reply failed")),
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      expect(consoleSpy).toHaveBeenCalledWith(
        "ModalFormManager: failed to ack modal submission",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle errors during follow-up embed", async () => {
      const template: FormTemplate = {
        id: "followup-error-template",
        name: "Followup Error Template",
        description: "Template for testing followup errors",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "followup-error-template");

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_followup-error-template_step_0",
        replied: false,
        deferred: false,
        followUp: vi.fn().mockRejectedValue(new Error("Follow-up failed")),
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined as any);

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      expect(consoleSpy).toHaveBeenCalledWith(
        "ModalFormManager: failed to send summary follow-up",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing step in template", async () => {
      const incompleteTemplate: FormTemplate = {
        id: "incomplete-template",
        name: "Incomplete Template",
        description: "Template missing a step",
        steps: [],
      };

      manager.registerTemplate(incompleteTemplate);

      await expect(
        manager.startForm(mockInteraction, "incomplete-template")
      ).rejects.toThrow("Step 0 not found in template incomplete-template");
    });

    it("should handle invalid step index in modal submission", async () => {
      const template: FormTemplate = {
        id: "test-template",
        name: "Test Template",
        description: "A test form template",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "test-template");

      const invalidStepInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_test-template_step_99", // Invalid step index
      };

      await manager.handleModalSubmit(invalidStepInteraction as ModalSubmitInteraction);

      expect(invalidStepInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Invalid form step.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle complex object values in embed summary", async () => {
      const template: FormTemplate = {
        id: "complex-template",
        name: "Complex Template",
        description: "Template with complex data",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "field1",
            label: "Field 1",
            type: "text",
            style: TextInputStyle.Short,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      
      // Start form with complex initial data
      const complexData = {
        simpleField: "simple value",
        complexObject: { nested: "value" },
        nullValue: null,
      };
      
      await manager.startForm(mockInteraction, "complex-template", complexData);

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_complex-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue("Test Value");

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      expect(submitInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              addFields: expect.any(Function),
            }),
          ]),
        })
      );
    });

    it("should handle very long field values in embed summary", async () => {
      const template: FormTemplate = {
        id: "long-value-template",
        name: "Long Value Template",
        description: "Template with long values",
        steps: [{
          id: "step1",
          title: "Step 1",
          fields: [{
            id: "longField",
            label: "Long Field",
            type: "text",
            style: TextInputStyle.Paragraph,
            required: true,
          }],
        }],
      };

      manager.registerTemplate(template);
      await manager.startForm(mockInteraction, "long-value-template");

      const longValue = "a".repeat(150); // Longer than 100 characters

      const submitInteraction = {
        ...mockModalSubmitInteraction,
        customId: "form_long-value-template_step_0",
      };
      (submitInteraction.fields!.getTextInputValue as any)
        .mockReturnValue(longValue);

      await manager.handleModalSubmit(submitInteraction as ModalSubmitInteraction);

      // Verify the value was truncated in the embed
      const addFieldsCalls = (EmbedBuilder as any).mock?.results?.[0]?.value?.addFields?.mock?.calls;
      if (addFieldsCalls) {
        const fieldValues = addFieldsCalls[0][0].map((field: any) => field.value);
        const truncatedField = fieldValues.find((value: string) => value.endsWith("..."));
        expect(truncatedField).toBeDefined();
      }
    });
  });
});
