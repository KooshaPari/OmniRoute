const ClipboardHandler = require('../src/clipboard-handler');
const ClaudeCodeClipboardIntegration = require('../src/claude-code-integration');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ClipboardHandler', () => {
  let handler;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'test-clipboard-' + Date.now());
    await fs.ensureDir(testDir);
    
    handler = new ClipboardHandler({
      screenshotDir: testDir,
      enableLogging: false,
      pollInterval: 100
    });
  });

  afterEach(async () => {
    handler.stop();
    await fs.remove(testDir);
  });

  test('should create screenshot directory on start', async () => {
    await handler.start();
    expect(await fs.pathExists(testDir)).toBe(true);
  });

  test('should generate unique filenames', async () => {
    const mockImageData = Buffer.from('fake-image-data');
    
    // Mock sharp to avoid actual image processing
    jest.doMock('sharp', () => {
      return jest.fn(() => ({
        png: jest.fn(() => ({
          toFile: jest.fn().mockResolvedValue()
        }))
      }));
    });

    const filename1 = await handler.processImagePaste(mockImageData);
    const filename2 = await handler.processImagePaste(mockImageData);
    
    expect(filename1).not.toBe(filename2);
  });
});

describe('ClaudeCodeClipboardIntegration', () => {
  let integration;
  let testBaseDir;

  beforeEach(async () => {
    testBaseDir = path.join(os.tmpdir(), 'test-claude-code-' + Date.now());
    integration = new ClaudeCodeClipboardIntegration();
    integration.baseDir = testBaseDir;
    integration.screenshotDir = path.join(testBaseDir, 'clipboard-screenshots');
    integration.configFile = path.join(testBaseDir, 'clipboard-config.json');
  });

  afterEach(async () => {
    integration.stop();
    await fs.remove(testBaseDir);
  });

  test('should create user directories', async () => {
    await integration.createUserDirectories();
    
    expect(await fs.pathExists(testBaseDir)).toBe(true);
    expect(await fs.pathExists(integration.screenshotDir)).toBe(true);
  });

  test('should create default config if none exists', async () => {
    const config = await integration.loadConfig();
    
    expect(config.enabled).toBe(true);
    expect(config.autoStart).toBe(false);
    expect(config.imageFormats).toContain('png');
    expect(await fs.pathExists(integration.configFile)).toBe(true);
  });

  test('should update config', async () => {
    await integration.loadConfig();
    
    const updatedConfig = await integration.updateConfig({
      enabled: false,
      compressionQuality: 95
    });
    
    expect(updatedConfig.enabled).toBe(false);
    expect(updatedConfig.compressionQuality).toBe(95);
  });

  test('should get screenshot history', async () => {
    await integration.createUserDirectories();
    
    // Create a mock screenshot file
    const mockScreenshot = path.join(integration.screenshotDir, 'test-screenshot.png');
    await fs.writeFile(mockScreenshot, 'mock-image-data');
    
    const history = await integration.getScreenshotHistory();
    
    expect(history.length).toBe(1);
    expect(history[0].filename).toBe('test-screenshot.png');
    expect(history[0].path).toBe(mockScreenshot);
  });
});