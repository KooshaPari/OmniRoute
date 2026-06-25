import { describe, it, expect } from "vitest";
import {
  getSkillsProviderForFormat,
  getSkillsModelIdForFormat,
} from "../formatSkillsHelpers";
import { FORMATS } from "../../../translator/formats";

describe("getSkillsProviderForFormat", () => {
  it("maps CLAUDE to anthropic", () => {
    expect(getSkillsProviderForFormat(FORMATS.CLAUDE)).toBe("anthropic");
  });

  it("maps GEMINI to google", () => {
    expect(getSkillsProviderForFormat(FORMATS.GEMINI)).toBe("google");
  });

  it("maps OPENAI to openai (default)", () => {
    expect(getSkillsProviderForFormat(FORMATS.OPENAI)).toBe("openai");
  });

  it("maps unknown formats to openai", () => {
    expect(getSkillsProviderForFormat("unknown-format")).toBe("openai");
    expect(getSkillsProviderForFormat("")).toBe("openai");
  });

  it("is case-sensitive", () => {
    expect(getSkillsProviderForFormat("CLAUDE")).toBe("openai");
    expect(getSkillsProviderForFormat("Claude")).toBe("openai");
  });

  it("never throws on any input", () => {
    expect(() => getSkillsProviderForFormat("")).not.toThrow();
    expect(() => getSkillsProviderForFormat("x")).not.toThrow();
  });
});

describe("getSkillsModelIdForFormat", () => {
  it("maps CLAUDE to claude", () => {
    expect(getSkillsModelIdForFormat(FORMATS.CLAUDE)).toBe("claude");
  });

  it("maps GEMINI to gemini", () => {
    expect(getSkillsModelIdForFormat(FORMATS.GEMINI)).toBe("gemini");
  });

  it("maps OPENAI to openai (default)", () => {
    expect(getSkillsModelIdForFormat(FORMATS.OPENAI)).toBe("openai");
  });

  it("maps unknown formats to openai", () => {
    expect(getSkillsModelIdForFormat("unknown-format")).toBe("openai");
    expect(getSkillsModelIdForFormat("")).toBe("openai");
  });

  it("is case-sensitive", () => {
    expect(getSkillsModelIdForFormat("GEMINI")).toBe("openai");
    expect(getSkillsModelIdForFormat("Gemini")).toBe("openai");
  });

  it("returns consistent values with provider function", () => {
    // The two helpers must stay in sync: claude/anthropic, gemini/google, *->openai
    expect(getSkillsModelIdForFormat(FORMATS.CLAUDE)).toBe("claude");
    expect(getSkillsProviderForFormat(FORMATS.CLAUDE)).toBe("anthropic");
    expect(getSkillsModelIdForFormat(FORMATS.GEMINI)).toBe("gemini");
    expect(getSkillsProviderForFormat(FORMATS.GEMINI)).toBe("google");
  });
});
