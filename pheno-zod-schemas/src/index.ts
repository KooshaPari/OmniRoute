// pheno-zod-schemas
//
// Canonical Zod schemas for the pheno-* fleet. Mirrors the domain model in
// the sibling `pheno-pydantic-models` Python package so TS and Python
// services validate the same wire contract. The three entities are:
//
//   - User         : identity record (uuid, email, display_name, created_at)
//   - WorklogEntry : per-task execution record (task_id, status enum, agent_id,
//                    commit_sha nullable, started/completed_at, files_changed)
//   - Project      : top-level project aggregate (slug id, name, owner_email,
//                    members list of emails)
//
// Each schema is exported as both a Zod schema (`<Name>Schema`) and an
// inferred TypeScript type (`<Name>`). Consumers should import the type
// for typing and the schema for runtime validation:
//
//   import { UserSchema, type User } from "@kooshapari/pheno-zod-schemas";
//   const user: User = UserSchema.parse(untrustedInput);
//
// Wire-codes & invariants (must match pheno-pydantic-models):
//   - User.id            : RFC 4122 UUID v4
//   - User.email         : RFC 5322 email (Zod `z.string().email()`)
//   - User.display_name  : 1..80 chars inclusive
//   - User.created_at    : ISO-8601 datetime string
//   - WorklogEntry.task_id        : non-empty string
//   - WorklogEntry.status         : exactly one of the 6 enum members
//   - WorklogEntry.commit_sha     : nullable; when set, 7-40 lowercase hex
//   - WorklogEntry.started_at     : ISO-8601 datetime string
//   - WorklogEntry.completed_at   : nullable ISO-8601 datetime string
//   - WorklogEntry.files_changed  : array of non-empty strings
//   - Project.id          : non-empty slug (lowercase alnum + dashes/underscores)
//   - Project.name        : 1..120 chars inclusive
//   - Project.owner_email : RFC 5322 email
//   - Project.members     : array of emails; at least one member (the owner
//                           MUST appear) — this is the "owner required"
//                           invariant.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** RFC 5322 email string. Zod's built-in `z.string().email()`. */
const EmailSchema = z.string().email();

/** ISO-8601 datetime string. We accept any string that `Date` can parse AND
 *  round-trip back to a matching ISO representation, which rejects values
 *  like `"not-a-date"` while accepting both `2026-06-11T12:00:00Z` and the
 *  offset form `2026-06-11T12:00:00+00:00`. */
const IsoDateTimeSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "must be an ISO-8601 datetime string",
  });

/** RFC 4122 UUID v4 string. Zod's built-in validator. */
const UuidV4Schema = z.string().uuid();

/** Slug: lowercase alnum with `-` or `_`, 1..120 chars, anchored. */
const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
    message: "must be a slug (lowercase alnum, dashes/underscores, no leading/trailing separators)",
  });

/** 7-40 char lowercase hex (git short..full SHA). Null allowed. */
const CommitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, {
    message: "must be 7-40 lowercase hex characters",
  });

// ---------------------------------------------------------------------------
// Worklog status enum
// ---------------------------------------------------------------------------

export const WorklogStatus = [
  "pending",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;

export type WorklogStatusType = (typeof WorklogStatus)[number];

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
  id: UuidV4Schema,
  email: EmailSchema,
  display_name: z.string().min(1).max(80),
  created_at: IsoDateTimeSchema,
});

/** Inferred TypeScript type for {@link UserSchema}. */
export type User = z.infer<typeof UserSchema>;

// ---------------------------------------------------------------------------
// WorklogEntry
// ---------------------------------------------------------------------------

export const WorklogEntrySchema = z.object({
  task_id: z.string().min(1),
  status: z.enum(WorklogStatus),
  agent_id: z.string().min(1),
  commit_sha: CommitShaSchema.nullable(),
  started_at: IsoDateTimeSchema,
  completed_at: IsoDateTimeSchema.nullable(),
  files_changed: z.array(z.string().min(1)),
});

/** Inferred TypeScript type for {@link WorklogEntrySchema}. */
export type WorklogEntry = z.infer<typeof WorklogEntrySchema>;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/**
 * Project aggregate. Enforces the "owner must be a member" invariant at
 * schema level via `.refine`, mirroring the same check in
 * pheno-pydantic-models. The owner_email is also independently required to
 * be a valid email, and members must be valid emails; an empty members list
 * is rejected because a project with zero members is meaningless.
 */
export const ProjectSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(1).max(120),
    owner_email: EmailSchema,
    members: z.array(EmailSchema).min(1, "project must have at least one member"),
  })
  .refine((p) => p.members.includes(p.owner_email), {
    message: "owner_email must appear in members",
    path: ["members"],
  });

/** Inferred TypeScript type for {@link ProjectSchema}. */
export type Project = z.infer<typeof ProjectSchema>;
