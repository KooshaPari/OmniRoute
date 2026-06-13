const ClipboardHandler = require('./clipboard-handler');
const path = require('path');
const os = require('os');

const userClipboardDir = path.join(os.homedir(), '.klipdot', 'screenshots');

const handler = new ClipboardHandler({
  screenshotDir: userClipboardDir,
  enableLogging: true
});

console.log('KlipDot Terminal Image Interceptor started');
console.log(`Screenshot directory: ${userClipboardDir}`);

handler.start();

process.on('SIGINT', () => {
  console.log('\nShutting down image interceptor...');
  handler.stop();
  process.exit(0);
});