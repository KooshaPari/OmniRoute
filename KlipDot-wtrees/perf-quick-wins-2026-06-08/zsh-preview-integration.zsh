#!/bin/zsh

# KlipDot ZSH Image Preview Integration
# Provides hover preview and command line image detection

# Configuration
KLIPDOT_PREVIEW_ENABLED=${KLIPDOT_PREVIEW_ENABLED:-1}
KLIPDOT_PREVIEW_WIDTH=${KLIPDOT_PREVIEW_WIDTH:-80}
KLIPDOT_PREVIEW_HEIGHT=${KLIPDOT_PREVIEW_HEIGHT:-24}
KLIPDOT_PREVIEW_DELAY=${KLIPDOT_PREVIEW_DELAY:-0.5}
KLIPDOT_AUTO_PREVIEW=${KLIPDOT_AUTO_PREVIEW:-1}

# Image file extensions to detect
KLIPDOT_IMAGE_EXTENSIONS=(png jpg jpeg gif bmp webp svg tiff ico)

# Check if KlipDot preview is available
klipdot_preview_available() {
    command -v klipdot >/dev/null 2>&1 && [[ $KLIPDOT_PREVIEW_ENABLED -eq 1 ]]
}

# Check if a file is an image
klipdot_is_image() {
    local file="$1"
    [[ -f "$file" ]] || return 1
    
    local ext="${file:l:e}"  # Get extension in lowercase
    for img_ext in $KLIPDOT_IMAGE_EXTENSIONS; do
        [[ "$ext" == "$img_ext" ]] && return 0
    done
    return 1
}

# Check if a string looks like an image path
klipdot_looks_like_image_path() {
    local path="$1"
    
    # Remove quotes if present
    path="${path%\"}"
    path="${path#\"}"
    path="${path%\'}"
    path="${path#\'}"
    
    # Check if it's a valid file path with image extension
    if [[ "$path" =~ ^[~/.].*\.(png|jpg|jpeg|gif|bmp|webp|svg|tiff|ico)$ ]]; then
        # Expand path
        path="${path/#\~/$HOME}"
        [[ -f "$path" ]] && echo "$path" && return 0
    fi
    
    return 1
}

# Show preview for an image file
klipdot_show_preview() {
    local image_path="$1"
    
    if ! klipdot_preview_available; then
        return 1
    fi
    
    if klipdot_is_image "$image_path"; then
        echo "🖼️  Previewing: $(basename "$image_path")"
        
        # Use timeout to prevent hanging
        timeout 3s klipdot preview "$image_path" --width "$KLIPDOT_PREVIEW_WIDTH" --height "$KLIPDOT_PREVIEW_HEIGHT" 2>/dev/null
        
        # If that failed or timed out, try quick preview
        if [[ $? -ne 0 ]]; then
            klipdot_quick_preview "$image_path"
        fi
        
        return 0
    fi
    
    return 1
}

# Quick image preview function (non-blocking)
klipdot_quick_preview() {
    local image_path="$1"
    
    if [[ ! -f "$image_path" ]]; then
        echo "❌ File not found: $image_path"
        return 1
    fi
    
    # Show immediate file info using stat
    local file_size=$(stat -f%z "$image_path" 2>/dev/null || echo "unknown")
    local readable_size=$(echo $file_size | awk '{
        if ($1 < 1024) print $1 " B"
        else if ($1 < 1048576) printf "%.1f KB", $1/1024
        else if ($1 < 1073741824) printf "%.1f MB", $1/1024/1024
        else printf "%.1f GB", $1/1024/1024/1024
    }')
    
    # Get image dimensions with sips (built-in macOS tool)
    local dimensions=""
    if command -v sips >/dev/null 2>&1; then
        dimensions=$(sips -g pixelWidth -g pixelHeight "$image_path" 2>/dev/null | 
                    awk '/pixelWidth/ {w=$2} /pixelHeight/ {h=$2} END {if(w&&h) print w"x"h}')
    fi
    
    echo "📸 $(basename "$image_path")"
    echo "📏 Size: $readable_size"
    [[ -n "$dimensions" ]] && echo "🖼️  Dimensions: $dimensions"
    echo "📁 $image_path"
}

# Auto-preview function for command line
klipdot_auto_preview() {
    [[ $KLIPDOT_AUTO_PREVIEW -eq 0 ]] && return
    
    local line="$BUFFER"
    local words=("${(@s/ /)line}")
    
    for word in $words; do
        local image_path=$(klipdot_looks_like_image_path "$word")
        if [[ -n "$image_path" ]]; then
            klipdot_show_preview "$image_path"
            break
        fi
    done
}

