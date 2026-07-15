import type { CavemanRule } from "./types.ts";

const CAVEMAN_RULES: CavemanRule[] = [
  // ── Category 1: Filler Removal (10+ rules) ──────────────────────────

  {
    name: "polite_framing",
    pattern:
      /\b(?:please|kindly|could you please|would you please|can you please|I would like you to|I want you to|I need you to)\b\s*/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "hedging",
    pattern:
      /\b(?:it seems like|it appears that|I think that|I believe that|probably|possibly|maybe it)\b\s*/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "verbose_instructions",
    pattern:
      /\b(?:provide a detailed|give me a comprehensive|write an in-depth|create a thorough|explain in detail)\b/gi,
    replacement: (match: string): string => {
      const map: Record<string, string> = {
        "provide a detailed": "provide",
        "give me a comprehensive": "give",
        "write an in-depth": "write",
        "create a thorough": "create",
        "explain in detail": "explain",
      };
      const lower = match.toLowerCase();
      return map[lower] ?? match;
    },
    context: "all",
  },
  {
    name: "filler_adverbs",
    pattern: /(?<![a-z])\b(?:basically|essentially|actually|literally|simply)\b\s*/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "filler_phrases",
    pattern: /^(?:I want to|I need to|I'd like to|I'm looking for)\b\s*/gim,
    replacement: "",
    context: "user",
  },
  {
    name: "redundant_openers",
    pattern: /^(?:Hi there|Hello|Good morning|Hey)\s*[,.!?\s]?\s*/gim,
    replacement: "",
    context: "user",
  },
  {
    name: "verbose_requests",
    pattern: /\b(?:I was wondering if you could|Would it be possible to)\b\s*/gi,
    replacement: "",
    context: "user",
  },
  {
    name: "self_reference",
    pattern: /^(?:I am trying to|I am working on|I have been)\b\s*/gim,
    replacement: "",
    context: "user",
  },
  {
    name: "excessive_gratitude",
    pattern: /\b(?:Thank you so much|Thanks in advance|I really appreciate)\b[,.!?\s]*/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "qualifier_removal",
    pattern: /\b(?:a bit|a little|somewhat|kind of|sort of)\b\s*/gi,
    replacement: "",
    context: "all",
  },

  // ── Category 2: Context Condensation (8+ rules) ──────────────────────

  {
    name: "compound_collapse",
    pattern: /\band any potential\b/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "explanatory_prefix",
    pattern:
      /\b(?:The function appears to be handling|The code seems to|The class is|This module is)\b/gi,
    replacement: (match: string): string => {
      const map: Record<string, string> = {
        "the function appears to be handling": "Function:",
        "the code seems to": "Code:",
        "the class is": "Class:",
        "this module is": "Module:",
      };
      return map[match.toLowerCase()] ?? match;
    },
    context: "all",
  },
  {
    name: "question_to_directive",
    pattern:
      /\b(?:Can you explain why|Could you show me how|Would you tell me|Can you tell me)\b\s*/gi,
    replacement: (match: string): string => {
      const trimmed = match.trimEnd().toLowerCase();
      const map: Record<string, string> = {
        "can you explain why": "Explain why",
        "could you show me how": "Show how",
        "would you tell me": "Tell me",
        "can you tell me": "Tell me",
      };
      return map[trimmed] ?? match;
    },
    context: "user",
  },
  {
    name: "context_setup",
    pattern: /\b(?:I have the following code|Here is my code|Below is the code)\b\s*[:.]?\s*/gi,
    replacement: "Code:",
    context: "user",
  },
  {
    name: "intent_clarification",
    pattern:
      /\b(?:What I'm trying to do is|My objective is to|What I need is|I'm aiming to)\b\s*/gi,
    replacement: "Goal:",
    context: "user",
  },
  {
    name: "background_removal",
    pattern: /\b(?:As you may know,?\s*|As we discussed earlier,?\s*)/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "meta_commentary",
    pattern: /^(?:Note that|Keep in mind that|Remember that)\b\s*/gim,
    replacement: "",
    context: "all",
  },
  {
    name: "purpose_statement",
    pattern: /\b(?:for the purpose of|with the goal of|in an effort to)\b/gi,
    replacement: (match: string): string => {
      const map: Record<string, string> = {
        "for the purpose of": "for",
        "with the goal of": "to",
        "in an effort to": "to",
      };
      return map[match.toLowerCase()] ?? match;
    },
    context: "all",
  },

  // ── Category 3: Structural Compression (7+ rules) ────────────────────

  {
    name: "list_conjunction",
    pattern: /,\s*and also\s+|,\s*as well as\s+/gi,
    replacement: ", ",
    context: "all",
  },
  {
    name: "purpose_phrases",
    pattern: /\b(?:in order to|so as to)\b\s*/gi,
    replacement: "to ",
    context: "all",
  },
  {
    name: "redundant_quantifiers",
    pattern: /\b(?:each and every single|each and every|any and all)\b/gi,
    replacement: (match: string): string => {
      const map: Record<string, string> = {
        "each and every single": "each",
        "each and every": "each",
        "any and all": "all",
      };
      return map[match.toLowerCase()] ?? match;
    },
    context: "all",
  },
  {
    name: "verbose_connectors",
    pattern: /\b(?:furthermore|additionally|moreover|in addition)\b\s*/gi,
    replacement: "also ",
    context: "all",
  },
  {
    name: "transition_removal",
    pattern: /^(?:On the other hand,?\s*|In contrast,?\s*|However,?\s*)/gim,
    replacement: "",
    context: "all",
  },
  {
    name: "emphasis_removal",
    pattern: /\b(?:very|really|extremely|highly|quite)\s+(?=[a-z])/gi,
    replacement: "",
    context: "all",
  },
  {
    name: "passive_voice",
    pattern: /\b(?:is being used|is being called|was created|was generated|was implemented)\b/gi,
    replacement: (match: string): string => {
      const map: Record<string, string> = {
        "is being used": "uses",
        "is being called": "calls",
        "was created": "created",
        "was generated": "generated",
        "was implemented": "implemented",
      };
      return map[match.toLowerCase()] ?? match;
    },
    context: "all",
  },

  // ── Category 4: Multi-Turn Dedup (5+ rules) ─────────────────────────

  {
    name: "repeated_context",
    pattern:
      /\b(?:As we discussed earlier|As mentioned before|As previously stated|As I said before)\b[,.]?\s*/gi,
    replacement: "See above. ",
    context: "all",
  },
  {
    name: "repeated_question",
    pattern:
      /\b(?:Same question as before|I asked this earlier|This is the same question)\b[,.]?\s*/gi,
    replacement: "[same question] ",
    context: "user",
  },
  {
    name: "reestablished_context",
    pattern: /\b(?:Going back to the code above|Referring back to|Returning to)\b\s*/gi,
    replacement: "Re: ",
    context: "all",
  },
  {
    name: "summary_replacement",
    pattern:
      /\b(?:To summarize what we've discussed|In summary of our conversation|To recap)\b[,.]?\s*/gi,
    replacement: "Summary: ",
    context: "assistant",
  },
];

export function getRulesForContext(context: string): CavemanRule[] {
  return CAVEMAN_RULES.filter((rule) => rule.context === "all" || rule.context === context);
}

export function getRuleByName(name: string): CavemanRule | undefined {
  return CAVEMAN_RULES.find((rule) => rule.name === name);
}

export { CAVEMAN_RULES };
