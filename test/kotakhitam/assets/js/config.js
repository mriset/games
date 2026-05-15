(function (KH) {
    KH.config = {
        firebase: {
            apiKey: "AIzaSyBGEwGVEVM0lUcUF6_wJbc4rmVgp8XG6_g",
            authDomain: "kotakhitam-33e4a.firebaseapp.com",
            databaseURL: "https://kotakhitam-33e4a-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "kotakhitam-33e4a",
            storageBucket: "kotakhitam-33e4a.firebasestorage.app",
            messagingSenderId: "1069156640677",
            appId: "1:1069156640677:web:3a4bb5d5ead8f215beaa4c"
        },
        createRoomPin: "183729",
        maxPlayers: 50,
        minPlayersToStart: 3,
        roomCodeLength: 4,
        sessionKey: "khSession",
        shuffleSpeed: 100,
        shuffleDuration: 2000
    };

    firebase.initializeApp(KH.config.firebase);
    KH.db = firebase.database();
})(window.KH = window.KH || {});
