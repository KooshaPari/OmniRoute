import { writable } from 'svelte/store';

// Define the User interface
export interface User {
	// Personal Details
	UUID: string;
	Name: string;
	Email: string;
	Encrypted_Token: string;

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
type UserStore = {
	status: 'pending' | 'authenticated' | 'unauthenticated';
	data: User | null;
};
const defaultUser: User = {
	UUID: '',
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
