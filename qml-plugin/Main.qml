import Ubuntu.OnlineAccounts.Plugin 1.0

OAuthMain {
    creationComponent: OAuth {
        function completeCreation(reply) {
            console.log("Access token: " + reply.AccessToken)
            var http = new XMLHttpRequest()
            var url = "https://freesound_url"
            http.open("GET", url, true)
            http.onreadystatechange = function() {
                if (http.readyState == 4) {
                    if (http.status == 200) {
                        console.log("OK")
                        console.log("response text: " + http.responseText)
                        var response = JSON.parse(http.responseText)
                        account.updateDisplayName(response.name)
                        globalAccountService.updateSettings({
                            'id': response.id
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


//import QtQuick 2.0
//import Ubuntu.Components 0.1

//Flickable {
//    id: root
//
//    signal: finished
//
//    Loader {
//        id: loader
//        anchors.fill: parent
//        sourceComponent: account.accountId != 0 ? existingAccountComponent : newAccountComponent
//
//        Connections {
//            target: loader.item
//            onFinished: root.finished()
//        }
//    }
//
//    Component {
//        id: newAccountComponent
//        NewAccount {}  // UI for creating a new account
//    }
//
//    Component {
//        id: existingAccountComponent
//        EditAccount {}  // UI for editing an existing account
//    }
//
//}

