/**
 * /api/chat/completions — non-streaming + streaming via SSE.
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ChatRequestEnvelope, ChatResponse, ChatChunk } from '@omniroute/shared-types';

export const chatRoute = new Hono()
  .post('/completions', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    const body = ChatRequestEnvelope.parse(await c.req.json());

    if (body.request.stream) {
      return streamSSE(c, async (stream) => {
        for await (const chunk of dispatchStream(body)) {
          await stream.writeSSE({ event: 'chunk', data: JSON.stringify(ChatChunk.parse(chunk)) });
        }
      });
    }

    const res = await dispatchOnce(body);
    return c.json({ ok: true, data: ChatResponse.parse(res) });
  });

// Stub: in v1 these hit kbridge → omniroute-server pipeline.
async function* dispatchStream(_env: typeof ChatRequestEnvelope._type): AsyncGenerator<unknown> {
  yield { id: 'chatcmpl-stub', object: 'chat.completion.chunk', created: Date.now(), model: 'stub', choices: [{ index: 0, delta: { content: 'hello' }, finishReason: null }] };
  yield { id: 'chatcmpl-stub', object: 'chat.completion.chunk', created: Date.now(), model: 'stub', choices: [{ index: 0, delta: { content: ' world' }, finishReason: 'stop' }] };
}
async function dispatchOnce(_env: typeof ChatRequestEnvelope._type): Promise<unknown> {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion',
    created: Date.now(),
    model: 'stub',
    choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finishReason: 'stop' }],
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, cachedTokens: 0 },
  };
}
