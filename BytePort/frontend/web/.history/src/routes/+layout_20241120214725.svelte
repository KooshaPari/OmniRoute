<script lang="ts">
	import '../app.css';
	import '../assets/css/dark.css';
	import Icon from '@iconify/svelte';
	let { children } = $props();
</script>

{@render children()}
