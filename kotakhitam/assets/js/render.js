(function (KH) {
    const { dom } = KH;

    function getCardHTML(level, text) {
        let iconClass = "fa-solid fa-quote-left";
        if (level === 2) iconClass = "fa-solid fa-user-secret";
        else if (level === 3) iconClass = "fa-solid fa-fire";
        else if (level === 4) iconClass = "fa-solid fa-bomb";
        else if (level === 5) iconClass = "fa-solid fa-skull-crossbones";

        return `
            <div class="card-gradient"></div>
            <div class="card-content-wrapper">
                <div class="q-top">
                    <span class="q-level-badge">LVL ${level}</span>
                </div>
                <div class="q-mid">
                    <i class="${iconClass} q-icon"></i>
                    <p class="q-text">"${dom.escapeHTML(text)}"</p>
                </div>
                <div class="q-bot">
                    <span class="q-brand">KOTAK HITAM</span>
                </div>
            </div>
        `;
    }

    function renderStaticCard(cardData) {
        const cardView = document.getElementById("hp-card-view");
        if (!cardView || !cardData) return;

        cardView.className = `card-hp lvl-${cardData.level}`;
        cardView.innerHTML = getCardHTML(cardData.level, cardData.text);
    }

    function renderLobby(data, playersCount) {
        const state = KH.state;
        document.getElementById("lobby-room-code").textContent = state.myRoomCode;
        document.getElementById("player-count").textContent = playersCount;

        const playerList = document.getElementById("player-list");
        playerList.innerHTML = "";

        Object.entries(data.players || {}).forEach(([playerId, player]) => {
            const isMod = playerId === data.moderator;
            const isMe = playerId === state.myPlayerId;
            const showKick = state.isModerator && !isMod && !isMe;
            const item = document.createElement("div");

            item.className = "player-list-item";
            item.innerHTML = `
                <span>${dom.escapeHTML(player.name)} ${isMe ? "(Kamu)" : ""}</span>
                <span class="inline-status">
                    ${isMod ? '<i class="fa-solid fa-crown crown-icon"></i>' : ""}
                    ${showKick ? `<button class="btn-kick" data-action="kick-player" data-player-id="${playerId}" data-player-name="${dom.escapeHTML(player.name)}">KICK</button>` : ""}
                </span>
            `;
            playerList.appendChild(item);
        });

        const modControls = document.getElementById("mod-lobby-controls");
        modControls.classList.toggle("is-visible", state.isModerator);

        if (!state.isModerator) return;

        const startButton = document.getElementById("btn-start-game");
        if (playersCount >= KH.config.minPlayersToStart) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fa-solid fa-play"></i> Mulai Permainan';
        } else {
            startButton.disabled = true;
            startButton.textContent = `Menunggu (Min. ${KH.config.minPlayersToStart} Pemain)`;
        }
    }

    function renderVoting(data, playersCount) {
        const state = KH.state;
        const votePanel = document.getElementById("vote-panel");
        const resultsPanel = document.getElementById("results-panel");
        const voteStatus = document.getElementById("vote-status");
        const revealButton = document.getElementById("btn-reveal-vote");

        document.querySelector(".card-container").classList.add("panel-active");
        resultsPanel.classList.remove("show");
        if (data.currentCard && !state.isShuffling) renderStaticCard(data.currentCard);
        if (!votePanel.classList.contains("show")) {
            setTimeout(() => votePanel.classList.add("show"), 50);
        }

        const votesCount = data.vote && data.vote.votes ? Object.keys(data.vote.votes).length : 0;
        voteStatus.textContent = `${votesCount} / ${playersCount} sudah vote`;

        const voted = new Set(Object.keys(data.vote?.votes || {}));
        const pending = Object.entries(data.players || {})
            .filter(([playerId]) => !voted.has(playerId))
            .map(([, player]) => dom.escapeHTML(player.name));

        const pendingElement = document.getElementById("pending-voters");
        pendingElement.innerHTML = pending.length > 0
            ? `<p class="pending-voters-label">BELUM VOTE:</p>${pending.map(name => `<span class="pending-voter-badge">${name}</span>`).join("")}`
            : '<p class="all-voted-message">Semua sudah vote!</p>';

        if (state.isModerator) {
            revealButton.disabled = false;
            revealButton.textContent = votesCount >= playersCount ? "BUKA HASIL" : `BUKA HASIL (${votesCount}/${playersCount})`;
        }

        const myVote = data.vote && data.vote.votes && data.vote.votes[state.myPlayerId];
        const joinedMidVote = state.skippedVoteStart && data.vote?.startTime === state.skippedVoteStart;
        document.getElementById("btn-vote-ya").disabled = !!myVote || joinedMidVote;
        document.getElementById("btn-vote-tidak").disabled = !!myVote || joinedMidVote;
    }

    function renderResults(data) {
        const state = KH.state;
        const votePanel = document.getElementById("vote-panel");
        const resultsPanel = document.getElementById("results-panel");

        if (!state.lastRevealedStatus) {
            KH.audio.suspense();
            state.lastRevealedStatus = true;
        }

        document.querySelector(".card-container").classList.add("panel-active");
        votePanel.classList.remove("show");
        if (data.currentCard && !state.isShuffling) renderStaticCard(data.currentCard);
        if (!resultsPanel.classList.contains("show")) {
            setTimeout(() => resultsPanel.classList.add("show"), 50);
        }

        let yesCount = 0;
        let noCount = 0;
        Object.values(data.vote?.votes || {}).forEach(vote => {
            if (vote === "yes") yesCount++;
            else if (vote === "no") noCount++;
        });

        document.getElementById("res-ya").textContent = `${yesCount} Orang`;
        document.getElementById("res-tidak").textContent = `${noCount} Orang`;
    }

    function updateModeratorControls(data) {
        const state = KH.state;
        const modPlayControls = document.getElementById("mod-play-controls");
        const nextButton = document.getElementById("btn-next");

        modPlayControls.classList.toggle("is-visible", state.isModerator);
        if (!state.isModerator) return;

        dom.setVisible(document.getElementById("btn-start-vote"), data.status === "playing");
        dom.setVisible(document.getElementById("btn-reveal-vote"), data.status === "voting");
        dom.setVisible(document.getElementById("btn-reset-vote"), data.status === "results");
        nextButton.disabled = data.status === "voting" || data.status === "shuffling" || data.status === "results";
    }

    function updateUI(data) {
        const state = KH.state;
        const playersCount = data.players ? Object.keys(data.players).length : 0;

        if (data.status === "lobby") {
            dom.showScreen("lobby-screen");
            renderLobby(data, playersCount);
            return;
        }

        dom.showScreen("play-screen");
        document.getElementById("play-room-code").textContent = `ROOM: ${state.myRoomCode}`;
        document.getElementById("deck-progress").textContent = `${(data.usedCards || []).length}/${KH.questions.length}`;

        if (document.getElementById("players-overlay").classList.contains("show")) {
            KH.overlays.renderPlayers(data);
        }
        if (document.getElementById("secret-vote-overlay").classList.contains("show")) {
            KH.overlays.renderSecretVote(data);
        }

        const votePanel = document.getElementById("vote-panel");
        const resultsPanel = document.getElementById("results-panel");
        updateModeratorControls(data);

        if (data.status !== "results") state.lastRevealedStatus = false;

        if (data.status === "playing") {
            document.querySelector(".card-container").classList.remove("panel-active");
            votePanel.classList.remove("show");
            resultsPanel.classList.remove("show");
            if (data.currentCard && !state.isShuffling) renderStaticCard(data.currentCard);
        } else if (data.status === "shuffling") {
            document.querySelector(".card-container").classList.remove("panel-active");
            votePanel.classList.remove("show");
            resultsPanel.classList.remove("show");
            if (!state.isShuffling && data.shuffleSignal) {
                KH.gameplay.handleShuffleSignal(data.shuffleSignal);
            }
        } else if (data.status === "voting") {
            renderVoting(data, playersCount);
        } else if (data.status === "results") {
            renderResults(data);
        }
    }

    KH.render = {
        cardHTML: getCardHTML,
        staticCard: renderStaticCard,
        updateUI
    };
})(window.KH = window.KH || {});
