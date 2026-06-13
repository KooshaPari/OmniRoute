export interface ForumTag {
  name: string;
  emoji: string;
}

export interface ForumPermissions {
  allowedRoles: string[];
  restrictedToTeam: boolean;
}

export interface ForumConfig {
  id: string;
  name: string;
  description: string;
  category: string; // e.g., 'bug-reports' | 'feature-requests' | 'support'
  team: string; // team id
  priority: number;
  tags: ForumTag[];
  permissions: ForumPermissions;
  autoAssign: string[];
  labels: string[];
}

export interface TeamConfig {
  id: string;
  name: string;
  description: string;
  color: number;
  emoji: string;
  forums: string[];
  members: string[];
}

