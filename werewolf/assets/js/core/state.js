        // ==================== FIREBASE CONFIG AND INIT ====================
        // GANTI CONFIG INI DENGAN CONFIG DARI FIREBASE CONSOLE PROJECT KAMU!
        const firebaseConfig = {
            apiKey: "AIzaSyBiFLIVROIksZMPS5kl3-ijiNnD6G1L8Lk",
            authDomain: "wwonline-e773c.firebaseapp.com",
            databaseURL: "https://wwonline-e773c-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "wwonline-e773c",
            storageBucket: "wwonline-e773c.firebasestorage.app",
            messagingSenderId: "399653834294",
            appId: "1:399653834294:web:42b78b940a4d3512e29297",
            measurementId: "G-BCRC7M0Q7T"
        };

        let db = null;
        let onlineRoomCode = null;
        let roomPlayersRef = null;
        let roomMetaRef = null;
        let timerRef = null;
        let roomVotesRef = null;
        let onlineVotesCache = {};
        window.werewolfFirebaseServerTimeOffset = 0;
        window.getWerewolfSyncedNow = function () {
            return Date.now() + (window.werewolfFirebaseServerTimeOffset || 0);
        };

        if (Object.keys(firebaseConfig).length > 0) {
            try {
                firebase.initializeApp(firebaseConfig);
                db = firebase.database();
                
                // Connection state listener
                db.ref(".info/connected").on("value", (snap) => {
                    if (snap.val() === true) {
                        console.log("Firebase Connected");
                    } else {
                        console.warn("Firebase Disconnected");
                    }
                });
                db.ref(".info/serverTimeOffset").on("value", (snap) => {
                    window.werewolfFirebaseServerTimeOffset = snap.val() || 0;
                });
            } catch (e) {
                console.error("Firebase init error:", e);
            }
        } else {
            console.warn("Firebase tidak terkonfigurasi. Online Mode tidak akan berjalan. Cek konfigurasi Firebase di file HTML.");
        }

        // ==================== GAME STATE ====================
        function createInitialState(overrides = {}) {
            const base = {
            phase: 'setup', // setup, night, day, gameover
            day: 1,
            nightPhase: 0,
            isPaused: false,
            players: [],
            roles: {},
            votes: {},
            onlineManualVotes: {},
            wolfTeam: [],
            couples: [],
            witchPotions: { heal: true, poison: true },
            guardLastProtect: null,
            hunterShot: false,
            nightLog: [],
            dayLog: [],
            nightKills: [],
            nightDeathDetails: {},
            eliminatedPlayers: [],
            winner: null,
            started: false,
            rolesSubmitted: false,
            _onlineVoteOpenedDay: null,
            veteranAlertsLeft: 2,
            doppelgangerTarget: null,
            toughGuyPendingDeath: null,
            wolfCubKilledThisDay: false,
            wolfCubDoubleKillActive: false,
            infectorUsed: false,
            survivorVestUsed: false,
            cultMembers: [],
            vampireTeam: [],
            bountyHunterTarget: null,
            drunkPoisonedWolf: false,
            apprenticeSeerActivated: false,
            huntersApprenticeActivated: false,
            troublemakerUsed: false,
            thiefStolen: null,
            amnesiacChosen: false,
            nightState: {
                wolfKillTarget: null,
                alphaKillTarget: null,
                skKillTarget: null,
                guardProtectTarget: null,
                bodyguardProtectTarget: null,
                witchHealTarget: null,
                witchPoisonTarget: null,
                veteranIsAlert: false,
                wizardSilenceTarget: null,
                infectorInfectId: null,
                tavernKeeperBlockId: null,
                trackerTargetId: null,
                trackerVisitResultId: null,
                auraSeerTargetId: null,
                sorcererTargetId: null,
                whiteWolfKillId: null,
                cultLeaderRecruitId: null,
                vampireKillId: null,
                survivorVestActivated: false,
                gravediggerInfoShown: false,
                wolfKillId2: null
            }
            };
            return Object.assign(base, overrides);
        }

        function createInitialNightState(overrides = {}) {
            return Object.assign(createInitialState().nightState, overrides);
        }

        let gameState = createInitialState();

        // ==================== PERSISTENCE ====================
        const SAVE_KEY = 'werewolf_moderator_state';

        function saveState() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
                if (onlineRoomCode) {
                    localStorage.setItem('werewolf_online_room', onlineRoomCode);
                }
            } catch (e) {
                // Quota exceeded or private mode — silently ignore
            }
            if (onlineRoomCode) {
                pushGameStateToFirebase();
            }
        }

        // ==================== FIREBASE ONLINE MODE ====================
        function generateRoomCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        const CREATE_ROOM_PIN = '183729';

        function verifyCreateRoomPin() {
            const modal = document.getElementById('modalCreateRoomPin');
            const input = document.getElementById('createRoomPinInput');
            const error = document.getElementById('createRoomPinError');
            const okBtn = document.getElementById('createRoomPinOkBtn');
            const cancelBtn = document.getElementById('createRoomPinCancelBtn');
            const cancelActionBtn = document.getElementById('createRoomPinCancelActionBtn');

            if (!modal || !input || !okBtn || !cancelBtn || !cancelActionBtn) {
                const pin = window.prompt('Masukkan PIN untuk membuat room:');
                if (pin === null) return Promise.resolve(false);
                const valid = String(pin).trim() === CREATE_ROOM_PIN;
                if (!valid) showToast('PIN salah. Room tidak dibuat.', 'error');
                return Promise.resolve(valid);
            }

            return new Promise(resolve => {
                input.value = '';
                if (error) error.textContent = '';

                const cleanup = (result) => {
                    okBtn.removeEventListener('click', onOk);
                    cancelBtn.removeEventListener('click', onCancel);
                    cancelActionBtn.removeEventListener('click', onCancel);
                    input.removeEventListener('keydown', onKeydown);
                    closeModal('modalCreateRoomPin');
                    resolve(result);
                };
                const onOk = () => {
                    if (String(input.value).trim() !== CREATE_ROOM_PIN) {
                        if (error) error.textContent = 'PIN salah. Room tidak dibuat.';
                        showToast('PIN salah. Room tidak dibuat.', 'error');
                        input.select();
                        return;
                    }
                    cleanup(true);
                };
                const onCancel = () => cleanup(false);
                const onKeydown = (event) => {
                    if (event.key === 'Enter') onOk();
                    if (event.key === 'Escape') onCancel();
                };

                okBtn.addEventListener('click', onOk);
                cancelBtn.addEventListener('click', onCancel);
                cancelActionBtn.addEventListener('click', onCancel);
                input.addEventListener('keydown', onKeydown);
                openModal('modalCreateRoomPin');
                setTimeout(() => input.focus(), 80);
            });
        }

        async function createOnlineRoom(skipPinCheck = false) {
            if (!skipPinCheck && !(await verifyCreateRoomPin())) return;

            if (!db) {
                return showToast('Firebase belum terkonfigurasi!', 'error');
            }
            onlineRoomCode = generateRoomCode();
            attachRoomListeners(onlineRoomCode);
            saveState();
        }

        function attachRoomListeners(code) {
            onlineRoomCode = code;
            roomMetaRef = db.ref(`rooms/${onlineRoomCode}/meta`);
            roomPlayersRef = db.ref(`rooms/${onlineRoomCode}/players`);
            timerRef = db.ref(`rooms/${onlineRoomCode}/timer`);
            if (roomVotesRef) roomVotesRef.off();
            roomVotesRef = db.ref(`rooms/${onlineRoomCode}/votes`);

            // Register/Update room info
            roomMetaRef.update({
                phase: gameState.phase,
                day: gameState.day,
                gameStarted: gameState.started,
                rolesSubmitted: !!gameState.rolesSubmitted,
                isPaused: !!gameState.isPaused,
                voteOpen: isOnlineVotingOpenForCurrentDay(),
                announcement: buildAnnouncement('info', 'Room Dibuka', 'Selamat datang di Room Werewolf!'),
                voteSummary: null,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                console.log("Room meta updated in Firebase");
            }).catch(err => {
                console.error("Firebase Room Meta Error:", err);
                alert("Gagal koneksi ke Firebase: " + err.message + "\n\nPeriksa apakah Realtime Database sudah di-enable dan Rules-nya 'public'.");
            });

            roomVotesRef.on('value', snapshot => {
                onlineVotesCache = snapshot.val() || {};
                applyOnlineVotes(onlineVotesCache);
            });

            // Listen to joined players
            roomPlayersRef.on('child_added', snapshot => {
                const pd = snapshot.val();
                const pId = snapshot.key; // We use the push key as player ID

                // Cek apakah pemain sudah ada
                if (!gameState.players.find(p => p.id === pId)) {
                    gameState.players.push({
                        id: pId,
                        name: pd.name,
                        role: null,
                        alive: true,
                        eliminated: false,
                        notes: ''
                    });
                    renderPlayers();
                    updateStats();
                    initRoleDistribution();
                    showToast(`${pd.name} bergabung ke room!`, 'success');
                    saveState();
                }
            });

            // Update UI
            const onlineModeSetup = document.getElementById('onlineModeSetup');
            const onlineModeActive = document.getElementById('onlineModeActive');
            const roomCodeDisplay = document.getElementById('roomCodeDisplay');
            const roomLinkDisplay = document.getElementById('roomLinkDisplay');

            if (onlineModeSetup) onlineModeSetup.style.display = 'none';
            if (onlineModeActive) onlineModeActive.style.display = 'block';
            if (roomCodeDisplay) roomCodeDisplay.textContent = onlineRoomCode;
	            
            const fullUrl = buildJoinRoomUrl(onlineRoomCode);
	            
            if (roomLinkDisplay) roomLinkDisplay.textContent = fullUrl;
            renderRoomShareWarning(fullUrl);

            showToast('Mode Online Aktif!', 'success');
        }

        function copyRoomCode() {
            const code = onlineRoomCode || '';
            navigator.clipboard.writeText(code).then(() => {
                showToast('Kode room berhasil disalin!', 'success');
            });
        }

        function copyRoomLink() {
            const url = buildJoinRoomUrl(onlineRoomCode);
            navigator.clipboard.writeText(`Ayo main Werewolf! Join di sini:\n${url}`).then(() => {
                showToast('Link berhasil disalin!', 'success');
            });

        }

        function buildJoinRoomUrl(code) {
            const url = new URL(window.location.href);
            if (url.pathname.endsWith('/')) {
                url.pathname += 'index.html';
            } else if (!/index\.html$/i.test(url.pathname)) {
                url.pathname = url.pathname.replace(/\/?$/, '/index.html');
            }
            url.search = '';
            url.hash = '';
            url.searchParams.set('mode', 'join');
            url.searchParams.set('room', code);
            return url.toString();
        }

        function renderRoomShareWarning(urlText) {
            const warning = document.getElementById('roomShareWarning');
            if (!warning) return;
            warning.style.display = 'none';
            warning.textContent = '';
        }

        function buildAnnouncement(type, title, message, extras = {}) {
            return {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type,
                title,
                message,
                day: gameState.day,
                phase: gameState.phase,
                createdAt: window.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
                ...extras
            };
        }

        function pushAnnouncement(type, title, message, extras = {}) {
            if (!db || !onlineRoomCode || !roomMetaRef) return;
            roomMetaRef.update({
                announcement: buildAnnouncement(type, title, message, extras)
            }).catch(err => console.error('Firebase announcement error:', err));
        }

        function pushVoteSummaryToFirebase(snapshot = buildOnlineVoteSnapshot()) {
            if (!db || !onlineRoomCode || !roomMetaRef) return;
            const leader = snapshot.leaders?.[0] || snapshot.results?.[0] || null;
            roomMetaRef.update({
                voteSummary: {
                    day: snapshot.day,
                    votedCount: snapshot.votedCount,
                    totalVoters: snapshot.totalVoters,
                    leaderName: leader?.name || '',
                    leaderCount: leader?.count || 0
                }
            }).catch(err => console.error('Firebase vote summary error:', err));
        }

        function isOnlineVotingOpenForCurrentDay() {
            return !!(
                gameState.started &&
                gameState.phase === 'day' &&
                !gameState.isPaused &&
                gameState._onlineVoteOpenedDay === gameState.day &&
                gameState._onlineVoteLockedDay !== gameState.day
            );
        }

        function stopOnlineRoomListeners() {
            if (roomPlayersRef) roomPlayersRef.off();
            if (roomMetaRef) roomMetaRef.off();
            if (timerRef) timerRef.off();
            if (roomVotesRef) roomVotesRef.off();
        }

        function resetOnlineRoomUi() {
            const onlineModeSetup = document.getElementById('onlineModeSetup');
            const onlineModeActive = document.getElementById('onlineModeActive');
            if (onlineModeSetup) onlineModeSetup.style.display = 'block';
            if (onlineModeActive) onlineModeActive.style.display = 'none';
        }

        async function closeOnlineRoomData() {
            const codeToRemove = onlineRoomCode || localStorage.getItem('werewolf_online_room');

            if (!db || !codeToRemove) return;

            try {
                const roomRef = db.ref(`rooms/${codeToRemove}`);
                await roomRef.child('meta').update({
                    closed: true,
                    closedReason: 'moderator_deleted_session',
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                });
                await roomRef.remove();
                console.log("Room deleted from Firebase");
            } catch (err) {
                console.error("Error deleting room:", err);
                throw err;
            }

            stopOnlineRoomListeners();
            onlineRoomCode = null;
            roomPlayersRef = null;
            roomMetaRef = null;
            timerRef = null;
            roomVotesRef = null;
            onlineVotesCache = {};
            localStorage.removeItem('werewolf_online_room');
        }

        function disconnectRoom() {
            if (!onlineRoomCode) return;

            showConfirm('Tutup Room', 'Tutup room online dan hapus semua data dari database?', 'Tutup & Hapus', true, async () => {
                try {
                    await closeOnlineRoomData();
                    resetOnlineRoomUi();
                    showToast('Room telah ditutup dan dihapus.', 'info');
                } catch (err) {
                    showToast('Gagal menutup room: ' + err.message, 'error');
                }
            });
        }

        function pushGameStateToFirebase() {
            if (!db || !onlineRoomCode) return;
            try {
                // Update Meta
                db.ref(`rooms/${onlineRoomCode}/meta`).update({
                    phase: gameState.phase,
                    day: gameState.day,
                    gameStarted: gameState.started,
                    rolesSubmitted: !!gameState.rolesSubmitted,
                    isPaused: !!gameState.isPaused,
                    voteOpen: isOnlineVotingOpenForCurrentDay()
                });

                // Update players (only the ones present locally)
                const updates = {};
                gameState.players.forEach(p => {
                    updates[p.id] = {
                        name: p.name,
                        role: p.role,
                        alive: p.alive,
                        eliminated: p.eliminated,
                        _idiotRevealed: !!p._idiotRevealed,
                        _mayorRevealed: !!p._mayorRevealed
                    };
                });
                // Note: ini tidak menghapus pemain yang terputus, dsb
                // untuk kemudahan.
                roomPlayersRef.update(updates);
            } catch (e) {
                console.error("Firebase sync error: ", e);
            }
        }

        function pushTimerStateToFirebase() {
            if (!db || !onlineRoomCode) return;
            try {
                timerRef.set({
                    running: _timerRunning,
                    status: _timerStatus || (_timerRunning ? 'running' : 'ready'),
                    duration: _timerOriginal,
                    secondsLeft: _timerSeconds,
                    endsAt: _timerRunning ? _timerEndsAt : null,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (e) {
                console.error("Firebase timer sync error: ", e);
            }
        }

        function loadState() {
            try {
                const raw = localStorage.getItem(SAVE_KEY);
                if (!raw) return false;
                const saved = JSON.parse(raw);
                // Merge into gameState so any new fields from code updates have defaults
                gameState = Object.assign(createInitialState(), saved);
                // Restore nested nightState safely
                if (saved.nightState) {
                    gameState.nightState = Object.assign(createInitialNightState(), saved.nightState);
                }
                return true;
            } catch (e) {
                localStorage.removeItem(SAVE_KEY);
                return false;
            }
        }

        function clearSavedState() {
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem('werewolf_online_room');
        }

        async function deleteSavedSessionAndReload() {
            try {
                await closeOnlineRoomData();
            } catch (err) {
                console.error('Failed closing online room while deleting session:', err);
                showToast('Sesi lokal dihapus, tapi room online gagal ditutup: ' + err.message, 'warning');
            } finally {
                clearSavedState();
                location.reload();
            }
        }

        function applyOnlineVotes(votesByDay) {
            if (!onlineRoomCode || !gameState.started || gameState.phase !== 'day') return;

            const nextVotes = buildOnlineVoteSnapshot(votesByDay).tally;
            gameState.votes = nextVotes;
            pushVoteSummaryToFirebase(buildOnlineVoteSnapshot(votesByDay));
            renderVoteGrid();
            renderVoteResults();
        }

        function buildOnlineVoteSnapshot(votesByDay = onlineVotesCache || {}) {
            const dayVotes = votesByDay?.[gameState.day] || {};
            const eligiblePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);
            const eligibleIds = new Set(eligiblePlayers.map(p => String(p.id)));
            const playerById = new Map(gameState.players.map(p => [String(p.id), p]));
            const manualVotes = gameState.onlineManualVotes?.[gameState.day] || {};
            const tally = {};
            const ballots = [];
            const manualBallots = [];
            const votedIds = new Set();

            Object.entries(dayVotes).forEach(([voterId, ballot]) => {
                const voter = playerById.get(String(voterId));
                const target = playerById.get(String(ballot?.targetId));
                if (!voter || !target) return;
                if (!voter.alive || voter._idiotRevealed) return;
                if (String(voter.id) === String(target.id)) return;
                if (!eligibleIds.has(String(target.id))) return;

                const weight = voter.role === 'Mayor' && voter._mayorRevealed ? 2 : 1;
                votedIds.add(String(voter.id));
                tally[target.name] = (tally[target.name] || 0) + weight;
                ballots.push({
                    voterId: String(voter.id),
                    voterName: voter.name,
                    targetId: String(target.id),
                    targetName: target.name,
                    weight
                });
            });

            Object.entries(manualVotes).forEach(([targetId, rawCount]) => {
                const target = playerById.get(String(targetId));
                const count = Number(rawCount) || 0;
                if (!target || count <= 0) return;
                if (!eligibleIds.has(String(target.id))) return;

                tally[target.name] = (tally[target.name] || 0) + count;
                manualBallots.push({
                    targetId: String(target.id),
                    targetName: target.name,
                    count
                });
            });

            const missing = eligiblePlayers
                .filter(p => !votedIds.has(String(p.id)))
                .map(p => ({ id: String(p.id), name: p.name }));
            const results = Object.entries(tally)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
            const maxVotes = results.length ? results[0].count : 0;
            const leaders = results.filter(r => r.count === maxVotes && maxVotes > 0);

            return {
                day: gameState.day,
                tally,
                ballots,
                manualBallots,
                missing,
                results,
                maxVotes,
                leaders,
                isTie: leaders.length > 1,
                totalVoters: eligiblePlayers.length,
                votedCount: ballots.length
            };
        }

        function showOnlineVoteToPlayers() {
            if (!db || !onlineRoomCode) return showToast('Mode online belum aktif.', 'warning');
            if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa ditampilkan saat fase siang.', 'warning');
            if (gameState.isPaused) return showToast('Game sedang dijeda. Lanjutkan game dulu untuk menampilkan voting.', 'warning');

            const snapshot = buildOnlineVoteSnapshot();
            if (snapshot.results.length === 0) return showToast('Belum ada vote yang masuk.', 'warning');

            roomMetaRef.update({
                publicVoteResult: {
                    day: snapshot.day,
                    results: snapshot.results,
                    leaders: snapshot.leaders,
                    maxVotes: snapshot.maxVotes,
                    isTie: snapshot.isTie,
                    shownAt: firebase.database.ServerValue.TIMESTAMP
                }
            }).then(() => {
                pushAnnouncement('vote', 'Hasil Voting', snapshot.isTie ? 'Voting sementara seri.' : `Voting terbanyak: ${snapshot.leaders[0]?.name || snapshot.results[0].name}`);
                showToast('Hasil voting ditampilkan ke pemain.', 'success');
            }).catch(err => showToast('Gagal menampilkan voting: ' + err.message, 'error'));
        }

        function startOnlineVoting() {
            if (!db || !onlineRoomCode) return showToast('Mode online belum aktif.', 'warning');
            if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa dimulai saat fase siang.', 'warning');
            if (gameState.isPaused) return showToast('Game sedang dijeda. Lanjutkan game dulu untuk memulai voting.', 'warning');

            gameState._onlineVoteOpenedDay = gameState.day;
            delete gameState._onlineVoteLockedDay;
            roomMetaRef.update({
                voteOpen: true,
                publicVoteResult: null,
                savedVoteResult: null,
                voteSummary: buildOnlineVoteSnapshot()
            }).then(() => {
                pushAnnouncement('vote', 'Voting Dimulai', 'Moderator sudah membuka voting pengusiran.');
                renderVoteGrid();
                renderVoteResults();
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
                } catch (e) {
                    // Ignore storage failures; Firebase already has the vote state.
                }
                showToast('Voting dibuka. Pemain sekarang bisa memilih dari console mereka.', 'success');
            }).catch(err => showToast('Gagal memulai voting: ' + err.message, 'error'));
        }

        function saveOnlineVoteResult() {
            if (!db || !onlineRoomCode) return showToast('Mode online belum aktif.', 'warning');
            if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa disimpan saat fase siang.', 'warning');
            if (gameState.isPaused) return showToast('Game sedang dijeda. Lanjutkan game dulu untuk menyimpan voting.', 'warning');

            const snapshot = buildOnlineVoteSnapshot();
            if (snapshot.results.length === 0) return showToast('Belum ada vote yang masuk.', 'warning');

            gameState.votes = snapshot.tally;
            gameState._onlineVoteLockedDay = gameState.day;
            roomMetaRef.update({
                voteOpen: false,
                savedVoteResult: {
                    day: snapshot.day,
                    tally: snapshot.tally,
                    results: snapshot.results,
                    leaders: snapshot.leaders,
                    maxVotes: snapshot.maxVotes,
                    isTie: snapshot.isTie,
                    savedAt: firebase.database.ServerValue.TIMESTAMP
                }
            }).then(() => {
                pushAnnouncement('vote', 'Voting Dikunci', 'Moderator sudah mengunci hasil voting hari ini.');
                renderVoteGrid();
                renderVoteResults();
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
                } catch (e) {
                    // Ignore storage failures; Firebase already has the saved vote.
                }
                showToast('Voting disimpan. Pemain tidak bisa mengubah vote lagi.', 'success');
            }).catch(err => showToast('Gagal menyimpan voting: ' + err.message, 'error'));
        }

        function clearOnlineVotesForCurrentDay() {
            if (!db || !onlineRoomCode) return;
            if (onlineVotesCache && onlineVotesCache[gameState.day]) {
                delete onlineVotesCache[gameState.day];
            }
            if (gameState.onlineManualVotes) {
                delete gameState.onlineManualVotes[gameState.day];
            }
            db.ref(`rooms/${onlineRoomCode}/votes/${gameState.day}`).remove().catch(err => {
                console.error('Firebase vote reset error:', err);
            });
            delete gameState._onlineVoteLockedDay;
            if (roomMetaRef) {
                roomMetaRef.update({
                    voteOpen: isOnlineVotingOpenForCurrentDay(),
                    publicVoteResult: null,
                    savedVoteResult: null,
                    voteSummary: null
                }).catch(err => console.error('Firebase vote meta reset error:', err));
            }
        }

        function refreshOnlineVotes() {
            applyOnlineVotes(onlineVotesCache || {});
        }

        const ROLE_DEFINITIONS = {
            'Werewolf': { name: 'Serigala Biasa', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Bangun tiap malam bersama kawanan, sepakat memilih 1 target untuk dicabik-cabik.', count: 0, priority: 1 },
            'Alpha Wolf': { name: 'Alpha Wolf', icon: '👑', category: 'wolf', team: 'Werewolf', description: 'Sekali seumur permainan, dapat memberikan gigitan maut, ATAU merekrut 1 pemain non-serigala untuk menjadi Werewolf.', count: 0, priority: 2 },
            'Lone Wolf': { name: 'Serigala Liar', icon: '🐺', category: 'villager', team: 'Villager', description: 'Dianggap sebagai Warga Biasa. Namun, jika ia diincar oleh Werewolf di malam hari, ia batal mati dan seketika berubah sepenuhnya menjadi Werewolf.', count: 0, priority: 3 },
            'Seer': { name: 'Sang Peramal', icon: '🔮', category: 'villager', team: 'Villager', description: 'Menunjuk 1 pemain tiap malam. Mengetahui secara pasti apakah targetnya faksi Serigala atau bukan.', count: 0, priority: 5 },
            'Guardian': { name: 'Sang Pelindung', icon: '🛡️', category: 'villager', team: 'Villager', description: 'Melindungi 1 pemain dari kematian di malam hari. Syarat: Tidak bisa melindungi orang yang sama dua malam berturut-turut.', count: 0, priority: 6 },
            'Witch': { name: 'Sang Penyihir', icon: '🧪', category: 'villager', team: 'Villager', description: 'Punya 1 Ramuan Hidup (menyelamatkan korban) dan 1 Ramuan Mati (membunuh). Masing-masing hanya bisa dipakai satu kali.', count: 0, priority: 7 },
            'Wizard': { name: 'Penyihir Agung', icon: '🧙', category: 'villager', team: 'Villager', description: 'Hingga 3x per permainan, bisa membungkam 1 pemain di malam hari. Target yang dibungkam tidak bisa menggunakan kemampuannya malam itu.', count: 0, priority: 8 },
            'Hunter': { name: 'Sang Pemburu', icon: '🏹', category: 'villager', team: 'Villager', description: 'Jika mati (dibunuh malam/digantung siang), berhak langsung menembak mati 1 pemain lain sebelum keluar.', count: 0, priority: 9 },
            'Veteran': { name: 'Sang Veteran', icon: '⚔️', category: 'villager', team: 'Villager', description: 'Punya jatah 2x "Siaga" di malam hari. Siapapun yang mengunjunginya dengan niat membunuh akan tertembak mati.', count: 0, priority: 10 },
            'Bodyguard': { name: 'Perisai Hidup', icon: '💂', category: 'villager', team: 'Villager', description: 'Melindungi 1 pemain. Jika target diserang, Bodyguard mati menggantikannya, TETAPI sang penyerang ikut mati seketika.', count: 0, priority: 11 },
            'Priest': { name: 'Sang Pendeta', icon: '⛪', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa menyiram Air Suci ke 1 pemain. Jika targetnya Serigala mati. Jika baik, Pendeta yang otomatis mati.', count: 0, priority: 12 },
            'Mayor': { name: 'Sang Walikota', icon: '🏛️', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa membuka identitasnya. Sejak saat itu, suaranya dihitung sebagai 2 vote dalam eksekusi.', count: 0, priority: 13 },
            'Sheriff': { name: 'Sang Sheriff', icon: '⭐', category: 'villager', team: 'Villager', description: 'Punya 1 peluru. Di siang hari, bisa menembak mati 1 pemain tanpa voting. Jika ia menembak orang baik, Sheriff bunuh diri.', count: 0, priority: 14 },
            'Jester': { name: 'Sang Badut', icon: '🃏', category: 'neutral', team: 'Neutral', description: 'Tujuan tunggalnya memanipulasi warga agar curiga padanya. Jika berhasil divote mati, ia langsung MENANG MUTLAK.', count: 0, priority: 15 },
            'Cupid': { name: 'Sang Pemikat', icon: '💕', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, merantai 2 pemain. Jika salah satu mati, pasangannya ikut mati karena patah hati.', count: 0, priority: 16 },
            'Doppelganger': { name: 'Sang Peniru', icon: '🎭', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, menunjuk 1 pemain. Begitu pemain itu mati, langsung mewarisi peran, faksi, dan kekuatannya.', count: 0, priority: 17 },
            'Serial Killer': { name: 'Pembunuh Berantai', icon: '🔪', category: 'neutral', team: 'Neutral', description: 'Bangun setiap malam sendirian untuk membunuh 1 orang. Kebal dari serangan Serigala. Menang jika jadi pemain terakhir.', count: 0, priority: 18 },
            'Idiot': { name: 'Si Pandir', icon: '😅', category: 'neutral', team: 'Neutral', description: 'Jika digantung di siang hari, ia batal mati, namun kehilangan hak suara (vote) selamanya.', count: 0, priority: 19 },
            'Prince': { name: 'Sang Pangeran', icon: '🤴', category: 'neutral', team: 'Neutral', description: 'Jika divote mati, identitasnya terbuka dan eksekusi batal. Tetap mempertahankan hak suaranya untuk hari berikutnya.', count: 0, priority: 20 },
            'Little Girl': { name: 'Gadis Kecil', icon: '👧', category: 'neutral', team: 'Neutral', description: 'Boleh membuka mata saat serigala berdiskusi. Jika ketahuan dan ditunjuk, ia langsung mati tanpa bisa dilindungi.', count: 0, priority: 21 },
            'Villager': { name: 'Warga Biasa', icon: '👥', category: 'villager', team: 'Villager', description: 'Tidak punya kemampuan gaib. Senjata murninya adalah logika, manipulasi argumen, dan hak suara di siang hari.', count: 0, priority: 22 },

            // === WOLF TEAM ===
            'Wolf Cub': { name: 'Anak Serigala', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Werewolf biasa yang sangat disayangi kawanannya. Jika mati dibunuh warga, kawanan dapat membunuh 2 orang malam berikutnya.', count: 0, priority: 4 },
            'Minion': { name: 'Kaki Tangan', icon: '🕵️', category: 'wolf', team: 'Werewolf', description: 'Manusia yang memihak Serigala. Tahu siapa saja Werewolf sejak awal, namun para Werewolf tidak tahu siapa dia.', count: 0, priority: 4.5 },
            'Sorcerer': { name: 'Penyihir Gelap', icon: '🧿', category: 'wolf', team: 'Werewolf', description: 'Menerawang setiap malam untuk mencari tahu siapa Seer asli. Tidak bangun bersama Werewolf.', count: 0, priority: 5.5 },
            'Infector': { name: 'Penginfeksi', icon: '🦠', category: 'wolf', team: 'Werewolf', description: '1x per game: mengubah korban serangan wolf menjadi Werewolf baru alih-alih membunuhnya.', count: 0, priority: 2.5 },
            'White Wolf': { name: 'Serigala Putih', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Bangun setiap malam bersama kawanan. Setiap dua malam sekali, terbangun sendirian untuk memangsa sesama Werewolf.', count: 0, priority: 3.5 },

            // === VILLAGER TEAM ===
            'Tough Guy': { name: 'Jagoan', icon: '💪', category: 'villager', team: 'Villager', description: 'Jika diserang Werewolf di malam hari, baru mati di malam berikutnya (masih hidup seharian penuh).', count: 0, priority: 22.5 },
            'Mason 1': { name: 'Pekerja Batuan 1', icon: '⛏️', category: 'villager', team: 'Villager', description: 'Di malam pertama membuka mata untuk melihat Mason 2. Keduanya saling memastikan 100% pihak warga.', count: 0, priority: 23 },
            'Mason 2': { name: 'Pekerja Batuan 2', icon: '⛏️', category: 'villager', team: 'Villager', description: 'Pasangan Mason 1. Di malam pertama membuka mata bersama Mason 1. Keduanya 100% terpercaya satu sama lain.', count: 0, priority: 23.5 },
            'Lycan': { name: 'Serigala Jinak', icon: '🐾', category: 'villager', team: 'Villager', description: 'Sepenuhnya memihak warga desa. Namun jika diterawang Seer, identitasnya terbaca sebagai Werewolf.', count: 0, priority: 22.8 },
            'Cursed': { name: 'Terkutuk', icon: '😈', category: 'villager', team: 'Villager', description: 'Jika diserang Werewolf, tidak mati melainkan langsung berubah menjadi Werewolf baru.', count: 0, priority: 22.9 },
            'Apprentice Seer': { name: 'Murid Peramal', icon: '🔮', category: 'villager', team: 'Villager', description: 'Begitu Seer asli mati, mewarisi bola kristalnya dan dapat menerawang setiap malam selanjutnya.', count: 0, priority: 23.1 },
            'Gravedigger': { name: 'Penggali Kubur', icon: '⚰️', category: 'villager', team: 'Villager', description: 'Di malam hari, diberi tahu Moderator apa peran asli pemain yang baru dieksekusi warga pada siang harinya.', count: 0, priority: 23.2 },
            'Drunk': { name: 'Pemabuk', icon: '🍺', category: 'villager', team: 'Villager', description: 'Jika digigit Werewolf, wolf tersebut keracunan dan kehilangan kemampuan membunuh malam berikutnya. Pemabuk tetap mati.', count: 0, priority: 22.7 },
            'Tavern Keeper': { name: 'Penjaga Kedai', icon: '🍻', category: 'villager', team: 'Villager', description: 'Setiap malam, memilih 1 pemain untuk diajak minum. Orang itu mabuk dan tidak bisa menggunakan kemampuannya malam itu.', count: 0, priority: 11.5 },
            'Aura Seer': { name: 'Peramal Aura', icon: '👁️', category: 'villager', team: 'Villager', description: 'Tidak bisa melihat role spesifik, tapi mengetahui faksi seseorang: Warga, Serigala, atau Netral.', count: 0, priority: 5.1 },
            'Martyr': { name: 'Martir', icon: '✝️', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa mengorbankan nyawanya untuk menyelamatkan pemain lain yang akan dieksekusi.', count: 0, priority: 23.3 },
            'Tracker': { name: 'Pelacak', icon: '🔍', category: 'villager', team: 'Villager', description: 'Memilih 1 orang malam hari. Moderator memberi tahu siapa yang dikunjungi orang tersebut malam itu.', count: 0, priority: 5.2 },
            'Hunters Apprentice': { name: 'Murid Pemburu', icon: '🏹', category: 'villager', team: 'Villager', description: 'Jika Hunter asli mati, dia mengambil senjatanya dan mendapat 1 peluru yang bisa ditembakkan kapan saja.', count: 0, priority: 9.5 },

            // === NEUTRAL TEAM ===
            'Amnesiac': { name: 'Hilang Ingatan', icon: '🌀', category: 'neutral', team: 'Neutral', description: 'Di malam ke-3, bisa memilih untuk mengambil alih 1 peran dari pemain yang sudah mati.', count: 0, priority: 21.5 },
            'Thief': { name: 'Pencuri', icon: '🎴', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, menukar kartu perannya dengan kartu milik pemain lain tanpa mereka sadari.', count: 0, priority: 16.5 },
            'Survivor': { name: 'Penyintas', icon: '🛡️', category: 'neutral', team: 'Neutral', description: 'Tujuannya hanya hidup sampai akhir. Punya 1 rompi pelindung kebal dari serangan (1x pakai).', count: 0, priority: 21.8 },
            'Cult Leader': { name: 'Pemimpin Sekte', icon: '🌑', category: 'neutral', team: 'Neutral', description: 'Setiap malam merekrut 1 anggota. Menang mandiri jika semua pemain hidup yang tersisa adalah anggota sektenya.', count: 0, priority: 21.9 },
            'Vampire': { name: 'Vampir', icon: '🧛', category: 'neutral', team: 'Neutral', description: 'Faksi ketiga yang memusuhi Desa dan Serigala. Membunuh 1 orang setiap malamnya secara mandiri.', count: 0, priority: 18.5 },
            'Troublemaker': { name: 'Pembuat Onar', icon: '🃏', category: 'neutral', team: 'Neutral', description: 'Satu kali di malam hari, menukar kartu peran dua pemain lain tanpa melihat kartunya.', count: 0, priority: 17.5 },
            'Bounty Hunter': { name: 'Pemburu Hadiah', icon: '🎯', category: 'neutral', team: 'Neutral', description: 'Di awal game, Moderator menunjuk 1 pemain secara acak sebagai target. Jika target itu digantung warga di siang hari, dia menang sendiri.', count: 0, priority: 20.5 }
        };

        const ROLE_LUCIDE_ICONS = {
            'Werewolf': 'paw-print',
            'Alpha Wolf': 'crown',
            'Lone Wolf': 'footprints',
            'Seer': 'eye',
            'Guardian': 'shield',
            'Witch': 'flask-conical',
            'Wizard': 'wand-sparkles',
            'Hunter': 'crosshair',
            'Veteran': 'medal',
            'Bodyguard': 'shield-plus',
            'Priest': 'church',
            'Mayor': 'landmark',
            'Sheriff': 'badge',
            'Jester': 'drama',
            'Cupid': 'heart',
            'Doppelganger': 'copy',
            'Serial Killer': 'skull',
            'Idiot': 'circle-help',
            'Prince': 'gem',
            'Little Girl': 'baby',
            'Villager': 'house',
            'Wolf Cub': 'paw-print',
            'Minion': 'handshake',
            'Sorcerer': 'sparkles',
            'Infector': 'biohazard',
            'White Wolf': 'moon',
            'Tough Guy': 'dumbbell',
            'Mason 1': 'hammer',
            'Mason 2': 'hammer',
            'Lycan': 'scan-eye',
            'Cursed': 'zap',
            'Apprentice Seer': 'graduation-cap',
            'Gravedigger': 'shovel',
            'Drunk': 'beer',
            'Tavern Keeper': 'cup-soda',
            'Aura Seer': 'radar',
            'Martyr': 'heart-handshake',
            'Tracker': 'route',
            'Hunters Apprentice': 'target',
            'Amnesiac': 'brain',
            'Thief': 'key-round',
            'Survivor': 'shield-check',
            'Cult Leader': 'users-round',
            'Vampire': 'droplet',
            'Troublemaker': 'shuffle',
            'Bounty Hunter': 'badge-dollar-sign'
        };

        function getRoleIconName(role) {
            return ROLE_LUCIDE_ICONS[role] || 'circle-dot';
        }

        function lucideIconMarkup(iconName, className = 'role-lucide-icon') {
            return `<span class="${className}" aria-hidden="true"><i data-lucide="${iconName || 'circle-dot'}"></i></span>`;
        }

        function roleIconMarkup(role, className = 'role-lucide-icon') {
            return lucideIconMarkup(getRoleIconName(role), className);
        }

        const ROLE_ASSET_ICON_FILES = {
            'Werewolf': 'werewolf.svg',
            'Alpha Wolf': 'alpha wolf.svg',
            'Lone Wolf': 'lone wolf.svg',
            'Seer': 'seer.svg',
            'Guardian': 'guardian.svg',
            'Witch': 'witch.svg',
            'Wizard': 'wizard.svg',
            'Hunter': 'hunter.svg',
            'Veteran': 'veteran.svg',
            'Bodyguard': 'bodyguard.svg',
            'Priest': 'priest.svg',
            'Mayor': 'mayor.svg',
            'Sheriff': 'sheriff.svg',
            'Jester': 'jester.svg',
            'Cupid': 'cupid.svg',
            'Doppelganger': 'doppelganger.svg',
            'Serial Killer': 'serial killer.svg',
            'Idiot': 'idiot.svg',
            'Prince': 'prince.svg',
            'Little Girl': 'little girl.svg',
            'Villager': 'villager.svg',
            'Wolf Cub': 'wolf cub.svg',
            'Minion': 'minion.svg',
            'Sorcerer': 'sorcerer.svg',
            'Infector': 'infector.svg',
            'White Wolf': 'white wolf.svg',
            'Tough Guy': 'tough guy.svg',
            'Mason 1': 'mason 1.svg',
            'Mason 2': 'mason 2.svg',
            'Lycan': 'lycan.svg',
            'Cursed': 'cursed.svg',
            'Apprentice Seer': 'Apprentice Seer.svg',
            'Gravedigger': 'gravedigger.svg',
            'Drunk': 'drunk.svg',
            'Tavern Keeper': 'tavern keeper.svg',
            'Aura Seer': 'aura seer.svg',
            'Martyr': 'martyr.svg',
            'Tracker': 'tracker.svg',
            'Hunters Apprentice': 'Hunters Apprentice.svg',
            'Amnesiac': 'amnesiac.svg',
            'Thief': 'thief.svg',
            'Survivor': 'survivor.svg',
            'Cult Leader': 'cult leader.svg',
            'Vampire': 'vampire.svg',
            'Troublemaker': 'troublemaker.svg',
            'Bounty Hunter': 'bounty hunter.svg'
        };

        const ROLE_ASSET_ATTRIBUTIONS = {
            'Alpha Wolf': 'Created by Hamstring from Noun Project',
            'Amnesiac': 'Created by Elzicon from Noun Project',
            'Apprentice Seer': 'Created by VectorRecipe7 from Noun Project',
            'Aura Seer': 'Created by ABDUL LATIF from Noun Project',
            'Bodyguard': 'Created by PureSolution from Noun Project',
            'Bounty Hunter': 'Created by Aldric Rodr\u00edguez from the Noun Project',
            'Cult Leader': 'Created by Smashing Stocks from Noun Project',
            'Cupid': 'Created by Nuricon from Noun Project',
            'Cursed': 'Created by Eucalyp from the Noun Project',
            'Doppelganger': 'Created by Rafiico Creative Studio from Noun Project',
            'Drunk': 'Created by Hanabi Gardewi from Noun Project',
            'Gravedigger': 'Created by Adrien Coquet from the Noun Project',
            'Guardian': 'Created by Eucalyp from the Noun Project',
            'Hunter': 'Created by Amethyst Studio from the Noun Project',
            'Hunters Apprentice': 'Created by Mas Dhimas from the Noun Project',
            'Idiot': 'Created by Cuputo from the Noun Project',
            'Infector': 'Created by Stocke_Icon from Noun Project',
            'Jester': 'Created by Lewen Design from Noun Project',
            'Little Girl': 'Created by Azland Studio from Noun Project',
            'Lone Wolf': 'Created by Hamstring from Noun Project',
            'Lycan': 'Created by Kevin from the Noun Project',
            'Martyr': 'Created by gravisio from Noun Project',
            'Mason 1': 'Created by Fathur Rachman from Noun Project',
            'Mason 2': 'Created by Fathur Rachman from Noun Project',
            'Minion': 'Created by Milena Zanotelli from the Noun Project',
            'Priest': 'Created by metami septiana from Noun Project',
            'Prince': 'Created by Nanik haq from Noun Project',
            'Seer': 'Created by Zpoliariumz Zydanez from Noun Project',
            'Serial Killer': 'Created by Tippawan Sookruay from the Noun Project',
            'Sheriff': 'Created by Ahmad Ishaq from Noun Project',
            'Sorcerer': 'Created by IMG visuals icons from Noun Project',
            'Survivor': 'Created by Creative Mahira from the Noun Project',
            'Tavern Keeper': 'Created by iconfield from the Noun Project',
            'Thief': 'Created by Yu-Jin from the Noun Project',
            'Tough Guy': 'Created by Sebastian Schuldt from the Noun Project',
            'Tracker': 'Created by Omah Icon from Noun Project',
            'Vampire': 'Created by Arjuna from Noun Project',
            'Veteran': 'Created by Rahmad romadoni from Noun Project',
            'Villager': 'Created by agus raharjo from Noun Project',
            'Werewolf': 'Created by Astima from Noun Project',
            'Witch': 'Created by Brandi Carroll from the Noun Project',
            'Wizard': 'Created by Danil Polshin from Noun Project',
            'Wolf Cub': 'Created by Danil Polshin from Noun Project'
        };

        function escapeRoleAssetAttribute(value) {
            return String(value || '').replace(/[&<>"']/g, ch => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }

        function roleAssetIconMarkup(role, className = 'role-asset-icon') {
            const fileName = ROLE_ASSET_ICON_FILES[role];
            if (!fileName) return roleIconMarkup(role, className);
            const classes = String(className || '').split(/\s+/).includes('role-asset-icon')
                ? className
                : `role-asset-icon ${className || ''}`.trim();
            const safeClass = escapeRoleAssetAttribute(classes);
            const safeSrc = escapeRoleAssetAttribute(`assets/role icons/${fileName}`);
            return `<span class="${safeClass}" aria-hidden="true"><img src="${safeSrc}" alt="" loading="lazy" decoding="async"></span>`;
        }

        function hydrateWerewolfIcons(root) {
            const target = root || document;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({
                    root: target,
                    attrs: {
                        'stroke-width': 2,
                        'aria-hidden': 'true'
                    }
                });
            }
            if (window.werewolfRefreshInterface && typeof window.werewolfRefreshInterface === 'function') {
                window.werewolfRefreshInterface(target, { skipHydrate: true });
            }
        }

        Object.entries(ROLE_DEFINITIONS).forEach(([role, def]) => {
            def.icon = '';
            def.iconName = getRoleIconName(role);
        });

        const NIGHT_ORDER = [
            // Lone Wolf sengaja tidak ada di sini — transformasinya terjadi otomatis via processNightDeaths, bukan aksi malam
            'Thief', 'Troublemaker', 'Cupid', 'Mason 1', 'Mason 2', 'Doppelganger', 'Lone Wolf', 'White Wolf', 'Werewolf', 'Alpha Wolf', 'Infector', 'Seer', 'Apprentice Seer', 'Aura Seer', 'Sorcerer', 'Tracker', 'Guardian', 'Bodyguard', 'Tavern Keeper', 'Witch', 'Veteran', 'Wizard', 'Gravedigger', 'Amnesiac', 'Cult Leader', 'Vampire', 'Serial Killer', 'Little Girl', 'Sheriff', 'Martyr'
        ];

        // ==================== INITIALIZATION ====================
