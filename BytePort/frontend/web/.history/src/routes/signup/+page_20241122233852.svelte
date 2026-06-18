<script>
    async function signUpUser(){
        const response = await fetch(SERVER_URL + '/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'username',
                password: 'password'
            })
        })
        cons data = await response.json;
        if(response.ok){
            /** Log Down Credentials into User Store*/
            window.location.href="/"
        } else {error =data.error}
    }
</script>
