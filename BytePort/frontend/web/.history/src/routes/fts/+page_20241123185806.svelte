<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import type { User } from '../../stores/user';
	import { user } from '../../stores/user';
	let startBtn;
	let addtl = false;
	let visible = false;
	let ftsCont: HTMLElement;
	let ftsheadTxt: string = 'Welcome.';
	let stage = 0;
	let ftsHeadDescr: string = "Let's Begin First Time Setup";

	onMount(() => {
		visible = true;
		ftsCont = document.querySelector('#ftsCont');
		startBtn = document.querySelector('#startBtn');
	});

	function firstTimeSetup() {
		setStage();
		addtl = true;
		startBtn.remove();
	}

	function setStage() {
		// Handle initial state (stage === 0)
		if (stage === 0) {
			stage++; // Proceed to the first stage
			ftsheadTxt = "Let's Start With Some Basic Information...";
			ftsHeadDescr = 'Enter Your AWS Credentials Below';
			return;
		}

		// Validate the current form for all other stages
		const currentStageForm = document.querySelector(`#form-stage-${stage}`) as HTMLFormElement;

		if (currentStageForm && !currentStageForm.checkValidity()) {
			currentStageForm.reportValidity(); // Show validation error
			return; // Stop progression
		}else if (currentStageForm){
            //
            const formData = new FormData(currentStageForm);

        }

		// Increment stage after validation
		stage++;

		// Update texts for new stage
		switch (stage) {
			case 1:
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Enter Your AWS Credentials Below';
				break;
			case 2:
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Enter Your OpenAI Credentials Below';
				break;
			case 3:
				ftsheadTxt = "Let's Start With Some Basic Information...";
				ftsHeadDescr = 'Connect to Your Portfolio';
				break;
			default:
				ftsheadTxt = 'Setup Complete!';
				ftsHeadDescr = 'You have completed the first-time setup.';
				addtl = false; // Hide additional container
				break;
		}
	}
</script>

<div
	id="background"
	class="flex h-screen w-screen flex-col items-center justify-center bg-dark-surface"
>
	{#if visible}
		<h1
			in:fly={{ y: -100, duration: 1000 }}
			out:fade
			id="ftsHeadTxt"
			class="ftsHeadText my-2 w-screen text-center text-6xl text-dark-primary transition-all hover:text-dark-onSurface"
		>
			{ftsheadTxt}
		</h1>
		<h2
			in:fly={{ y: -50, duration: 2000 }}
			out:fade
			id="ftsHeadDescr"
			class="ftsHeadText text-md mb-4 w-screen text-center text-dark-tertiary transition-all hover:text-dark-onSurface"
		>
			{ftsHeadDescr}
		</h2>

		{#if addtl}
			<div
				in:fly={{ y: 50, duration: 2000 }}
				out:fade
				id="ftsOuterCont"
				class="mt-4 flex flex-col items-center justify-center"
			>
				<!-- Stage 1: AWS Credentials -->
				{#if stage === 1}
					<form id="form-stage-1" class="flex flex-col items-center justify-center">
						<input
							type="text"
							placeholder="AWS Access Key ID"
							class="mb-2 rounded border p-2"
							required
							pattern="^[A-Z0-9]{(16, 32)}$"
							title="AWS Access Key ID must be alphanumeric, between 16-32 characters."
						/>
						<input
							type="password"
							placeholder="AWS Secret Access Key"
							class="mb-2 rounded border p-2"
							required
							pattern="^[A-Za-z0-9/+=]{40}$"
							title="AWS Secret Access Key must be exactly 40 characters."
						/>
					</form>
				{:else if stage === 2}
					<!-- Stage 2: OpenAI Credentials -->
					<form id="form-stage-2" class="flex flex-col items-center justify-center">
						<input
							type="text"
							placeholder="OpenAI API Key"
							class="mb-2 rounded border p-2"
							required
							pattern="^sk-[a-zA-Z0-9]{(32, 64)}$"
							title="OpenAI API Key must start with 'sk-' and contain 32-64 alphanumeric characters."
						/>
					</form>
				{:else if stage === 3}
					<!-- Stage 3: Portfolio Integration -->
					<form id="form-stage-3" class="flex flex-col items-center justify-center">
						<input
							type="url"
							placeholder="Portfolio Root Endpoint URL"
							class="mb-2 rounded border p-2"
							required
							title="Please provide a valid URL."
						/>
						<input
							type="text"
							placeholder="API Key / Credential"
							class="mb-2 rounded border p-2"
							required
							title="API Key is required."
						/>

						<fieldset class="mb-4">
							<legend class="mb-2 font-bold">Git Repository Integration</legend>
							<label for="repo-url">Repository URL</label>
							<input
								type="url"
								id="repo-url"
								name="repo-url"
								placeholder="git@github.com:username/portfolio.git"
								required
								class="mb-2 rounded border p-2"
								title="Please provide a valid repository URL."
							/>

							<label for="auth-method">Authentication Method</label>
							<select id="auth-method" name="auth-method" required class="mb-2 rounded border p-2">
								<option value="ssh">SSH</option>
								<option value="token">Personal Access Token</option>
							</select>

							<label for="auth-key">SSH Key or Token</label>
							<input
								type="password"
								id="auth-key"
								name="auth-key"
								placeholder="Enter your SSH key or token"
								required
								class="mb-2 rounded border p-2"
								title="Authentication key is required."
							/>

							<label for="target-directory">Target Directory for Project Pages</label>
							<input
								type="text"
								id="target-directory"
								name="target-directory"
								placeholder="projects/"
								required
								class="mb-2 rounded border p-2"
								title="Target directory is required."
							/>
						</fieldset>
					</form>
				{:else}
					<!-- Completion -->
					<div class="flex flex-col items-center justify-center">
						<h1 class="text-dark-error">ERR!</h1>
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
		on:click={() => firstTimeSetup()}
	>
		Start
	</button>
</div>

<style></style>
