#!/bin/bash

echo "🧪 Testing KlipDot Clipboard Detection"
echo "===================================="

# Stop any running instances
echo "Stopping any running KlipDot instances..."
klipdot stop 2>/dev/null || true
pkill -f klipdot 2>/dev/null || true
sleep 1

# Remove old config to get fresh macOS-aware config
echo "Resetting configuration..."
rm -f ~/.klipdot/config.json

# Start in verbose mode for debugging
echo "Starting KlipDot with debug logging..."
klipdot start --verbose &
KLIPDOT_PID=$!
sleep 3

echo ""
echo "📋 Testing Clipboard Detection"
echo "=============================="

# Test 1: Check if KlipDot is running
echo "1. Checking if KlipDot is running..."
if kill -0 $KLIPDOT_PID 2>/dev/null; then
    echo "✅ KlipDot is running (PID: $KLIPDOT_PID)"
else
    echo "❌ KlipDot failed to start"
    exit 1
fi

# Test 2: Put some text in clipboard
echo ""
echo "2. Testing with text content..."
echo "Hello World" | pbcopy
sleep 2

# Test 3: Check current clipboard content
echo ""
echo "3. Current clipboard content:"
echo "Content: $(pbpaste)"
echo "Length: $(pbpaste | wc -c) bytes"

# Test 4: Instructions for manual testing
echo ""
echo "📸 Manual Screenshot Test Instructions"
echo "====================================="
echo "1. Press Cmd+Shift+4 to take a screenshot to clipboard"
echo "2. Watch the KlipDot logs for detection"
echo "3. Try pasting (Cmd+V) to see if file path appears"
echo ""
echo "Expected behavior:"
echo "- KlipDot should detect image data in clipboard"
echo "- Image should be saved to ~/.klipdot/screenshots/"
echo "- Clipboard should be replaced with file path"
echo ""
echo "🔍 Monitoring KlipDot logs..."
echo "Press Ctrl+C when done testing"

# Monitor the process
wait $KLIPDOT_PID