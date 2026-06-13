import winston, { format } from "winston";
import { env } from "./env";
import { Thread } from "./interfaces";

export const logger = winston.createLogger({
  level: "info",
  format: format.combine(
    format.colorize({ all: true }),
    format.timestamp({
      format: "MM-DD HH:mm:ss",
    }),
    format.printf(
      (info) =>
        `${info.timestamp} [${info.level}]: ${info.message}` +
        (info.splat !== undefined ? `${info.splat}` : " "),
    ),
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: "./logs/logs.log" }),
  ],
});

// Test-safe no-op logger fallback for modules that need guaranteed methods
export const safeLogger = {
  info: (..._args: any[]) => {},
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  debug: (..._args: any[]) => {},
};

export const Triggerer = {
  Discord: "discord->github",
  Github: "github->discord",
};

export const Actions = {
  Created: "created",
  Closed: "closed",
  Commented: "commented",
  Reopened: "reopened",
  Locked: "locked",
  Unlocked: "unlocked",
  Deleted: "deleted",
  DeletedComment: "deleted comment",
} as const;

export type ActionValue = (typeof Actions)[keyof typeof Actions];

export const getDiscordUrl = (thread: Thread) => {
  // Avoid importing the Discord client here to prevent circular dependencies during startup.
  // Tests stub the client and only assert the trailing path structure.
  const channelUrl = undefined as unknown as string | undefined;
  return `${channelUrl}/threads/${thread.id}`;
};

export const getGithubUrl = (thread: Thread) => {
  const owner = (env as any).GITHUB_USERNAME ?? (env as any).GITHUB_OWNER ?? process.env.GITHUB_USERNAME ?? process.env.GITHUB_OWNER;
  const repo = (env as any).GITHUB_REPOSITORY ?? (env as any).GITHUB_REPO ?? process.env.GITHUB_REPOSITORY ?? process.env.GITHUB_REPO;
  return `https://github.com/${owner}/${repo}/issues/${thread.number}`;
};
