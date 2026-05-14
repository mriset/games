(function (KH) {
    const nameRegex = /^[a-zA-Z]+$/;

    function copyInviteLink() {
        const state = KH.state;
        const url = `${window.location.origin}${window.location.pathname}?room=${state.myRoomCode}`;
        navigator.clipboard.writeText(url)
            .then(() => alert(`Link invite berhasil disalin!\n${url}`))
            .catch(error => alert(`Gagal menyalin link: ${error}`));
    }

    function generateRoomCode() {
        let result = "";
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < KH.config.roomCodeLength; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function getNameInput() {
        return document.getElementById("player-name").value.trim();
    }

    function resetCreateButton() {
        const button = document.getElementById("btn-create-room");
        if (!button) return;
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-plus"></i> Buat Room';
    }

    function resetJoinButton() {
        const button = document.getElementById("btn-join-room");
        if (!button) return;
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gabung Room';
    }

    function validateName(nameInput) {
        if (!nameInput) {
            alert("Masukkan nama dulu!");
            return false;
        }

        if (!nameRegex.test(nameInput)) {
            alert("Nama hanya boleh berisi huruf (A-Z), tanpa spasi, angka, atau karakter lain.");
            return false;
        }

        return true;
    }

    function createRoom() {
        KH.audio.init();

        const pin = prompt("Masukkan PIN untuk membuat room:");
        if (pin !== KH.config.createRoomPin) {
            alert("PIN salah!");
            return;
        }

        const nameInput = getNameInput();
        if (!validateName(nameInput)) return;

        const button = document.getElementById("btn-create-room");
        if (button) {
            button.disabled = true;
            button.textContent = "Menghubungkan...";
        }

        KH.state.myName = nameInput;
        verifyAndCreateRoom();
    }

    function verifyAndCreateRoom() {
        const state = KH.state;
        state.myRoomCode = generateRoomCode();

        KH.db.ref(`rooms/${state.myRoomCode}`).once("value", snapshot => {
            if (snapshot.exists()) {
                verifyAndCreateRoom();
                return;
            }

            state.isModerator = true;
            state.roomRef = KH.db.ref(`rooms/${state.myRoomCode}`);
            state.roomRef.set({
                moderator: state.myPlayerId,
                status: "lobby",
                players: {
                    [state.myPlayerId]: { name: state.myName }
                }
            }).then(() => {
                KH.session.save();
                listenToRoom();
            }).catch(error => {
                resetCreateButton();
                alert(`Gagal buat room: ${error.message}`);
            });
        });
    }

    function joinRoom() {
        KH.audio.init();

        const state = KH.state;
        const nameInput = getNameInput();
        const codeInput = document.getElementById("room-code-input").value.trim().toUpperCase();

        if (!validateName(nameInput)) return;
        if (!codeInput || codeInput.length !== KH.config.roomCodeLength) {
            alert(`Kode room tidak valid! Harus ${KH.config.roomCodeLength} huruf.`);
            return;
        }

        const button = document.getElementById("btn-join-room");
        if (button) {
            button.disabled = true;
            button.textContent = "Menghubungkan...";
        }

        KH.db.ref(`rooms/${codeInput}`).once("value", snapshot => {
            if (!snapshot.exists()) {
                alert("Room tidak ditemukan!");
                resetJoinButton();
                return;
            }

            const data = snapshot.val();
            const players = data.players || {};
            const playerCount = Object.keys(players).length;

            if (!players[state.myPlayerId]) {
                const existingNames = Object.values(players).map(player => player.name.toLowerCase());
                if (existingNames.includes(nameInput.toLowerCase())) {
                    alert(`Nama "${nameInput}" sudah dipakai pemain lain. Pilih nama berbeda.`);
                    resetJoinButton();
                    return;
                }

                if (playerCount >= KH.config.maxPlayers) {
                    alert(`Room sudah penuh! Maksimal ${KH.config.maxPlayers} pemain.`);
                    resetJoinButton();
                    return;
                }

                if (data.status === "voting") {
                    state.skippedVoteStart = data.vote?.startTime;
                }
            }

            state.myName = nameInput;
            state.myRoomCode = codeInput;
            state.isModerator = false;
            state.roomRef = KH.db.ref(`rooms/${state.myRoomCode}`);
            state.playerRef = state.roomRef.child(`players/${state.myPlayerId}`);

            state.playerRef.set({ name: state.myName }).then(() => {
                KH.session.save();
                listenToRoom();
            }).catch(error => {
                alert(`Gagal gabung room: ${error.message}`);
                resetJoinButton();
            });
        });
    }

    function resetToHome() {
        const state = KH.state;

        if (state.roomRef) state.roomRef.off();
        state.roomRef = null;
        state.playerRef = null;
        state.myRoomCode = "";
        state.isModerator = false;
        state.currentRoomData = null;
        KH.session.clear();
        KH.dom.showScreen("home-screen");
        resetCreateButton();
        resetJoinButton();
    }

    function leaveRoom() {
        const state = KH.state;

        if (state.roomRef) {
            if (state.isModerator) {
                state.roomRef.remove();
            } else if (state.playerRef) {
                state.playerRef.remove();
            }
        }

        resetToHome();
    }

    function confirmLeave() {
        const state = KH.state;
        if (state.isModerator) {
            if (!confirm("Kamu adalah Moderator. Keluar akan MENUTUP ROOM dan mengeluarkan semua pemain. Yakin?")) return;
        } else if (!confirm("Yakin mau keluar dari room?")) {
            return;
        }

        leaveRoom();
    }

    function listenToRoom() {
        const state = KH.state;

        state.roomRef.on("value", snapshot => {
            const data = snapshot.val();
            if (!data) {
                alert("Room telah ditutup!");
                resetToHome();
                return;
            }

            if (!state.isModerator && data.kickedPlayers && data.kickedPlayers[state.myPlayerId]) {
                alert("Kamu telah di-kick dari room oleh Moderator.");
                KH.session.clear();
                state.roomRef.off();
                state.roomRef = null;
                state.playerRef = null;
                state.myRoomCode = "";
                state.currentRoomData = null;
                KH.dom.showScreen("home-screen");
                resetJoinButton();
                return;
            }

            if (!data.players || !data.players[data.moderator]) {
                alert("Moderator keluar. Room ditutup.");
                if (!state.isModerator && state.playerRef) state.playerRef.remove();
                resetToHome();
                return;
            }

            state.isModerator = data.moderator === state.myPlayerId;
            state.currentRoomData = data;
            KH.render.updateUI(data);
        });
    }

    function kickPlayer(playerId, name) {
        const state = KH.state;
        if (!state.isModerator) return;
        if (!confirm(`Kick "${name}" dari room?`)) return;

        state.roomRef.child(`kickedPlayers/${playerId}`).set(true);
        state.roomRef.child(`players/${playerId}`).remove();
        state.roomRef.child(`vote/votes/${playerId}`).remove();

        const overlay = document.getElementById("players-overlay");
        if (overlay.classList.contains("show")) {
            KH.overlays.togglePlayers();
        }
    }

    function restoreSession() {
        const state = KH.state;
        const saved = state.saved;
        if (!saved || !saved.roomCode) return;

        KH.db.ref(`rooms/${saved.roomCode}`).once("value", snapshot => {
            if (!snapshot.exists()) {
                KH.session.clear();
                return;
            }

            const data = snapshot.val();
            if (data.kickedPlayers && data.kickedPlayers[saved.pid]) {
                KH.session.clear();
                return;
            }

            state.myRoomCode = saved.roomCode;
            state.isModerator = data.moderator === saved.pid;
            state.roomRef = KH.db.ref(`rooms/${state.myRoomCode}`);

            if (!state.isModerator) {
                state.playerRef = state.roomRef.child(`players/${state.myPlayerId}`);
                state.playerRef.set({ name: state.myName });
            }

            listenToRoom();
            KH.render.updateUI(data);
        });
    }

    KH.room = {
        copyInviteLink,
        createRoom,
        joinRoom,
        resetToHome,
        leaveRoom,
        confirmLeave,
        listenToRoom,
        kickPlayer,
        restoreSession
    };
})(window.KH = window.KH || {});
