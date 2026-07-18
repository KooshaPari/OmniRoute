<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border-2 border-indigo-500 bg-indigo-50 px-3 py-2">
  <Handle type="target" position={Position.Top} class="bg-indigo-500" />
  <div class="text-xs font-semibold text-indigo-700 uppercase">Router</div>
  <div class="text-sm font-medium text-gray-900 mt-0.5">{data.label ?? 'Entry'}</div>
  <div class="text-xs text-gray-500 mt-1">All traffic starts here</div>
  <Handle type="source" position={Position.Bottom} class="bg-indigo-500" />
</div>