# Widget for manual preview trigger
klipdot_preview_widget() {
    local line="$BUFFER"
    local words=("${(@s/ /)line}")
    local found_image=""
    
    # Look for image paths in the current command line
    for word in $words; do
        local image_path=$(klipdot_looks_like_image_path "$word")
        if [[ -n "$image_path" ]]; then
            found_image="$image_path"
            break
        fi
    done
    
    if [[ -n "$found_image" ]]; then
        echo
        klipdot_show_preview "$found_image"
        zle redisplay
    else
        # Try to find image in current directory
        local current_word="${BUFFER[(ws: :)CURSOR]}"
        if [[ -n "$current_word" ]]; then
            local matches=()
            for ext in $KLIPDOT_IMAGE_EXTENSIONS; do
                matches+=($current_word*.$ext(N))
            done
            
            if [[ ${#matches[@]} -eq 1 && -f "${matches[1]}" ]]; then
                echo
                klipdot_show_preview "${matches[1]}"
                zle redisplay
            elif [[ ${#matches[@]} -gt 1 ]]; then
                echo
                echo "Multiple image matches:"
                for match in $matches; do
                    echo "  $match"
                done
                zle redisplay
            else
                echo
                echo "No image found matching: $current_word"
                zle redisplay
            fi
        fi
    fi
}

# Register the widget
zle -N klipdot_preview_widget

# Bind Ctrl+Shift+I (or Alt+I if Ctrl+Shift not available) for manual preview
# Using ^[i for Alt+I which is more universally available
bindkey '^[i' klipdot_preview_widget

# Hook into command execution to detect pasted image paths
klipdot_preexec_hook() {
    local cmd="$1"
    
    # Check if command contains image paths
    local words=("${(@s/ /)cmd}")
    for word in $words; do
        local image_path=$(klipdot_looks_like_image_path "$word")
        if [[ -n "$image_path" ]]; then
            echo "🖼️  Detected image path: $(basename "$image_path")"
            if [[ $KLIPDOT_AUTO_PREVIEW -eq 1 ]]; then
                klipdot_show_preview "$image_path"
            fi
            break
        fi
    done
}

# Hook into right prompt to show preview info
klipdot_rprompt_hook() {
    if ! klipdot_preview_available; then
        return
    fi
    
    local line="$BUFFER"
    if [[ -n "$line" ]]; then
        local words=("${(@s/ /)line}")
        for word in $words; do
            local image_path=$(klipdot_looks_like_image_path "$word")
            if [[ -n "$image_path" ]]; then
                echo "%F{blue}🖼️%f"
                return
            fi
        done
    fi
}

# Hook into line editor to provide real-time feedback
klipdot_line_hook() {
    # This gets called on every keystroke
    # We'll use it to update the right prompt
    zle reset-prompt
}

# Register hooks if preview is enabled
if klipdot_preview_available; then
    # Add to preexec hooks
    if [[ -z "$preexec_functions" ]]; then
        preexec_functions=()
    fi
    preexec_functions+=(klipdot_preexec_hook)
    
    # Add line hook widget
    zle -N klipdot_line_hook
    
    # Update right prompt to show image indicators
    if [[ -z "$RPS1" ]]; then
        RPS1='$(klipdot_rprompt_hook)'
    else
        RPS1="$RPS1"'$(klipdot_rprompt_hook)'
    fi
fi

# Utility functions for manual use

# Quick preview of files in current directory
klipdot_ls_preview() {
    local dir="${1:-.}"
    
    echo "📁 Images in $dir:"
    for ext in $KLIPDOT_IMAGE_EXTENSIONS; do
        for file in "$dir"/*.$ext(N); do
            if [[ -f "$file" ]]; then
                echo "  $(basename "$file")"
                if [[ "$2" == "--preview" || "$2" == "-p" ]]; then
                    klipdot_show_preview "$file"
                    echo
                fi
            fi
        done
    done
}

# Preview the most recent screenshot
klipdot_preview_recent() {
    local screenshot_dir="$HOME/.klipdot/screenshots"
    
    if [[ ! -d "$screenshot_dir" ]]; then
        echo "No screenshot directory found"
        return 1
    fi
    
    local recent_file=$(ls -t "$screenshot_dir"/*.{png,jpg,jpeg}(N) 2>/dev/null | head -1)
    
    if [[ -n "$recent_file" && -f "$recent_file" ]]; then
        echo "📸 Most recent screenshot:"
        klipdot_show_preview "$recent_file"
    else
        echo "No recent screenshots found"
        return 1
    fi
}

# Enhanced cat command that previews images
klipdot_cat() {
    for arg in "$@"; do
        if klipdot_is_image "$arg"; then
            klipdot_show_preview "$arg"
        else
            # Use monitor-output to detect image paths in cat output
            command cat "$arg" | klipdot monitor-output 2>/dev/null || command cat "$arg"
        fi
    done
}

# Live preview mode for editing image paths
klipdot_edit_with_preview() {
    local file="$1"
    echo "🔍 Starting live preview mode for editing: $file"
    echo "Any image paths you type will be auto-previewed!"
    
    # Start live preview in background
    klipdot live-preview --auto-preview &
    local preview_pid=$!
    
    # Open editor
    ${EDITOR:-vim} "$file"
    
    # Kill live preview when done
    kill $preview_pid 2>/dev/null
}

# Monitor any command's output for image paths
klipdot_monitor() {
    local cmd="$@"
    echo "🖼️  Monitoring command output for images: $cmd"
    $cmd 2>&1 | klipdot monitor-output
}

# Run TUI applications with image monitoring
klipdot_tui() {
    local cmd="$@"
    echo "🖼️  Running TUI with image monitoring: $cmd"
    klipdot tui $cmd
}

# Enhanced versions of common TUI apps
klipdot_vim() {
    klipdot_tui vim "$@"
}

klipdot_nvim() {
    klipdot_tui nvim "$@"
}

klipdot_ranger() {
    klipdot_tui ranger "$@"
}

klipdot_lf() {
    klipdot_tui lf "$@"
}

# Enhanced ls command that shows image previews
klipdot_ls() {
    local preview_mode=false
    local args=()
    
    # Parse arguments
    for arg in "$@"; do
        if [[ "$arg" == "--preview" || "$arg" == "-p" ]]; then
            preview_mode=true
        else
            args+=("$arg")
        fi
    done
    
    # Run normal ls
    command ls "${args[@]}"
    
    # Show previews if requested
    if [[ $preview_mode == true ]]; then
        echo
        echo "🖼️  Image previews:"
        for file in "${args[@]:-*}"; do
            if [[ -f "$file" ]] && klipdot_is_image "$file"; then
                echo "━━━ $(basename "$file") ━━━"
                klipdot_show_preview "$file"
                echo
            fi
        done
    fi
}

# Aliases for convenience
alias lsp='klipdot_ls --preview'
alias catimg='klipdot_cat'
alias previewimg='klipdot_show_preview'
alias recent='klipdot_preview_recent'
alias imgls='klipdot_ls_preview'
alias editlive='klipdot_edit_with_preview'
alias monitor='klipdot_monitor'
alias tuiimg='klipdot_tui'
alias vimimg='klipdot_vim'
alias nvimimg='klipdot_nvim'
alias rangerimg='klipdot_ranger'
alias lfimg='klipdot_lf'

# Help function
klipdot_preview_help() {
    cat << 'EOF'
🖼️  KlipDot ZSH Image Preview Integration

Key Bindings:
  Alt+I           - Preview image at cursor or in command line

Commands:
  previewimg FILE - Preview an image file
  recent          - Preview most recent screenshot
  imgls [DIR]     - List images in directory
  lsp             - ls with image previews
  catimg FILE     - cat that previews images and detects paths in output
  editlive FILE   - Edit with LSP-style live preview
  monitor COMMAND - Monitor any command output for image paths
  tuiimg COMMAND  - Run TUI apps with enhanced image monitoring
  vimimg/nvimimg  - Vim/Neovim with image detection
  rangerimg/lfimg - File managers with enhanced previews

Auto-detection:
  • Automatically detects image paths in command line
  • Shows 🖼️ indicator in right prompt when image detected
  • Auto-previews on command execution (if enabled)

Configuration:
  KLIPDOT_PREVIEW_ENABLED=1    # Enable/disable preview
  KLIPDOT_AUTO_PREVIEW=1       # Auto-preview on command exec
  KLIPDOT_PREVIEW_WIDTH=80     # Preview width
  KLIPDOT_PREVIEW_HEIGHT=24    # Preview height

Examples:
  echo ~/.klipdot/screenshots/image.png  # Will show preview
  vim ~/Pictures/photo.jpg               # Will detect and preview
  ls ~/Downloads/*.png                   # Shows 🖼️ indicator
EOF
}

# Show help on first load if KLIPDOT_SHOW_HELP is set
if [[ $KLIPDOT_SHOW_HELP -eq 1 ]] && klipdot_preview_available; then
    echo "🖼️  KlipDot image preview loaded! Type 'klipdot_preview_help' for usage."
fi