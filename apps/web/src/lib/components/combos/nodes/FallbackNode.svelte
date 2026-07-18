<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border border-orange-500 bg-orange-50 px-3 py-2">
  <Handle type="target" position={Position.Top} class="bg-orange-500" />
  <div class="text-xs font-semibold text-orange-700 uppercase">Fallback</div>
  <div class="text-sm font-mono text-gray-900 mt-0.5 break-all">{data.model ?? '(select)'}</div>
  {#if data.condition}
    <div class="text-xs text-gray-500 mt-1">on: {data.condition}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} class="bg-orange-500" />
</div>
