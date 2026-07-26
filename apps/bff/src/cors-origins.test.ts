import { describe, expect, it } from "vitest";

import { parseCorsOrigins } from "./cors-origins";

describe("parseCorsOrigins", () => {
  it("parses a bounded http(s) allowlist and drops credentials / junk", () => {
    expect(
      parseCorsOrigins(
        "http://localhost:4321, https://app.example.com, ftp://bad, http://user:pass@evil, not-a-url",
      ),
    ).toEqual(["http://localhost:4321", "https://app.example.com"]);
  });

  it("dedupes origins", () => {
    expect(parseCorsOrigins("http://localhost:4321,http://localhost:4321/")).toEqual([
      "http://localhost:4321",
    ]);
  });
});
