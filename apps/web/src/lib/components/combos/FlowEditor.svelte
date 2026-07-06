<script lang="ts">
  import { SvelteFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  type ComboNodeData = {
    label: string;
    model: string;
    condition?: 'on-error' | 'on-rate-limit' | 'on-cost';
  };

  type ComboNode = Node<ComboNodeData>;

  let {
    primaryModel,
    fallbackModels = [],
    onchange,
  }: {
    primaryModel: string;
    fallbackModels: string[];
    onchange?: (nodes: ComboNode[], edges: Edge[]) => void;
  } = $props();

  // Layout: primary at top, fallbacks branching below
  let initialNodes = $derived<ComboNode[]>([
    {
      id: 'primary',
      type: 'input',
      data: { label: 'Primary', model: primaryModel || '(unset)' },
      position: { x: 200, y: 0 },
    },
    ...fallbackModels.map((m, i) => ({
      id: `fallback-${i}`,
      type: 'default' as const,
      data: { label: `Fallback ${i + 1}`, model: m, condition: 'on-error' as const },
      position: { x: 80 + (i % 3) * 240, y: 160 + Math.floor(i / 3) * 140 },
    })),
    {
      id: 'output',
      type: 'output',
      data: { label: 'Response', model: '—' },
      position: { x: 280, y: 360 },
    },
  ]);

  let initialEdges = $derived<Edge[]>(() => {
    const edges: Edge[] = [
      { id: 'e-primary', source: 'primary', target: 'output', label: 'success' },
    ];
    fallbackModels.forEach((_, i) => {
      edges.push({
        id: `e-${i}`,
        source: 'primary',
        target: `fallback-${i}`,
        label: 'on-error',
        style: 'stroke-dasharray: 4 2',
      });
      edges.push({
        id: `e-${i}-to-out`,
        source: `fallback-${i}`,
        target: 'output',
      });
    });
    return edges;
  }());

  let nodes = $state(initialNodes);
  let edges = $state(initialEdges);
  $effect(() => { onchange?.(nodes, edges); });

  const nodeTypes = {};
</script>

<div class="border border-gray-200 rounded-lg h-[500px] bg-gray-50">
  <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView class="bg-gray-50">
    <Background />
    <Controls />
    <MiniMap />
  </SvelteFlow>
</div>
<p class="text-xs text-gray-500 mt-2">
  Drag nodes to rearrange. Edit edges by clicking. Visual representation of the same ComboNode[] / Edge[] arrays stored in the combos editor form above.
</p>
