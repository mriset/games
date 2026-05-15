(function (KH) {
    const saved = KH.session.read();

    KH.state = {
        saved,
        myPlayerId: saved && saved.pid ? saved.pid : `p_${Math.random().toString(36).substr(2, 9)}`,
        myName: saved && saved.name ? saved.name : "",
        myRoomCode: "",
        isModerator: false,
        roomRef: null,
        playerRef: null,
        currentRoomData: null,
        isShuffling: false,
        lastProcessedShuffleSignalId: null,
        lastRevealedStatus: false,
        skippedVoteStart: null,
        secretClickCount: 0,
        secretClickTimer: null
    };
})(window.KH = window.KH || {});
