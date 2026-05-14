(function (KH) {
    const { dom } = KH;

    function handleSecretPanelTap() {
        const state = KH.state;
        state.secretClickCount++;
        clearTimeout(state.secretClickTimer);
        state.secretClickTimer = setTimeout(() => {
            state.secretClickCount = 0;
        }, 600);

        if (state.secretClickCount >= 5) {
            state.secretClickCount = 0;
            toggleSecretPanel();
        }
    }

    function toggleSecretPanel() {
        const state = KH.state;
        if (!state.isModerator) return;
        if (!state.currentRoomData || (state.currentRoomData.status !== "voting" && state.currentRoomData.status !== "results")) return;

        const overlay = document.getElementById("secret-vote-overlay");
        const isShown = overlay.classList.toggle("show");
        if (isShown && state.currentRoomData) renderSecretVoteList(state.currentRoomData);
    }

    function renderSecretVoteList(data) {
        const list = document.getElementById("secret-vote-list");
        list.innerHTML = "";

        if (!data.vote || !data.vote.active) {
            list.innerHTML = '<div class="empty-overlay-message">Belum ada sesi vote aktif.</div>';
            return;
        }

        const players = data.players || {};
        const votes = data.vote.votes || {};

        Object.entries(players).forEach(([playerId, player]) => {
            const vote = votes[playerId];
            let voteHtml = '<span class="secret-vote-pending">Belum Vote</span>';
            if (vote === "yes") voteHtml = '<span class="secret-vote-yes">YA</span>';
            if (vote === "no") voteHtml = '<span class="secret-vote-no">TIDAK</span>';

            const item = document.createElement("div");
            item.className = "overlay-player-item";
            item.innerHTML = `<span class="player-name-strong">${dom.escapeHTML(player.name)}</span>${voteHtml}`;
            list.appendChild(item);
        });
    }

    function togglePlayersOverlay() {
        const state = KH.state;
        if (!state.isModerator) return;

        const overlay = document.getElementById("players-overlay");
        const isShown = overlay.classList.toggle("show");
        if (isShown && state.currentRoomData) renderOverlayPlayerList(state.currentRoomData);
    }

    function renderOverlayPlayerList(data) {
        const players = data.players || {};
        const list = document.getElementById("overlay-player-list");
        list.innerHTML = "";

        Object.entries(players).forEach(([playerId, player]) => {
            const isMod = playerId === data.moderator;
            const isMe = playerId === KH.state.myPlayerId;
            const item = document.createElement("div");

            item.className = "overlay-player-item";
            item.innerHTML = `
                <span class="inline-status">
                    ${isMod
                        ? '<i class="fa-solid fa-crown icon-gold"></i>'
                        : '<i class="fa-solid fa-user icon-muted"></i>'
                    }
                    ${dom.escapeHTML(player.name)}${isMe ? ' <span class="you-label">(Kamu)</span>' : ""}
                </span>
                ${(!isMod && !isMe)
                    ? `<button class="btn-kick" data-action="kick-player" data-player-id="${playerId}" data-player-name="${dom.escapeHTML(player.name)}">KICK</button>`
                    : `<span class="role-label">${isMod ? "MOD" : ""}</span>`
                }
            `;
            list.appendChild(item);
        });
    }

    function toggleGuideOverlay() {
        const overlay = document.getElementById("guide-overlay");
        if (overlay) overlay.classList.toggle("show");
    }

    KH.overlays = {
        handleSecretPanelTap,
        toggleSecret: toggleSecretPanel,
        renderSecretVote: renderSecretVoteList,
        togglePlayers: togglePlayersOverlay,
        renderPlayers: renderOverlayPlayerList,
        toggleGuide: toggleGuideOverlay
    };
})(window.KH = window.KH || {});
