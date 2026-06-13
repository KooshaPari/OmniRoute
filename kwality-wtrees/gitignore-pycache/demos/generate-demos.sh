#!/bin/bash

# Generate all Kwality demonstration GIFs using VHS
# 
# Prerequisites:
# - VHS installed (https://github.com/charmbracelet/vhs)
# - Kwality built and available in the current directory

set -e

echo "🎬 Generating Kwality demonstration GIFs..."

# Check if VHS is installed
if ! command -v vhs &> /dev/null; then
    echo "❌ VHS is not installed. Install it with:"
    echo "   brew install vhs"
    echo "   # or"
    echo "   go install github.com/charmbracelet/vhs@latest"
    exit 1
fi

# Check if Kwality binary exists
if [ ! -f "./kwality" ]; then
    echo "❌ Kwality binary not found. Build it with:"
    echo "   make build"
    exit 1
fi

# Create demos directory if it doesn't exist
mkdir -p demos

echo "📦 Generating basic validation demo..."
vhs demos/basic-validation.tape

echo "🚀 Generating installation demo..."
vhs demos/installation.tape

echo "🔒 Generating security scanning demo..."
vhs demos/security-scan.tape

echo "🌐 Generating API usage demo..."
vhs demos/api-usage.tape

echo "🚢 Generating deployment demo..."
vhs demos/deployment.tape

echo "✅ All demonstration GIFs generated successfully!"
echo ""
echo "Generated files:"
ls -la demos/*.gif

echo ""
echo "📋 To regenerate a specific demo:"
echo "   vhs demos/basic-validation.tape"
echo "   vhs demos/installation.tape"
echo "   vhs demos/security-scan.tape"
echo "   vhs demos/api-usage.tape"  
echo "   vhs demos/deployment.tape"