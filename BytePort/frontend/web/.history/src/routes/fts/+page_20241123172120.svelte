<script>
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	let addtl = false;
	let visible = false;

	onMount(() => {
		visible = true;
	});
	function firstTimeSetup() {
		let stage = 0;
		addtl = true;
		visible = false;
		document.getElementById('ftsHeadTxt').textContent =
			"Let's Start With Some Basic Information...";
		document.getElementById('startBtn').remove();

		visible = true;
	}
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
			class="ftsHeadText my-2 w-screen text-center text-6xl text-dark-primary transition-all  hover:text-dark-onSurface"
		>
			Welcome.
		</h1>
		<h2
			in:fly={{ y: -50, duration: 2000 }}
			out:fade
			id="ftsHeadTxt"
			class="ftsHeadText text-md mb-4 w-screen text-center text-dark-tertiary transition-all hover:text-dark-onSurface"
		>
			Let's begin first time setup.
		</h2>
		{#if addtl}
			<div in:fly={{ y: 50, duration: 2000 }} out:fade id="ftsCont">
				<button
					id="actionBtn"
					class="my-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-secondaryContainer p-2 text-dark-onSecondaryContainer transition-all hover:scale-105 hover:bg-dark-tertiaryContainer active:scale-100 active:bg-dark-primaryContainer"
					on:click={() => {}}
				>
					<Icon icon="maki-arrow" />
				</button>
			</div>
		{/if}
	{/if}
	<button
		id="startBtn"
		class="my-4 flex h-10 w-20 items-center justify-center rounded-full bg-dark-secondaryContainer p-2 text-dark-onSecondaryContainer transition-all hover:scale-105 hover:bg-dark-tertiaryContainer active:scale-100 active:bg-dark-primaryContainer"
		on:click={() => firstTimeSetup()}>Start</button
	>
</div>
<stye></stye>
