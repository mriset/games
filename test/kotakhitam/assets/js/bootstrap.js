(function (KH) {
    function syncAppHeight() {
        document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    }

    const actionHandlers = {
        "create-room": () => KH.room.createRoom(),
        "join-room": () => KH.room.joinRoom(),
        "copy-room-code": () => KH.room.copyRoomCode(),
        "confirm-leave": () => KH.room.confirmLeave(),
        "start-game": () => KH.gameplay.startGame(),
        "trigger-shuffle": () => KH.gameplay.triggerShuffle(),
        "start-vote": () => KH.gameplay.startVote(),
        "reveal-vote": () => KH.gameplay.revealResults(true),
        "reset-vote": () => KH.gameplay.resetVote(),
        "vote-yes": () => KH.gameplay.submitVote("yes"),
        "vote-no": () => KH.gameplay.submitVote("no"),
        "secret-panel-tap": () => KH.overlays.handleSecretPanelTap(),
        "toggle-secret": () => KH.overlays.toggleSecret(),
        "toggle-players": () => KH.overlays.togglePlayers(),
        "toggle-guide": () => KH.overlays.toggleGuide(),
        "kick-player": target => KH.room.kickPlayer(target.dataset.playerId, target.dataset.playerName, target)
    };

    function bindActions() {
        document.addEventListener("click", event => {
            const target = event.target.closest("[data-action]");
            if (!target) return;

            const handler = actionHandlers[target.dataset.action];
            if (!handler) return;

            event.preventDefault();
            handler(target);
        });
    }

    function hydrateInviteCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get("room");
        if (!roomFromUrl) return;

        const input = document.getElementById("room-code-input");
        if (input) input.value = roomFromUrl.toUpperCase();
    }

    function bindInputs() {
        const nameInput = document.getElementById("player-name");
        const charCounter = document.getElementById("char-counter");
        if (nameInput && charCounter) {
            nameInput.addEventListener("input", () => {
                const len = nameInput.value.length;
                charCounter.textContent = `${len}/12`;
                
                if (len > 0) nameInput.classList.add("input-filled");
                else nameInput.classList.remove("input-filled");
                
                charCounter.classList.toggle("near-limit", len >= 9 && len < 12);
                charCounter.classList.toggle("at-limit", len === 12);
            });
        }
    }

    function boot() {
        syncAppHeight();
        window.addEventListener("resize", syncAppHeight);
        window.addEventListener("orientationchange", syncAppHeight);
        bindActions();
        bindInputs();
        hydrateInviteCode();
        KH.room.restoreSession();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(window.KH = window.KH || {});
