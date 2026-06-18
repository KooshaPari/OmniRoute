<script>
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	let addtl = false;
	let visible = false;

	onMount(() => {
		visible = true;
	});
</script>

<div
	id="background"
	class=" flex h-screen w-screen flex-col items-center justify-center bg-dark-surface"
>
	{#if visible}
		<h1
			in:fly={{ y: -200, duration: 1000 }}
			out:fade
			id="ftsHeadTxt"
			class="ftsHeadText my-2 w-screen text-center text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
		>
			Welcome.
		</h1>
		<h2
			in:fly={{ y: -200, duration: 1000 }}
			out:fade
			id="ftsHeadTxt"
			class="ftsHeadText text-1xl mb-4 w-screen text-center text-dark-primary transition-all hover:text-dark-onSurface"
		>
			Welcome.
		</h2>
		{#if addtl}
			<div id="ftsCont"></div>
		{/if}
	{/if}
	<button
		class="my-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-secondaryContainer p-2 text-dark-onSecondaryContainer transition-all hover:scale-105 hover:bg-dark-tertiaryContainer active:scale-100 active:bg-dark-primaryContainer"
		on:click={() => {
			window.location.href = '/login';
		}}
	>
		<Icon icon="maki-arrow" />
	</button>
</div>
<stye></stye>
