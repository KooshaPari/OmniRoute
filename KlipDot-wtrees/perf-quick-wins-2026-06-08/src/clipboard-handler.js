const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { exec } = require('child_process');

class ClipboardHandler {
  constructor(options = {}) {
    this.screenshotDir = options.screenshotDir || path.join(process.cwd(), 'screenshots');
    this.enableLogging = options.enableLogging || false;
    this.polling = false;
    this.pollInterval = options.pollInterval || 1000;
    this.lastClipboardContent = null;
  }

  async start() {
    await this.ensureScreenshotDir();
    this.log('Clipboard handler started');
    this.startPolling();
  }

  stop() {
    this.polling = false;
    this.log('Clipboard handler stopped');
  }

  async ensureScreenshotDir() {
    try {
      await fs.ensureDir(this.screenshotDir);
      this.log(`Screenshot directory created/verified: ${this.screenshotDir}`);
    } catch (error) {
      console.error('Error creating screenshot directory:', error);
      throw error;
    }
  }

  startPolling() {
    this.polling = true;
    this.pollClipboard();
  }

  async pollClipboard() {
    if (!this.polling) return;

    try {
      const clipboardContent = await this.getClipboardContent();
      
      if (clipboardContent && clipboardContent !== this.lastClipboardContent) {
        await this.handleClipboardChange(clipboardContent);
        this.lastClipboardContent = clipboardContent;
      }
    } catch (error) {
      this.log(`Error polling clipboard: ${error.message}`);
    }

    setTimeout(() => this.pollClipboard(), this.pollInterval);
  }

  async getClipboardContent() {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        exec('pbpaste', (error, stdout) => {
          if (error) {
            exec('osascript -e "the clipboard as «class PNGf»" | xxd -r -p', (imgError, imgStdout) => {
              if (imgError) {
                resolve(null);
              } else {
                resolve({ type: 'image', data: imgStdout });
              }
            });
          } else {
            resolve({ type: 'text', data: stdout });
          }
        });
      } else if (process.platform === 'win32') {
        exec('powershell -command "Get-Clipboard"', (error, stdout) => {
          if (error) {
            resolve(null);
          } else {
            resolve({ type: 'text', data: stdout });
          }
        });
      } else {
        exec('xclip -selection clipboard -o', (error, stdout) => {
          if (error) {
            resolve(null);
          } else {
            resolve({ type: 'text', data: stdout });
          }
        });
      }
    });
  }

  async handleClipboardChange(content) {
    if (content.type === 'image') {
      await this.processImagePaste(content.data);
    }
  }

  async processImagePaste(imageData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}-${uuidv4().slice(0, 8)}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      await sharp(Buffer.from(imageData))
        .png()
        .toFile(filepath);

      this.log(`Image saved to: ${filepath}`);
      
      await this.replaceClipboardWithPath(filepath);
      
      return filepath;
    } catch (error) {
      this.log(`Error processing image paste: ${error.message}`);
      throw error;
    }
  }

  async replaceClipboardWithPath(filepath) {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        exec(`echo "${filepath}" | pbcopy`, (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Clipboard replaced with file path: ${filepath}`);
            resolve();
          }
        });
      } else if (process.platform === 'win32') {
        exec(`echo "${filepath}" | clip`, (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Clipboard replaced with file path: ${filepath}`);
            resolve();
          }
        });
      } else {
        exec(`echo "${filepath}" | xclip -selection clipboard`, (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Clipboard replaced with file path: ${filepath}`);
            resolve();
          }
        });
      }
    });
  }

  log(message) {
    if (this.enableLogging) {
      console.log(`[ClipboardHandler] ${message}`);
    }
  }
}

module.exports = ClipboardHandler;