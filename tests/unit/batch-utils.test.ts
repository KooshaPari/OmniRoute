import { describe, it, expect } from "vitest";
import { mapBatchApiToRecord, mapFileApiToRecord } from "@/app/(dashboard)/dashboard/batch/batch-utils";

describe("mapBatchApiToRecord", () => {
  it("maps a full batch API response to a BatchRecord with request counts", () => {
    const apiResponse = {
      id: "batch_123",
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
      status: "in_progress",
      input_file_id: "file_in",
      output_file_id: "file_out",
      error_file_id: "file_err",
      created_at: 1700000000,
      in_progress_at: 1700000100,
      expires_at: 1700086400,
      finalizing_at: null,
      completed_at: null,
      failed_at: null,
      expired_at: null,
      cancelling_at: null,
      cancelled_at: null,
      request_counts: { total: 100, completed: 50, failed: 2 },
      metadata: { key: "value" },
      errors: null,
      model: "gpt-4",
      usage: null,
    };

    const result = mapBatchApiToRecord(apiResponse);

    expect(result.id).toBe("batch_123");
    expect(result.endpoint).toBe("/v1/chat/completions");
    expect(result.completionWindow).toBe("24h");
    expect(result.status).toBe("in_progress");
    expect(result.inputFileId).toBe("file_in");
    expect(result.outputFileId).toBe("file_out");
    expect(result.errorFileId).toBe("file_err");
    expect(result.createdAt).toBe(1700000000);
    expect(result.inProgressAt).toBe(1700000100);
    expect(result.expiresAt).toBe(1700086400);
    expect(result.finalizingAt).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.failedAt).toBeNull();
    expect(result.expiredAt).toBeNull();
    expect(result.cancellingAt).toBeNull();
    expect(result.cancelledAt).toBeNull();
    expect(result.requestCountsTotal).toBe(100);
    expect(result.requestCountsCompleted).toBe(50);
    expect(result.requestCountsFailed).toBe(2);
    expect(result.metadata).toEqual({ key: "value" });
    expect(result.errors).toBeNull();
    expect(result.model).toBe("gpt-4");
    expect(result.usage).toBeNull();
  });

  it("defaults request_counts to 0 when missing or partially missing", () => {
    const apiResponse = {
      id: "batch_456",
      endpoint: "/v1/embeddings",
      completion_window: "24h",
      status: "completed",
      input_file_id: "file_in",
      output_file_id: "file_out",
      error_file_id: null,
      created_at: 1700000000,
      in_progress_at: null,
      expires_at: null,
      finalizing_at: null,
      completed_at: 1700001000,
      failed_at: null,
      expired_at: null,
      cancelling_at: null,
      cancelled_at: null,
      request_counts: { total: 10, completed: 10 },
      metadata: null,
      errors: null,
      model: null,
      usage: null,
    };

    const result = mapBatchApiToRecord(apiResponse);

    expect(result.requestCountsTotal).toBe(10);
    expect(result.requestCountsCompleted).toBe(10);
    expect(result.requestCountsFailed).toBe(0);
  });
});

describe("mapFileApiToRecord", () => {
  it("maps a file API response to a FileRecord", () => {
    const apiResponse = {
      id: "file_abc",
      filename: "batch.jsonl",
      bytes: 2048,
      purpose: "batch",
      created_at: 1700000000,
      expires_at: 1700086400,
    };

    const result = mapFileApiToRecord(apiResponse);

    expect(result.id).toBe("file_abc");
    expect(result.filename).toBe("batch.jsonl");
    expect(result.bytes).toBe(2048);
    expect(result.purpose).toBe("batch");
    expect(result.createdAt).toBe(1700000000);
    expect(result.expiresAt).toBe(1700086400);
  });
});
