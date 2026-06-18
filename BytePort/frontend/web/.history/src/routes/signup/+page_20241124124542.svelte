<script lang="ts">
	import tempUser from '../+layout.svelte';
	import { user } from '../../stores/user';
	import type { User } from '../../stores/user';
	let newUser: User;
	let Error: string = ''
	const SERVER_URL = 'http://localhost:8080';
	async function signUpUser() {
		let newUser = {
			Name: document.forms['regUser']['name'].value,
			Email: document.forms['regUser']['email'].value,
			Password: document.forms['regUser']['password'].value
		};

		const { Name, Email, Password } = newUser;
		const response = await fetch(SERVER_URL + '/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},

			body: JSON.stringify({ Name, Email, Password })
		});

		newUser.Password = '';
		 console.log('Response Status:', response.status);
            console.log('Response OK:', response.ok);

            const data = await response.json();
if (response.ok) {
                console.log('Signup successful:', data);
                let temp: User = data as User;
                user.set(temp); // Update the user store
                window.location.href = '/fts'; // Redirect to /fts
            } else {
                Error = data.message || data.error || 'An unknown error occurred';
                console.log('Signup failed:', Error);
            }
        } catch (err) {
            console.error('Error during signup:', err);
            Error = 'An error occurred during signup.';
        }
	}
</script>

<div class="h-screen w-screen overflow-x-hidden bg-dark-surface">
	<div id="header" class=" w-5/5 h-1/5 flex-col justify-between bg-dark-surfaceContainerLow ps-2.5">
		<div id="headerNav" class="h-3/5 pt-2.5"></div>
		<div id="headerContent" class="h-2/5 text-4xl text-white">Hello.</div>
	</div>
	<div id="body" class="px-2.5 pt-5">
		<h1 class="text-2xl text-white">Please Register Below...</h1>
		<div id="signCont">
			<form class="flex-row" name="regUser" on:submit|preventDefault={signUpUser}>
				<div>
					<label for="name">Name</label>
					<input name="name" type="text" pattern="[a-zA-Z]+" required placeholder="Username" />
				</div>
				<div>
					<label for="email">Email</label>
					<input name="email" placeholder="Email" required type="email" />
				</div>
				<div>
					<label for="password">Password</label>
					<input
						name="password"
						pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])+"
						type="password"
						required
						placeholder="Password"
					/>
				</div>
				<input
					type="submit"
					value="Sign Up"
					class="rounded-full bg-dark-surfaceContainerHigh p-2 text-dark-onSurface hover:bg-dark-surfaceContainerHighest active:bg-dark-surfaceContainer"
				/>
			</form>
		</div>
	</div>
</div>

<style>
	#signCont form > div > input {
		@apply my-2 rounded-full bg-dark-surfaceContainerHigh text-dark-onSurface placeholder-dark-onSurfaceVariant selection:bg-dark-surfaceContainer hover:bg-dark-surfaceContainerHighest;
		border: none;
	}
	#signCont form > div > label {
		@apply text-dark-onSurface;
	}
	#signCont form > div {
		@apply h-1/5 w-screen flex-row items-center justify-center;
	}
</style>
