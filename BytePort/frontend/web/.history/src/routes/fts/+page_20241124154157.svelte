<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import type { User } from '../../stores/user';
	import { setUser, user } from '../../stores/user';
	import { goto } from '$app/navigation';
	const SERVER_URL = 'http://localhost:8080';
	let startBtn: HTMLElement;
	let addtl = false;
	let visible = false;
	let ftsCont: HTMLElement;
	let ftsheadTxt: string = 'Welcome.';
	let stage = 0;
	let ftsHeadDescr: string = "Let's Begin First Time Setup";
	let client: User | null = null;
	let userData: User = {
		UUID: '',
		Name: '',
		Email: '',
		aws: {
			accessKeyId: '',
			secretAccessKey: ''
		},
		openAI: {
			apiKey: ''
		},
		portfolio: {
			rootEndpoint: '',
			apiKey: ''
		},
		git: {
			repoUrl: '',
			authMethod: '',
			authKey: '',
			targetDirectory: ''
		}
	};
	
	onMount(() => {
		visible = true;
		ftsCont = document.querySelector('#ftsCont');
		console.log($user);
		unsubscribe();
		//startBtn = document.querySelector('#startBtn');
	});
	onDestroy(() => {
		unsubscribe();
	});

	function firstTimeSetup() {
		addtl = true;
		if (client) {
			console.log('C: ', client);
			userData = {
				...userData,
				UUID: client.UUID,
				Name: client.Name,
				Email: client.Email
			};
		}
		setStage();
		const startBtn = document.querySelector('#startBtn');
		if (startBtn) startBtn.remove();
	}

	async function setStage() {
		if (stage === 0) {
			stage++;
			ftsheadTxt = "Let's Start With Some Basic Information...";
			ftsHeadDescr = 'Enter Your AWS Credentials Below';
			return;
		}

		const currentStageForm = document.querySelector(`#form-stage-${stage}`) as HTMLFormElement;

		if (currentStageForm) {
			if (!currentStageForm.checkValidity()) {
				currentStageForm.reportValidity(); // Show validation errors
				return; // Stop progression
			}

			// Collect form data
			const formData = new FormData(currentStageForm);
			const data = Object.fromEntries(formData.entries());

			// Assign data to the appropriate nested object in userData
			switch (stage) {
				case 1:
					userData.aws = {
						accessKeyId: data.accessKeyId as string,
						secretAccessKey: data.secretAccessKey as string
					};
					break;
				case 2:
					userData.openAI = {
						apiKey: data.apiKey as string
					};
					break;
				case 3:
					userData.portfolio = {
						rootEndpoint: data.rootEndpoint as string,
						apiKey: data.apiKey as string
					};
					userData.git = {
						repoUrl: data.repoUrl as string,
						authMethod: data.authMethod as string,
						authKey: data.authKey as string,
						targetDirectory: data.targetDirectory as string
					};
					break;
				default:
					break;
			}

			console.log(`Stage ${stage} data collected:`, userData);

			// Increment stage
			stage++;

			// Update texts based on the new stage
			switch (stage) {
				case 1:
					ftsheadTxt = "Let's Start With Some Basic Information...";
					ftsHeadDescr = 'Enter Your AWS Credentials Below';
					break;
				case 2:
					ftsheadTxt = "Let's Continue With OpenAI Credentials...";
					ftsHeadDescr = 'Enter Your OpenAI Credentials Below';
					break;
				case 3:
					ftsheadTxt = "Let's Connect Your Portfolio...";
					ftsHeadDescr = 'Provide Your Portfolio and Git Details';
					break;
				case 4:
					ftsheadTxt = 'Setup Complete!';
					ftsHeadDescr = 'You have completed the first-time setup.';
					await Link(); // Send the complete userData to the server
					break;
				case 5:
					ftsheadTxt = '(Progress Bar Goes Here)';
					goto('/'); // Redirect to the home page or dashboard
					break;
				default:
					ftsheadTxt = 'Setup ERR!';
					addtl = false; // Hide additional container
					break;
			}
		}
	}
	async function Link() {
		try {
			const payload = userData;

			const response = await fetch(`${SERVER_URL}/link`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				const data = await response.json();
				console.log('Link successful:', data);
				setUser(true, data as User);
			} else {
				const errorData = await response.json();
				console.error('Link failed:', errorData);
			}
		} catch (error) {
			console.error('Error during linking:', error);
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
							bind:value={userData.aws.accessKeyId}
						/>

						<label for="secretAccessKey">AWS Secret Access Key</label>
						<input
							name="secretAccessKey"
							type="password"
							placeholder="AWS Secret Access Key"
							class="mb-2 rounded border p-2"
							required
							title="AWS Secret Access Key must be exactly 40 characters."
							bind:value={userData.aws.secretAccessKey}
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
							bind:value={userData.openAI.apiKey}
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
							bind:value={userData.portfolio.rootEndpoint}
						/>

						<label for="portfolioApiKey">Portfolio API Key</label>
						<input
							name="portfolioApiKey"
							type="text"
							placeholder="Portfolio API Key"
							class="mb-2 rounded border p-2"
							required
							title="API Key is required."
							bind:value={userData.portfolio.apiKey}
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
								bind:value={userData.git.repoUrl}
							/>

							<label for="authMethod">Authentication Method</label>
							<select
								name="authMethod"
								required
								class="mb-2 rounded border p-2"
								bind:value={userData.git.authMethod}
							>
								<option value="" disabled selected>Select Authentication Method</option>
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
								bind:value={userData.git.authKey}
							/>

							<label for="targetDirectory">Target Directory for Project Pages</label>
							<input
								name="targetDirectory"
								type="text"
								placeholder="projects/"
								required
								class="mb-2 rounded border p-2"
								title="Target directory is required."
								bind:value={userData.git.targetDirectory}
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
