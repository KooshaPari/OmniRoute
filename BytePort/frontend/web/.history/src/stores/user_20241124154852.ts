import { writable } from 'svelte/store';
const SERVER_URL = 'http://localhost:8080';

// Define the User interface
export interface User {
	// Personal Details
	UUID: string;
	Name: string;
	Email: string;

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

export const user = writable<UserStore>({
	status: 'pending',
	data: null
});
export function setUser(authenticated: boolean, userData: User | null = null) {
	if (authenticated && userData) {
		user.set({
			status: 'authenticated',
			data: userData
		});
	} else {
		user.set({ status: 'unauthenticated', data: null });
	}
}
export async function initializeUser() {
	try {
		const response = await fetch(`${SERVER_URL}/authenticate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include'
		});

		if (response.ok) {
			const data = await response.json();
			const authenticatedUser: User = data.user; // Adjust based on backend response structure
			setUser(true, authenticatedUser);
		} else {
			// Token is invalid or expired
			console.log('Token is invalid or expired');
			setUser(false);
			localStorage.removeItem('authToken'); // Clear invalid token
		}
	} catch (error) {
		console.error('Error validating token:', error);
		setUser(false);
		localStorage.removeItem('authToken');
	}
}
