#!/usr/bin/env python3
"""Generate oxlint-disable comments from ESLint suppressions file.

This script reads the ESLint suppressions file and generates oxlint-disable
comments for files with pre-existing violations.
"""
import json
import os
from collections import defaultdict
from pathlib import Path

SUPPRESSIONS_FILE = "config/quality/eslint-suppressions.json"

# Map ESLint rule names to oxlint equivalents
RULE_MAP = {
    "@typescript-eslint/no-unused-vars": "no-unused-vars",
    "@typescript-eslint/no-explicit-any": "no-explicit-any",
    "react-hooks/exhaustive-deps": "exhaustive-deps",
    "react-hooks/rules-of-hooks": "rules-of-hooks",
    "no-eval": "no-eval",
    "no-implied-eval": "no-implied-eval",
    "no-new-func": "no-new-func",
    "no-restricted-imports": "no-restricted-imports",
}

def add_oxlint_disable_comments():
    """Add oxlint-disable comments to files with pre-existing violations."""
    with open(SUPPRESSIONS_FILE) as f:
        suppressions = json.load(f)
    
    files_modified = 0
    comments_added = 0
    
    for filepath, rules in suppressions.items():
        if not os.path.exists(filepath):
            continue
        
        # Collect oxlint rules to disable
        oxlint_rules = []
        for rule_name in rules.keys():
            oxlint_rule = RULE_MAP.get(rule_name)
            if oxlint_rule:
                oxlint_rules.append(oxlint_rule)
        
        if not oxlint_rules:
            continue
        
        # Read file content
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check if file already has oxlint-disable at top
        if content.startswith('// oxlint-disable'):
            continue
        
        # Generate disable comment
        disable_comment = f"// oxlint-disable {', '.join(sorted(set(oxlint_rules)))}\n"
        
        # Add comment at top of file
        new_content = disable_comment + content
        
        with open(filepath, 'w') as f:
            f.write(new_content)
        
        files_modified += 1
        comments_added += len(oxlint_rules)
    
    print(f"Modified {files_modified} files")
    print(f"Added {comments_added} oxlint-disable comments")

if __name__ == "__main__":
    add_oxlint_disable_comments()
