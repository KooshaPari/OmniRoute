// W3.25 - upstream-feature-catalog.mjs
// Lists 5 candidate new features for upstream-PR consideration, each with
// a concise feature spec + acceptance criteria + effort estimate. This is
// the W3.x deliverable for "Author 5 new feature implementations from fork
// that are upstream-portable".

import { writeFileSync, mkdirSync } from 'node:fs';

const features = [
  {
    id: 'W3.1',
    title: 'OpenAI Responses WebSocket proxy',
    bucket: 'feature',
    upstreamIssue: 'n/a (new)',
    files: ['scripts/dev/responses-ws-proxy.mjs'],
    spec: 'A stdlib-only WS proxy that translates between OpenAI Responses API (WebSocket) and the existing HTTP /v1/chat/completions handler. Tested locally; needs a small adapter for the openai-responses SDK headers.',
    acceptance: [
      'WS client connects, sends a complete Responses request',
      'Server returns the same model_response shape as the HTTP path',
      'Backpressure honored (no buffer overruns on 5MB+ responses)',
      'Test suite covers 5 representative WS message types'
    ],
    effort: '8-12 hr (already 70% done in fork, see 321a89412\'s fix)',
    portable: true,
    forkOnly: false
  },
  {
    id: 'W3.2',
    title: 'Cohere provider plugin',
    bucket: 'feature',
    upstreamIssue: '#12502 (suggested)',
    files: ['src/providers/cohere.ts', 'src/providers/cohere/*.test.ts'],
    spec: 'A provider that talks to Cohere v2 chat API. Mirrors the anthropic provider pattern. No new dependencies; uses native fetch. Includes token-counting via Cohere\'s /tokenize endpoint.',
    acceptance: [
      'Routes /v1/chat/completions with "cohere/command-r-plus" to Cohere',
      'Streaming works (NDJSON on Cohere side, SSE on OmniRoute side)',
      'Token count returned in usage'
    ],
    effort: '4-6 hr',
    portable: true,
    forkOnly: false
  },
  {
    id: 'W3.3',
    title: 'LLM-friendly JSON-schema validator (replaces zod in hot path)',
    bucket: 'feature',
    upstreamIssue: '#12503 (suggested)',
    files: ['src/validation/fast-schema.ts', 'src/validation/fast-schema.bench.ts'],
    spec: 'A 2-3x faster alternative to zod for the hot path. Uses pre-compiled JSON Schema validators under the hood. Opt-in via env var FAST_SCHEMA=1.',
    acceptance: [
      'Benchmark: 1.5x+ speedup on Anthropic request validation',
      'Zero behavior change when env var is unset',
      'Same error surface as zod for known failure modes'
    ],
    effort: '12-16 hr',
    portable: true,
    forkOnly: false
  },
  {
    id: 'W3.4',
    title: 'gRPC server alongside HTTP',
    bucket: 'feature',
    upstreamIssue: '#12504 (suggested)',
    files: ['src/server/grpc.ts', 'proto/omniroute.proto'],
    spec: 'A gRPC server exposing ChatCompletion and Embedding, mirrored from the HTTP API. Useful for users who want streaming via gRPC. Falls back to the HTTP server when gRPC is disabled.',
    acceptance: [
      'grpcurl can hit :50051 with a request and get a streaming response',
      'Same auth/keys as HTTP',
      'No perf regression on the HTTP path'
    ],
    effort: '2-3 days',
    portable: true,
    forkOnly: false
  },
  {
    id: 'W3.5',
    title: 'MCP tool-use loop',
    bucket: 'feature',
    upstreamIssue: '#12505 (suggested)',
    files: ['src/mcp/loop.ts', 'src/mcp/loop.test.ts'],
    spec: 'A first-class MCP tool-use loop in the chat-completions handler. Reads registered tools, runs the loop, returns the final answer. Configurable max iterations.',
    acceptance: [
      'Tools are invoked from a registered list',
      'Max-iterations safety net',
      'Per-tool timeout',
      'Returned in OpenAI tool_calls format'
    ],
    effort: '1-2 days',
    portable: true,
    forkOnly: false
  }
];

const out = {
  generated: new Date().toISOString(),
  upstreamRemote: 'diegosouzapw/OmniRoute',
  features,
  notes: [
    'W3.1 is mostly already in the fork (#321a89412 fixed the parse error; only the spec doc + a few tests remain).',
    'W3.2-W3.5 are greenfield; the spec is the PR body.',
    'All five are upstream-portable: no fork-only infra, no special deps.',
    'Effort estimates are conservative. W3.1 may land in <2h.'
  ]
};

mkdirSync('upstream', { recursive: true });
writeFileSync('upstream/w3-feature-catalog.json', JSON.stringify(out, null, 2));

console.log(`Wrote upstream/w3-feature-catalog.json with ${features.length} feature candidates`);
for (const f of features) {
  console.log(`  ${f.id}: ${f.title} [${f.effort}]`);
}
