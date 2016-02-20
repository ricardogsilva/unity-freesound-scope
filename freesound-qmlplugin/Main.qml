import Ubuntu.OnlineAccounts.Plugin 1.0

OAuthMain {
    creationComponent: OAuth {
        function completeCreation(reply) {
            console.log("Access token: " + reply.access_token)
            var http = new XMLHttpRequest()
            var url = "https://www.freesound.org/apiv2/me/"
            http.open("GET", url, true)
            http.onreadystatechange = function() {
                if (http.readyState == 4) {
                    if (http.status == 200) {
                        console.log("OK")
                        console.log("response text: " + http.responseText)
                        var response = JSON.parse(http.responseText)
                        account.updateDisplayName(response.username)
                        globalAccountService.updateSettings({
                            'id': response.unique_id
                        })
                        account.synced.connect(finished)
                        account.sync()
                    } else {
                        console.log("error: " + http.status)
                        cancel()
                    }
                }
            };
            http.send(null);
        }
    }
}
