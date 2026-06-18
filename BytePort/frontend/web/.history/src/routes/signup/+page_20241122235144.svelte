<script lang="ts">
	import tempUser from '../+layout.svelte';
	import User from '../+layout.svelte';
	let newUser: tempUser;
	async function signUpUser() {
		/*const response = await fetch(SERVER_URL + '/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newUser.name,
                newUser.email,
                newUser.password

            })
        })
        const data = await response.json;
        if(response.ok){*/
		/* Log Down Credentials into User Store
            window.location.href="/home";
        } else {error =data.error}*/
	}
</script>

<div class="h-screen w-screen overflow-x-hidden bg-dark-surface">
	<div id="header" class=" w-5/5 h-1/5 flex-col justify-between bg-dark-surfaceContainerLow ps-2.5">
		<div id="headerNav" class="h-3/5 pt-2.5">
			<div class="flex justify-end pe-2.5" id="navRight">
				<Icon
					class="mx-1 h-6 w-6 cursor-pointer text-white hover:text-dark-primary active:text-dark-surfaceBright"
					icon="ic:baseline-notifications"
				/>
				<Icon
					class="mx-1 h-6 w-6 cursor-pointer text-white hover:text-dark-primary active:text-dark-surfaceBright"
					icon="ic:baseline-account-circle"
				/>
			</div>
		</div>
		<div id="headerContent" class="h-2/5 text-4xl text-white">Hello.</div>
	</div>
</div>
