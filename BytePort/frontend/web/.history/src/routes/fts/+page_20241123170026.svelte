<script>
	import { fly, fade } from 'svelte/transition';
</script>

<div id="background" in:fly={{ y: 200 }} out:fade class=" h-screen w-screen bg-dark-surface">
	<h1
		in:fly={{ y: 200 }}
		out:fade={{ duration: 100 }}
		class="ftsHeadText text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
	>
		Welcome.
	</h1>
	<button
		class="h-1/10 w-1/10 rounded-full bg-dark-secondaryContainer"
		on:click={() => {
			window.location.href = '/login';
		}}>Login</button
	>
</div>
<stye></stye>
