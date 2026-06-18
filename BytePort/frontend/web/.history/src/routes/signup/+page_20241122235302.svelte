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
		<div id="headerNav" class="h-3/5 pt-2.5"></div>
		<div id="headerContent" class="h-2/5 text-4xl text-white">Hello.</div>
	</div>
	<div id="body" class="pt-5">
		<h1 class="text-2xl text-white">Please Register Below...</h1>
	</div>
</div>
