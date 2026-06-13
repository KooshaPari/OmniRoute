const ClipboardHandler = require('./clipboard-handler');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

class ClaudeCodeClipboardIntegration {
  constructor(options = {}) {
    this.baseDir = path.join(os.homedir(), '.claude-code');
    this.screenshotDir = path.join(this.baseDir, 'clipboard-screenshots');
    this.configFile = path.join(this.baseDir, 'clipboard-config.json');
    
    this.handler = new ClipboardHandler({
      screenshotDir: this.screenshotDir,
      enableLogging: true,
      ...options
    });
  }

  async initialize() {
    await this.createUserDirectories();
    await this.loadConfig();
    await this.handler.start();
  }

  async createUserDirectories() {
    try {
      await fs.ensureDir(this.baseDir);
      await fs.ensureDir(this.screenshotDir);
      
      console.log(`Created Claude-Code user directories:`);
      console.log(`  Base: ${this.baseDir}`);
      console.log(`  Screenshots: ${this.screenshotDir}`);
    } catch (error) {
      console.error('Error creating user directories:', error);
      throw error;
    }
  }

  async loadConfig() {
    try {
      if (await fs.pathExists(this.configFile)) {
        const config = await fs.readJson(this.configFile);
        console.log('Loaded clipboard configuration:', config);
        return config;
      } else {
        const defaultConfig = {
          enabled: true,
          autoStart: false,
          imageFormats: ['png', 'jpg', 'jpeg', 'gif', 'bmp'],
          maxFileSize: '10MB',
          compressionQuality: 90,
          createdAt: new Date().toISOString()
        };
        
        await fs.writeJson(this.configFile, defaultConfig, { spaces: 2 });
        console.log('Created default clipboard configuration');
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      throw error;
    }
  }

  async updateConfig(newConfig) {
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = { ...currentConfig, ...newConfig };
      await fs.writeJson(this.configFile, updatedConfig, { spaces: 2 });
      console.log('Updated clipboard configuration');
      return updatedConfig;
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  }

  async getScreenshotHistory() {
    try {
      const files = await fs.readdir(this.screenshotDir);
      const screenshots = [];
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          const filePath = path.join(this.screenshotDir, file);
          const stats = await fs.stat(filePath);
          screenshots.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }
      
      return screenshots.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error getting screenshot history:', error);
      return [];
    }
  }

  async cleanupOldScreenshots(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const files = await fs.readdir(this.screenshotDir);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.screenshotDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.remove(filePath);
          deletedCount++;
          console.log(`Deleted old screenshot: ${file}`);
        }
      }
      
      console.log(`Cleanup completed. Deleted ${deletedCount} old screenshots.`);
      return deletedCount;
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  stop() {
    this.handler.stop();
  }
}

module.exports = ClaudeCodeClipboardIntegration;