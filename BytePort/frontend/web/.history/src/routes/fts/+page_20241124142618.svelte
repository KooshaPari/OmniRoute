<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import type { User } from '../../stores/user';
	import { user, UserStore } from '../../stores/user';
	import { goto } from '$app/navigation';
	const SERVER_URL = 'http://localhost:8080';
	let startBtn: HTMLElement;
	let addtl = false;
	let visible = false;
	let ftsCont: HTMLElement;
	let userData: User;
	let ftsheadTxt: string = 'Welcome.';
	let stage = 0;
	let ftsHeadDescr: string = "Let's Begin First Time Setup";
	let client: UserStore;

	const unsubscribe = user.subscribe((value) => {
		client = value;
		if (!client) {
			goto('/signup');
		}
	});
	onMount(() => {
		visible = true;
		ftsCont = document.querySelector('#ftsCont');
		startBtn = document.querySelector('#startBtn');
	});
	onDestroy(() => {
		unsubscribe();
	});

	function firstTimeSetup() {
		setStage();
		userData = $user.data;
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
		} else if (currentStageForm) {

			const formData = new FormData(currentStageForm);
			const data = Object.fromEntries(formData) as UserStore;

			userData = { ...userData, ...data };
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

			case 4:
				ftsheadTxt = 'Setup Complete!';
				ftsHeadDescr = 'You have completed the first-time setup.';
				user.set(userData);
				link();
			// post user obj to server
			case 5:
				ftsheadTxt = '(Progress Bar Goes Here)';
			default:
				goto('/');
				ftsheadTxt = 'Setup ERR!';
				addtl = false; // Hide additional container
				break;
		}
	}
	function Link() {
		let payload = $client.data;
		const response = await fetch(`${SERVER_URL}/link`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${client.token}`
			},
			body: JSON.stringify(payload)
		});
        let data = await response.json();
        console.log(data);
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
					<!-- Stage 1: AWS Credentials -->
					<form id="form-stage-1" class="flex flex-col items-center justify-center">
						<label for="accessKeyId">AWS Access Key ID</label>
						<input
							name="accessKeyId"
							type="text"
							placeholder="AWS Access Key ID"
							class="mb-2 rounded border p-2"
							required
							title="AWS Access Key ID must be alphanumeric, between 16-32 characters."
						/>

						<label for="secretAccessKey">AWS Secret Access Key</label>
						<input
							name="secretAccessKey"
							type="password"
							placeholder="AWS Secret Access Key"
							class="mb-2 rounded border p-2"
							required
							title="AWS Secret Access Key must be exactly 40 characters."
						/>
					</form>
				{:else if stage === 2}
					<!-- Stage 2: OpenAI Credentials -->
					<form id="form-stage-2" class="flex flex-col items-center justify-center">
						<label for="apiKey">OpenAI API Key</label>
						<input
							name="apiKey"
							type="text"
							placeholder="OpenAI API Key"
							class="mb-2 rounded border p-2"
							required
							title="OpenAI API Key must start with 'sk-' and contain 32-64 alphanumeric characters."
						/>
					</form>
				{:else if stage === 3}
					<!-- Stage 3: Portfolio Integration -->
					<form id="form-stage-3" class="flex flex-col items-center justify-center">
						<label for="rootEndpoint">Portfolio Root Endpoint URL</label>
						<input
							name="rootEndpoint"
							type="url"
							placeholder="Portfolio Root Endpoint URL"
							class="mb-2 rounded border p-2"
							required
							title="Please provide a valid URL."
						/>

						<label for="apiKey">Portfolio API Key</label>
						<input
							name="apiKey"
							type="text"
							placeholder="Portfolio API Key"
							class="mb-2 rounded border p-2"
							required
							title="API Key is required."
						/>

						<fieldset class="mb-4 flex flex-col">
							<legend class="mb-2 font-bold">Git Repository Integration</legend>
							<label for="repoUrl">Repository URL</label>
							<input
								name="repoUrl"
								type="url"
								placeholder="git@github.com:username/portfolio.git"
								required
								class="mb-2 rounded border p-2"
								title="Please provide a valid repository URL."
							/>

							<label for="authMethod">Authentication Method</label>
							<select name="authMethod" required class="mb-2 rounded border p-2">
								<option value="ssh">SSH</option>
								<option value="token">Personal Access Token</option>
							</select>

							<label for="authKey">SSH Key or Token</label>
							<input
								name="authKey"
								type="password"
								placeholder="Enter your SSH key or token"
								required
								class="mb-2 rounded border p-2"
								title="Authentication key is required."
							/>

							<label for="targetDirectory">Target Directory for Project Pages</label>
							<input
								name="targetDirectory"
								type="text"
								placeholder="projects/"
								required
								class="mb-2 rounded border p-2"
								title="Target directory is required."
							/>
						</fieldset>
					</form>
				{/if}

				<!-- Action button to proceed -->
				{#if stage < 4}
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
