import { Request } from "express";

interface Thread {
  id: string;
  title: string;
  appliedTags: string[];
  number?: number;
  body?: string;
  node_id?: string;
  comments: ThreadComment[];
  archived: boolean | undefined;
  locked: boolean | undefined;
  lockArchiving?: boolean;
  lockLocking?: boolean;
  channelId?: string;
  assignee?: string;
  // Bind each thread to the GitHub repository it originated from
  repoOwner?: string;
  repoName?: string;
  // Bind each thread to a Jira issue
  jiraKey?: string;
  // Optional timestamps used in tests and some stores
  createdAt?: string;
  updatedAt?: string;
}

interface ThreadComment {
  id: string;
  git_id: number;
}

interface GitIssue {
  title: string;
  body: string;
  number: number;
  node_id: string;
  locked: boolean;
  state: "open" | "closed";
  html_url: string;
}

interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string;
}

interface IssueMetadata {
  number?: number;
  state?: "open" | "closed";
  assignees?: Array<{ login: string; avatar_url: string; id?: number }>;
  labels?: Array<{ name: string; color: string; description?: string }>;
  milestone?: { title: string; due_on?: string | null };
  created_at?: string;
  updated_at?: string;
  comments?: number | ThreadComment[];
  reactions?: { total_count: number };
  priority?: string;
  complexity?: number;
  sprint?: string;
  description?: string;
  html_url?: string;
  jira_url?: string;
  coda_url?: string;
}

// eslint-disable-next-line no-unused-vars
type GithubHandlerFunction = (req: Request) => void;

export type {
  Thread,
  ThreadComment,
  GitIssue,
  GitHubLabel,
  IssueMetadata,
  GithubHandlerFunction,
};

// Compatibility mapping interfaces used by the database service
export interface JiraLinkMapping {
  threadId: string;
  jiraKey: string;
  githubNumber?: number;
  createdAt: number;
}

export interface GitHubLinkMapping {
  threadId: string;
  number: number;
  owner: string;
  repo: string;
  createdAt: number;
}
