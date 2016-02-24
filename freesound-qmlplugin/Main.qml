import Ubuntu.OnlineAccounts.Plugin 1.0

OAuthMain {
    creationComponent: OAuth {
        function completeCreation(reply) {
            console.log("***************************");
            console.log("**** Freesound account ****");
            console.log("reply: " + reply);
            for (var prop in reply) {
                console.log("    reply." + prop + ": " + reply[prop]);
            }
            console.log("Access token: " + reply.AccessToken);
            console.log("***************************");
            var http = new XMLHttpRequest()
            var url = "https://www.freesound.org/apiv2/me/"
            http.open("GET", url, true);
            http.setRequestHeader("Authorization", "Bearer "+ reply.AccessToken);
            http.onreadystatechange = function() {
                if (http.readyState == 4) {
                    if (http.status == 200) {
                        console.log("***************************");
                        console.log("**** Freesound account ****");
                        console.log("OK")
                        console.log("response text: " + http.responseText)
                        console.log("***************************");
                        var response = JSON.parse(http.responseText)
                        account.updateDisplayName(response.username)
                        globalAccountService.updateSettings({
                            'id': response.unique_id
                        })
                        account.synced.connect(finished)
                        account.sync()
                    } else {
                        console.log("***************************");
                        console.log("**** Freesound account ****");
                        console.log("error: " + http.status)
                        console.log("***************************");
                        cancel()
                    }
                }
            };
            http.send(null);
        }
    }
}
