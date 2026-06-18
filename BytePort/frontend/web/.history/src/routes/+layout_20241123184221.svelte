<script lang="ts">
	import '../app.css';

	let { children } = $props();
	interface VMInstance {
		Name: String;
		Status: String;
		OS: String;
		RootProject: Project;
		LastUpdated: String;
	}
	interface Project {
		Name: String;
		Description: String;
		LastUpdated: String;
		Status: String;
		Type: String;
		Instances: VMInstance[];
	}
	interface tempUser {
		Name: String;
		Email: String;
		Password: String;
	}
	import { writable } from 'svelte/store';

	// Define the User interface
	export interface User {
		// Personal Details
		Name: string;
		Email: string;
		Token: string;

		// API Details
		aws: {
			accessKeyId: string;
			secretAccessKey: string;
		};
		openAI: {
			apiKey: string;
		};
		portfolio: {
			rootEndpoint: string;
			apiKey: string;
		};
		git: {
			repoUrl: string;
			authMethod: string; // e.g., "ssh" or "token"
			authKey: string;
			targetDirectory: string;
		};
	}

	// Default user object
	const defaultUser: User = {
		Name: '',
		Email: '',
		Token: '',
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
			authMethod: 'ssh', // Default to SSH
			authKey: '',
			targetDirectory: 'projects/'
		}
	};

	// Create a writable store with the default user
	export const user = writable<User>(defaultUser);
</script>

{@render children()}

<style>
	@import '../app.css';
</style>
