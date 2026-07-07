/**
 * SSE consumer for chat completions. Yields ChatChunk events; honors
 * backpressure by awaiting each write.
 */
import type { ChatChunk } from '@omniroute/shared-types';
import { ZodError } from 'zod';
import { ChatChunk as ChatChunkSchema } from '@omniroute/shared-types';

export interface SseHandlers {
  onChunk: (chunk: ChatChunk) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export async function consumeSse(response: Response, handlers: SseHandlers): Promise<void> {
  if (!response.body) {
    handlers.onError?.(new Error('no response body'));
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const event = JSON.parse(payload) as { event?: string; data?: string };
          if (event.event === 'chunk' && event.data) {
            const chunk = ChatChunkSchema.parse(JSON.parse(event.data));
            handlers.onChunk(chunk);
          }
        } catch (e) {
          if (e instanceof ZodError) handlers.onError?.(new Error(`sse parse: ${e.message}`));
          else handlers.onError?.(e as Error);
        }
      }
    }
    handlers.onDone?.();
  } catch (e) {
    handlers.onError?.(e as Error);
  }
}
