#!/bin/zsh

# Quick image preview function for KlipDot
# Provides instant feedback without blocking terminal

klipdot_quick_preview() {
    local image_path="$1"
    
    if [[ ! -f "$image_path" ]]; then
        echo "❌ File not found: $image_path"
        return 1
    fi
    
    # Show immediate file info
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
    
    # Launch QuickLook in background without blocking
    if command -v qlmanage >/dev/null 2>&1; then
        echo "🔍 Opening QuickLook preview..."
        qlmanage -p "$image_path" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        echo "🔍 Opening with default app..."
        open "$image_path" >/dev/null 2>&1 &
    fi
}

# Enhanced preview that tries multiple methods
klipdot_smart_preview() {
    local image_path="$1"
    
    if [[ ! -f "$image_path" ]]; then
        echo "❌ File not found: $image_path"
        return 1
    fi
    
    # First show quick info
    klipdot_quick_preview "$image_path"
    
    # Try ASCII preview if tools are available
    if command -v chafa >/dev/null 2>&1; then
        echo "🎨 ASCII Preview:"
        chafa --size 60x30 --format symbols "$image_path" 2>/dev/null
    elif command -v jp2a >/dev/null 2>&1; then
        echo "🎨 ASCII Preview:"
        jp2a --colors --width=60 "$image_path" 2>/dev/null
    fi
}

# Export functions
typeset -fx klipdot_quick_preview
typeset -fx klipdot_smart_preview