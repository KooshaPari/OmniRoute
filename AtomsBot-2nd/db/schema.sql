-- Comprehensive Database Schema for Discord Bot
-- Supports both PostgreSQL and SQLite with compatibility notes

-- Enable foreign key constraints (SQLite)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Discord Guilds/Servers
CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    owner_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Discord Channels (Forums)
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type INTEGER NOT NULL, -- Discord channel type
    topic TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Discord Forum Tags
CREATE TABLE IF NOT EXISTS forum_tags (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji_id TEXT,
    emoji_name TEXT,
    moderated BOOLEAN DEFAULT FALSE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Discord Threads (Main entity)
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    archived BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    auto_archive_duration INTEGER,
    message_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Thread-Tag relationships (many-to-many)
CREATE TABLE IF NOT EXISTS thread_tags (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES forum_tags(id) ON DELETE CASCADE,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (thread_id, tag_id)
);

-- Discord Messages/Comments
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_username TEXT,
    content TEXT,
    edited_at INTEGER,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- INTEGRATION ENTITIES
-- ============================================================================

-- GitHub Issues
CREATE TABLE IF NOT EXISTS github_issues (
    id INTEGER PRIMARY KEY,
    number INTEGER NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL, -- open, closed
    locked BOOLEAN DEFAULT FALSE,
    assignee_login TEXT,
    labels TEXT, -- JSON array of labels
    milestone_title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    closed_at INTEGER,
    UNIQUE(owner, repo, number)
);

-- Jira Issues
CREATE TABLE IF NOT EXISTS jira_issues (
    id TEXT PRIMARY KEY, -- Jira issue ID
    key TEXT UNIQUE NOT NULL, -- Jira issue key (e.g., PROJ-123)
    project_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT,
    assignee_email TEXT,
    reporter_email TEXT,
    labels TEXT, -- JSON array of labels
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    resolved_at INTEGER
);

-- ============================================================================
-- LINKING TABLES
-- ============================================================================

-- Thread-GitHub Issue Links
CREATE TABLE IF NOT EXISTS thread_github_links (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    github_issue_id INTEGER NOT NULL REFERENCES github_issues(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT, -- Discord user ID who created the link
    PRIMARY KEY (thread_id, github_issue_id)
);

-- Thread-Jira Issue Links
CREATE TABLE IF NOT EXISTS thread_jira_links (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    jira_issue_id TEXT NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT, -- Discord user ID who created the link
    PRIMARY KEY (thread_id, jira_issue_id)
);

-- GitHub-Jira Issue Links (for cross-platform linking)
CREATE TABLE IF NOT EXISTS github_jira_links (
    github_issue_id INTEGER NOT NULL REFERENCES github_issues(id) ON DELETE CASCADE,
    jira_issue_id TEXT NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT,
    PRIMARY KEY (github_issue_id, jira_issue_id)
);

-- ============================================================================
-- USER & SESSION MANAGEMENT
-- ============================================================================

-- Discord Users (for caching and session management)
CREATE TABLE IF NOT EXISTS discord_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    global_name TEXT,
    avatar TEXT,
    bot BOOLEAN DEFAULT FALSE,
    last_seen_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- User Sessions (for modal forms, multi-step interactions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL REFERENCES discord_users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL, -- 'modal_form', 'command_flow', etc.
    session_data TEXT, -- JSON data
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

-- Activity Log (for audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'thread', 'github_issue', 'jira_issue'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'linked', 'closed', etc.
    actor_id TEXT, -- Discord user ID
    actor_type TEXT DEFAULT 'user', -- 'user', 'bot', 'webhook'
    details TEXT, -- JSON details
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Thread indexes
CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_archived ON threads(archived);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- GitHub issue indexes
CREATE INDEX IF NOT EXISTS idx_github_issues_owner_repo ON github_issues(owner, repo);
CREATE INDEX IF NOT EXISTS idx_github_issues_state ON github_issues(state);
CREATE INDEX IF NOT EXISTS idx_github_issues_assignee ON github_issues(assignee_login);

-- Jira issue indexes
CREATE INDEX IF NOT EXISTS idx_jira_issues_project_key ON jira_issues(project_key);
CREATE INDEX IF NOT EXISTS idx_jira_issues_status ON jira_issues(status);
CREATE INDEX IF NOT EXISTS idx_jira_issues_assignee ON jira_issues(assignee_email);

-- Link indexes
CREATE INDEX IF NOT EXISTS idx_thread_github_links_thread_id ON thread_github_links(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_jira_links_thread_id ON thread_jira_links(thread_id);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Complete thread view with all linked issues
CREATE VIEW IF NOT EXISTS thread_details AS
SELECT 
    t.id,
    t.title,
    t.archived,
    t.locked,
    t.created_at,
    t.updated_at,
    c.name as channel_name,
    g.name as guild_name,
    GROUP_CONCAT(ft.name) as tags,
    COUNT(DISTINCT m.id) as message_count,
    COUNT(DISTINCT tgl.github_issue_id) as github_links_count,
    COUNT(DISTINCT tjl.jira_issue_id) as jira_links_count
FROM threads t
LEFT JOIN channels c ON t.channel_id = c.id
LEFT JOIN guilds g ON c.guild_id = g.id
LEFT JOIN thread_tags tt ON t.id = tt.thread_id
LEFT JOIN forum_tags ft ON tt.tag_id = ft.id
LEFT JOIN messages m ON t.id = m.thread_id AND m.deleted_at IS NULL
LEFT JOIN thread_github_links tgl ON t.id = tgl.thread_id
LEFT JOIN thread_jira_links tjl ON t.id = tjl.thread_id
GROUP BY t.id;
