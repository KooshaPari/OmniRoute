<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<div class="rounded-lg border border-red-500 bg-red-50 px-3 py-2">
  <Handle type="target" position={Position.Top} class="bg-red-500" />
  <div class="text-xs font-semibold text-red-700 uppercase">Reject</div>
  <div class="text-sm font-medium text-gray-900 mt-0.5">{data.label ?? 'No match'}</div>
  <div class="text-xs text-gray-500 mt-1">{(data.statusCode ?? 503).toString()}</div>
</div>
