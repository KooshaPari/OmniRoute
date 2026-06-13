// Minimal transcription service to be mocked in tests
export const transcriptionService = {
  async startTranscription(_config: any): Promise<string> {
    // Default behavior returns a deterministic ID; tests will mock this
    return 'transcription-123';
  },
  async stopTranscription(_sessionId?: string): Promise<void> {
    return;
  },
  async generateSummary(): Promise<{ summary: string; actionItems: string[]; keyTopics: string[] }> {
    return {
      summary: 'Meeting summary with key points.',
      actionItems: ['Complete task A', 'Review document B'],
      keyTopics: ['Project status', 'Next steps'],
    };
  },
};

