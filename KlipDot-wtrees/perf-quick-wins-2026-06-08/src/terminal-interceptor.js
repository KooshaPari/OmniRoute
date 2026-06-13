const fs = require('fs-extra');
const path = require('path');
const { spawn, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const os = require('os');

class TerminalInterceptor {
  constructor(options = {}) {
    this.screenshotDir = options.screenshotDir || path.join(os.homedir(), '.claude-code', 'clipboard-screenshots');
    this.enableLogging = options.enableLogging || false;
    this.hooks = new Map();
    this.interceptors = new Map();
    this.shellIntegration = null;
  }

  async initialize() {
    await this.ensureDirectories();
    await this.setupShellIntegration();
    await this.setupTerminalHooks();
    await this.setupClipboardMonitoring();
    await this.setupDragDropHandling();
    this.log('Terminal interceptor initialized');
  }

  async ensureDirectories() {
    await fs.ensureDir(this.screenshotDir);
    await fs.ensureDir(path.join(os.homedir(), '.claude-code', 'hooks'));
    await fs.ensureDir(path.join(os.homedir(), '.claude-code', 'temp'));
  }

  async setupShellIntegration() {
    const shellType = process.env.SHELL || '/bin/bash';
    const isZsh = shellType.includes('zsh');
    const isBash = shellType.includes('bash');

    if (isZsh) {
      await this.setupZshHooks();
    } else if (isBash) {
      await this.setupBashHooks();
    }

    this.log(`Shell integration setup for: ${shellType}`);
  }

  async setupZshHooks() {
    const hookScript = `
# Claude-Code Terminal Interceptor ZSH Hooks
CLAUDE_CODE_DIR="${os.homedir()}/.claude-code"
CLAUDE_CODE_TEMP="$CLAUDE_CODE_DIR/temp"
CLAUDE_CODE_HANDLER="$CLAUDE_CODE_DIR/terminal-handler.js"

# Function to handle image files
claude_code_handle_image() {
  local file_path="$1"
  if [[ -f "$file_path" ]]; then
    local mime_type=$(file --mime-type -b "$file_path")
    if [[ "$mime_type" =~ ^image/ ]]; then
      # Call Node.js handler
      node "$CLAUDE_CODE_HANDLER" handle-image "$file_path"
      return $?
    fi
  fi
  return 1
}

# Hook into command execution
preexec_claude_code() {
  local cmd="$1"
  
  # Check for image-related commands
  if [[ "$cmd" =~ (cp|mv|scp|rsync).*\\.(png|jpg|jpeg|gif|bmp|webp|svg) ]]; then
    echo "[Claude-Code] Image operation detected: $cmd"
  fi
  
  # Check for file arguments that might be images
  for arg in \${(z)cmd}; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
}

# Hook into command completion
precmd_claude_code() {
  # Check for new files in current directory
  for file in *.{png,jpg,jpeg,gif,bmp,webp,svg}(N); do
    if [[ -f "$file" ]]; then
      claude_code_handle_image "$file"
    fi
  done
}

# Add hooks to ZSH
autoload -Uz add-zsh-hook
add-zsh-hook preexec preexec_claude_code
add-zsh-hook precmd precmd_claude_code

# Override common commands
alias cp='claude_code_cp'
alias mv='claude_code_mv'
alias scp='claude_code_scp'

claude_code_cp() {
  local result
  command cp "$@"
  result=$?
  
  # Check if any copied files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}

claude_code_mv() {
  local result
  command mv "$@"
  result=$?
  
  # Check if any moved files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}

claude_code_scp() {
  local result
  command scp "$@"
  result=$?
  
  # Check if any transferred files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}
`;

    const zshrcPath = path.join(os.homedir(), '.zshrc');
    const hookPath = path.join(os.homedir(), '.claude-code', 'hooks', 'zsh-hooks.zsh');
    
    await fs.writeFile(hookPath, hookScript);
    
    // Add source line to .zshrc if not already present
    if (await fs.pathExists(zshrcPath)) {
      const zshrcContent = await fs.readFile(zshrcPath, 'utf8');
      const sourceLine = `source "${hookPath}"`;
      
      if (!zshrcContent.includes(sourceLine)) {
        await fs.appendFile(zshrcPath, `\n# Claude-Code Terminal Interceptor\n${sourceLine}\n`);
        this.log('Added ZSH hooks to .zshrc');
      }
    }
  }

  async setupBashHooks() {
    const hookScript = `
# Claude-Code Terminal Interceptor Bash Hooks
CLAUDE_CODE_DIR="${os.homedir()}/.claude-code"
CLAUDE_CODE_TEMP="$CLAUDE_CODE_DIR/temp"
CLAUDE_CODE_HANDLER="$CLAUDE_CODE_DIR/terminal-handler.js"

# Function to handle image files
claude_code_handle_image() {
  local file_path="$1"
  if [[ -f "$file_path" ]]; then
    local mime_type=$(file --mime-type -b "$file_path")
    if [[ "$mime_type" =~ ^image/ ]]; then
      # Call Node.js handler
      node "$CLAUDE_CODE_HANDLER" handle-image "$file_path"
      return $?
    fi
  fi
  return 1
}

# Hook into command execution
claude_code_preexec() {
  local cmd="$1"
  
  # Check for image-related commands
  if [[ "$cmd" =~ (cp|mv|scp|rsync).*\\.(png|jpg|jpeg|gif|bmp|webp|svg) ]]; then
    echo "[Claude-Code] Image operation detected: $cmd"
  fi
  
  # Check for file arguments that might be images
  for arg in $cmd; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
}

# Hook into prompt
claude_code_precmd() {
  # Check for new files in current directory
  for file in *.{png,jpg,jpeg,gif,bmp,webp,svg}; do
    if [[ -f "$file" ]]; then
      claude_code_handle_image "$file"
    fi
  done 2>/dev/null
}

# Set up command hooks
trap 'claude_code_preexec "$BASH_COMMAND"' DEBUG
PROMPT_COMMAND="claude_code_precmd;\$PROMPT_COMMAND"

# Override common commands
alias cp='claude_code_cp'
alias mv='claude_code_mv'
alias scp='claude_code_scp'

claude_code_cp() {
  local result
  command cp "$@"
  result=$?
  
  # Check if any copied files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}

claude_code_mv() {
  local result
  command mv "$@"
  result=$?
  
  # Check if any moved files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}

claude_code_scp() {
  local result
  command scp "$@"
  result=$?
  
  # Check if any transferred files are images
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then
      claude_code_handle_image "$arg"
    fi
  done
  
  return $result
}
`;

    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const hookPath = path.join(os.homedir(), '.claude-code', 'hooks', 'bash-hooks.bash');
    
    await fs.writeFile(hookPath, hookScript);
    
    // Add source line to .bashrc if not already present
    if (await fs.pathExists(bashrcPath)) {
      const bashrcContent = await fs.readFile(bashrcPath, 'utf8');
      const sourceLine = `source "${hookPath}"`;
      
      if (!bashrcContent.includes(sourceLine)) {
        await fs.appendFile(bashrcPath, `\n# Claude-Code Terminal Interceptor\n${sourceLine}\n`);
        this.log('Added Bash hooks to .bashrc');
      }
    }
  }

  async setupTerminalHooks() {
    // Create the terminal handler script
    const handlerScript = `#!/usr/bin/env node

const TerminalInterceptor = require('./terminal-interceptor');
const path = require('path');

async function handleImage(filePath) {
  const interceptor = new TerminalInterceptor({
    enableLogging: true
  });
  
  try {
    await interceptor.processImageFile(filePath);
    process.exit(0);
  } catch (error) {
    console.error('Error processing image:', error.message);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];
  
  switch (command) {
    case 'handle-image':
      await handleImage(filePath);
      break;
    default:
      console.error('Unknown command:', command);
      process.exit(1);
  }
}

main();
`;

    const handlerPath = path.join(os.homedir(), '.claude-code', 'terminal-handler.js');
    await fs.writeFile(handlerPath, handlerScript);
    await fs.chmod(handlerPath, '755');
  }

  async setupClipboardMonitoring() {
    // Enhanced clipboard monitoring with terminal integration
    setInterval(async () => {
      try {
        const clipboardContent = await this.getClipboardContent();
        if (clipboardContent && clipboardContent.type === 'image') {
          await this.processClipboardImage(clipboardContent.data);
        }
      } catch (error) {
        this.log(`Clipboard monitoring error: ${error.message}`);
      }
    }, 1000);
  }

  async setupDragDropHandling() {
    // Monitor for drag-and-drop operations on macOS
    if (process.platform === 'darwin') {
      const applescriptWatcher = `
        on run
          set watchFolder to (path to home folder as string) & ".claude-code:temp:"
          
          tell application "System Events"
            repeat
              try
                set folderContents to (get name of every file in folder watchFolder)
                repeat with fileName in folderContents
                  set filePath to (watchFolder & fileName)
                  if fileName ends with ".png" or fileName ends with ".jpg" or fileName ends with ".jpeg" or fileName ends with ".gif" then
                    do shell script "node ~/.claude-code/terminal-handler.js handle-image " & quoted form of POSIX path of filePath
                  end if
                end repeat
              end try
              delay 1
            end repeat
          end tell
        end run
      `;
      
      const applescriptPath = path.join(os.homedir(), '.claude-code', 'drag-drop-watcher.applescript');
      await fs.writeFile(applescriptPath, applescriptWatcher);
    }
  }

  async processImageFile(filePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `terminal-${timestamp}-${uuidv4().slice(0, 8)}.png`;
      const outputPath = path.join(this.screenshotDir, filename);

      // Copy and process the image
      await sharp(filePath)
        .png()
        .toFile(outputPath);

      this.log(`Processed image: ${filePath} -> ${outputPath}`);
      
      // Replace original file reference with processed path
      await this.replaceFileReference(filePath, outputPath);
      
      return outputPath;
    } catch (error) {
      this.log(`Error processing image file: ${error.message}`);
      throw error;
    }
  }

  async processClipboardImage(imageData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `clipboard-${timestamp}-${uuidv4().slice(0, 8)}.png`;
      const outputPath = path.join(this.screenshotDir, filename);

      await sharp(Buffer.from(imageData))
        .png()
        .toFile(outputPath);

      this.log(`Processed clipboard image: ${outputPath}`);
      
      // Replace clipboard content with file path
      await this.replaceClipboardWithPath(outputPath);
      
      return outputPath;
    } catch (error) {
      this.log(`Error processing clipboard image: ${error.message}`);
      throw error;
    }
  }

  async getClipboardContent() {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        exec('pbpaste', (error, stdout) => {
          if (error) {
            // Try to get image data
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
      } else {
        // Linux clipboard handling
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

  async replaceClipboardWithPath(filepath) {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        exec(`echo "${filepath}" | pbcopy`, (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Clipboard replaced with: ${filepath}`);
            resolve();
          }
        });
      } else {
        exec(`echo "${filepath}" | xclip -selection clipboard`, (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Clipboard replaced with: ${filepath}`);
            resolve();
          }
        });
      }
    });
  }

  async replaceFileReference(originalPath, newPath) {
    // This could be enhanced to update shell history, command line, etc.
    this.log(`File reference updated: ${originalPath} -> ${newPath}`);
  }

  stop() {
    this.log('Terminal interceptor stopped');
  }

  log(message) {
    if (this.enableLogging) {
      console.log(`[TerminalInterceptor] ${message}`);
    }
  }
}

module.exports = TerminalInterceptor;