-- LLM Validation Platform - Initial Database Schema
-- Generated from comprehensive validation platform design
-- Version: 1.0.0
-- Date: 2025-07-07

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE validation_status AS ENUM (
    'pending',
    'running', 
    'passed',
    'failed',
    'skipped',
    'error'
);

CREATE TYPE validation_target_type AS ENUM (
    'llm_model',
    'code_function',
    'api_endpoint',
    'data_pipeline',
    'ui_component'
);

CREATE TYPE validation_suite_type AS ENUM (
    'unit',
    'integration',
    'performance',
    'security',
    'compliance',
    'visual',
    'semantic'
);

CREATE TYPE agent_status AS ENUM (
    'active',
    'inactive',
    'busy',
    'error',
    'maintenance'
);

CREATE TYPE user_role AS ENUM (
    'admin',
    'validator',
    'grader',
    'viewer'
);

CREATE TYPE priority_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- Users table for authentication and authorization
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- API Keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects for organizing validation targets
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Validation targets (what we're validating)
CREATE TABLE validation_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type validation_target_type NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Validation suites (collections of tests)
CREATE TABLE validation_suites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type validation_suite_type NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual tests
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_suite_id UUID NOT NULL REFERENCES validation_suites(id) ON DELETE CASCADE,
    validation_target_id UUID NOT NULL REFERENCES validation_targets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_definition JSONB NOT NULL,
    expected_result JSONB,
    priority priority_level NOT NULL DEFAULT 'medium',
    timeout_seconds INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test dependencies
CREATE TABLE test_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    depends_on_test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL DEFAULT 'prerequisite',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, depends_on_test_id)
);

-- Validation executions (test runs)
CREATE TABLE validation_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_suite_id UUID NOT NULL REFERENCES validation_suites(id),
    triggered_by UUID NOT NULL REFERENCES users(id),
    status validation_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    configuration JSONB NOT NULL DEFAULT '{}',
    environment VARCHAR(100) NOT NULL DEFAULT 'development',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual validation results
CREATE TABLE validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_execution_id UUID NOT NULL REFERENCES validation_executions(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id),
    agent_id UUID,
    status validation_status NOT NULL DEFAULT 'pending',
    score NUMERIC(5,2),
    max_score NUMERIC(5,2),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    result_data JSONB,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agents (validation agents)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]',
    configuration JSONB NOT NULL DEFAULT '{}',
    status agent_status NOT NULL DEFAULT 'inactive',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    resource_usage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Code artifacts (source code being validated)
CREATE TABLE code_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_target_id UUID NOT NULL REFERENCES validation_targets(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    language VARCHAR(50),
    version VARCHAR(50),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_result_id UUID NOT NULL REFERENCES validation_results(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(50),
    metric_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge graph nodes
CREATE TABLE knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    properties JSONB NOT NULL DEFAULT '{}',
    confidence_score NUMERIC(3,2) DEFAULT 0.5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge graph relationships
CREATE TABLE knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    confidence_score NUMERIC(3,2) DEFAULT 0.5,
    weight NUMERIC(3,2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for compliance
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_validation_targets_project_id ON validation_targets(project_id);
CREATE INDEX idx_validation_targets_type ON validation_targets(type);
CREATE INDEX idx_validation_suites_project_id ON validation_suites(project_id);
CREATE INDEX idx_validation_suites_type ON validation_suites(type);
CREATE INDEX idx_tests_suite_id ON tests(validation_suite_id);
CREATE INDEX idx_tests_target_id ON tests(validation_target_id);
CREATE INDEX idx_tests_priority ON tests(priority);
CREATE INDEX idx_validation_executions_suite_id ON validation_executions(validation_suite_id);
CREATE INDEX idx_validation_executions_status ON validation_executions(status);
CREATE INDEX idx_validation_executions_created_at ON validation_executions(created_at);
CREATE INDEX idx_validation_results_execution_id ON validation_results(validation_execution_id);
CREATE INDEX idx_validation_results_test_id ON validation_results(test_id);
CREATE INDEX idx_validation_results_status ON validation_results(status);
CREATE INDEX idx_validation_results_created_at ON validation_results(created_at);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_code_artifacts_target_id ON code_artifacts(validation_target_id);
CREATE INDEX idx_code_artifacts_hash ON code_artifacts(content_hash);
CREATE INDEX idx_metrics_result_id ON metrics(validation_result_id);
CREATE INDEX idx_metrics_name ON metrics(metric_name);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX idx_knowledge_nodes_name ON knowledge_nodes(name);
CREATE INDEX idx_knowledge_relationships_source ON knowledge_relationships(source_node_id);
CREATE INDEX idx_knowledge_relationships_target ON knowledge_relationships(target_node_id);
CREATE INDEX idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Composite indexes for common queries
CREATE INDEX idx_validation_results_execution_status ON validation_results(validation_execution_id, status);
CREATE INDEX idx_tests_suite_priority ON tests(validation_suite_id, priority);
CREATE INDEX idx_validation_executions_suite_status ON validation_executions(validation_suite_id, status);
CREATE INDEX idx_knowledge_relationships_source_type ON knowledge_relationships(source_node_id, relationship_type);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_targets_updated_at BEFORE UPDATE ON validation_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_suites_updated_at BEFORE UPDATE ON validation_suites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_nodes_updated_at BEFORE UPDATE ON knowledge_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_relationships_updated_at BEFORE UPDATE ON knowledge_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (action, resource_type, resource_id, new_values)
        VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (action, resource_type, resource_id, old_values, new_values)
        VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (action, resource_type, resource_id, old_values)
        VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add audit triggers to key tables
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER projects_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER validation_targets_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON validation_targets
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER validation_suites_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON validation_suites
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER tests_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE users IS 'User authentication and authorization';
COMMENT ON TABLE user_sessions IS 'Active user sessions for JWT management';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE projects IS 'Project containers for organizing validation work';
COMMENT ON TABLE validation_targets IS 'Items being validated (LLM models, code, APIs, etc.)';
COMMENT ON TABLE validation_suites IS 'Collections of related tests';
COMMENT ON TABLE tests IS 'Individual test definitions';
COMMENT ON TABLE validation_executions IS 'Test run instances';
COMMENT ON TABLE validation_results IS 'Individual test results';
COMMENT ON TABLE agents IS 'Validation agents (AI agents performing validation)';
COMMENT ON TABLE code_artifacts IS 'Source code being validated';
COMMENT ON TABLE metrics IS 'Performance and quality metrics';
COMMENT ON TABLE knowledge_nodes IS 'Knowledge graph nodes';
COMMENT ON TABLE knowledge_relationships IS 'Knowledge graph relationships';
COMMENT ON TABLE audit_log IS 'Audit trail for compliance and security';

-- Initial data for system setup
INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_verified)
VALUES (
    uuid_generate_v4(),
    'admin@llm-validation.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1xKM7zCRY.',
    'System Administrator',
    'admin',
    TRUE,
    TRUE
);

INSERT INTO agents (id, name, type, capabilities, status)
VALUES (
    uuid_generate_v4(),
    'Default Validation Agent',
    'validation_agent',
    '["code_analysis", "llm_evaluation", "security_testing"]',
    'active'
);

COMMIT;
