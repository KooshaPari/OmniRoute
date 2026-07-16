<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border border-purple-500 bg-purple-50 px-3 py-2 inline-block">
  <Handle type="target" position={Position.Top} class="bg-purple-500" />
  <div class="text-xs font-semibold text-purple-700 uppercase">Quota Bucket</div>
  <div class="text-sm font-medium text-gray-900 mt-0.5">{data.label ?? 'Bucket'}</div>
  <div class="text-xs text-gray-600 mt-1">
    {data.used ?? 0} / {data.cap ?? '\u221e'} {data.unit ?? 'req/min'}
  </div>
  {#if data.overflow}
    <div class="text-xs text-red-600 mt-1">on overflow: {data.overflow}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} class="bg-purple-500" />
</div>
