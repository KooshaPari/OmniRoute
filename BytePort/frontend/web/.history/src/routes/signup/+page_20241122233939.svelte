<script>
    async function signUpUser(){
        const response = await fetch(SERVER_URL + '/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newUser.
            })
        })
        const data = await response.json;
        if(response.ok){
            /** Log Down Credentials into User Store*/
            window.location.href="/home";
        } else {error =data.error}
    }
</script>
