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
	token: string;
};

export const user = writable<UserStore>({
	status: 'pending',
	data: null,
});
export function setUser(authenticated: boolean, userData: User | null = null) {
	if (authenticated && userData) {
		user.set({ status: 'authenticated', data: userData, token: userData.Encrypted_Token });
	} else {
		user.set({ status: 'unauthenticated', data: null, token: '' });
	}
}
export async function initializeUser() {
	const token = localStorage.getItem('authToken'); // Or retrieve from cookies if using HTTP-only cookies

	if (token) {
		try {
			const response = await fetch(`${SERVER_URL}/authenticate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				const authenticatedUser: User = data.user; // Adjust based on backend response structure
				setUser(true, authenticatedUser);
			} else {
				// Token is invalid or expired
				setUser(false);
				localStorage.removeItem('authToken'); // Clear invalid token
			}
		} catch (error) {
			console.error('Error validating token:', error);
			setUser(false);
			localStorage.removeItem('authToken');
		}
	} else {
		// No token found
		setUser(false);
	}
}
