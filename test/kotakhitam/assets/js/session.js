(function (KH) {
    KH.session = {
        read() {
            try {
                return JSON.parse(sessionStorage.getItem(KH.config.sessionKey) || "null");
            } catch (error) {
                sessionStorage.removeItem(KH.config.sessionKey);
                return null;
            }
        },

        save() {
            const state = KH.state;
            sessionStorage.setItem(KH.config.sessionKey, JSON.stringify({
                pid: state.myPlayerId,
                name: state.myName,
                roomCode: state.myRoomCode,
                isModerator: state.isModerator
            }));
        },

        clear() {
            sessionStorage.removeItem(KH.config.sessionKey);
        }
    };
})(window.KH = window.KH || {});
