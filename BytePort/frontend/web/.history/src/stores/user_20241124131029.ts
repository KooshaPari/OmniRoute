import { writable } from 'svelte/store';
const SERVER_URL = 'http://localhost:8080';

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


// Create a writable store with the default user
export const user = writable<UserStore>({
	status: 'pending',
	data: null
});
export function setUser(authenticated: boolean, userData: User | null = null) {
	if (authenticated && userData) {
		user.set({ status: 'authenticated', data: userData });
	} else {
		user.set({ status: 'unauthenticated', data: null });
	}
}
