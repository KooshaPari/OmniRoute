import { describe, expect, it, vi } from 'vitest';
import { consumeSse } from '../src/sse.ts';

describe('consumeSse', () => {
  it('parses chunked SSE', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: chunk\ndata: {"id":"x","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"hi"},"finishReason":null}]}\n\n'));
        controller.close();
      },
    });
    const chunks: string[] = [];
    await consumeSse(new Response(body), {
      onChunk: (c) => chunks.push(c.choices[0]?.delta?.content ?? ''),
    });
    expect(chunks).toEqual(['hi']);
  });

  it('invokes onError on malformed JSON', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: chunk\ndata: {not-json}\n\n'));
        controller.close();
      },
    });
    const onError = vi.fn();
    await consumeSse(new Response(body), { onChunk: () => {}, onError });
    expect(onError).toHaveBeenCalled();
  });
});
