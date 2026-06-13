// Debug StateManager behavior  
import { StateManager } from './src/discord/framework/StateManager.ts';

const stateManager = new StateManager();

// Test basic registerState and getState
const testState = {
  id: 'test-123',
  channelId: 'channel-456',
  embedData: { title: 'Test' },
  components: [],
  metadata: {},
  lastUpdated: new Date(),
  version: 1,
  autoUpdate: false
};

console.log('Registering state...');
stateManager.registerState(testState);

console.log('Attempting to get state...');
const retrieved = stateManager.getState('test-123');

console.log('Retrieved state:', retrieved);
console.log('States map size:', stateManager.states?.size);
console.log('removedStates has id:', stateManager.removedStates?.has('test-123'));