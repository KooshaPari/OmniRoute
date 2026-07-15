#!/usr/bin/env node
/**
 * guardrails-pii.bench.ts — TS regex vs UDS Rust aho-corasick (ADR-032)
 *
 * Benchmarks the PII-masker hot path (`sanitizeStringValue` in
 * `src/lib/guardrails/piiMasker.ts`). The TS baseline uses regex-based
 * detection via `processPII()`. The T2/T3 target would use Rust
 * `aho-corasick` for Aho-Corasick multi-pattern matching.
 *
 * Since the Rust crate for aho-corasick isn't exposed as a benchmarkable
 * T3 crate yet, this benchmarks the TS baseline and records the results
 * for comparison when the Rust crate lands.
 *
 * Usage:
 *   node --import tsx/esm benches/polyglot/guardrails-pii.bench.ts
 */

import { bench } from "./shared.ts";
import { processPII } from "../../src/shared/utils/inputSanitizer.ts";

// ── Fabricated PII-laden text ──────────────────────────────────────
// Emails, phone numbers, IPs, credit-card-like patterns, SSN-like patterns.
const PII_TEXTS: string[] = [
  "Contact john.doe@example.com or jane@company.org for support.",
  "IP 192.168.1.1 connected from 10.0.0.5 at 2024-01-15T10:30:00Z.",
  "Card 4111-1111-1111-1111 expires 12/25. CVV 123.",
  "SSN 987-65-4320 belongs to employee 12345.",
  "Call +1 (555) 123-4567 or email support@phenotype.cloud.",
  "My name is Alice and my email is alice@wonderland.io. Call me at 555-0100.",
  "No sensitive data here. Just plain text for baseline.",
  "Mixed: alice@test.com, 192.168.1.1, 4111111111111111, SSN 123-45-6789",
  "Very long text with an email at the end: user+tag@domain.co.uk. " +
    "x".repeat(500),
  "Short: hi@x.co",
];

const ITERATIONS = 3000;
let tIdx = 0;

const result = await bench({
  name: "guardrails-pii-ts-processPII",
  tier: "T2",
  edge: "guardrails.pii.anonymize",
  description:
    "processPII() inputSanitizer with mixed PII/non-PII texts",
  iterations: ITERATIONS,
  run: () => {
    const text = PII_TEXTS[tIdx++ % PII_TEXTS.length];
    const r = processPII(text, true);
    return r.detections.length;
  },
});

console.log(JSON.stringify(result, null, 2));
