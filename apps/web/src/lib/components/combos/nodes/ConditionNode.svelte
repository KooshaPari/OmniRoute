<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border border-amber-500 bg-amber-50 px-3 py-2">
  <Handle type="target" position={Position.Left} class="bg-amber-500" />
  <div class="text-xs font-semibold text-amber-700 uppercase">Condition</div>
  <div class="text-sm font-medium text-gray-900 mt-0.5">{data.label ?? 'If ...'}</div>
  {#if data.expression}
    <div class="text-xs font-mono text-gray-600 mt-1 break-all">{data.expression}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} class="bg-amber-500" />
  <Handle type="source" id="else" position={Position.Right} class="bg-gray-400" />
</div>
