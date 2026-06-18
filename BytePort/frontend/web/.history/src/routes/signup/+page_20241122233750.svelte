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
    }
</script>