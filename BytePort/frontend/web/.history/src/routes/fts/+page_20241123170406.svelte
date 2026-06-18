<script>
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
</script>

<div
	id="background"
	in:fly={{ y: 200 }}
	out:fade
	class=" flex h-screen w-screen flex-col items-center justify-center bg-dark-surface"
>
	<h1
		in:fly={{ y: 200 }}
		out:fade={{ duration: 100 }}
		class="ftsHeadText text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
	>
		Welcome.
	</h1>
	<button
		class="flex h-10 w-10 items-center justify-center rounded-full bg-dark-secondaryContainer p-2"
		on:click={() => {
			window.location.href = '/login';
		}}
	>
		<Icon icon="maki-arrow" />
	</button>
</div>
<stye></stye>
