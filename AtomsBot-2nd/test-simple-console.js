// Simple test to verify status command can be imported and called
console.log('Starting simple test...');

try {
  // Use CommonJS syntax for Node.js
  const path = require('path');
  const statusPath = path.join(__dirname, 'src/discord/commands/status.ts');
  console.log('Trying to import from:', statusPath);
  
  // For TS files in Node.js, we need to use require or dynamic import
  (async () => {
    try {
      const { statusCommand } = await import('./src/discord/commands/status.ts');
      console.log('Import successful');
      console.log('statusCommand type:', typeof statusCommand);
      console.log('statusCommand.execute type:', typeof statusCommand?.execute);
      
      // Test minimal call
      const mockInteraction = {
        deferred: false,
        replied: false,
        deferReply: async () => { console.log('Mock deferReply called'); },
        editReply: async () => { console.log('Mock editReply called'); }
      };
      
      console.log('About to call execute...');
      await statusCommand.execute(mockInteraction);
      console.log('Execute completed');
      
    } catch (importError) {
      console.error('Import or execution error:', importError);
    }
  })();
  
} catch (error) {
  console.error('Error in test:', error);
}