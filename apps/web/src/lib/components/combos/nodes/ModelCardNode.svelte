<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border border-emerald-500 bg-white shadow-sm px-3 py-2">
  <Handle type="target" position={Position.Top} class="bg-emerald-500" />
  <div class="text-xs font-semibold text-emerald-700 uppercase">Model</div>
  <div class="text-sm font-mono font-medium text-gray-900 mt-0.5 break-all">{data.model ?? '(select model)'}</div>
  {#if data.latency !== undefined}
    <div class="text-xs text-gray-500 mt-1">p50 {data.latency}ms</div>
  {/if}
  <Handle type="source" position={Position.Bottom} class="bg-emerald-500" />
</div>
