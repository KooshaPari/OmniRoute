const TerminalInterceptor = require('./terminal-interceptor');
const ClipboardHandler = require('./clipboard-handler');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

class ComprehensiveInterceptor {
  constructor(options = {}) {
    this.screenshotDir = options.screenshotDir || path.join(os.homedir(), '.claude-code', 'clipboard-screenshots');
    this.enableLogging = options.enableLogging || false;
    
    // Initialize sub-interceptors
    this.terminalInterceptor = new TerminalInterceptor({
      screenshotDir: this.screenshotDir,
      enableLogging: this.enableLogging
    });
    
    this.clipboardHandler = new ClipboardHandler({
      screenshotDir: this.screenshotDir,
      enableLogging: this.enableLogging
    });
    
    this.interceptMethods = {
      clipboard: true,
      terminal: true,
      dragdrop: true,
      stdin: true,
      filewatch: true
    };
  }

  async initialize() {
    await this.ensureDirectories();
    await this.setupAllInterceptors();
    this.log('Comprehensive interceptor initialized');
  }

  async ensureDirectories() {
    const dirs = [
      this.screenshotDir,
      path.join(os.homedir(), '.claude-code', 'hooks'),
      path.join(os.homedir(), '.claude-code', 'temp'),
      path.join(os.homedir(), '.claude-code', 'watch'),
      path.join(os.homedir(), '.claude-code', 'stdin-buffer')
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
  }

  async setupAllInterceptors() {
    // 1. Terminal hooks and shell integration
    if (this.interceptMethods.terminal) {
      await this.terminalInterceptor.initialize();
    }

    // 2. Clipboard monitoring
    if (this.interceptMethods.clipboard) {
      await this.clipboardHandler.start();
    }

    // 3. Drag and drop monitoring
    if (this.interceptMethods.dragdrop) {
      await this.setupDragDropMonitoring();
    }

    // 4. STDIN monitoring
    if (this.interceptMethods.stdin) {
      await this.setupStdinMonitoring();
    }

    // 5. File system watching
    if (this.interceptMethods.filewatch) {
      await this.setupFileWatching();
    }

    // 6. Process monitoring
    await this.setupProcessMonitoring();
  }

  async setupDragDropMonitoring() {
    const watchDir = path.join(os.homedir(), '.claude-code', 'watch');
    
    if (process.platform === 'darwin') {
      // macOS: Check if fswatch is available
      try {
        const fswatch = spawn('fswatch', ['-r', process.cwd()], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        fswatch.on('error', (error) => {
          if (error.code === 'ENOENT') {
            this.log('fswatch not found - using fallback file monitoring');
            this.setupDirectoryWatcher(process.cwd());
          } else {
            this.log(`fswatch error: ${error.message}`);
          }
        });
        
        fswatch.stdout.on('data', async (data) => {
          const files = data.toString().split('\n').filter(Boolean);
          for (const file of files) {
            if (await this.isImageFile(file)) {
              await this.processImageFile(file, 'dragdrop');
            }
          }
        });
        
        this.log('Drag-drop monitoring started (macOS with fswatch)');
      } catch (error) {
        this.log('fswatch not available - using fallback monitoring');
        this.setupDirectoryWatcher(process.cwd());
      }
    } else {
      // Linux: Use inotify if available
      try {
        const inotifywait = spawn('inotifywait', ['-m', '-r', '-e', 'create,moved_to', process.cwd()], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        inotifywait.on('error', (error) => {
          if (error.code === 'ENOENT') {
            this.log('inotifywait not found - using fallback file monitoring');
            this.setupDirectoryWatcher(process.cwd());
          } else {
            this.log(`inotifywait error: ${error.message}`);
          }
        });
        
        inotifywait.stdout.on('data', async (data) => {
          const events = data.toString().split('\n').filter(Boolean);
          for (const event of events) {
            const [dir, action, filename] = event.split(' ');
            const filepath = path.join(dir, filename);
            
            if (await this.isImageFile(filepath)) {
              await this.processImageFile(filepath, 'dragdrop');
            }
          }
        });
        
        this.log('Drag-drop monitoring started (Linux with inotify)');
      } catch (error) {
        this.log('inotifywait not available - using fallback monitoring');
        this.setupDirectoryWatcher(process.cwd());
      }
    }
  }

  async setupStdinMonitoring() {
    // Monitor stdin for image data
    const stdinBuffer = path.join(os.homedir(), '.claude-code', 'stdin-buffer');
    
    // Create a wrapper script that intercepts stdin
    const stdinWrapperScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Buffer to collect stdin data
let stdinData = Buffer.alloc(0);

// Read all stdin data
process.stdin.on('data', (chunk) => {
  stdinData = Buffer.concat([stdinData, chunk]);
});

process.stdin.on('end', () => {
  // Check if stdin contains image data
  if (isImageData(stdinData)) {
    // Process image data
    const ComprehensiveInterceptor = require('./comprehensive-interceptor');
    const interceptor = new ComprehensiveInterceptor({ enableLogging: true });
    
    interceptor.processImageBuffer(stdinData, 'stdin').then((filepath) => {
      // Replace stdin with filepath
      process.stdout.write(filepath);
    }).catch((error) => {
      // Pass through original data if processing fails
      process.stdout.write(stdinData);
    });
  } else {
    // Pass through non-image data
    process.stdout.write(stdinData);
  }
});

function isImageData(buffer) {
  if (buffer.length < 8) return false;
  
  // Check for common image signatures
  const signatures = [
    [0x89, 0x50, 0x4E, 0x47], // PNG
    [0xFF, 0xD8, 0xFF],       // JPEG
    [0x47, 0x49, 0x46],       // GIF
    [0x42, 0x4D],             // BMP
    [0x52, 0x49, 0x46, 0x46]  // WEBP
  ];
  
  for (const sig of signatures) {
    if (buffer.subarray(0, sig.length).equals(Buffer.from(sig))) {
      return true;
    }
  }
  
  return false;
}
`;

    const stdinWrapperPath = path.join(os.homedir(), '.claude-code', 'stdin-wrapper.js');
    await fs.writeFile(stdinWrapperPath, stdinWrapperScript);
    await fs.chmod(stdinWrapperPath, '755');
    
    this.log('STDIN monitoring setup complete');
  }

  async setupFileWatching() {
    // Watch common directories for image files
    const watchDirs = [
      process.cwd(),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Pictures')
    ];

    for (const dir of watchDirs) {
      if (await fs.pathExists(dir)) {
        this.setupDirectoryWatcher(dir);
      }
    }
  }

  async setupDirectoryWatcher(directory) {
    const fs = require('fs');
    
    try {
      const watcher = fs.watch(directory, { recursive: false }, async (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const filepath = path.join(directory, filename);
          
          // Small delay to ensure file is fully written
          setTimeout(async () => {
            if (await this.isImageFile(filepath)) {
              await this.processImageFile(filepath, 'filewatch');
            }
          }, 100);
        }
      });
      
      this.log(`Watching directory: ${directory}`);
    } catch (error) {
      this.log(`Error watching directory ${directory}: ${error.message}`);
    }
  }

  async setupProcessMonitoring() {
    // Monitor for image-related processes
    const imageProcesses = [
      'screencapture',  // macOS screenshot
      'import',         // ImageMagick
      'convert',        // ImageMagick
      'ffmpeg',         // Video/image processing
      'scrot',          // Linux screenshot
      'gnome-screenshot'// GNOME screenshot
    ];

    // Monitor running processes
    setInterval(async () => {
      try {
        const processes = await this.getRunningProcesses();
        
        for (const proc of processes) {
          if (imageProcesses.some(name => proc.command.includes(name))) {
            this.log(`Image process detected: ${proc.command}`);
            // Could potentially hook into process completion
          }
        }
      } catch (error) {
        this.log(`Process monitoring error: ${error.message}`);
      }
    }, 5000);
  }

  async getRunningProcesses() {
    return new Promise((resolve) => {
      if (process.platform === 'darwin') {
        exec('ps aux', (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }
          
          const lines = stdout.split('\n').slice(1);
          const processes = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              command: parts.slice(10).join(' ')
            };
          });
          
          resolve(processes);
        });
      } else {
        exec('ps -eo pid,comm,args', (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }
          
          const lines = stdout.split('\n').slice(1);
          const processes = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[0],
              command: parts.slice(2).join(' ')
            };
          });
          
          resolve(processes);
        });
      }
    });
  }

  async isImageFile(filepath) {
    try {
      if (!await fs.pathExists(filepath)) return false;
      
      const stats = await fs.stat(filepath);
      if (!stats.isFile()) return false;
      
      const ext = path.extname(filepath).toLowerCase();
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
      
      if (imageExtensions.includes(ext)) {
        return true;
      }
      
      // Check MIME type
      return new Promise((resolve) => {
        exec(`file --mime-type -b "${filepath}"`, (error, stdout) => {
          if (error) {
            resolve(false);
            return;
          }
          
          const mimeType = stdout.trim();
          resolve(mimeType.startsWith('image/'));
        });
      });
    } catch (error) {
      return false;
    }
  }

  async processImageFile(filepath, source = 'unknown') {
    try {
      const processed = await this.terminalInterceptor.processImageFile(filepath);
      this.log(`Processed image from ${source}: ${filepath} -> ${processed}`);
      return processed;
    } catch (error) {
      this.log(`Error processing image from ${source}: ${error.message}`);
      throw error;
    }
  }

  async processImageBuffer(buffer, source = 'unknown') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${source}-${timestamp}-${require('uuid').v4().slice(0, 8)}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      await require('sharp')(buffer)
        .png()
        .toFile(filepath);
      
      this.log(`Processed image buffer from ${source}: ${filepath}`);
      return filepath;
    } catch (error) {
      this.log(`Error processing image buffer from ${source}: ${error.message}`);
      throw error;
    }
  }

  stop() {
    this.terminalInterceptor.stop();
    this.clipboardHandler.stop();
    this.log('Comprehensive interceptor stopped');
  }

  log(message) {
    if (this.enableLogging) {
      console.log(`[ComprehensiveInterceptor] ${message}`);
    }
  }
}

module.exports = ComprehensiveInterceptor;