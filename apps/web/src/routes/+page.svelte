<script lang="ts">
  import { goto } from '$app/navigation';
  $effect(() => { goto('/dashboard'); });
</script>
<p class="p-8 text-base-content/60">Loading dashboard...</p>
