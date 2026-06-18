<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { type UserLink, type User, initializeUser } from '../../stores/user';
	import { setUser, user } from '../../stores/user';
	import { goto } from '$app/navigation';
	const SELF_URL = 'http://localhost:5173';
	const SERVER_URL = 'http://localhost:8080';
	let startBtn: HTMLElement;
	let addtl = false;
	let visible = false;
	let ftsCont: HTMLElement;
	let ftsheadTxt: string = 'Welcome.';
	let stage = 0;
	let ftsHeadDescr: string = "Let's Begin First Time Setup";
	let client: User | null = null;
	let userData: UserLink = {
		UUID: '',
		Name: '',
		Email: '',
		awsCreds: {
			accessKeyId: '',
			secretAccessKey: ''
		},
		openAICreds: {
			apiKey: ''
		},
		portfolio: {
			rootEndpoint: '',
			apiKey: ''
		},
		git: {
			gitUrl: '',
			authMethod: '',
			authKey: '',
			targetDirectory: ''
		}
	};

	onMount(async () => {
		const unsubscribe = user.subscribe((value) => {
			// Handle pending state
			if (value.status === 'pending') {
				console.log('User state pending...');
				return; // Wait for initialization to complete
			}

			// Redirect if unauthenticated
			if (value.status !== 'authenticated') {
				console.log('User unauthenticated, redirecting...');
				goto('/login');
			} else {
				console.log('Authenticated user:', value.data);
				// Perform actions for authenticated user
				client = value.data; // Assign the authenticated user to `client`
			}
		});
		await initializeUser(); // Initialize the user store
		onDestroy(() => {
			unsubscribe();
		});
	});
	function firstTimeSetup() {
		visible = true;
		addtl = true;
		if (client) {
			//console.log('C: ', client);
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
					userData.awsCreds = {
						accessKeyId: data.accessKeyId as string,
						secretAccessKey: data.secretAccessKey as string
					};
					break;
				case 2:
					userData.openAICreds = {
						apiKey: data.apiKey as string
					};
					break;
				case 3:
					userData.portfolio = {
						rootEndpoint: data.rootEndpoint as string,
						apiKey: data.portfolioApiKey as string
					};
					userData.git = {
						gitUrl: data.gitUrl as string,
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
					goto('/home'); // Redirect to the home page or dashboard
					break;
				default:
					ftsheadTxt = 'Setup ERR!';
					addtl = false; // Hide additional container
					break;
			}
		}
	}
	async function checkGitHubLinkStatus() {
		const response = await fetch(`${SERVER_URL}/github/status`, { credentials: 'include' });
		const data = await response.json();
		if (data.linked) {
			console.log('GitHub linked successfully!');
			// Proceed to validation step
		} else {
			console.log('Waiting for GitHub linking...');
			setTimeout(checkGitHubLinkStatus, 5000); // Poll every 5 seconds
		}
	}

	async function Link() {
		window.open(`${SERVER_URL}/link`, '_blank');
		await checkGitHubLinkStatus();
		try {
			const payload = userData;

			const response = await fetch(`${SERVER_URL}/validate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				const data = await response.json();
				console.log('Integration successful:', data);
				setUser(true, data as User);
			} else {
				const errorData = await response.json();
				console.error('Link failed:', errorData);
			}
		} catch (error) {
			console.error('Error during integration:', error);
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
							bind:value={userData.awsCreds.accessKeyId}
						/>

						<label for="secretAccessKey">AWS Secret Access Key</label>
						<input
							name="secretAccessKey"
							type="password"
							placeholder="AWS Secret Access Key"
							class="mb-2 rounded border p-2"
							required
							title="AWS Secret Access Key must be exactly 40 characters."
							bind:value={userData.awsCreds.secretAccessKey}
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
							bind:value={userData.openAICreds.apiKey}
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
