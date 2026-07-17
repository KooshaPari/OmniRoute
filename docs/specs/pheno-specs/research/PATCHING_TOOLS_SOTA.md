# State of the Art: Patching Tools and Technologies

## Executive Summary

This document surveys the landscape of patching tools from traditional Unix utilities to modern alternatives. The analysis covers implementation details, feature comparisons, and integration patterns essential for the phenotype-patch project architecture decisions.

---

## Table of Contents

1. [Traditional Patching Tools](#1-traditional-patching-tools)
   - 1.1 [GNU Patch](#11-gnu-patch)
   - 1.2 [Git Apply](#12-git-apply)
   - 1.3 [Ed and Ex](#13-ed-and-ex)
   - 1.4 [Sed for Patching](#14-sed-for-patching)
2. [Modern Diff Display Tools](#2-modern-diff-display-tools)
   - 2.1 [Difftastic](#21-difftastic)
   - 2.2 [Delta](#22-delta)
   - 2.3 [Diff-So-Fancy](#23-diff-so-fancy)
   - 2.4 [Diff-Highlight](#24-diff-highlight)
3. [Specialized Patching Systems](#3-specialized-patching-systems)
   - 3.1 [JSON Patch (RFC 6902)](#31-json-patch-rfc-6902)
   - 3.2 [OpenAPI Diff](#32-openapi-diff)
   - 3.3 [Database Patching Tools](#33-database-patching-tools)
   - 3.4 [Configuration Management Patches](#34-configuration-management-patches)
4. [Integrated Development Tools](#4-integrated-development-tools)
   - 4.1 [IDE Patch Integration](#41-ide-patch-integration)
   - 4.2 [Code Review Systems](#42-code-review-systems)
5. [Language-Specific Tools](#5-language-specific-tools)
   - 5.1 [Rust: cargo-patch](#51-rust-cargo-patch)
   - 5.2 [Python: patch-ng](#52-python-patch-ng)
   - 5.3 [JavaScript: diff and patch libraries](#53-javascript-diff-and-patch-libraries)
6. [Tool Comparison Matrix](#6-tool-comparison-matrix)
7. [Integration Patterns](#7-integration-patterns)
8. [Recommendations for phenotype-patch](#8-recommendations-for-phenotype-patch)
9. [References](#9-references)

---

## 1. Traditional Patching Tools

### 1.1 GNU Patch

GNU Patch is the reference implementation for applying patch files, originally written by Larry Wall (creator of Perl) in 1985.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GNU Patch                             │
├─────────────────────────────────────────────────────────────┤
│  Input Parser → Hunk Processor → Fuzzy Matcher → File Writer │
├─────────────────────────────────────────────────────────────┤
│  Patch Format: unified | context | normal | ed | git         │
│  Features: --fuzz, --dry-run, --backup, --reverse           │
└─────────────────────────────────────────────────────────────┘
```

#### Command-Line Interface

```bash
# Basic application
patch -p1 < changes.patch

# With backup
patch -b -p1 < changes.patch

# Dry run (verification only)
patch --dry-run -p1 < changes.patch

# Reverse patch (unapply)
patch -R -p1 < changes.patch

# Specify fuzz factor
patch -F3 -p1 < changes.patch
```

#### Fuzzy Matching Implementation

GNU Patch implements sophisticated fuzzy matching:

1. **Offset Search**: Searches within a window (default: ±2×context) from expected location
2. **Similarity Scoring**: Compares context lines using:
   - Exact match: 100%
   - Whitespace-only difference: 90%
   - Minor content difference: 50-80%

3. **Decision Thresholds**:
   - **Strict**: 100% match required
   - **Default**: 50% minimum
   - **Fuzzy**: Configurable (0-100)

#### Algorithm Complexity

```c
// Core matching logic (simplified)
int match_hunk(struct patch *patch, struct file *file, int offset) {
    int matches = 0;
    int context_lines = 0;
    
    for (line in patch->context) {
        if (compare_normalized(file->lines[offset + i], line)) {
            matches++;
        }
        context_lines++;
    }
    
    return (matches * 100) / context_lines;
}
```

Time complexity: O(H × C × W) where:
- H = number of hunks
- C = average context lines per hunk
- W = search window size

#### Backup and Versioning

GNU Patch provides multiple backup strategies:

```bash
# Simple backup (.orig)
patch -b < patchfile

# Numbered backup series
patch -b -V numbered < patchfile

# Custom suffix
patch -b -z .backup < patchfile

# Original file preservation
patch -B /tmp/originals/ < patchfile
```

#### Limitations

1. **Line-Oriented**: Cannot apply character-level changes
2. **No Directory Moves**: Cannot track file renames
3. **Single Threaded**: Processes one file at a time
4. **Limited Context**: Relies on surrounding context for matching

#### Source Code

```
Repository: git://git.savannah.gnu.org/patch.git
Language: C
License: GPLv3+
Key Files:
  - src/patch.c: Main entry point
  - src/pch.c: Patch parsing
  - src/inp.c: Input file handling
  - src/fuzz.c: Fuzzy matching
  - src/util.c: Utilities
```

---

### 1.2 Git Apply

Git apply is Git's internal patch application tool, designed for Git-specific features and workflows.

#### Differentiation from GNU Patch

| Feature | GNU Patch | Git Apply |
|---------|-----------|-----------|
| Git diff metadata | Partial | Full |
| Rename detection | No | Yes |
| Binary patches | No | Yes |
| Mode changes | Partial | Full |
| CRLF handling | Basic | Configurable |
| Prettier errors | No | Yes |
| Statistics | No | Yes |

#### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Git Apply                         │
├─────────────────────────────────────────────────────┤
│  1. Parse Git diff headers                           │
│  2. Validate against index (optional)               │
│  3. Apply hunks with 3-way fallback                 │
│  4. Update index and working tree                    │
├─────────────────────────────────────────────────────┤
│  Special Handlers:                                   │
│  • Binary delta (literal/delta)                     │
│  • Rename detection (--detect-renames)              │
│  • Mode changes (--chmod=+x)                        │
│  • Submodules                                        │
└─────────────────────────────────────────────────────┘
```

#### Binary Patch Support

Git apply handles binary files through delta encoding:

```diff
diff --git a/file.bin b/file.bin
index 1234567..890abcd 100644
GIT binary patch
delta 45
zcmV?ib4J8PW@... (base85 encoded delta)

literal 1234
zcmV?ib4J8PW@... (base85 encoded literal)
```

Binary patch algorithms:
1. **Literal**: Full file content (base85 encoded)
2. **Delta**: xdelta encoding for efficiency

#### Three-Way Merge Fallback

When direct application fails:

```bash
# Attempt 3-way merge with staged version
git apply --3way < patchfile
```

Process:
1. Try direct application
2. If failed, look for base version in index
3. Perform 3-way merge
4. Mark conflicts if unresolvable

#### Interface Examples

```bash
# Check if patch applies cleanly
git apply --check patch.diff

# Apply with verbose output
git apply -v patch.diff

# Apply to index only
git apply --cached patch.diff

# Apply to working tree without index update
git apply --nostat patch.diff

# Reject hunks to .rej files
git apply --reject patch.diff

# Whitespace handling
git apply --whitespace=fix patch.diff  # auto-fix
git apply --whitespace=error patch.diff  # report only
```

#### Implementation

Located in Git source at:
```
builtin/apply.c          # Main command
diff.c                   # Diff parsing
apply.c                  # Apply logic
tree-walk.c              # Tree operations
```

---

### 1.3 Ed and Ex

Ed is the original Unix line editor, and Ex is its extended version (foundation of vi).

#### Historical Significance

Ed was developed by Ken Thompson in 1969 and represents the earliest approach to automated text editing. The `diff -e` command generates ed scripts.

#### Ed Script Format

```ed
# Line numbers are 1-based
42          # Go to line 42
a           # Append after this line
New line content
.           # End input
c           # Change current line
Replacement content
.           # End input
d           # Delete current line
,s/old/new/g # Global substitute
w           # Write file
q           # Quit
```

#### Generating Ed Scripts

```bash
# Generate ed script from diff
diff -e file1 file2 > changes.ed

# Apply ed script
ed - file1 < changes.ed

# Silent mode (no output)
ed -s file1 < changes.ed
```

#### Modern Usage

While rarely used interactively today, ed scripts are still useful for:

1. **Minimal Dependencies**: Available on all Unix systems
2. **Scripted Editing**: Simple automated modifications
3. **Embedded Systems**: Small footprint (~100KB)

#### Limitations

- Line-oriented only
- No undo capability
- Limited error handling
- No visual feedback

---

### 1.4 Sed for Patching

Sed (Stream Editor) is a non-interactive text processor that can perform patching operations.

#### Patching Patterns

```bash
# Simple substitution
sed -i 's/old_pattern/new_pattern/g' file.txt

# Line deletion
sed -i '42d' file.txt

# Line insertion
sed -i '42a\New line content' file.txt

# Line replacement
sed -i '42c\Replacement line' file.txt

# Multiple commands (script file)
sed -i -f changes.sed file.txt
```

#### Batch Patching

```bash
# Apply to multiple files
find . -name "*.c" -exec sed -i 's/OLD_MACRO/NEW_MACRO/g' {} \;

# In-place with backup
sed -i.bak 's/foo/bar/g' *.txt
```

#### Comparison to Patch

| Aspect | Sed | GNU Patch |
|--------|-----|-----------|
| Pattern matching | Regex | Exact/context |
| Line numbers | Absolute | Offset-based |
| Context awareness | No | Yes |
| Reversibility | Manual | Built-in (-R) |
| Fuzzy matching | No | Yes |
| Error recovery | Poor | Good |

---

## 2. Modern Diff Display Tools

### 2.1 Difftastic

Difftastic is a structural diff tool that parses code before comparing, producing more meaningful diffs.

#### Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      Difftastic                            │
├───────────────────────────────────────────────────────────┤
│  File Detection → Parser Selection → AST Generation      │
│         ↓                                                │
│  Tree Diffing → Edit Script → Side-by-Side Display        │
├───────────────────────────────────────────────────────────┤
│  Parsers: Tree-sitter (40+ languages)                    │
│  Diff Engine: Custom tree comparison                     │
│  Output: ANSI color, HTML, JSON                         │
└───────────────────────────────────────────────────────────┘
```

#### Tree-Sitter Integration

Difftastic uses Tree-sitter parsers for accurate syntax analysis:

```rust
// Simplified tree structure
struct SyntaxNode {
    kind: NodeKind,      // e.g., Function, IfStatement
    content: Vec<Atom>,  // Tokens or child nodes
    position: Span,
}

enum Atom {
    Token(String),       // Leaf node
    Node(SyntaxNode),    // Inner node
}
```

#### Diff Algorithm

Difftastic's tree diffing:

1. **Parse both files** into ASTs
2. **Find matching regions** using both:
   - Node kind matching
   - Content similarity (Levenshtein on atoms)
3. **Generate edit script** with tree operations:
   - `Novel`: New node
   - `Changed`: Modified node
   - `Unchanged`: Identical node
   - `Moved`: Relocated node

#### Display Modes

```bash
# Side-by-side (default)
difft file1.rs file2.rs

# Inline view
difft --display inline file1.rs file2.rs

# JSON output (for tooling)
difft --output json file1.rs file2.rs

# HTML output
difft --output html file1.rs file2.rs > diff.html

# Check mode (exit code based on changes)
difft --check file1.rs file2.rs
```

#### Git Integration

```bash
# Set as Git diff tool
git config --global diff.tool difftastic
git config --global difftool.difftastic.cmd 'difft "$LOCAL" "$REMOTE"'

# Use for specific files
git difftool -t difftastic -- '*.rs'

# Set as external diff driver
git config --global diff.difftastic.command 'difft'
```

#### Performance

| Metric | Value |
|--------|-------|
| Startup time | ~50ms |
| Large file handling | Streaming parse |
| Memory usage | ~2x file size |
| Parallel processing | Yes (directory diff) |

#### Source

```
Repository: https://github.com/Wilfred/difftastic
Language: Rust
License: MIT
Parsers: Tree-sitter grammars
```

---

### 2.2 Delta

Delta is a syntax-highlighting pager for Git and diff output, written in Rust.

#### Design Philosophy

Delta doesn't generate diffs—it beautifies existing diff output while maintaining compatibility with standard tools.

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Delta                            │
├─────────────────────────────────────────────────────────┤
│  Input: diff/unified format (stdin or file)              │
│         ↓                                                │
│  Parser: Extract hunks, metadata, file info             │
│         ↓                                                │
│  Highlighter: Syntax highlighting via bat               │
│         ↓                                                │
│  Formatter: Side-by-side, unified, or raw               │
│         ↓                                                │
│  Output: ANSI-colored, pager-compatible                   │
└─────────────────────────────────────────────────────────┘
```

#### Features

```bash
# As Git pager
git config --global core.pager delta
git config --global delta.syntax-theme Dracula

# Command-line usage
delta file1.diff

cat file.diff | delta

# Side-by-side mode
delta --side-by-side file.diff

# With file decoration
delta --file-style 'bold yellow' \
      --hunk-header-decoration-style 'blue box'
```

#### Customization

```gitconfig
[core]
    pager = delta

[delta]
    navigate = true
    light = false
    line-numbers = true
    side-by-side = true
    syntax-theme = Monokai Extended
    plus-style = "syntax #002800"
    minus-style = "syntax #300000"
    file-decoration-style = "blue ul"
    hunk-header-decoration-style = "cyan box"
```

#### Advanced Features

1. **Hyperlinks**: Clickable file paths in terminal
2. **Grep Integration**: Highlight grep matches in diff context
3. **Blame Integration**: Show blame information alongside changes
4. **Ripgrep Integration**: Works with `rg --json | delta`

#### Comparison to Diff-So-Fancy

| Feature | Delta | Diff-So-Fancy |
|---------|-------|---------------|
| Language | Rust | Perl |
| Speed | Fast | Moderate |
| Side-by-side | Native | No |
| Syntax highlighting | Full | Partial |
| Configuration | Extensive | Limited |
| Line numbers | Yes | No |
| Hyperlinks | Yes | No |

#### Source

```
Repository: https://github.com/dandavison/delta
Language: Rust
License: MIT
Dependencies: bat (syntax highlighting)
```

---

### 2.3 Diff-So-Fancy

Diff-so-fancy is a Perl-based diff pretty-printer that makes diffs more human-readable.

#### Approach

```bash
# Standard Git diff
diff --git a/file.txt b/file.txt
index 123456..789abc 100644
--- a/file.txt
+++ b/file.txt
@@ -1,5 +1,5 @@
 line 1
-old line
+new line
 line 3

# With diff-so-fancy
─────────────────────────────────────────────────
modified: file.txt
─────────────────────────────────────────────────
@ file.txt:1 @
 line 1
-old line
+new line
 line 3
```

#### Installation and Usage

```bash
# Installation via npm
npm install -g diff-so-fancy

# Git pager configuration
git config --global core.pager "diff-so-fancy | less --tabs=4 -RFX"

# Mark as non-file (required for proper paging)
git config --global interactive.diffFilter "diff-so-fancy --patch"

# Filter specific parts
git diff | diff-so-fancy
```

#### Features

1. **Clean Headers**: Removes noise from diff headers
2. **Color Optimization**: Better color scheme for readability
3. **Hunk Simplification**: Cleaner hunk markers
4. **Range Information**: Simplified line number display

#### Limitations

- No side-by-side view
- Limited customization
- Perl dependency
- Slower than Rust alternatives

#### Source

```
Repository: https://github.com/so-fancy/diff-so-fancy
Language: Perl
License: MIT
```

---

### 2.4 Diff-Highlight

Diff-highlight is Git's official contrib script for highlighting changed words within diff lines.

#### Functionality

```diff
# Without diff-highlight
-This is the old line content
+This is the new line content

# With diff-highlight
-This is the {old} line content
+This is the {new} line content
```

#### Setup

```bash
# Find the script (included with Git)
which diff-highlight
# Usually: /usr/share/doc/git/contrib/diff-highlight/diff-highlight

# Git configuration
git config --global core.pager "diff-highlight | less"

# Or copy to PATH
cp /usr/share/doc/git/contrib/diff-highlight/diff-highlight ~/bin/
```

#### Implementation

```perl
# Core logic (simplified from Perl source)
sub highlight_pair {
    my ($old, $new) = @_;
    my $prefix = common_prefix($old, $new);
    my $suffix = common_suffix($old, $new);
    
    my $old_middle = substr($old, length($prefix), -length($suffix) || 0);
    my $new_middle = substr($new, length($prefix), -length($suffix) || 0);
    
    return (
        $prefix . highlight_minus($old_middle) . $suffix,
        $prefix . highlight_plus($new_middle) . $suffix
    );
}
```

---

## 3. Specialized Patching Systems

### 3.1 JSON Patch (RFC 6902)

JSON Patch defines a JSON document structure for expressing operations to transform one JSON document into another.

#### Specification

RFC 6902 standardizes six operations:

| Operation | Description | Example |
|-----------|-------------|---------|
| `add` | Add value at path | `{"op": "add", "path": "/foo", "value": "bar"}` |
| `remove` | Remove value at path | `{"op": "remove", "path": "/foo"}` |
| `replace` | Replace value | `{"op": "replace", "path": "/foo", "value": "baz"}` |
| `move` | Move value | `{"op": "move", "from": "/foo", "path": "/bar"}` |
| `copy` | Copy value | `{"op": "copy", "from": "/foo", "path": "/bar"}` |
| `test` | Test value | `{"op": "test", "path": "/foo", "value": "bar"}` |

#### JSON Pointer (RFC 6901)

Paths use JSON Pointer syntax:

```json
// Original document
{
  "users": [
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25}
  ],
  "config": {
    "enabled": true
  }
}
```

```json
// Patch operations
[
  {"op": "replace", "path": "/users/0/age", "value": 31},
  {"op": "add", "path": "/users/-", "value": {"name": "Charlie"}},
  {"op": "remove", "path": "/config/enabled"}
]
```

#### Implementation Libraries

**JavaScript/TypeScript**:
```javascript
import { applyPatch, createPatch } from 'fast-json-patch';

const document = { foo: 'bar' };
const patch = [{ op: 'replace', path: '/foo', value: 'baz' }];

const result = applyPatch(document, patch).newDocument;
// { foo: 'baz' }

// Generate patch
const diff = createPatch({ foo: 'bar' }, { foo: 'baz' });
```

**Python**:
```python
import jsonpatch

patch = jsonpatch.JsonPatch([
    {'op': 'replace', 'path': '/foo', 'value': 'baz'}
])
doc = {'foo': 'bar'}
result = patch.apply(doc)
```

**Rust**:
```rust
use json_patch::{patch, PatchOperation};

let mut doc = serde_json::json!({"foo": "bar"});
let patch = serde_json::json!([
    {"op": "replace", "path": "/foo", "value": "baz"}
]);

patch(&mut doc, &patch).unwrap();
```

#### HTTP Integration

JSON Patch is commonly used in REST APIs:

```http
PATCH /api/users/123 HTTP/1.1
Content-Type: application/json-patch+json

[
  { "op": "replace", "path": "/email", "value": "new@example.com" }
]
```

#### Merge Patch (RFC 7396)

Simpler alternative for partial updates:

```json
// Merge patch (simpler, but less powerful)
{"email": "new@example.com", "name": null}

// Equivalent JSON Patch
[
  {"op": "replace", "path": "/email", "value": "new@example.com"},
  {"op": "remove", "path": "/name"}
]
```

---

### 3.2 OpenAPI Diff

OpenAPI Diff compares OpenAPI specifications to identify breaking and non-breaking changes.

#### Use Cases

1. **API Evolution Tracking**: Monitor API changes over time
2. **Breaking Change Detection**: Automated CI checks
3. **Documentation**: Generate changelogs
4. **Version Compatibility**: Client/server compatibility

#### Types of Changes

| Category | Breaking | Non-Breaking |
|----------|----------|--------------|
| **Endpoints** | Remove endpoint, change HTTP method | Add endpoint |
| **Parameters** | Remove required param, change type | Add optional param |
| **Schemas** | Remove property, change type | Add property |
| **Responses** | Remove success response, change code | Add error response |
| **Security** | Add required auth | Remove auth |

#### Tools

**OpenAPI Diff (Java)**:
```bash
# CLI usage
java -jar openapi-diff.jar old.yaml new.yaml

# HTML report
java -jar openapi-diff.jar --html report.html old.yaml new.yaml

# Fail on breaking
java -jar openapi-diff.jar --fail-on-incompatible old.yaml new.yaml
```

**@apidevtools/openapi-diff (Node.js)**:
```javascript
const diff = require('@apidevtools/openapi-diff');

const result = await diff.diff({
  oldSpec: oldOpenApi,
  newSpec: newOpenApi
});

console.log('Breaking:', result.breakingDifferences.length);
console.log('Non-breaking:', result.nonBreakingDifferences.length);
```

#### Output Format

```yaml
breakingChanges:
  - type: endpoint.removed
    path: /api/v1/legacy
    message: "Endpoint removed"
    
nonBreakingChanges:
  - type: endpoint.added
    path: /api/v2/users
    message: "New endpoint added"
    
unclassifiedChanges:
  - type: description.changed
    path: /api/v1/users
    message: "Description updated"
```

#### Integration

```yaml
# GitHub Actions
- name: Check API Compatibility
  run: |
    openapi-diff base.yaml head.yaml \
      --fail-on-breaking \
      --format markdown \
      --output api-changes.md
```

---

### 3.3 Database Patching Tools

#### Sqitch

Sqitch is a database change management application.

```sql
-- deploy/users.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL
);

-- revert/users.sql
DROP TABLE IF EXISTS users;

-- verify/users.sql
SELECT id, username, email FROM users WHERE FALSE;
```

```bash
# Deploy changes
sqitch deploy db:pg:mydb

# Verify deployment
sqitch verify db:pg:mydb

# Revert changes
sqitch revert db:pg:mydb
```

#### Flyway

Flyway is a popular database migration tool.

```sql
-- V1__Initial_schema.sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

-- V2__Add_email_column.sql
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

```bash
# Apply migrations
flyway migrate

# Check status
flyway info

# Validate pending changes
flyway validate
```

#### Schema Comparison Tools

**PgAdmin Schema Diff**:
- Visual schema comparison
- Generate migration scripts
- Table, index, constraint comparison

**Liquibase**:
```xml
<changeSet id="1" author="dev">
    <createTable tableName="users">
        <column name="id" type="int">
            <constraints primaryKey="true"/>
        </column>
        <column name="name" type="varchar(255)"/>
    </createTable>
</changeSet>
```

---

### 3.4 Configuration Management Patches

#### Ansible Patch Module

```yaml
- name: Apply configuration patch
  ansible.posix.patch:
    src: /tmp/config.patch
    dest: /etc/app/config.conf
    backup: yes

- name: Patch with remote source
  ansible.posix.patch:
    src: https://example.com/security.patch
    dest: /usr/local/bin/app
    remote_src: yes
```

#### Chef InSpec

```ruby
# Verify patch state
describe file('/etc/config.conf') do
  its('content') { should match /new_setting=true/ }
end
```

#### Terraform

```hcl
# Generate patch-like resource changes
resource "aws_launch_configuration" "app" {
  # Changes trigger rolling update
  user_data = templatefile("userdata.sh", {
    version = "2.0.0"  # Change triggers patch
  })
  
  lifecycle {
    create_before_destroy = true
  }
}
```

---

## 4. Integrated Development Tools

### 4.1 IDE Patch Integration

#### IntelliJ IDEA / PyCharm / CLion

```kotlin
// Patch API (simplified)
interface PatchProvider {
    fun applyPatch(patchFile: VirtualFile, target: VirtualFile)
    fun canApply(patchFile: VirtualFile): Boolean
    fun previewPatch(patchFile: VirtualFile): PatchPreview
}

// Features:
// - Visual patch preview
// - Conflict resolution UI
// - Shelve/unshelve changes
// - Patch from clipboard
```

**Features**:
- **Apply Patch**: File → Apply Patch from Clipboard/File
- **Create Patch**: VCS → Create Patch
- **Shelve Changes**: VCS → Shelve Changes
- **Patch Preview**: Side-by-side with apply/reject per hunk

#### VS Code

```json
// settings.json
{
  "diffEditor.renderSideBySide": true,
  "diffEditor.ignoreTrimWhitespace": false,
  "diffEditor.renderIndicators": true,
  "merge-conflict.autoNavigateNextConflict.enabled": true
}
```

**Extensions**:
- **Diff**: Enhanced diff viewer
- **Partial Diff**: Compare selections
- **Git Graph**: Visual commit/patch history

#### Emacs

```elisp
;; Ediff - comprehensive diff interface
(ediff-files "file1.txt" "file2.txt")
(ediff-patch-file "patch.diff")

;; VC integration
(vc-diff)
(vc-create-patch)
```

#### Vim

```vim
" Built-in diff
:diffsplit file2.txt
:diffthis

" Patch operations
:!patch < patch.diff

" Plugins
" - vim-diff-enhanced
" - vim-fugitive (Git integration)
```

---

### 4.2 Code Review Systems

#### GitHub

```yaml
# Pull Request diff features
- Unified/split diff view
- Suggestion block commits
- Multi-line comments
- Review approval workflows
- Required reviews (branch protection)
```

**Patch Integration**:
```bash
# Download PR as patch
curl -L https://github.com/user/repo/pull/123.patch > pr.patch

# Apply PR patch
git am < pr.patch
```

#### GitLab

```yaml
# Merge Request features
- Side-by-side diff
- Suggest changes (inline edits)
- Code intelligence
- Merge conflict resolution UI
- Web IDE for fixes
```

#### Phabricator (Deprecated)

```bash
# Differential patch workflow
arc diff          # Create revision
arc patch D123    # Apply revision
arc amend         # Update with changes
```

#### Gerrit

```bash
# Upload patch for review
git push origin HEAD:refs/for/main

# Download patch
# Via web UI: Download → Patch
# Apply: git am < change_1234.patch
```

---

## 5. Language-Specific Tools

### 5.1 Rust: cargo-patch

Cargo-patch applies patches to dependencies at build time.

```toml
# Cargo.toml
[package.metadata.patch]
crates = [
    { name = "serde", version = "1.0", path = "patches/serde.patch" }
]
```

```bash
# Apply patches
cargo patch

# Verify patches applied
cargo check
```

#### Implementation

Uses `patch` crate (Rust implementation):
```rust
use patch::{Patch, parse};

let patch_str = std::fs::read_to_string("fix.patch")?;
let patch = parse(&patch_str)?;

for file in &patch.files {
    let old = std::fs::read_to_string(&file.old)?;
    let new = patch.apply_to(&old)?;
    std::fs::write(&file.new, new)?;
}
```

---

### 5.2 Python: patch-ng

Patch-ng is a modern Python library for parsing and applying patches.

```python
from patch_ng import Patch, PatchSet, fromfile

# Parse patch
patch = fromfile('changes.patch')

# Apply with statistics
success = patch.apply(root='./target')
print(f"Applied {patch.stat['success']} of {patch.stat['total']} hunks")

# Dry run
patch.apply(root='./target', dry_run=True)
```

#### Features

- Unified and context diff support
- Fuzzy matching (configurable)
- Reject file generation
- Python 3.6+ support
- Type hints included

#### Source

```
Repository: https://github.com/conan-io/python-patch-ng
License: MIT
Maintainer: Conan team
```

---

### 5.3 JavaScript/TypeScript Libraries

#### diff (npm: diff)

```javascript
import { createPatch, applyPatch, structuredPatch } from 'diff';

// Create unified diff
const patch = createPatch('file.txt', oldStr, newStr, 'old', 'new');

// Apply patch
const result = applyPatch(source, patch);

// Structured patch (for processing)
const hunks = structuredPatch('file.txt', 'file.txt', oldStr, newStr);
```

**API Overview**:

| Function | Purpose |
|----------|---------|
| `createPatch()` | Generate unified diff string |
| `applyPatch()` | Apply patch to source |
| `parsePatch()` | Parse diff string to objects |
| `structuredPatch()` | Generate patch as structured data |
| `diffLines()` | Line-by-line comparison |
| `diffChars()` | Character-level diff |

#### jsdiff (GitHub: kpdecker/jsdiff)

```javascript
import Diff from 'diff';

// Word-level diff
const diff = Diff.diffWords(oldText, newText);
diff.forEach(part => {
  const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
  process.stderr.write(part.value[color]);
});

// Patch format
const patch = Diff.createPatch('file.txt', oldStr, newStr);
```

---

## 6. Tool Comparison Matrix

### Feature Comparison

| Tool | Language | Diff Generation | Patch Apply | Fuzzy | Binary | Rename | Speed |
|------|----------|-----------------|-------------|-------|--------|--------|-------|
| GNU Patch | C | No | Yes | Yes | No | No | Fast |
| Git Apply | C | No | Yes | Yes | Yes | Yes | Fast |
| Difftastic | Rust | Yes | No | N/A | No | Yes | Medium |
| Delta | Rust | No | No | N/A | N/A | N/A | Fast |
| Diff-So-Fancy | Perl | No | No | N/A | N/A | N/A | Slow |
| patch-ng | Python | Yes | Yes | Yes | No | No | Medium |
| diff (npm) | JS | Yes | Yes | Limited | No | No | Medium |
| fast-json-patch | JS | Yes | Yes | N/A | N/A | N/A | Fast |

### Use Case Recommendations

| Use Case | Primary | Secondary |
|----------|---------|-----------|
| CI/CD patch apply | GNU Patch | Git Apply |
| Code review display | Difftastic | Delta |
| API versioning | OpenAPI Diff | JSON Patch |
| Database migration | Sqitch | Flyway |
| Library integration | patch-ng (Py) | diff (JS) |
| Visual diff viewing | Delta | Difftastic |

---

## 7. Integration Patterns

### 7.1 CI/CD Integration

```yaml
# GitHub Actions: Patch verification
name: Verify Patch
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check patch applies
        run: |
          patch --dry-run -p1 < proposed.patch
          
      - name: Test apply and build
        run: |
          patch -p1 < proposed.patch
          make build
```

### 7.2 Programmatic Integration

```python
# Python wrapper for phenotype-patch
import subprocess
import tempfile
from pathlib import Path

class PatchManager:
    def __init__(self, fuzz_level=2, backup=True):
        self.fuzz_level = fuzz_level
        self.backup = backup
    
    def apply(self, patch_path: Path, target_dir: Path) -> dict:
        """Apply patch and return status."""
        cmd = [
            'patch', '-p1',
            f'--fuzz={self.fuzz_level}',
            '-d', str(target_dir)
        ]
        
        if self.backup:
            cmd.append('-b')
            
        result = subprocess.run(
            cmd,
            input=patch_path.read_text(),
            capture_output=True,
            text=True
        )
        
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'rejects': self._find_rejects(target_dir)
        }
```

### 7.3 Web Service Integration

```rust
// Rust Axum handler for patch application
use axum::{extract::Json, response::Json};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct PatchRequest {
    source: String,
    patch: String,
    options: PatchOptions,
}

#[derive(Serialize)]
struct PatchResponse {
    success: bool,
    result: Option<String>,
    error: Option<String>,
    hunks_applied: usize,
    hunks_rejected: usize,
}

async fn apply_patch(Json(req): Json<PatchRequest>) -> Json<PatchResponse> {
    match phenotype_patch::apply(&req.source, &req.patch, req.options) {
        Ok(result) => Json(PatchResponse {
            success: true,
            result: Some(result),
            error: None,
            hunks_applied: result.hunks_applied,
            hunks_rejected: 0,
        }),
        Err(e) => Json(PatchResponse {
            success: false,
            result: None,
            error: Some(e.to_string()),
            hunks_applied: 0,
            hunks_rejected: e.hunks_rejected,
        }),
    }
}
```

---

## 8. Recommendations for phenotype-patch

### Architecture Recommendations

1. **Core Engine**: Implement Myers + Histogram algorithms in Rust
2. **Patch Parser**: Support unified, git, and JSON Patch formats
3. **Fuzzy Matcher**: Port GNU Patch's fuzzy algorithm
4. **API Layer**: REST + gRPC interfaces
5. **CLI Tool**: Modern UX with progress indicators and colors

### Feature Priorities

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Unified diff apply | Core requirement |
| P0 | Git diff support | Modern VCS compatibility |
| P1 | Fuzzy matching | Robustness |
| P1 | 3-way merge | Conflict resolution |
| P2 | JSON Patch | API integration |
| P2 | Histogram diff | Quality output |
| P3 | Binary patches | Complete Git compat |
| P3 | AST-based diff | Semantic patching |

### Implementation Stack

```
phenotype-patch/
├── core/                    # Rust implementation
│   ├── diff/               # Myers, Histogram, Patience
│   ├── patch/              # Patch apply engine
│   ├── merge/              # 3-way merge
│   └── fuzz/               # Fuzzy matcher
├── bindings/               # Language bindings
│   ├── python/
│   ├── node/
│   └── wasm/
├── cli/                    # Command-line tool
├── api/                    # REST/gRPC server
└── docs/                   # Documentation
```

---

## 9. References

### Primary Documentation

1. **GNU Patch Manual**. Free Software Foundation.
   - https://www.gnu.org/software/diffutils/manual/

2. **Git Documentation**. Git SCM.
   - https://git-scm.com/docs/git-apply
   - https://git-scm.com/docs/diff-format

3. **RFC 6902: JSON Patch**. IETF.
   - https://tools.ietf.org/html/rfcfc6902

4. **OpenAPI Specification**. OpenAPI Initiative.
   - https://spec.openapis.org/

### Tool Repositories

5. **Difftastic**. Wilfred Hughes.
   - https://github.com/Wilfred/difftastic

6. **Delta**. Dan Davison.
   - https://github.com/dandavison/delta

7. **Diff-So-Fancy**. So Fancy Team.
   - https://github.com/so-fancy/diff-so-fancy

8. **Patch-ng**. Conan Team.
   - https://github.com/conan-io/python-patch-ng

### Books and Papers

9. **Hunt, A., & Thomas, D. (2000)**. "The Pragmatic Programmer". 
   - Chapter on code generation

10. **Raymond, E. S. (2003)**. "The Art of Unix Programming".
    - Chapter on text processing

11. **Spinellis, D. (2020)**. "Beautiful Architecture".
    - Chapter on diff algorithms

### Online Resources

12. **Diffoscope**. Reproducible Builds Project.
    - https://diffoscope.org/

13. **LibXDiff**. Davide Libenzi.
    - http://www.xmailserver.org/xdiff-lib.html

14. **Zig Diff Analysis**. Blog series on diff algorithms.
    - Various technical deep-dives

### Related Standards

15. **IEEE Std 1003.1 (POSIX)**. Diff and patch utilities.

16. **ECMA-404**. JSON standard (for JSON Patch).

17. **W3C XML Patch**. XML patch operations.
    - https://www.w3.org/TR/xpath-31/

---

## Appendix A: Patch Tool History Timeline

```
1969  Ed (Thompson) - Original Unix line editor
1974  Diff (Hunt & McIlroy) - First diff utility
1984  Context diff introduced
1985  Larry Wall creates Patch
1990s Unified diff format
1991  CVS - Patch-based version control
2005  Git - Advanced diff/merge
2010  Patience diff algorithm
2016  Git 2.9 - Histogram becomes default
2018  Difftastic project starts
2020  Delta released (Rust rewrite)
2024  phenotype-patch project
```

## Appendix B: Testing Matrix for phenotype-patch

| Test Case | GNU Patch | Git Apply | phenotype-patch |
|-----------|-----------|-----------|-----------------|
| Simple unified diff | ✓ | ✓ | Must Pass |
| Fuzzy match | ✓ | ✓ | Must Pass |
| Git rename | ✗ | ✓ | Should Pass |
| Binary patch | ✗ | ✓ | Optional |
| 3-way merge | ✗ | Partial | Must Pass |
| JSON Patch | N/A | N/A | Must Pass |
| Large file (>1GB) | ✓ | ✓ | Must Pass |
| Many files (10k+) | ✓ | ✓ | Should Pass |
| Malformed patch | Error | Error | Error |

---

*Document Version: 1.0*
*Last Updated: 2024*
*Author: Research Team - phenotype-patch project*
