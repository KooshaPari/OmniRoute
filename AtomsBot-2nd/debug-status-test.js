const { statusCommand } = require('./src/discord/commands/status.ts');
const { store } = require('./src/store.ts');

async function testStatusCommand() {
  console.log('Testing status command...');
  console.log('statusCommand object:', statusCommand);
  console.log('statusCommand.execute type:', typeof statusCommand?.execute);

  // Set up a thread
  const thread = {
    id: "test_thread",
    number: 1,
    jiraKey: "TEST-1",
    repoOwner: "test",
    repoName: "repo"
  };
  store.threads = [thread];

  // Create mock interaction
  const interaction = {
    channel: { 
      id: "test_thread",
      isThread: () => true 
    },
    channelId: "test_thread",
    commandName: "status",
    user: { id: "admin_123", tag: "admin#1234" },
    member: {
      permissions: { has: () => true }
    },
    options: {
      getString: (key) => key === 'state' ? 'open' : null
    },
    deferred: false,
    replied: false,
    deferReply: function(opts) { 
      console.log('deferReply called with:', opts);
      this.deferred = true;
      return Promise.resolve();
    },
    reply: function(opts) { 
      console.log('reply called with:', opts);
      this.replied = true;
      return Promise.resolve();
    },
    editReply: function(opts) { 
      console.log('editReply called with:', opts);
      return Promise.resolve();
    }
  };

  try {
    console.log('About to call statusCommand.execute...');
    await statusCommand.execute(interaction);
    console.log('statusCommand.execute completed');
    console.log('Final state - deferred:', interaction.deferred, 'replied:', interaction.replied);
  } catch (error) {
    console.error('Error executing status command:', error);
    console.error('Stack:', error.stack);
  }
}

testStatusCommand().catch(console.error);