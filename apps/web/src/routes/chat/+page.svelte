<script lang="ts">
  import type { ChatMessage, ChatChunk, ChatResponse } from '@omniroute/shared-types';

  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let current = $state('');

  async function send() {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    messages = [...messages, userMsg];
    const userInput = input;
    input = '';
    streaming = true;
    current = '';

    try {
      const r = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          request: { model: 'fast', messages: [...messages], stream: true },
        }),
      });
      if (!r.ok || !r.body) {
        streaming = false;
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        for (const line of buf.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const ev = JSON.parse(payload) as { event?: string; data?: string };
            if (ev.event === 'chunk' && ev.data) {
              const chunk = JSON.parse(ev.data) as ChatChunk;
              const delta = chunk.choices[0]?.delta?.content ?? '';
              current += delta;
            }
          } catch { /* ignore parse errors mid-stream */ }
        }
        buf = '';
      }
      messages = [...messages, { role: 'assistant', content: current } satisfies ChatMessage];
      current = '';
    } finally {
      streaming = false;
    }
  }
</script>

<svelte:head><title>Chat · argismonitor</title></svelte:head>

<section class="flex h-full flex-col p-6">
  <h1 class="mb-4 text-2xl font-bold">Chat</h1>
  <div class="flex-1 space-y-3 overflow-auto rounded bg-base-200 p-4">
    {#each messages as m, i (i)}
      <article class="chat" class:chat-end={m.role === 'user'}>
        <div class="chat-header text-xs">{m.role}</div>
        <div class="chat-bubble">{m.content}</div>
      </article>
    {/each}
    {#if current}
      <article class="chat chat-start">
        <div class="chat-header text-xs">assistant</div>
        <div class="chat-bubble">{current}</div>
      </article>
    {/if}
  </div>
  <form class="mt-4 flex gap-2" onsubmit={(e) => { e.preventDefault(); send(); }}>
    <input class="input input-bordered flex-1" placeholder="Send a message…" bind:value={input} disabled={streaming} />
    <button class="btn btn-primary" type="submit" disabled={streaming || !input.trim()}>
      {streaming ? '…' : 'Send'}
    </button>
  </form>
</section>
