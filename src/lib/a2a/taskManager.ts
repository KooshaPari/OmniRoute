/**
 * A2A Task Manager — Tracks task lifecycle and state
 */

import { randomUUID } from "crypto";

export interface A2ATask {
  id: string;
  skill: string;
  messages: Array<{ role: string; content: string }>;
  metadata?: Record<string, unknown>;
  state: "pending" | "working" | "completed" | "failed" | "cancelled";
  artifacts: Array<{ type: string; content: string }>;
  errorMessage?: string;
  expiresAt: string;
  createdAt: number;
  updatedAt: number;
}

interface A2ATaskManagerInstance {
  createTask(input: {
    skill: string;
    messages: Array<{ role: string; content: string }>;
    metadata?: Record<string, unknown>;
  }): A2ATask;
  updateTask(
    id: string,
    state: A2ATask["state"],
    artifacts?: A2ATask["artifacts"],
    errorMessage?: string
  ): void;
  getTask(id: string): A2ATask | undefined;
  getStats(): {
    total: number;
    pending: number;
    working: number;
    completed: number;
    failed: number;
    cancelled: number;
    streamActive: boolean;
  };
  cancelTask(id: string): A2ATask;
  beginStream(): void;
  endStream(): void;
}

/**
 * Exported A2ATaskManager class — instantiable with a custom TTL for testing and
 * per-request manager use-cases. The singleton `taskManager` / `getTaskManager()`
 * remain available for backward compatibility.
 */
export class A2ATaskManager {
  private tasks = new Map<string, A2ATask>();
  private ttlMs: number;

  constructor(ttlMinutes: number = 5) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  createTask(input: {
    skill: string;
    messages: Array<{ role: string; content: string }>;
    metadata?: Record<string, unknown>;
  }): A2ATask {
    const id = randomUUID();
    const now = Date.now();
    const task: A2ATask = {
      id,
      skill: input.skill,
      messages: input.messages,
      metadata: input.metadata,
      state: "pending",
      artifacts: [],
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    return task;
  }

  updateTask(
    id: string,
    state: A2ATask["state"],
    artifacts?: A2ATask["artifacts"],
    errorMessage?: string
  ): void {
    const task = this.tasks.get(id);
    if (task) {
      task.state = state;
      task.updatedAt = Date.now();
      if (artifacts !== undefined) task.artifacts = artifacts;
      if (errorMessage !== undefined) task.errorMessage = errorMessage;
    }
  }

  getTask(id: string): A2ATask | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    // Lazy expiry: only force terminal-incomplete tasks to failed
    if (new Date(task.expiresAt).getTime() < Date.now()) {
      if (task.state === "pending" || task.state === "working") {
        task.state = "failed";
        task.updatedAt = Date.now();
        task.artifacts = [...task.artifacts, { type: "error", content: "Task expired" }];
      }
      // completed / cancelled are left as-is
    }

    return task;
  }

  getStats() {
    this.cleanupExpired();
    const stats = {
      total: 0,
      pending: 0,
      working: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      stats.total += 1;
      stats[task.state] += 1;
    }

    return stats;
  }

  cancelTask(id: string): A2ATask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    task.state = "cancelled";
    task.updatedAt = Date.now();
    return task;
  }

  /** Clean up expired pending/working tasks (private by TS convention; accessible at runtime). */
  cleanupExpired(): void {
    const now = Date.now();
    for (const task of this.tasks.values()) {
      if (
        new Date(task.expiresAt).getTime() < now &&
        (task.state === "pending" || task.state === "working")
      ) {
        task.state = "failed";
        task.updatedAt = now;
        task.artifacts = [...task.artifacts, { type: "error", content: "Task expired" }];
      }
      // completed / cancelled are left unchanged
    }
  }

  /** Tear down the internal state; call in afterEach to prevent cross-test leakage. */
  destroy(): void {
    this.tasks.clear();
  }
}

// ---------------------------------------------------------------------------
// Legacy singleton (kept for backward compatibility with existing callers)
// ---------------------------------------------------------------------------

const _singleton = new A2ATaskManager(5);

let streamActive = false;

const taskManager: A2ATaskManagerInstance = {
  createTask(input) {
    return _singleton.createTask(input);
  },

  updateTask(id, state, artifacts, errorMessage) {
    _singleton.updateTask(id, state, artifacts, errorMessage);
  },

  getTask(id) {
    return _singleton.getTask(id);
  },

  getStats() {
    return { ..._singleton.getStats(), streamActive };
  },

  cancelTask(id) {
    return _singleton.cancelTask(id);
  },

  beginStream() {
    streamActive = true;
  },

  endStream() {
    streamActive = false;
  },
};

export function getTaskManager(): A2ATaskManagerInstance {
  return taskManager;
}
