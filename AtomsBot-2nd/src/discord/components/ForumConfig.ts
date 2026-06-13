import type { ForumConfig, TeamConfig, ForumTag, ForumPermissions } from "./ForumTypes";

// Default forum/team configurations used by tests and components
export const FORUM_CONFIGURATIONS: ForumConfig[] = [
  {
    id: "platform-bugs",
    name: "🏗️ Platform Bug Reports",
    description: "Report platform-related bugs and issues",
    category: "bug-reports",
    team: "platform",
    priority: 1,
    tags: [
      { name: "bug", emoji: "🐛" },
      { name: "platform", emoji: "🏗️" },
      { name: "high-priority", emoji: "⚠️" },
      { name: "critical", emoji: "🚨" },
      { name: "infrastructure", emoji: "🏭" },
      { name: "deployment", emoji: "🚀" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["platform-team"],
    labels: ["bug", "platform", "infrastructure"],
  },
  {
    id: "platform-features",
    name: "🚀 Platform Feature Requests",
    description: "Request new platform features and improvements",
    category: "feature-requests",
    team: "platform",
    priority: 2,
    tags: [
      { name: "feature", emoji: "✨" },
      { name: "platform", emoji: "🏗️" },
      { name: "enhancement", emoji: "🔧" },
      { name: "idea", emoji: "💡" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["platform-team"],
    labels: ["enhancement", "platform"],
  },
  {
    id: "backend-ai-bugs",
    name: "🧠 Backend/AI Bug Reports",
    description: "Report backend and AI-related bugs",
    category: "bug-reports",
    team: "backend-ai",
    priority: 3,
    tags: [
      { name: "bug", emoji: "🐛" },
      { name: "backend", emoji: "⚙️" },
      { name: "ai", emoji: "🤖" },
      { name: "ml", emoji: "🧠" },
      { name: "api", emoji: "🔌" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["backend-ai-team"],
    labels: ["bug", "backend", "ai"],
  },
  {
    id: "backend-ai-features",
    name: "🤖 Backend/AI Feature Requests",
    description: "Request new backend and AI features",
    category: "feature-requests",
    team: "backend-ai",
    priority: 4,
    tags: [
      { name: "feature", emoji: "✨" },
      { name: "backend", emoji: "⚙️" },
      { name: "ai", emoji: "🤖" },
      { name: "ml", emoji: "🧠" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["backend-ai-team"],
    labels: ["enhancement", "backend", "ai"],
  },
  {
    id: "plugin-bugs",
    name: "🔌 Plugin Bug Reports",
    description: "Report plugin and extension bugs",
    category: "bug-reports",
    team: "plugin",
    priority: 5,
    tags: [
      { name: "bug", emoji: "🐛" },
      { name: "plugin", emoji: "🔌" },
      { name: "extension", emoji: "🧩" },
      { name: "sdk", emoji: "📦" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["plugin-team"],
    labels: ["bug", "plugin"],
  },
  {
    id: "plugin-features",
    name: "🧩 Plugin Feature Requests",
    description: "Request new plugin features and capabilities",
    category: "feature-requests",
    team: "plugin",
    priority: 6,
    tags: [
      { name: "feature", emoji: "✨" },
      { name: "plugin", emoji: "🔌" },
      { name: "extension", emoji: "🧩" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["plugin-team"],
    labels: ["enhancement", "plugin"],
  },
  {
    id: "general-support",
    name: "❓ General Support",
    description: "Get help with general questions and issues",
    category: "support",
    team: "platform",
    priority: 7,
    tags: [
      { name: "support", emoji: "❓" },
      { name: "help", emoji: "🆘" },
      { name: "question", emoji: "❔" },
    ],
    permissions: { allowedRoles: ["@everyone"], restrictedToTeam: false },
    autoAssign: ["platform-team"],
    labels: ["question", "support"],
  },
];

export const TEAM_CONFIGURATIONS: TeamConfig[] = [
  {
    id: "platform",
    name: "Platform Team",
    description: "Responsible for core platform infrastructure and services",
    color: 0x4f46e5,
    emoji: "🏗️",
    forums: ["platform-bugs", "platform-features", "general-support"],
    members: ["platform-team", "infrastructure-engineers"],
  },
  {
    id: "backend-ai",
    name: "Backend/AI Team",
    description: "Handles backend services, APIs, and AI/ML features",
    color: 0x059669,
    emoji: "🧠",
    forums: ["backend-ai-bugs", "backend-ai-features"],
    members: ["backend-ai-team", "ml-engineers", "ai-researchers", "api-developers"],
  },
  {
    id: "plugin",
    name: "Plugin Team",
    description: "Develops and maintains plugins, extensions, and SDKs",
    color: 0xdc2626,
    emoji: "🔌",
    forums: ["plugin-bugs", "plugin-features"],
    members: ["plugin-team", "sdk-developers", "extension-developers"],
  },
];

// Helper to safely parse boolean env values
function parseBooleanEnv(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  const val = String(raw).trim().toLowerCase();
  if (val === "true") return true;
  if (val === "false") return false;
  return defaultValue;
}

// Internal test overrides so specs can mutate ENVIRONMENT_CONFIG
const __ENV_OVERRIDES__: Partial<{
  FORUM_CHANNEL_IDS: Record<string, string>;
  ROLE_MAPPINGS: Record<string, string>;
  AUTO_ASSIGNMENT: { enabled: boolean; notifyAssignees: boolean; createThreads: boolean };
  FORUM_CREATION: { autoCreateForums: boolean; defaultPermissions: Record<string, boolean> };
}> = {};

export const ENVIRONMENT_CONFIG = {
  get FORUM_CHANNEL_IDS() {
    if (__ENV_OVERRIDES__.FORUM_CHANNEL_IDS) return __ENV_OVERRIDES__.FORUM_CHANNEL_IDS;
    const map: Record<string, string> = {};
    // include all defined forums
    for (const f of FORUM_CONFIGURATIONS) {
      const envKey = `FORUM_${f.id.toUpperCase().replace(/-/g, "_")}_CHANNEL_ID`;
      map[f.id] = process.env[envKey] || "";
    }
    // Include additional keys referenced by tests
    const extras: Array<[string, string]> = [
      ["platform-bugs", "PLATFORM_BUGS_CHANNEL_ID"],
      ["platform-features", "PLATFORM_FEATURES_CHANNEL_ID"],
      ["backend-ai-bugs", "BACKEND_AI_BUGS_CHANNEL_ID"],
      ["backend-ai-features", "BACKEND_AI_FEATURES_CHANNEL_ID"],
      ["plugin-bugs", "PLUGIN_BUGS_CHANNEL_ID"],
      ["plugin-features", "PLUGIN_FEATURES_CHANNEL_ID"],
      ["general-support", "GENERAL_SUPPORT_CHANNEL_ID"],
    ];
    for (const [key, env] of extras) {
      if (!(key in map) || map[key] === "") map[key] = process.env[env] || "";
    }
    return map;
  },
  set FORUM_CHANNEL_IDS(val: Record<string, string>) {
    __ENV_OVERRIDES__.FORUM_CHANNEL_IDS = { ...(val || {}) };
  },

  get ROLE_MAPPINGS() {
    if (__ENV_OVERRIDES__.ROLE_MAPPINGS) return __ENV_OVERRIDES__.ROLE_MAPPINGS;
    const roles: Record<string, string> = {};
    roles["platform-team"] = process.env.PLATFORM_TEAM_ROLE_ID || "";
    roles["backend-ai-team"] = process.env.BACKEND_AI_TEAM_ROLE_ID || "";
    roles["plugin-team"] = process.env.PLUGIN_TEAM_ROLE_ID || "";
    roles["infrastructure-engineers"] = process.env.INFRASTRUCTURE_ENGINEERS_ROLE_ID || "";
    roles["ml-engineers"] = process.env.ML_ENGINEERS_ROLE_ID || "";
    roles["ai-researchers"] = process.env.AI_RESEARCHERS_ROLE_ID || "";
    roles["api-developers"] = process.env.API_DEVELOPERS_ROLE_ID || "";
    roles["sdk-developers"] = process.env.SDK_DEVELOPERS_ROLE_ID || "";
    roles["extension-developers"] = process.env.EXTENSION_DEVELOPERS_ROLE_ID || "";
    return roles;
  },
  set ROLE_MAPPINGS(val: Record<string, string>) {
    __ENV_OVERRIDES__.ROLE_MAPPINGS = { ...(val || {}) };
  },

  get AUTO_ASSIGNMENT() {
    if (__ENV_OVERRIDES__.AUTO_ASSIGNMENT) return __ENV_OVERRIDES__.AUTO_ASSIGNMENT;
    return {
      enabled: true,
      notifyAssignees: true,
      createThreads: true,
    };
  },
  set AUTO_ASSIGNMENT(val: { enabled: boolean; notifyAssignees: boolean; createThreads: boolean }) {
    __ENV_OVERRIDES__.AUTO_ASSIGNMENT = { ...(val || {}) } as any;
  },

  get FORUM_CREATION() {
    if (__ENV_OVERRIDES__.FORUM_CREATION) return __ENV_OVERRIDES__.FORUM_CREATION as any;
    return {
      autoCreateForums: parseBooleanEnv("FORUM_AUTO_CREATE", false),
      defaultPermissions: {
        viewChannel: true,
        sendMessages: true,
        createPublicThreads: true,
        sendMessagesInThreads: true,
      },
    } as const;
  },
  set FORUM_CREATION(val: { autoCreateForums: boolean; defaultPermissions: Record<string, boolean> }) {
    __ENV_OVERRIDES__.FORUM_CREATION = { ...(val || {}) } as any;
  },
};

export function validateConfigurations(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Duplicate IDs
  const forumIds = FORUM_CONFIGURATIONS.map((f) => f.id);
  const teamIds = TEAM_CONFIGURATIONS.map((t) => t.id);
  
  // Check for duplicate forum IDs
  const duplicateForumIds = forumIds.filter((id, index) => forumIds.indexOf(id) !== index);
  if (duplicateForumIds.length > 0) {
    errors.push(`Duplicate forum IDs found: ${[...new Set(duplicateForumIds)].join(", ")}`);
  }
  
  // Check for duplicate team IDs
  const duplicateTeamIds = teamIds.filter((id, index) => teamIds.indexOf(id) !== index);
  if (duplicateTeamIds.length > 0) {
    errors.push(`Duplicate team IDs found: ${[...new Set(duplicateTeamIds)].join(", ")}`);
  }

  // Forum -> team references
  const teamSet = new Set(teamIds);
  for (const f of FORUM_CONFIGURATIONS) {
    if (!teamSet.has(f.team)) {
      errors.push(`Forum '${f.id}' references non-existent team '${f.team}'`);
    }
  }

  // Team -> forum references
  const forumSet = new Set(forumIds);
  for (const t of TEAM_CONFIGURATIONS) {
    for (const fid of t.forums) {
      if (!forumSet.has(fid)) {
        errors.push(`Team '${t.id}' references non-existent forum '${fid}'`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Re-export types for tests
export type { ForumConfig, TeamConfig, ForumTag, ForumPermissions };

