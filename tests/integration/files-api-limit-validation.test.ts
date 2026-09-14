import { describe, it } from "node:test";
import assert from "node:assert";
import { createFile, deleteFile } from "@/lib/db/files";
import { GET, parseFilesListQuery } from "@/app/api/v1/files/route";

describe("GET /v1/files limit validation", () => {
  it("defaults to 20 when limit is absent", () => {
    const parsed = parseFilesListQuery(new URLSearchParams("order=asc"));

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.limit, 20);
  });

  it("parses an explicit positive integer limit", () => {
    const parsed = parseFilesListQuery(new URLSearchParams("limit=2&order=asc&purpose=batch"));

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.limit, 2);
    assert.equal(parsed.order, "asc");
    assert.equal(parsed.purpose, "batch");
  });

  it("rejects non-integer, zero, and oversized limits", async () => {
    for (const rawLimit of ["abc", "1.5", "-1", "0", "10001"]) {
      const parsed = parseFilesListQuery(
        new URLSearchParams(`limit=${encodeURIComponent(rawLimit)}`)
      );
      assert.equal(parsed.ok, false, `limit=${rawLimit} should be rejected`);
      if (parsed.ok) continue;
      assert.equal(parsed.response.status, 400);
      const body = await parsed.response.json();
      assert.equal(body.error.type, "invalid_request_error");
    }
  });

  it("returns only the requested number of files over HTTP", async () => {
    const created = [
      createFile({
        bytes: 1,
        filename: "test-files-limit-http-a.txt",
        purpose: "assistants",
        content: Buffer.from("a"),
        mimeType: "text/plain",
      }),
      createFile({
        bytes: 1,
        filename: "test-files-limit-http-b.txt",
        purpose: "assistants",
        content: Buffer.from("b"),
        mimeType: "text/plain",
      }),
    ];

    try {
      const response = await GET(
        new Request("http://localhost/v1/files?limit=1&purpose=assistants")
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.object, "list");
      assert.equal(body.data.length, 1);
      assert.equal(body.has_more, true);
    } finally {
      for (const file of created) deleteFile(file.id);
    }
  });

  it("returns 400 over HTTP for an invalid limit instead of listing files", async () => {
    const response = await GET(new Request("http://localhost/v1/files?limit=-1"));

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.type, "invalid_request_error");
  });
});
