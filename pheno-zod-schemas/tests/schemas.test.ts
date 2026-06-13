import { describe, expect, it } from "vitest";
import {
  ProjectSchema,
  UserSchema,
  WorklogEntrySchema,
  WorklogStatus,
  type Project,
  type User,
  type WorklogEntry,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validUser: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "ada@example.com",
  display_name: "Ada Lovelace",
  created_at: "2026-06-11T10:00:00Z",
};

const validWorklogEntry: WorklogEntry = {
  task_id: "L3-53",
  status: "running",
  agent_id: "forge-l3-subagent-53",
  commit_sha: "7b78b5d0511655a0c535ade2cbd0b22131851a19",
  started_at: "2026-06-11T10:00:00Z",
  completed_at: null,
  files_changed: ["pheno-zod-schemas/src/index.ts"],
};

const validProject: Project = {
  id: "pheno-zod-schemas",
  name: "Canonical Zod schemas for the pheno-* fleet",
  owner_email: "ada@example.com",
  members: ["ada@example.com", "babbage@example.com"],
};

// ---------------------------------------------------------------------------
// Tests (>= 5; explicit per task brief)
// ---------------------------------------------------------------------------

describe("pheno-zod-schemas", () => {
  it("user_schema_rejects_invalid_email", () => {
    const bad = { ...validUser, email: "not-an-email" };
    const result = UserSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod emits an issue whose path points at the email field.
      const emailIssue = result.error.issues.find((i) => i.path[0] === "email");
      expect(emailIssue).toBeDefined();
    }
  });

  it("user_schema_accepts_well_formed_user", () => {
    // Sanity baseline so the rejects test is meaningful.
    const result = UserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.display_name).toBe("Ada Lovelace");
    }
  });

  it("worklog_entry_schema_accepts_all_six_statuses", () => {
    // All six canonical status enum members must validate.
    for (const status of WorklogStatus) {
      const entry: WorklogEntry = { ...validWorklogEntry, status };
      const result = WorklogEntrySchema.safeParse(entry);
      expect(result.success, `status=${status} should validate`).toBe(true);
    }
  });

  it("worklog_entry_schema_rejects_unknown_status", () => {
    // Cast through unknown so the test compiles — at runtime this is a
    // string that's not in the enum.
    const bad = { ...validWorklogEntry, status: "queued" as unknown as WorklogEntry["status"] };
    const result = WorklogEntrySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const statusIssue = result.error.issues.find((i) => i.path[0] === "status");
      expect(statusIssue).toBeDefined();
    }
  });

  it("project_schema_requires_at_least_one_owner_member", () => {
    // The "owner must be a member" invariant: members is non-empty and
    // owner_email must appear in it.
    const missingOwner: Project = {
      ...validProject,
      members: ["babbage@example.com"], // ada is missing
    };
    expect(ProjectSchema.safeParse(missingOwner).success).toBe(false);

    const emptyMembers: Project = {
      ...validProject,
      members: [],
    };
    expect(ProjectSchema.safeParse(emptyMembers).success).toBe(false);

    // Baseline: the well-formed fixture does validate.
    expect(ProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it("schema_types_infer_correctly", () => {
    // Compile-time + runtime check that `z.infer<typeof XSchema>` yields the
    // expected shape. We construct objects of the inferred types and parse
    // them, so a wrong shape would surface as a type error AND a parse
    // failure.
    const u: User = UserSchema.parse(validUser);
    const w: WorklogEntry = WorklogEntrySchema.parse(validWorklogEntry);
    const p: Project = ProjectSchema.parse(validProject);

    expect(u.id).toBe(validUser.id);
    expect(w.task_id).toBe("L3-53");
    expect(p.members.length).toBeGreaterThan(0);

    // The exported runtime WorklogStatus tuple has exactly 6 members — a
    // tripwire so a future edit accidentally adding or removing a status
    // would break this test (intentional, mirrors the l3-46 6-variant
    // tripwire pattern in the Rust sibling crate).
    expect(WorklogStatus).toHaveLength(6);
    expect(new Set(WorklogStatus)).toEqual(
      new Set(["pending", "running", "blocked", "completed", "failed", "cancelled"]),
    );
  });
});
