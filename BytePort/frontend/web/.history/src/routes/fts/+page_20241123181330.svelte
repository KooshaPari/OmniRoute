<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	let startBtn;
	let addtl = false;
	let visible = false;
	let ftsCont: HTMLElement;
	let ftsheadTxt: String;
	let stage = 0;
	let ftsHeadDescr: String;

	onMount(() => {
		ftsHeadDescr = "Let's Begin First Time Setup";
		ftsheadTxt = 'Welcome.';
		visible = true;
		ftsCont = document.querySelector('#ftsCont');
		const actionBtn = document.querySelector('#actionBtn');
		startBtn = document.querySelector('#startBtn');
	});

	function firstTimeSetup() {
		let stage = 0;
		setStage();

		addtl = true;
		startBtn.remove();
		// 0 eq AWS Credentials 1 eq OpenAI Credentials 2 eq connect to your portfolio (api endpoints/auth) Output the addtl container contents for each too
	}
	function setStage() {
		switch (stage) {
			case 0:
				console.log('STAGE 0');
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Enter Your AWS Credentials Below';
				const testCont = `
                <div class="flex flex-col items-center justify-center">
                <div class="flex flex-row items-center justify-center">
                    <div class="flex flex-col items-center justify-center">
                        <h1>AWS Credentials</h1>
                        <div class="flex flex-row items-center justify-center">`;
				updateAddtlContent(testCont);
				stage++;
				break;
			case 1:
				console.log('STAGE 1');
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Enter Your OpenAI Credentials Below';
				stage++;
				break;
			case 2:
				console.log('STAGE 2');
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Connect to Your Portfolio';
				stage++;
				break;
			default:
				ftsheadTxt = 'Setup Complete!';
				ftsHeadDescr = 'You have completed the first-time setup.';
				addtl = false; // Hide the additional container
				break;
		}
	}
	function updateAddtlContent(content: string) {
		if (ftsCont) {
			ftsCont.innerHTML = content;
		}
	}
</script>

<div
	id="background"
	class=" flex h-screen w-screen flex-col items-center justify-center bg-dark-surface"
>
	{#if visible}
		{#key ftsheadTxt}
			<h1
				in:fly={{ y: -100, duration: 1000 }}
				out:fade
				id="ftsHeadTxt"
				class="ftsHeadText my-2 w-screen text-center text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
			>
				{ftsheadTxt}
			</h1>
		{/key}
		{#key ftsHeadDescr}
			<h2
				in:fly={{ y: -50, duration: 2000 }}
				out:fade
				id="ftsHeadDescr"
				class="ftsHeadText text-md mb-4 w-screen text-center text-dark-tertiary transition-all hover:text-dark-onSurface"
			>
				{ftsHeadDescr}
			</h2>
		{/key}
		{#if addtl}
			<div in:fly={{ y: 50, duration: 2000 }} out:fade id="ftsOuterCont">
				<!-- Render stage-specific content -->
				{#if stage === 0}
					<div class="flex flex-col items-center justify-center">
						<h3>AWS Credentials</h3>
						<input type="text" placeholder="AWS Access Key ID" class="mb-2 rounded border p-2" />
						<input
							type="password"
							placeholder="AWS Secret Access Key"
							class="mb-2 rounded border p-2"
						/>
					</div>
				{:else if stage === 1}
					<div class="flex flex-col items-center justify-center">
						<h3>OpenAI Credentials</h3>
						<input type="text" placeholder="OpenAI API Key" class="mb-2 rounded border p-2" />
					</div>
				{:else if stage === 2}
					<div class="flex flex-col items-center justify-center">
						<h3>Connect to Your Portfolio</h3>
						<input
							type="text"
							placeholder="Portfolio Root Endpoint URL"
							class="mb-2 rounded border p-2"
						/>
						<input type="text" placeholder="API Key / Credential" class="mb-2 rounded border p-2" />
						<input type="text" placeholder="" class="mb-2 rounded border p-2" />
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center">
						<h3>Setup Complete!</h3>
						<p>You have completed the first-time setup.</p>
					</div>
				{/if}

				<!-- Action button to proceed -->
				{#if stage < 3}
					<button
						id="actionBtn"
						on:click={setStage}
						class="my-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-secondaryContainer p-2 text-dark-onSecondaryContainer transition-all hover:scale-105 hover:bg-dark-tertiaryContainer active:scale-100 active:bg-dark-primaryContainer"
					>
						<Icon icon="maki-arrow" />
					</button>
				{/if}
			</div>
		{/if}
	{/if}
	<button
		id="startBtn"
		class="my-4 flex h-10 w-20 items-center justify-center rounded-full bg-dark-secondaryContainer p-2 text-dark-onSecondaryContainer transition-all hover:scale-105 hover:bg-dark-tertiaryContainer active:scale-100 active:bg-dark-primaryContainer"
		on:click={() => firstTimeSetup()}>Start</button
	>
</div>

<style></style>
