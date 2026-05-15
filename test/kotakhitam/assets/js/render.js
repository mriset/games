(function (KH) {
    const { dom } = KH;

    function getCardHTML(level, text) {
        let label = "RINGAN";
        let symbol = "✦";
        let iconClass = "fa-solid fa-quote-left";
        if (level === 2) { iconClass = "fa-solid fa-user-secret"; label = "MENENGAH"; symbol = "✦✦"; }
        else if (level === 3) { iconClass = "fa-solid fa-fire"; label = "BERANI"; symbol = "✦✦✦"; }
        else if (level === 4) { iconClass = "fa-solid fa-bomb"; label = "GELAP"; symbol = "✦✦✦✦"; }
        else if (level === 5) { iconClass = "fa-solid fa-skull-crossbones"; label = "TABU"; symbol = "✦✦✦✦✦"; }

        return `
            <div class="card-gradient"></div>
            <div class="card-content-wrapper">
                <div class="q-top">
                    <span class="q-level-badge">${symbol} ${label}</span>
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
                    ${isMod ? '<i class="fa-solid fa-crown crown-icon"></i>' : '<span class="waiting-dot"></span>'}
                    ${showKick ? `<button class="btn-kick" data-action="kick-player" data-player-id="${playerId}" data-player-name="${dom.escapeHTML(player.name)}">KICK</button>` : ""}
                </span>
            `;
            playerList.appendChild(item);
        });

        const modControls = document.getElementById("mod-lobby-controls");
        modControls.classList.toggle("is-visible", state.isModerator);

        const progressBar = document.getElementById("lobby-progress-bar");
        if (progressBar) {
            const minPlayers = KH.config.minPlayersToStart || 3;
            const progress = Math.min(100, (playersCount / minPlayers) * 100);
            progressBar.style.width = `${progress}%`;
        }

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
        
        const btnYa = document.getElementById("btn-vote-ya");
        const btnTidak = document.getElementById("btn-vote-tidak");
        const confirmYa = document.getElementById("vote-confirm-ya");
        const confirmTidak = document.getElementById("vote-confirm-tidak");

        btnYa.disabled = !!myVote || joinedMidVote;
        btnTidak.disabled = !!myVote || joinedMidVote;
        
        btnYa.classList.toggle("vote-btn-chosen", myVote === "yes");
        btnTidak.classList.toggle("vote-btn-chosen", myVote === "no");
        
        if (confirmYa) confirmYa.classList.toggle("show", myVote === "yes");
        if (confirmTidak) confirmTidak.classList.toggle("show", myVote === "no");
    }

    function animateCountUp(elementId, targetValue, duration = 800) {
        const element = document.getElementById(elementId);
        if (!element) return;
        const startValue = 0;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            const currentVal = Math.round(startValue + (targetValue - startValue) * ease);
            
            element.textContent = `${currentVal} Orang`;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = `${targetValue} Orang`;
            }
        }
        
        requestAnimationFrame(update);
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

        const totalVotes = yesCount + noCount;
        const yesPercent = totalVotes ? (yesCount / totalVotes) * 100 : 0;
        const noPercent = totalVotes ? (noCount / totalVotes) * 100 : 0;

        const barYa = document.getElementById("res-bar-ya");
        const barTidak = document.getElementById("res-bar-tidak");
        const itemYa = document.getElementById("res-item-ya");
        const itemTidak = document.getElementById("res-item-tidak");

        if (barYa && barTidak) {
            barYa.style.setProperty('--fill-width', `${yesPercent}%`);
            barTidak.style.setProperty('--fill-width', `${noPercent}%`);
            
            barYa.style.animation = 'none';
            barTidak.style.animation = 'none';
            void barYa.offsetWidth; // trigger reflow
            barYa.style.animation = 'resultBarFill var(--duration-reveal) var(--ease-out) forwards';
            barTidak.style.animation = 'resultBarFill var(--duration-reveal) var(--ease-out) forwards';
        }

        if (itemYa && itemTidak) {
            itemYa.classList.toggle("win", yesCount > noCount);
            itemTidak.classList.toggle("win", noCount > yesCount);
        }

        animateCountUp("res-ya", yesCount);
        animateCountUp("res-tidak", noCount);
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
