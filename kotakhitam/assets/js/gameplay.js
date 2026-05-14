(function (KH) {
    function startGame() {
        const state = KH.state;
        if (!state.isModerator) return;

        state.roomRef.update({
            status: "playing",
            usedCards: [],
            currentCard: {
                level: 0,
                text: "Gunakan tombol ACAK KARTU di bawah untuk membagikan kartu pertama."
            }
        });
    }

    function triggerShuffle() {
        const state = KH.state;
        if (!state.isModerator || state.isShuffling) return;
        if (!state.currentRoomData || state.currentRoomData.status !== "playing") return;

        KH.audio.init();

        let usedCards = state.currentRoomData.usedCards || [];
        let availableDeck = KH.questions.filter(question => !usedCards.includes(question.text));

        if (!availableDeck.length) {
            alert("Semua kartu sudah dimainkan! Mengacak ulang deck.");
            availableDeck = KH.questions;
            usedCards = [];
        }

        const randomCard = availableDeck[Math.floor(Math.random() * availableDeck.length)];
        usedCards.push(randomCard.text);

        state.roomRef.update({
            status: "shuffling",
            usedCards,
            shuffleSignal: {
                id: `sig_${Math.random().toString(36).substr(2, 9)}`,
                startAt: firebase.database.ServerValue.TIMESTAMP,
                card: {
                    text: randomCard.text,
                    level: randomCard.level,
                    isIntro: false
                }
            }
        });
    }

    function handleShuffleSignal(signal) {
        const state = KH.state;
        if (state.lastProcessedShuffleSignalId === signal.id) return;
        state.lastProcessedShuffleSignalId = signal.id;

        KH.audio.init();

        const cardElement = document.getElementById("hp-card-view");
        const nextButton = document.getElementById("btn-next");

        state.isShuffling = true;
        cardElement.classList.add("animate-shuffle");
        if (nextButton) nextButton.disabled = true;

        const localStart = Date.now();
        const interval = setInterval(() => {
            const randomCard = KH.questions[Math.floor(Math.random() * KH.questions.length)];
            cardElement.className = `card-hp lvl-${randomCard.level}`;
            cardElement.innerHTML = KH.render.cardHTML(randomCard.level, randomCard.text);
            KH.audio.tick();

            if (Date.now() - localStart >= KH.config.shuffleDuration) {
                clearInterval(interval);

                cardElement.classList.remove("animate-shuffle");
                cardElement.classList.remove("animate-pop");
                void cardElement.offsetWidth;
                cardElement.className = `card-hp lvl-${signal.card.level} animate-pop`;
                cardElement.innerHTML = KH.render.cardHTML(signal.card.level, signal.card.text);

                KH.audio.stop();

                state.isShuffling = false;
                if (nextButton) nextButton.disabled = false;

                if (state.isModerator && state.currentRoomData && state.currentRoomData.status === "shuffling") {
                    state.roomRef.update({
                        status: "playing",
                        currentCard: signal.card
                    });
                }
            }
        }, KH.config.shuffleSpeed);
    }

    function startVote() {
        const state = KH.state;
        if (!state.isModerator || state.currentRoomData.status !== "playing") return;

        state.roomRef.update({
            status: "voting",
            vote: {
                active: true,
                votes: {},
                startTime: firebase.database.ServerValue.TIMESTAMP
            }
        });
    }

    function submitVote(choice) {
        const state = KH.state;
        if (state.currentRoomData.status !== "voting") return;

        KH.audio.vote();
        state.roomRef.child(`vote/votes/${state.myPlayerId}`).set(choice);
    }

    function revealResults(force = false) {
        const state = KH.state;
        if (!state.isModerator) return;

        const playersCount = state.currentRoomData.players ? Object.keys(state.currentRoomData.players).length : 0;
        const votesCount = state.currentRoomData.vote && state.currentRoomData.vote.votes
            ? Object.keys(state.currentRoomData.vote.votes).length
            : 0;

        if (!force && votesCount < playersCount) return;
        state.roomRef.update({ status: "results" });
    }

    function resetVote() {
        const state = KH.state;
        if (!state.isModerator) return;

        state.roomRef.update({
            status: "playing",
            vote: null
        });
    }

    KH.gameplay = {
        startGame,
        triggerShuffle,
        handleShuffleSignal,
        startVote,
        submitVote,
        revealResults,
        resetVote
    };
})(window.KH = window.KH || {});
