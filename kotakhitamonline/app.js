// === FIREBASE INIT & AUDIO CONFIG ===
        const firebaseConfig = {
            apiKey: "AIzaSyBGEwGVEVM0lUcUF6_wJbc4rmVgp8XG6_g",
            authDomain: "kotakhitam-33e4a.firebaseapp.com",
            databaseURL: "https://kotakhitam-33e4a-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "kotakhitam-33e4a",
            storageBucket: "kotakhitam-33e4a.firebasestorage.app",
            messagingSenderId: "1069156640677",
            appId: "1:1069156640677:web:3a4bb5d5ead8f215beaa4c"
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.database();

        let audioCtx;
        let noiseBuffer;

        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (!noiseBuffer && audioCtx) {
                const bufferSize = audioCtx.sampleRate * 0.15;
                noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
            }
        }

        function playTickSound() {
            if (!audioCtx || !noiseBuffer) return;
            const noiseSrc = audioCtx.createBufferSource();
            noiseSrc.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1.5, audioCtx.currentTime + 0.005);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            noiseSrc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            noiseSrc.start(audioCtx.currentTime);
            noiseSrc.stop(audioCtx.currentTime + 0.1);
        }

        function playStopSound() {
            if (!audioCtx) return;
            const frequencies = [146.83, 174.61, 220.00];
            frequencies.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                const startTime = audioCtx.currentTime + (index * 0.05);
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.9, startTime + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 2.5);
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 3.0);
            });
        }

        function playSuspenseSound() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.5);
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1.5, audioCtx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.5);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 2.5);
        }

        function playVoteSound() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            // Suara "Ding!" yang bersih dan elegan (Nada C6)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); 
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.01); // Attack cepat
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6); // Decay halus (gema)
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.6);
        }

        let lastRevealedStatus = false;

        // === MULTIPLAYER STATE ===
        // Restore session from sessionStorage if available (survive refresh)
        const _saved = JSON.parse(sessionStorage.getItem('khSession') || 'null');
        let myPlayerId = (_saved && _saved.pid) ? _saved.pid : ('p_' + Math.random().toString(36).substr(2, 9));
        let myName = (_saved && _saved.name) ? _saved.name : '';
        let myRoomCode = '';
        let isModerator = false;
        let roomRef = null;
        let pRef = null; // player ref
        let currentRoomData = null;

        let isShuffling = false;
        let lastProcessedShuffleSignalId = null;

        function copyInviteLink() {
            const url = window.location.origin + window.location.pathname + '?room=' + myRoomCode;
            navigator.clipboard.writeText(url).then(() => alert('Link invite berhasil disalin!\n' + url)).catch(err => alert('Gagal menyalin link: ' + err));
        }

        function saveSession() {
            sessionStorage.setItem('khSession', JSON.stringify({
                pid: myPlayerId,
                name: myName,
                roomCode: myRoomCode,
                isModerator: isModerator
            }));
        }

        function clearSession() {
            sessionStorage.removeItem('khSession');
        }

        function showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
            document.getElementById(screenId).classList.add('active-screen');
        }

        function generateRoomCode() {
            let result = '';
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
        }

        function resetJoinBtn() {
            const btn = document.querySelector('button[onclick="joinRoom()"]');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gabung Room'; }
        }

        function createRoom() {
            initAudio();
            const pin = prompt('Masukkan PIN untuk membuat room:');
            if (pin !== '183729') { alert('PIN salah!'); return; }
            const nameInput = document.getElementById('player-name').value.trim();
            if (!nameInput) { alert('Masukkan nama dulu!'); return; }
            const nameRegex = /^[a-zA-Z]+$/;
            if (!nameRegex.test(nameInput)) {
                alert('Nama hanya boleh berisi huruf (A-Z), tanpa spasi, angka, atau karakter lain.');
                return;
            }

            const btn = document.querySelector('button[onclick="createRoom()"]');
            if (btn) { btn.disabled = true; btn.innerHTML = 'Menghubungkan...'; }

            myName = nameInput;
            verifyAndCreateRoom();
        }

        function verifyAndCreateRoom() {
            myRoomCode = generateRoomCode();
            db.ref('rooms/' + myRoomCode).once('value', snapshot => {
                if (snapshot.exists()) {
                    verifyAndCreateRoom();
                } else {
                    isModerator = true;
                    roomRef = db.ref('rooms/' + myRoomCode);
                    roomRef.set({
                        moderator: myPlayerId,
                        status: 'lobby',
                        players: { [myPlayerId]: { name: myName } }
                    }).then(() => {
                        // roomRef.onDisconnect().remove(); // Dihapus agar tidak langsung keluar room saat refresh
                        saveSession();
                        listenToRoom();
                    }).catch(e => {
                        const btn = document.querySelector('button[onclick="createRoom()"]');
                        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Buat Room'; }
                        alert('Gagal buat room: ' + e.message);
                    });
                }
            });
        }

        let skippedVoteStart = null;

        function joinRoom() {
            initAudio();
            const nameInput = document.getElementById('player-name').value.trim();
            const codeInput = document.getElementById('room-code-input').value.trim().toUpperCase();
            if (!nameInput) { alert('Masukkan nama dulu!'); return; }
            const nameRegex = /^[a-zA-Z]+$/;
            if (!nameRegex.test(nameInput)) {
                alert('Nama hanya boleh berisi huruf (A-Z), tanpa spasi, angka, atau karakter lain.');
                return;
            }
            if (!codeInput || codeInput.length !== 4) { alert('Kode room tidak valid! Harus 4 huruf.'); return; }

            const btn = document.querySelector('button[onclick="joinRoom()"]');
            if (btn) { btn.disabled = true; btn.innerHTML = 'Menghubungkan...'; }

            db.ref('rooms/' + codeInput).once('value', snapshot => {
                if (!snapshot.exists()) {
                    alert("Room tidak ditemukan!");
                    resetJoinBtn();
                    return;
                }

                const data = snapshot.val();
                const players = data.players || {};
                const playerCount = Object.keys(players).length;

                if (!players[myPlayerId]) {
                    const existingNames = Object.values(players).map(p => p.name.toLowerCase());
                    if (existingNames.includes(nameInput.toLowerCase())) {
                        alert('Nama "' + nameInput + '" sudah dipakai pemain lain. Pilih nama berbeda.');
                        resetJoinBtn();
                        return;
                    }
                    if (playerCount >= 50) {
                        alert('Room sudah penuh! Maksimal 50 pemain.');
                        resetJoinBtn();
                        return;
                    }
                    if (data.status === 'voting') {
                        skippedVoteStart = data.vote?.startTime;
                    }
                }

                myName = nameInput;
                myRoomCode = codeInput;
                isModerator = false;

                roomRef = db.ref('rooms/' + myRoomCode);
                pRef = roomRef.child('players/' + myPlayerId);

                pRef.set({ name: myName }).then(() => {
                    saveSession();
                    listenToRoom();
                }).catch(e => {
                    alert("Gagal gabung room: " + e.message);
                    resetJoinBtn();
                });
            });
        }

        function resetToHome() {
            if (roomRef) roomRef.off();
            roomRef = null;
            pRef = null;
            myRoomCode = '';
            isModerator = false;
            currentRoomData = null;
            clearSession();
            showScreen('home-screen');
        }

        // Hanya dipanggil saat tombol Keluar ditekan secara eksplisit
        function leaveRoom() {
            if (roomRef) {
                if (isModerator) {
                    roomRef.remove(); // tutup room, semua player otomatis ter-kick
                } else {
                    if (pRef) pRef.remove(); // hanya hapus diri sendiri
                }
            }
            resetToHome();
        }

        function confirmLeave() {
            if (isModerator) {
                if (!confirm("Kamu adalah Moderator. Keluar akan MENUTUP ROOM dan mengeluarkan semua pemain. Yakin?")) return;
            } else {
                if (!confirm("Yakin mau keluar dari room?")) return;
            }
            leaveRoom();
        }

        function listenToRoom() {
            roomRef.on('value', snapshot => {
                const data = snapshot.val();
                if (!data) {
                    alert("Room telah ditutup!");
                    resetToHome();
                    return;
                }

                // Deteksi di-kick: cek node kickedPlayers (terpisah dari players list)
                if (!isModerator && data.kickedPlayers && data.kickedPlayers[myPlayerId]) {
                    alert("Kamu telah di-kick dari room oleh Moderator.");
                    clearSession();
                    roomRef.off();
                    roomRef = null; pRef = null; myRoomCode = ''; currentRoomData = null;
                    showScreen('home-screen');
                    return;
                }

                // If moderator is no longer in players list, or data.moderator is gone, room is dead
                if (!data.players || !data.players[data.moderator]) {
                    alert("Moderator keluar. Room ditutup.");
                    if (!isModerator) pRef.remove();
                    resetToHome();
                    return;
                }

                isModerator = (data.moderator === myPlayerId);
                currentRoomData = data;
                updateUI(data);

                // Timer Logic removed as per user request
            });
        }

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
                        <p class="q-text">"${text}"</p>
                    </div>
                    <div class="q-bot">
                        <span class="q-brand">KOTAK HITAM</span>
                    </div>
                </div>
            `;
        }

        function escapeHTML(str) {
            return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag]);
        }

        function updateUI(data) {
            const playersCount = data.players ? Object.keys(data.players).length : 0;

            if (data.status === 'lobby') {
                showScreen('lobby-screen');
                document.getElementById('lobby-room-code').textContent = myRoomCode;
                document.getElementById('player-count').textContent = playersCount;

                const pList = document.getElementById('player-list');
                pList.innerHTML = '';
                for (let pid in data.players) {
                    const p = data.players[pid];
                    const isMod = pid === data.moderator;
                    const isMe = pid === myPlayerId;
                    const showKick = isModerator && !isMod && !isMe;
                    pList.innerHTML += `
                        <div class="player-list-item">
                            <span>${escapeHTML(p.name)} ${isMe ? '(Kamu)' : ''}</span>
                            <span style="display:flex;align-items:center;gap:8px;">
                                ${isMod ? '<i class="fa-solid fa-crown crown-icon"></i>' : ''}
                                ${showKick ? `<button class="btn-kick" onclick="kickPlayer('${pid}','${escapeHTML(p.name)}')">KICK</button>` : ''}
                            </span>
                        </div>`;
                }

                const modControls = document.getElementById('mod-lobby-controls');
                if (isModerator) {
                    modControls.style.display = 'flex';
                    const btnStart = document.getElementById('btn-start-game');
                    if (playersCount >= 3) {
                        btnStart.disabled = false;
                        btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Mulai Permainan';
                    } else {
                        btnStart.disabled = true;
                        btnStart.innerHTML = `Menunggu (Min. 3 Pemain)`;
                    }
                } else {
                    modControls.style.display = 'none';
                }
            } else {
                showScreen('play-screen');
                document.getElementById('play-room-code').textContent = `ROOM: ${myRoomCode}`;
                const usedCount = (data.usedCards || []).length;
                document.getElementById('deck-progress').textContent = `${usedCount}/${questions.length}`;

                // Refresh overlay player list jika sedang terbuka
                const overlay = document.getElementById('players-overlay');
                if (overlay && overlay.classList.contains('show')) renderOverlayPlayerList(data);
                
                const secretOverlay = document.getElementById('secret-vote-overlay');
                if (secretOverlay && secretOverlay.classList.contains('show')) renderSecretVoteList(data);

                const btnNext = document.getElementById('btn-next');
                const votePanel = document.getElementById('vote-panel');
                const resultsPanel = document.getElementById('results-panel');

                const modPlayControls = document.getElementById('mod-play-controls');
                const btnStartVote = document.getElementById('btn-start-vote');
                const btnRevealVote = document.getElementById('btn-reveal-vote');
                const btnResetVote = document.getElementById('btn-reset-vote');
                const voteStatus = document.getElementById('vote-status');

                if (isModerator) {
                    modPlayControls.style.display = 'flex';
                    btnStartVote.style.display = (data.status === 'playing') ? 'block' : 'none';
                    btnRevealVote.style.display = (data.status === 'voting') ? 'block' : 'none';
                    btnResetVote.style.display = (data.status === 'results') ? 'block' : 'none';
                    // Nonaktifkan Acak Kartu saat voting/shuffling/results
                    btnNext.disabled = (data.status === 'voting' || data.status === 'shuffling' || data.status === 'results');
                } else {
                    modPlayControls.style.display = 'none';
                }

                if (data.status !== 'results') lastRevealedStatus = false;
                
                if (data.status === 'playing') {
                    document.querySelector('.card-container').classList.remove('panel-active');
                    votePanel.classList.remove('show');
                    resultsPanel.classList.remove('show');
                    if (data.currentCard && !isShuffling) {
                        renderStaticCard(data.currentCard);
                    }
                }
                else if (data.status === 'shuffling') {
                    document.querySelector('.card-container').classList.remove('panel-active');
                    votePanel.classList.remove('show');
                    resultsPanel.classList.remove('show');
                    if (!isShuffling && data.shuffleSignal) {
                        handleShuffleSignal(data.shuffleSignal);
                    }
                }
                else if (data.status === 'voting') {
                    document.querySelector('.card-container').classList.add('panel-active');
                    resultsPanel.classList.remove('show');
                    if (data.currentCard && !isShuffling) renderStaticCard(data.currentCard);
                    if (!votePanel.classList.contains('show')) {
                        setTimeout(() => votePanel.classList.add('show'), 50);
                    }

                    const votesCount = data.vote && data.vote.votes ? Object.keys(data.vote.votes).length : 0;
                    voteStatus.textContent = `${votesCount} / ${playersCount} sudah vote`;

                    const voted = new Set(Object.keys(data.vote?.votes || {}));
                    const pending = Object.entries(data.players || {})
                        .filter(([pid]) => !voted.has(pid))
                        .map(([, p]) => escapeHTML(p.name));

                    const pendingEl = document.getElementById('pending-voters');
                    if (pendingEl) {
                        pendingEl.innerHTML = pending.length > 0
                            ? `<p style="color:#888;font-size:0.75rem;margin-bottom:6px;letter-spacing:1px;">BELUM VOTE:</p>
                               ${pending.map(n => `<span class="pending-voter-badge">${n}</span>`).join('')}`
                            : `<p style="color:#4caf50;font-size:0.8rem;text-align:center;">✓ Semua sudah vote!</p>`;
                    }

                    if (isModerator) {
                        btnRevealVote.disabled = false;
                        btnRevealVote.innerHTML = (votesCount >= playersCount) ? 'BUKA HASIL' : `BUKA HASIL (${votesCount}/${playersCount})`;
                    }

                    const myVote = (data.vote && data.vote.votes && data.vote.votes[myPlayerId]);
                    const joinedMidVote = (skippedVoteStart && data.vote?.startTime === skippedVoteStart);
                    document.getElementById('btn-vote-ya').disabled = !!myVote || joinedMidVote;
                    document.getElementById('btn-vote-tidak').disabled = !!myVote || joinedMidVote;
                }
                else if (data.status === 'results') {
                    if (!lastRevealedStatus) {
                        playSuspenseSound();
                        lastRevealedStatus = true;
                    }
                    document.querySelector('.card-container').classList.add('panel-active');
                    votePanel.classList.remove('show');
                    if (data.currentCard && !isShuffling) renderStaticCard(data.currentCard);
                    if (!resultsPanel.classList.contains('show')) {
                        setTimeout(() => resultsPanel.classList.add('show'), 50);
                    }

                    let yaCount = 0;
                    let noneCount = 0;
                    if (data.vote && data.vote.votes) {
                        for (let v in data.vote.votes) {
                            if (data.vote.votes[v] === 'yes') yaCount++;
                            else if (data.vote.votes[v] === 'no') noneCount++;
                        }
                    }
                    document.getElementById('res-ya').textContent = `${yaCount} Orang`;
                    document.getElementById('res-tidak').textContent = `${noneCount} Orang`;
                }
            }
        }

        function renderStaticCard(cardData) {
            const cardView = document.getElementById('hp-card-view');
            cardView.className = `card-hp lvl-${cardData.level}`;
            cardView.innerHTML = getCardHTML(cardData.level, cardData.text);
        }

        function startGame() {
            if (!isModerator) return;

            roomRef.update({
                status: 'playing',
                usedCards: [],
                currentCard: { level: 0, text: "Gunakan tombol ACAK KARTU di bawah untuk membagikan kartu pertama." }
            });
        }

        function triggerShuffle() {
            if (!isModerator || isShuffling) return;
            if (!currentRoomData || currentRoomData.status !== 'playing') return;

            initAudio();

            let usedCards = currentRoomData.usedCards || [];
            let availableDeck = questions.filter(q => !usedCards.includes(q.text));

            if (!availableDeck.length) {
                alert("Semua kartu sudah dimainkan! Mengacak ulang deck.");
                availableDeck = questions;
                usedCards = [];
            }

            const randomCard = availableDeck[Math.floor(Math.random() * availableDeck.length)];
            usedCards.push(randomCard.text);
            const signalId = 'sig_' + Math.random().toString(36).substr(2, 9);

            roomRef.update({
                status: 'shuffling',
                usedCards: usedCards,
                shuffleSignal: {
                    id: signalId,
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
            if (lastProcessedShuffleSignalId === signal.id) return;
            lastProcessedShuffleSignalId = signal.id;

            initAudio();

            const cardEl = document.getElementById('hp-card-view');
            const shuffleLevel = signal.card.level || 1;

            isShuffling = true;
            cardEl.classList.add('animate-shuffle');

            const btnAcak = document.getElementById('btn-next');
            if (btnAcak) btnAcak.disabled = true;

            const shuffleSpeed = 100;
            const duration = 2000;
            const localStart = Date.now();

            const interval = setInterval(() => {
                const randomCard = questions[Math.floor(Math.random() * questions.length)];
                cardEl.className = `card-hp lvl-${randomCard.level}`;
                cardEl.innerHTML = getCardHTML(randomCard.level, randomCard.text);
                playTickSound();

                if (Date.now() - localStart >= duration) {
                    clearInterval(interval);

                    // Final reveal
                    cardEl.classList.remove('animate-shuffle');
                    cardEl.classList.remove('animate-pop');
                    void cardEl.offsetWidth;
                    cardEl.className = `card-hp lvl-${signal.card.level} animate-pop`;
                    cardEl.innerHTML = getCardHTML(signal.card.level, signal.card.text);

                    playStopSound();

                    isShuffling = false;
                    if (btnAcak) btnAcak.disabled = false;

                    if (isModerator && currentRoomData && currentRoomData.status === 'shuffling') {
                        roomRef.update({ status: 'playing', currentCard: signal.card });
                    }
                }
            }, shuffleSpeed);
        }

        function startVote() {
            if (!isModerator || currentRoomData.status !== 'playing') return;
            roomRef.update({
                status: 'voting',
                vote: { active: true, votes: {}, startTime: firebase.database.ServerValue.TIMESTAMP }
            });
        }

        function submitVote(choice) {
            if (currentRoomData.status !== 'voting') return;
            playVoteSound();
            roomRef.child(`vote/votes/${myPlayerId}`).set(choice);
        }

        function revealResults(force = false) {
            if (!isModerator) return;
            const playersCount = currentRoomData.players ? Object.keys(currentRoomData.players).length : 0;
            const votesCount = currentRoomData.vote && currentRoomData.vote.votes ? Object.keys(currentRoomData.vote.votes).length : 0;
            if (!force && votesCount < playersCount) return;

            roomRef.update({
                status: 'results'
            });
        }

        function resetVote() {
            if (!isModerator) return;
            roomRef.update({
                status: 'playing',
                vote: null
            });
        }

        function kickPlayer(pid, name) {
            if (!isModerator) return;
            if (!confirm(`Kick "${name}" dari room?`)) return;
            roomRef.child('kickedPlayers/' + pid).set(true);
            roomRef.child('players/' + pid).remove();
            roomRef.child('vote/votes/' + pid).remove();
            // Tutup overlay setelah kick
            const overlay = document.getElementById('players-overlay');
            if (overlay.classList.contains('show')) togglePlayersOverlay();
        }

        let secretClickCount = 0;
        let secretClickTimer = null;

        function handleSecretPanelTap() {
            secretClickCount++;
            clearTimeout(secretClickTimer);
            secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 600); // Reset dalam 600ms
            
            if (secretClickCount >= 5) {
                secretClickCount = 0;
                toggleSecretPanel();
            }
        }

        function toggleSecretPanel() {
            if (!isModerator) {
                return; // Gagal diam-diam jika bukan moderator
            }
            if (!currentRoomData || (currentRoomData.status !== 'voting' && currentRoomData.status !== 'results')) {
                // Jangan buka jika belum sesi voting/results
                return;
            }
            const overlay = document.getElementById('secret-vote-overlay');
            const isShown = overlay.classList.toggle('show');
            if (isShown && currentRoomData) renderSecretVoteList(currentRoomData);
        }

        function renderSecretVoteList(data) {
            const list = document.getElementById('secret-vote-list');
            list.innerHTML = '';
            if (!data.vote || !data.vote.active) {
                list.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Belum ada sesi vote aktif.</div>';
                return;
            }
            const players = data.players || {};
            const votes = data.vote.votes || {};
            
            for (let pid in players) {
                const p = players[pid];
                const v = votes[pid];
                let voteHtml = '<span style="color:#888;font-size:0.85rem;">Belum Vote</span>';
                if (v === 'yes') voteHtml = '<span style="color:#4caf50;font-weight:bold;">YA</span>';
                if (v === 'no') voteHtml = '<span style="color:#f44336;font-weight:bold;">TIDAK</span>';
                
                const item = document.createElement('div');
                item.className = 'overlay-player-item';
                item.innerHTML = '<span style="font-weight:bold;">' + escapeHTML(p.name) + '</span>' + voteHtml;
                list.appendChild(item);
            }
        }

        function togglePlayersOverlay() {
            if (!isModerator) return;
            const overlay = document.getElementById('players-overlay');
            const isShown = overlay.classList.toggle('show');
            if (isShown && currentRoomData) renderOverlayPlayerList(currentRoomData);
        }

        function renderOverlayPlayerList(data) {
            const players = data.players || {};
            const list = document.getElementById('overlay-player-list');
            list.innerHTML = '';
            for (let pid in players) {
                const p = players[pid];
                const isMod = pid === data.moderator;
                const isMe = pid === myPlayerId;
                const item = document.createElement('div');
                item.className = 'overlay-player-item';
                item.innerHTML = `
                    <span style="display:flex;align-items:center;gap:8px;">
                        ${isMod
                        ? '<i class="fa-solid fa-crown" style="color:var(--pale-gold);"></i>'
                        : '<i class="fa-solid fa-user" style="color:#666;"></i>'
                    }
                        ${escapeHTML(p.name)}${isMe ? ' <span style="font-size:0.72rem;color:#666;">(Kamu)</span>' : ''}
                    </span>
                    ${(!isMod && !isMe)
                        ? `<button class="btn-kick" onclick="kickPlayer('${pid}','${escapeHTML(p.name)}')">KICK</button>`
                        : `<span style="font-size:0.72rem;color:var(--pale-gold);letter-spacing:1px;">${isMod ? 'MOD' : ''}</span>`
                    }
                `;
                list.appendChild(item);
            }
        }

        function toggleGuideOverlay() {
            const overlay = document.getElementById('guide-overlay');
            if (overlay) overlay.classList.toggle('show');
        }

        // === AUTO RESTORE SESSION AFTER REFRESH ===
        function restoreSession() {
            if (!_saved || !_saved.roomCode) return;

            db.ref('rooms/' + _saved.roomCode).once('value', snapshot => {
                if (!snapshot.exists()) {
                    // Room sudah tidak ada, bersihkan session
                    clearSession();
                    return;
                }
                const data = snapshot.val();

                // Cek apakah pernah di-kick
                if (data.kickedPlayers && data.kickedPlayers[_saved.pid]) {
                    clearSession();
                    return;
                }

                // Restore state
                myRoomCode = _saved.roomCode;
                isModerator = (data.moderator === _saved.pid);
                roomRef = db.ref('rooms/' + myRoomCode);

                if (!isModerator) {
                    pRef = roomRef.child('players/' + myPlayerId);
                    pRef.set({ name: myName });
                }

                listenToRoom();
                updateUI(data);
            });
        }

        // Jalankan restore saat halaman selesai load
        window.onload = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const roomFromUrl = urlParams.get('room');
            if (roomFromUrl) {
                const input = document.getElementById('room-code-input');
                if (input) input.value = roomFromUrl.toUpperCase();
            }
        };

        restoreSession();