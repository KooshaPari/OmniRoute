import { writable } from 'svelte/store';

// Define the User interface
export interface User {
	// Personal Details
	Name: string;
	Email: string;
	Token: string;
	Encrypted_Token:

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
	Encrypted_Token: '',
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
