#!/bin/bash

# Script to convert Jest syntax to Vitest in test files

files=(
  "src/discord/commands/__tests__/dashboard.test.ts"
  "src/discord/commands/__tests__/help.test.ts"
  "src/discord/commands/__tests__/issue.test.ts"
  "src/discord/commands/__tests__/label.test.ts"
  "src/discord/commands/__tests__/link.test.ts"
  "src/discord/commands/__tests__/priority.test.ts"
  "src/discord/commands/__tests__/status.test.ts"
  "src/discord/commands/__tests__/githubManage.test.ts"
  "src/discord/commands/__tests__/jiraManage.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Converting $file..."
    
    # Add Vitest imports if not present
    if ! grep -q "import.*vitest" "$file"; then
      # Check if it already has jest imports to replace
      if grep -q "import.*@jest/globals" "$file"; then
        sed -i.bak 's|import.*from "@jest/globals"|import { vi, beforeEach, describe, it, expect } from "vitest"|g' "$file"
      else
        # Add vitest import after existing imports
        sed -i.bak '1,/^import.*from.*$/a\
import { vi, beforeEach, describe, it, expect } from "vitest";' "$file"
      fi
    fi
    
    # Replace Jest with Vitest
    sed -i.bak 's/jest\.mock/vi\.mock/g' "$file"
    sed -i.bak 's/jest\.fn()/vi\.fn()/g' "$file"
    sed -i.bak 's/jest\.Mock/vi\.Mock/g' "$file"
    sed -i.bak 's/jest\.clearAllMocks()/vi\.clearAllMocks()/g' "$file"
    sed -i.bak 's/jest\.requireActual/vi\.importActual/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
    
    echo "Converted $file"
  else
    echo "File $file not found"
  fi
done

echo "Conversion complete!"