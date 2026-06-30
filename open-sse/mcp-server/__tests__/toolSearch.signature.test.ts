import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToTsSignature } from "../toolSearch/signature.ts";

describe("zodToTsSignature", () => {
  it("primitives + optional", () => {
    const s = z.object({ query: z.string(), limit: z.number().optional() });
    const out = zodToTsSignature("omniroute_tool_search", s);
    expect(out).toContain("omniroute_tool_search(args: {");
    expect(out).toContain("query: string");
    expect(out).toContain("limit?: number");
  });
  it("defaulted fields are optional at call sites", () => {
    const s = z.object({ query: z.string(), limit: z.number().default(8) });
    const out = zodToTsSignature("omniroute_tool_search", s);
    expect(out).toContain("query: string");
    expect(out).toContain("limit?: number");
  });
  it("keeps required vs optional shape in nested objects", () => {
    const s = z.object({
      query: z.string(),
      filters: z.object({
        requiredMode: z.string(),
        limit: z.number().default(8),
        include: z.boolean().optional(),
      }),
    });
    const out = zodToTsSignature("omniroute_tool_search", s);
    expect(out).toContain("query: string");
    expect(out).toContain("filters: { requiredMode: string; limit?: number; include?: boolean }");
  });
  it("enum + array + boolean", () => {
    const s = z.object({ mode: z.enum(["a", "b"]), tags: z.array(z.string()), on: z.boolean() });
    const out = zodToTsSignature("t", s);
    expect(out).toContain("mode: 'a' | 'b'");
    expect(out).toContain("tags: string[]");
    expect(out).toContain("on: boolean");
  });
  it("no schema ⇒ no args", () => {
    expect(zodToTsSignature("ping")).toBe("ping()");
  });
  it("never throws on weird input", () => {
    expect(() => zodToTsSignature("x", {} as never)).not.toThrow();
  });
});
