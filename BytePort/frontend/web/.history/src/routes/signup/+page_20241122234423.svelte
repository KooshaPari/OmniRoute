<script>
    let newUser: tempUser;
    async function signUpUser(){
        const response = await fetch(SERVER_URL + '/signup', {
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
        if(response.ok){
            /** Log Down Credentials into User Store*/
            window.location.href="/home";
        } else {error =data.error}
    }
</script>
