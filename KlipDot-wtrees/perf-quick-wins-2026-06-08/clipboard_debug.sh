#!/bin/bash

echo "🔧 KlipDot Clipboard Diagnostic Tool"
echo "===================================="

echo ""
echo "1. Testing clipboard tools availability:"
echo "----------------------------------------"
echo -n "pbcopy: "
if command -v pbcopy >/dev/null 2>&1; then
    echo "✅ Available"
else
    echo "❌ Not found"
fi

echo -n "pbpaste: "
if command -v pbpaste >/dev/null 2>&1; then
    echo "✅ Available"
else
    echo "❌ Not found"
fi

echo -n "osascript: "
if command -v osascript >/dev/null 2>&1; then
    echo "✅ Available"
else
    echo "❌ Not found"
fi

echo -n "pngpaste: "
if command -v pngpaste >/dev/null 2>&1; then
    echo "✅ Available (optional)"
else
    echo "⚠️  Not installed (optional, install with: brew install pngpaste)"
fi

echo ""
echo "2. Current clipboard content analysis:"
echo "-------------------------------------"

# Check text content
TEXT_CONTENT=$(pbpaste 2>/dev/null)
if [ ! -z "$TEXT_CONTENT" ]; then
    TEXT_LENGTH=${#TEXT_CONTENT}
    echo "Text content: $TEXT_LENGTH characters"
    if [ $TEXT_LENGTH -lt 100 ]; then
        echo "Preview: $TEXT_CONTENT"
    else
        echo "Preview: ${TEXT_CONTENT:0:100}..."
    fi
else
    echo "No text content in clipboard"
fi

echo ""
echo "3. Testing image detection methods:"
echo "----------------------------------"

# Method 1: osascript
echo "Method 1 - osascript:"
if osascript -e 'try
    set imageData to the clipboard as «class PNGf»
    return "Image data found: " & (length of imageData) & " bytes"
on error
    return "No image data"
end try' 2>/dev/null; then
    echo "✅ osascript method working"
else
    echo "❌ osascript method failed"
fi

# Method 2: pngpaste (if available)
if command -v pngpaste >/dev/null 2>&1; then
    echo ""
    echo "Method 2 - pngpaste:"
    if pngpaste - 2>/dev/null | wc -c | grep -q "^[1-9]"; then
        PNG_SIZE=$(pngpaste - 2>/dev/null | wc -c)
        echo "✅ pngpaste found image data: $PNG_SIZE bytes"
    else
        echo "❌ No image data via pngpaste"
    fi
fi

echo ""
echo "4. KlipDot status:"
echo "-----------------"
klipdot status 2>/dev/null || echo "KlipDot not running"

echo ""
echo "5. Screenshot directory:"
echo "-----------------------"
if [ -d ~/.klipdot/screenshots ]; then
    SCREENSHOT_COUNT=$(find ~/.klipdot/screenshots -type f -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | wc -l)
    echo "Directory exists with $SCREENSHOT_COUNT image files"
    
    if [ $SCREENSHOT_COUNT -gt 0 ]; then
        echo "Recent files:"
        ls -lt ~/.klipdot/screenshots/*.{png,jpg,jpeg} 2>/dev/null | head -3
    fi
else
    echo "Screenshots directory not found"
fi

echo ""
echo "📋 To test screenshot detection:"
echo "1. Run: ./test_clipboard.sh"
echo "2. Take a screenshot with Cmd+Shift+4"
echo "3. Watch for image detection logs"
echo "4. Try pasting to see file path"