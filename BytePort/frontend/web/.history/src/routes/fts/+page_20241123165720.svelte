<script>
	import { fly, fade } from 'svelte/transition';
</script>

<div
	id="background"
	in:fly={{ y: 200 }}
	out:fade
	class=" flex h-screen w-screen items-center justify-center bg-dark-surface"
>
	<h1
		in:fly={{ y: 200 }}
		out:fade
		class="ftsHeadText text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
	>
		Welcome.
	</h1>
</div>
<stye></stye>
