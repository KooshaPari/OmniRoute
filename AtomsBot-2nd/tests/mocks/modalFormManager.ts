/**
 * ModalFormManager Mock Implementation
 * 
 * Comprehensive mock for the ModalFormManager to support testing
 * of modal form workflows and error handling.
 */

import { vi } from "vitest";
import { EventEmitter } from "events";

// Mock ModalFormManager class that extends EventEmitter
export class MockModalFormManager extends EventEmitter {
  private templates: Map<string, any> = new Map();
  private activeSubmissions: Map<string, any> = new Map();
  private submissionHistory: any[] = [];

  // Core methods
  handleModalSubmit = vi.fn().mockImplementation(async (interaction: any) => {
    const customId = interaction.customId;
    
    // Parse form_{templateId}_step_{stepIndex} format
    const match = customId.match(/^form_(.+)_step_(\d+)$/);
    
    if (!match) {
      await interaction.reply({
        content: `❌ Invalid modal submission. CustomId was: '${customId}'`,
        ephemeral: true,
      });
      return;
    }
    
    const [, templateId, stepIndex] = match;
    const template = this.templates.get(templateId);
    const submission = this.activeSubmissions.get(interaction.user.id);
    
    // Add some debugging info for test failures
    if (!template) {
      await interaction.reply({
        content: `❌ Template '${templateId}' not found. Available templates: [${Array.from(this.templates.keys()).join(', ')}]`,
        ephemeral: true,
      });
      return;
    }
    
    if (!submission) {
      await interaction.reply({
        content: `❌ No active form submission found for user ${interaction.user.id}. Active submissions: [${Array.from(this.activeSubmissions.keys()).join(', ')}]`,
        ephemeral: true,
      });
      return;
    }
    
    const stepNum = parseInt(stepIndex);
    const step = template.steps[stepNum];
    
    if (!step) {
      await interaction.reply({
        content: "❌ Invalid form step.",
        ephemeral: true,
      });
      return;
    }
    
    // Validate step
    const validationResult = this.validateStep(interaction, step);
    
    if (!validationResult.isValid) {
      const errorMessage = validationResult.errors
        .map((error: any) => `• ${error.field}: ${error.message}`)
        .join("\n");
      
      this.emit("validationError", { errors: validationResult.errors, submission });
      
      await interaction.reply({
        content: `❌ **Validation errors:**\n${errorMessage}`,
        ephemeral: true,
      });
      return;
    }
    
    // Extract field data
    const stepData: Record<string, any> = {};
    step.fields.forEach((field: any) => {
      const value = interaction.fields?.getTextInputValue?.(field.id) || "";
      stepData[field.id] = this.processFieldValue(field, value);
    });
    
    // Update submission data
    Object.assign(submission.data, stepData);
    
    // Find next step
    let nextStepIndex = -1;
    for (let i = stepNum + 1; i < template.steps.length; i++) {
      const nextStep = template.steps[i];
      if (!nextStep.condition || nextStep.condition(submission.data)) {
        nextStepIndex = i;
        break;
      }
    }
    
    if (nextStepIndex === -1) {
      // Complete form
      await this.completeForm(interaction, template, submission);
    } else {
      // Continue to next step
      submission.currentStep = nextStepIndex;
      
      this.emit("stepCompleted", { submission, step, template });
      
      await interaction.update({
        content: `✅ Step ${stepNum + 1} completed. Step ${nextStepIndex + 1} of ${template.steps.length}`,
        ephemeral: true,
        components: [],
      });
    }
  });
  
  startForm = vi.fn().mockImplementation(async (interaction: any, templateId: string, initialData?: any) => {
    if (!interaction || !interaction.user || !interaction.user.id) {
      throw new Error("Invalid interaction: missing user information");
    }
    
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Form template '${templateId}' not found`);
    }
    
    // Validate template has at least one step
    if (!template.steps || template.steps.length === 0) {
      throw new Error("Form template has no steps");
    }
    
    // Create active submission
    const submission = {
      formId: templateId,
      userId: interaction.user.id,
      data: initialData || {},
      timestamp: new Date(),
      currentStep: 0,
      completed: false,
    };
    
    // Replace any existing submission
    const existing = this.activeSubmissions.get(interaction.user.id);
    if (existing) {
      this.emit("formCancelled", existing);
    }
    this.activeSubmissions.set(interaction.user.id, submission);
    
    // Mock showing modal with proper structure expected by tests
    if (interaction.showModal) {
      const modalData = {
        customId: `form_${templateId}_step_0`,
        title: template.steps[0]?.title || "Form",
        components: template.steps[0]?.fields?.map((field: any) => ({
          type: 1, // ACTION_ROW
          components: [{
            type: 4, // TEXT_INPUT
            custom_id: field.id,
            label: field.label,
            style: field.type === 'textarea' ? 2 : 1,
            placeholder: field.placeholder || '',
            required: field.required || false,
            min_length: field.minLength,
            max_length: field.maxLength,
            value: initialData?.[field.id] || ''
          }]
        })) || [],
        data: {
          custom_id: `form_${templateId}_step_0`,
          title: template.steps[0]?.title || "Form",
          components: template.steps[0]?.fields?.map((field: any) => ({
            type: 1, // ACTION_ROW
            components: [{
              type: 4, // TEXT_INPUT
              custom_id: field.id,
              label: field.label,
              style: field.type === 'textarea' ? 2 : 1,
              placeholder: field.placeholder || '',
              required: field.required || false,
              min_length: field.minLength,
              max_length: field.maxLength,
              value: initialData?.[field.id] || ''
            }]
          })) || []
        }
      };
      
      await interaction.showModal(modalData);
    } else {
      await interaction.reply({
        content: "Opening form...",
        flags: 64, // MessageFlags.Ephemeral
      });
    }
    
    this.emit("formStarted", submission);
  });
  
  registerTemplate = vi.fn().mockImplementation((template: any) => {
    this.templates.set(template.id, template);
    
    // Validate template has steps
    if (!template.steps || template.steps.length === 0) {
      // Don't emit event for invalid templates, but don't throw here either
      // The error should be thrown when trying to start the form
      this.templates.delete(template.id); // Remove invalid template
      return;
    }
    
    try {
      this.emit("templateRegistered", template);
    } catch (error) {
      // Allow tests to verify event listener error handling
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      console.error("[MockModalFormManager] Event listener error:", error);
    }
  });
  getTemplate = vi.fn().mockImplementation((id: string) => this.templates.get(id));
  getTemplates = vi.fn().mockImplementation(() => Array.from(this.templates.values()));
  getTemplatesByCategory = vi.fn().mockImplementation((category: string) => 
    Array.from(this.templates.values()).filter(t => t.category === category)
  );
  
  // Submission management
  getActiveSubmission = vi.fn().mockImplementation((userId: string) => this.activeSubmissions.get(userId));
  
  // Alias for legacy compatibility
  getActiveForm = vi.fn().mockImplementation((userId: string) => this.activeSubmissions.get(userId));
  
  // Additional utility methods
  getActiveSubmissions = vi.fn().mockImplementation(() => Array.from(this.activeSubmissions.values()));
  
  setActiveForm = vi.fn().mockImplementation((userId: string, submission: any) => {
    this.activeSubmissions.set(userId, submission);
  });
  
  getStats = vi.fn().mockImplementation(() => ({
    activeSubmissions: this.activeSubmissions.size,
    templates: this.templates.size,
    history: this.submissionHistory.length,
  }));
  cancelForm = vi.fn().mockImplementation((userId: string) => {
    const submission = this.activeSubmissions.get(userId);
    if (submission) {
      this.activeSubmissions.delete(userId);
      this.emit("formCancelled", submission);
      return true;
    }
    return false;
  });
  getUserSubmissions = vi.fn().mockImplementation((userId: string) => 
    this.submissionHistory.filter(s => s.userId === userId)
  );
  getTemplateSubmissions = vi.fn().mockImplementation((templateId: string) => 
    this.submissionHistory.filter(s => s.formId === templateId)
  );
  
  // Validation methods (needed for private method access)
  validateStep = vi.fn().mockImplementation((interaction: any, step: any) => {
    const errors: any[] = [];
    
    step.fields.forEach((field: any) => {
      try {
        const value = interaction.fields?.getTextInputValue?.(field.id) || "";
        
        // Handle zero-length constraint edge case first
        if (field.maxLength === 0 && field.minLength === 0) {
          if (!value || value.length === 0) {
            return; // Valid empty value for zero-length field
          } else {
            errors.push({
              field: field.label,
              message: "Must be no more than 0 characters",
            });
            return;
          }
        }
        
        // Required field validation
        if (field.required && (!value || value.trim().length === 0)) {
          errors.push({
            field: field.label,
            message: "This field is required"
          });
          return;
        }
        
        // Skip further validation for empty non-required fields
        if (!field.required && (!value || value.trim().length === 0)) {
          if (field.type === "url" && typeof value === 'string' && value.length > 0 && value.trim().length === 0) {
            errors.push({ field: field.label, message: "Please provide a valid URL or path" });
          }
          return;
        }
        
        // Length validation
        if (field.minLength !== undefined && value.length < field.minLength) {
          errors.push({
            field: field.label,
            message: `Must be at least ${field.minLength} characters`
          });
          return;
        }
        
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push({
            field: field.label,
            message: `Must be no more than ${field.maxLength} characters`
          });
          return;
        }
        
        // Pattern validation
        if (field.validation?.pattern && !field.validation.pattern.test(value)) {
          errors.push({
            field: field.label,
            message: "Invalid format"
          });
          return;
        }
        
        // Custom validation
        if (field.validation?.customValidator) {
          try {
            const result = field.validation.customValidator(value);
            if (typeof result === "string") {
              errors.push({ field: field.label, message: result });
              return;
            } else if (!result) {
              errors.push({ field: field.label, message: "Validation failed" });
              return;
            }
          } catch (validationError) {
            errors.push({ field: field.label, message: "Validation error" });
            return;
          }
        }
        
        // Type-specific validation
        if (field.type === "email" && value && value.trim().length > 0) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value.trim())) {
            errors.push({
              field: field.label,
              message: "Invalid email format"
            });
            return;
          }
        }
        
        if (field.type === "url" && value && value.trim().length > 0) {
          const trimmed = String(value).trim();
          let isValid = false;
          
          if (trimmed.match(/^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]/i)) {
            isValid = true;
          } else if (trimmed.match(/^\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]/i)) {
            isValid = true;
          } else if (trimmed.match(/^www\.[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]/i)) {
            isValid = true;
          } else if (trimmed.match(/^\/[a-zA-Z0-9\/._-]+$/)) {
            isValid = true;
          } else if (trimmed.match(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)) {
            isValid = true;
          }
          
          if (!isValid) {
            errors.push({
              field: field.label,
              message: "Please provide a valid URL or path"
            });
            return;
          }
        }
        
        if (field.type === "number" && value && value.trim().length > 0) {
          if (isNaN(Number(value.trim()))) {
            errors.push({
              field: field.label,
              message: "Must be a valid number"
            });
            return;
          }
        }
      } catch (error) {
        errors.push({
          field: field.label,
          message: "Missing or invalid input"
        });
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  });
  
  // Process field values
  processFieldValue = vi.fn().mockImplementation((field: any, value: string) => {
    switch (field.type) {
      case "number":
        return Number(value);
      case "email":
      case "url":
      case "text":
      case "textarea":
      default:
        return value;
    }
  });
  
  // Private method access for tests
  private showStep = vi.fn().mockResolvedValue(undefined);
  private completeForm = vi.fn().mockImplementation(async (interaction: any, template: any, submission: any) => {
    submission.completed = true;
    submission.timestamp = new Date();
    
    // Move to history and remove from active
    this.submissionHistory.push({ ...submission });
    this.activeSubmissions.delete(submission.userId);
    
    // Create completion message
    const completionMessage = {
      content: `✅ ${template.name} successfully submitted!`,
      embeds: [{
        title: `✅ ${template.name} Completed`,
        description: template.description || "Form submitted successfully!",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        fields: Object.entries(submission.data)
          .slice(0, 10)
          .filter(([_, value]) => typeof value !== "object" || value === null)
          .map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value).substring(0, 100) + (String(value).length > 100 ? "..." : ""),
            inline: true,
          })),
      }],
      ephemeral: true,
    };
    
    try {
      await interaction.reply(completionMessage);
      
      // Send follow-up with summary
      try {
        await interaction.followUp({
          embeds: completionMessage.embeds,
          ephemeral: true,
        });
      } catch (followUpErr) {
        console.warn("ModalFormManager: failed to send follow-up", followUpErr);
      }
    } catch (err) {
      console.warn("ModalFormManager: failed to ack modal submission", err);
    }
    
    // Emit completion event
    this.emit("formCompleted", {
      template,
      submission,
      user: interaction.user,
    });
  });
  
  // Form creation helpers
  createSimpleForm = vi.fn().mockImplementation((id: string, name: string, description: string, fields: any[]) => {
    const template = {
      id, name, description,
      steps: [{ id: "step1", title: name, description, fields }]
    };
    this.registerTemplate(template);
    return template;
  });
  
  // Cleanup
  cleanupOldSubmissions = vi.fn().mockImplementation((maxAge?: number) => {
    // Mock cleanup logic
    const cutoffTime = maxAge || 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - cutoffTime);
    this.submissionHistory = this.submissionHistory.filter(s => s.timestamp > cutoff);
  });
  
  cleanupCompletedSubmission = vi.fn().mockImplementation((userId: string) => {
    this.activeSubmissions.delete(userId);
  });
  
  // Test helper method for field validation
  validateFields = vi.fn().mockImplementation((fields: any[], data: Record<string, any>) => {
    const mockInteraction = {
      fields: {
        getTextInputValue: (fieldId: string) => data[fieldId] || ""
      }
    };
    
    const mockStep = { fields };
    return this.validateStep(mockInteraction, mockStep);
  });
  
  // Constructor to enable private method access via indexing
  constructor() {
    super();
    
    // Fix EventEmitter memory leak by setting higher max listeners
    this.setMaxListeners(200);
    
    // Allow access to private methods through indexing (for tests)
    const self = this as any;
    self["validateStep"] = this.validateStep;
    self["processFieldValue"] = this.processFieldValue;
    self["showStep"] = this.showStep;
    self["completeForm"] = this.completeForm;
    self["activeSubmissions"] = this.activeSubmissions;
    self["submissionHistory"] = this.submissionHistory;
    self["templates"] = this.templates;
    
    // Add test helper methods
    self["validateFields"] = this.validateFields;
    self["cleanupCompletedSubmission"] = this.cleanupCompletedSubmission;
    self["_activeSubmissions"] = this.activeSubmissions;
    self["_submissionHistory"] = this.submissionHistory;
    
    // Add getter properties for test access
    Object.defineProperty(this, '_activeSubmissions', {
      get: () => this.activeSubmissions,
      enumerable: false,
      configurable: true
    });
    
    Object.defineProperty(this, '_submissionHistory', {
      get: () => this.submissionHistory,
      enumerable: false,
      configurable: true
    });
  }

  // Legacy methods for compatibility
  createModal = vi.fn().mockReturnValue({
    title: "Test Modal",
    custom_id: "test_modal",
    components: []
  });
  registerFormTemplate = vi.fn();
  getFormTemplate = vi.fn().mockReturnValue(null);
  deleteFormTemplate = vi.fn();
  getActiveSession = vi.fn().mockReturnValue(null);
  createSession = vi.fn().mockReturnValue("test_session_id");
  deleteSession = vi.fn();
  processFormStep = vi.fn().mockResolvedValue(undefined);
  validateFormData = vi.fn().mockReturnValue({ isValid: true, errors: [] });
  formatFormResponse = vi.fn().mockReturnValue("Formatted response");
  
  // Override removeAllListeners to ensure it works properly
  removeAllListeners = vi.fn().mockImplementation((event?: string) => {
    if (event) {
      super.removeAllListeners(event);
    } else {
      super.removeAllListeners();
    }
    return this;
  });
}

// Create a singleton instance for global usage
export const mockModalFormManager = new MockModalFormManager();

export const mockFormTemplate = {
  id: "test_template",
  name: "Test Form Template",
  description: "A test form template",
  steps: [
    {
      id: "step_1",
      title: "Step 1",
      description: "First step",
      fields: []
    }
  ],
  category: "test",
  tags: ["test"],
  onComplete: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn().mockResolvedValue(undefined),
  onError: vi.fn().mockResolvedValue(undefined),
};

export const mockFormSession = {
  id: "test_session",
  userId: "test_user_id",
  templateId: "test_template",
  currentStep: 0,
  formData: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Export the ModalFormManager constructor for tests that use `new ModalFormManager()`
export const ModalFormManager = MockModalFormManager;

// Export the mock module with various ways tests might import
export default {
  ModalFormManager: MockModalFormManager,
  modalFormManager: mockModalFormManager,
  MockModalFormManager,
  FormTemplate: vi.fn().mockImplementation(() => mockFormTemplate),
  FormSession: vi.fn().mockImplementation(() => mockFormSession),
};