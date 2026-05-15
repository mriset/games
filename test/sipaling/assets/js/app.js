// ============================================================
//                        AUDIO SYSTEM
// ============================================================
let audioCtx, noiseBuffer;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Build a 1-second noise buffer once
    if (!noiseBuffer && audioCtx) {
        const bufferSize = audioCtx.sampleRate;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    }
}

// 🃏 Card flip (noise burst with high-to-mid sweep)
function playTickSound() {
    if (!audioCtx || !noiseBuffer) return;
    const t = audioCtx.currentTime;
    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    filter.Q.value = 0.8;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noiseSrc.start(t);
    noiseSrc.stop(t + 0.07);
}

// Whoosh + soft pop when card stops
function playStopSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    // Whoosh (noise sweep down)
    if (noiseBuffer) {
        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        noiseSrc.loop = true;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(5000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.18);
        const gainN = audioCtx.createGain();
        gainN.gain.setValueAtTime(1.0, t);
        gainN.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        noiseSrc.connect(filter); filter.connect(gainN); gainN.connect(audioCtx.destination);
        noiseSrc.start(t); noiseSrc.stop(t + 0.18);
    }

    // Pop chord: C5 E5 G5 with sine waves
    [[523.25, 0.0], [659.25, 0.06], [783.99, 0.12]].forEach(([freq, delay]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(1.0, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t + delay); osc.stop(t + delay + 0.5);
    });
}

// Soft pop when player casts a vote
function playVoteSubmitSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.15);
}

// Tada fanfare arpeggio
function playTadaSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    // Rising arpeggio: C4 E4 G4 C5 + final chord sustain
    const notes = [
        { freq: 261.63, start: 0.0,  dur: 0.12 },
        { freq: 329.63, start: 0.11, dur: 0.12 },
        { freq: 392.00, start: 0.22, dur: 0.12 },
        { freq: 523.25, start: 0.33, dur: 0.6 },
        { freq: 659.25, start: 0.38, dur: 0.55 },
        { freq: 783.99, start: 0.43, dur: 0.5 },
    ];
    notes.forEach(({ freq, start, dur }) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(1.0, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t + start); osc.stop(t + start + dur);
    });
}

// ============================================================
//                      MODAL SYSTEM
// ============================================================
function _closeModal() {
    const overlay = document.getElementById('sp-modal-overlay');
    if (overlay) overlay.classList.remove('show');
}

function showModal(message, title = 'Perhatian', iconClass = 'ph-warning-circle') {
    return new Promise(resolve => {
        document.getElementById('sp-modal-title').textContent = title;
        document.getElementById('sp-modal-message').textContent = message;
        document.getElementById('sp-modal-icon').innerHTML = `<i class="ph-bold ${iconClass}"></i>`;
        document.getElementById('sp-prompt-container').style.display = 'none';
        
        const actions = document.getElementById('sp-modal-actions');
        actions.innerHTML = `<button class="pop-btn modal-btn-primary" id="sp-modal-btn-ok">OK</button>`;
        
        const overlay = document.getElementById('sp-modal-overlay');
        overlay.classList.add('show');
        
        document.getElementById('sp-modal-btn-ok').onclick = () => {
            _closeModal();
            resolve();
        };
    });
}

function showConfirm(message, title = 'Konfirmasi', iconClass = 'ph-question', isDestructive = false) {
    return new Promise(resolve => {
        document.getElementById('sp-modal-title').textContent = title;
        document.getElementById('sp-modal-message').textContent = message;
        document.getElementById('sp-modal-icon').innerHTML = `<i class="ph-bold ${iconClass}"></i>`;
        document.getElementById('sp-prompt-container').style.display = 'none';
        
        const actions = document.getElementById('sp-modal-actions');
        const confirmBtnClass = isDestructive ? 'modal-btn-danger' : 'modal-btn-primary';
        actions.innerHTML = `
            <button class="pop-btn modal-btn-cancel" id="sp-modal-btn-cancel">Batal</button>
            <button class="pop-btn ${confirmBtnClass}" id="sp-modal-btn-yes">Ya</button>
        `;
        
        const overlay = document.getElementById('sp-modal-overlay');
        overlay.classList.add('show');
        
        document.getElementById('sp-modal-btn-cancel').onclick = () => { _closeModal(); resolve(false); };
        document.getElementById('sp-modal-btn-yes').onclick = () => { _closeModal(); resolve(true); };
    });
}

function showPrompt(message, placeholder = '', title = 'Input', iconClass = 'ph-key') {
    return new Promise(resolve => {
        document.getElementById('sp-modal-title').textContent = title;
        document.getElementById('sp-modal-message').textContent = message;
        document.getElementById('sp-modal-icon').innerHTML = `<i class="ph-bold ${iconClass}"></i>`;
        
        const pContainer = document.getElementById('sp-prompt-container');
        const pInput = document.getElementById('sp-prompt-input');
        const pError = document.getElementById('sp-prompt-error');
        pContainer.style.display = 'block';
        pInput.value = '';
        pInput.placeholder = placeholder;
        pInput.classList.remove('input-invalid');
        pError.style.display = 'none';
        
        const actions = document.getElementById('sp-modal-actions');
        actions.innerHTML = `
            <button class="pop-btn modal-btn-cancel" id="sp-modal-btn-cancel">Batal</button>
            <button class="pop-btn modal-btn-primary" id="sp-modal-btn-submit">Kirim</button>
        `;
        
        const overlay = document.getElementById('sp-modal-overlay');
        overlay.classList.add('show');
        pInput.focus();
        
        const submitFn = () => {
            const val = pInput.value.trim();
            if (!val) {
                pInput.classList.add('input-invalid');
                pError.textContent = 'Input tidak boleh kosong!';
                pError.style.display = 'block';
                pError.classList.remove('shake');
                void pError.offsetWidth;
                pError.classList.add('shake');
                pInput.focus();
                return;
            }
            _closeModal();
            resolve(val);
        };

        document.getElementById('sp-modal-btn-cancel').onclick = () => { _closeModal(); resolve(null); };
        document.getElementById('sp-modal-btn-submit').onclick = submitFn;
        
        pInput.onkeydown = (e) => {
            pInput.classList.remove('input-invalid');
            pError.style.display = 'none';
            if (e.key === 'Enter') submitFn();
        };
    });
}

// ============================================================
//                    STATE & SESSION
// ============================================================
function escapeHTML(str) { return String(str).replace(/[&<>'"']/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag]); }
function isValidName(name) { return /^[A-Za-z]{1,12}$/.test(name); }
const AVATAR_EMOJIS = [
    '🦁','🐯','🦊','🐼','🐨','🦄','🐸','🦋',
    '🦉','🐙','🦀','🐬','🦚','🦜','🦩','🐧',
    '🐳','🦈','🦞','🦦','🐺','🦝','🦡','🦌',
    '🐘','🦏','🦛','🦒','🦓','🐪'
];

const SESSION_KEY = 'spOnlineSession';
const _saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');

let myPlayerId = (_saved && _saved.pid) ? _saved.pid : ('p_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').substring(0,12) : Math.random().toString(36).substr(2, 9)));
let myName = (_saved && _saved.name) ? _saved.name : '';
let myEmoji = (_saved && _saved.emoji) ? _saved.emoji : '';
let myRoomCode = '';
let isModerator = false;
let myJoinedMidGame = false;
let roomRef = null;
let pRef = null;
let currentRoomData = null;
let isShuffling = false;
let lastProcessedShuffleSignalId = null;
let lastFiredConfettiVoteId = null;
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock released');
            });
            console.log('Screen Wake Lock active');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        });
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});


function copyRoomCode() {
    navigator.clipboard.writeText(myRoomCode)
        .then(() => showInfoToast('Kode room berhasil disalin!', 'ph-copy'))
        .catch(err => showInfoToast('Gagal menyalin kode room: ' + err, 'ph-warning-circle'));
}

function saveSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        pid: myPlayerId, name: myName, emoji: myEmoji, roomCode: myRoomCode, isModerator
    }));
}
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

// ============================================================
//                      SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById(id).classList.add('active-screen');
    document.body.dataset.screen = id;
    refreshBodyUiState();
}

function refreshBodyUiState() {
    if (!document.body) return;
    const sheetOpen = !!document.querySelector('.vote-panel.show, .results-panel.show');
    const overlayOpen = !!document.querySelector('#leaderboard-overlay.show, #players-overlay.show, #custom-overlay.show, #secret-vote-panel.show, #emoji-overlay.active-screen');
    document.body.classList.toggle('sheet-open', sheetOpen);
    document.body.classList.toggle('overlay-open', overlayOpen);
}

// ============================================================
//                      ROOM MANAGEMENT
// ============================================================
function generateRoomCode() {
    let r = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return r;
}

function _showInputError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errorId);
    input.classList.add('input-invalid');
    err.textContent = message;
    err.style.display = 'block';
    err.classList.remove('shake');
    void err.offsetWidth;
    err.classList.add('shake');
    input.focus();
}

function _hideInputError(inputId, errorId) {
    document.getElementById(inputId).classList.remove('input-invalid');
    document.getElementById(errorId).style.display = 'none';
}

async function createRoom() {
    initAudio();
    const pin = await showPrompt('Masukkan PIN untuk membuat room:', 'PIN 6 Angka', 'Akses Moderator', 'ph-key');
    if (pin === null) return;
    if (pin !== '183729') { showModal('PIN salah!', 'Akses Ditolak', 'ph-x-circle'); return; }
    
    _hideInputError('player-name', 'name-error');
    const nameInput = document.getElementById('player-name').value.trim();
    if (!nameInput || !isValidName(nameInput)) { _showInputError('player-name', 'name-error', 'Nama max 12 huruf (A-Z), tanpa angka/spasi.'); return; }

    const btn = document.querySelector('button[onclick="createRoom()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Memeriksa...'; }

    // Check max 2 rooms
    db.ref('rooms').once('value', snapshot => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Buat Room'; }
        const totalRooms = snapshot.numChildren();
        if (totalRooms >= 2) {
            showModal('Jumlah room aktif sudah mencapai batas maksimum (2). Coba lagi nanti.', 'Server Penuh', 'ph-traffic-cone');
            return;
        }
        myName = nameInput;
        showEmojiPicker(true, null, null);
    });
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
                players: { [myPlayerId]: { name: myName, emoji: myEmoji } }
            }).then(() => {
                saveSession();
                listenToRoom();
            }).catch(e => {
                showModal('Gagal buat room: ' + e.message, 'Error', 'ph-x-circle');
            });
        }
    });
}

function joinRoom() {
    initAudio();
    _hideInputError('player-name', 'name-error');
    _hideInputError('room-code-input', 'code-error');
    const nameInput = document.getElementById('player-name').value.trim();
    const codeInput = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!nameInput || !isValidName(nameInput)) { _showInputError('player-name', 'name-error', 'Nama max 12 huruf (A-Z), tanpa angka/spasi.'); return; }
    if (!codeInput || codeInput.length !== 4) { _showInputError('room-code-input', 'code-error', 'Kode room harus 4 huruf.'); return; }

    const btn = document.querySelector('button[onclick="joinRoom()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Memeriksa...'; }

    db.ref('rooms/' + codeInput).once('value', snapshot => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gabung Room'; }
        if (!snapshot.exists()) { showModal('Room tidak ditemukan!', 'Error', 'ph-x-circle'); return; }
        const data = snapshot.val();
        
        const playerCount = data.players ? Object.keys(data.players).length : 0;
        if (playerCount >= 25) { showModal('Room sudah penuh! Maksimal 25 pemain.', 'Room Penuh', 'ph-traffic-cone'); return; }

        myName = nameInput;
        myRoomCode = codeInput;
        isModerator = false;
        
        if (data.status !== 'lobby') {
            myJoinedMidGame = true;
        } else {
            myJoinedMidGame = false;
        }
        
        showEmojiPicker(false, codeInput, data);
    });
}

function verifyAndJoinRoom() {
    roomRef = db.ref('rooms/' + myRoomCode);
    pRef = roomRef.child('players/' + myPlayerId);
    const playerData = { name: myName, emoji: myEmoji };
    if (myJoinedMidGame) {
        playerData.joinedMidGame = true;
    }
    pRef.set(playerData).then(() => {
        saveSession();
        listenToRoom();
    }).catch(e => { showModal('Gagal gabung room: ' + e.message, 'Error', 'ph-x-circle'); });
}

// ============================================================
//                      EMOJI PICKER
// ============================================================
let pendingEmojiAction = null; // 'create' or 'join'
function showEmojiPicker(isCreating, codeInput, roomData) {
    pendingEmojiAction = isCreating ? 'create' : 'join';
    const grid = document.getElementById('emoji-grid');
    grid.innerHTML = '';
    
    let usedEmojis = [];
    if (!isCreating && roomData && roomData.players) {
        usedEmojis = Object.values(roomData.players).map(p => p.emoji).filter(Boolean);
    }

    myEmoji = ''; // reset selection
    const btnConfirm = document.getElementById('btn-confirm-emoji');
    btnConfirm.disabled = true;

    AVATAR_EMOJIS.forEach(emoji => {
        const isUsed = usedEmojis.includes(emoji);
        const btn = document.createElement('div');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        if (isUsed) {
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
            btn.style.filter = 'grayscale(100%)';
        } else {
            btn.onclick = () => {
                document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                myEmoji = emoji;
                btnConfirm.disabled = false;
                initAudio(); playTickSound();
            };
        }
        grid.appendChild(btn);
    });
    
    showScreen('emoji-overlay');
}

function closeEmojiPicker() {
    showScreen('home-screen');
}

function confirmEmojiSelection() {
    if (!myEmoji) return;
    initAudio(); playVoteSubmitSound();
    if (pendingEmojiAction === 'create') {
        verifyAndCreateRoom();
    } else if (pendingEmojiAction === 'join') {
        verifyAndJoinRoom();
    }
}

function resetToHome() {
    if (typeof closeSecretPanel === 'function') closeSecretPanel();
    releaseWakeLock();
    if (roomRef) roomRef.off();
    roomRef = null; pRef = null; myRoomCode = ''; isModerator = false; myJoinedMidGame = false; currentRoomData = null;
    clearSession();
    // Hide panels
    document.getElementById('vote-panel').classList.remove('show');
    document.getElementById('results-panel').classList.remove('show');
    showScreen('home-screen');
    refreshBodyUiState();
}

function leaveRoom() {
    if (roomRef) {
        if (isModerator) {
            roomRef.remove();
        } else {
            if (pRef) pRef.remove();
        }
    }
    resetToHome();
}

async function confirmLeave() {
    if (isModerator) {
        const ok = await showConfirm('Kamu adalah Moderator. Keluar akan MENUTUP ROOM dan mengeluarkan semua pemain. Yakin?', 'Tutup Room?', 'ph-warning-circle');
        if (!ok) return;
    } else {
        const ok = await showConfirm('Yakin mau keluar dari room?', 'Keluar Room?', 'ph-door-open');
        if (!ok) return;
    }
    leaveRoom();
}

function listenToRoom() {
    requestWakeLock();
    roomRef.on('value', snapshot => {
        const data = snapshot.val();
        if (!data) {
            showModal('Room telah ditutup!', 'Perhatian', 'ph-warning-circle').then(resetToHome);
            return;
        }

        // Deteksi kick
        if (!isModerator && data.kickedPlayers && data.kickedPlayers[myPlayerId]) {
            showModal('Kamu telah di-kick dari room oleh Moderator.', 'Di-kick', 'ph-sign-out').then(() => {
                clearSession();
                releaseWakeLock();
                if (roomRef) roomRef.off();
                roomRef = null; pRef = null; myRoomCode = ''; currentRoomData = null;
                document.getElementById('vote-panel').classList.remove('show');
                document.getElementById('results-panel').classList.remove('show');
                showScreen('home-screen');
                refreshBodyUiState();
            });
            return;
        }

        // Cek room masih valid (moderator masih ada)
        if (!data.players || !data.players[data.moderator]) {
            showModal('Moderator keluar. Room ditutup.', 'Room Ditutup', 'ph-door-open').then(() => {
                if (!isModerator && pRef) pRef.remove();
                resetToHome();
            });
            return;
        }

        isModerator = (data.moderator === myPlayerId);
        currentRoomData = data;
        updateUI(data);
    });
}

async function kickPlayer(pid, name) {
    if (!isModerator) return;
    const ok = await showConfirm(`Kick "${name}" dari room?`, 'Kick Pemain?', 'ph-sign-out');
    if (!ok) return;
    roomRef.child('kickedPlayers/' + pid).set(true);
    roomRef.child('players/' + pid).remove();
    roomRef.child('vote/votes/' + pid).remove();

    // Jika ada pemain lain yang sudah terlanjur vote pemain ini, hapus vote mereka agar bisa vote ulang
    if (currentRoomData && currentRoomData.vote && currentRoomData.vote.votes) {
        for (let voterId in currentRoomData.vote.votes) {
            if (currentRoomData.vote.votes[voterId] === pid) {
                roomRef.child('vote/votes/' + voterId).remove();
            }
        }
    }
    // Close overlay after kick
    const overlay = document.getElementById('players-overlay');
    if (overlay.classList.contains('show')) togglePlayersOverlay();
}

function togglePlayersOverlay() {
    if (!isModerator) return;
    const overlay = document.getElementById('players-overlay');
    const isShown = overlay.classList.toggle('show');
    // Re-render list every time opened
    if (isShown && currentRoomData) renderOverlayPlayerList(currentRoomData);
    refreshBodyUiState();
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
    <span style="display:flex;align-items:center;gap:7px;">
        ${isMod
                ? '<i class="fa-solid fa-crown" style="color:#FFB800;"></i>'
                : '<i class="fa-solid fa-user" style="color:#94A3B8;"></i>'
            }
        ${escapeHTML(p.name)}${isMe ? ' <span style="font-size:0.7rem;color:#94A3B8;">(Kamu)</span>' : ''}
    </span>
    ${(!isMod && !isMe)
                ? `<button class="btn-kick" onclick="kickPlayer('${pid}','${escapeHTML(p.name)}')">KICK</button>`
                : '<span style="font-size:0.7rem;font-weight:800;color:#94A3B8;">' + (isMod ? 'MOD' : '') + '</span>'
            }
`;
        list.appendChild(item);
    }
}

// ============================================================
//                       GAME FLOW
// ============================================================
function getSelectedEditionId(data = currentRoomData) {
    return (data && data.selectedEdition) ? data.selectedEdition : 'classic';
}

function goToEdition() {
    if (!isModerator) return;
    roomRef.update({
        status: 'edition',
        selectedEdition: null,
        selectedCategory: null,
        currentCard: null,
        vote: null,
        shuffleSignal: null,
        usedCards: null
    });
}

function goToCategory() {
    goToEdition();
}

function backToEdition() {
    if (!isModerator) return;
    roomRef.update({
        status: 'edition',
        selectedEdition: null,
        selectedCategory: null,
        currentCard: null,
        vote: null,
        shuffleSignal: null,
        usedCards: null
    });
}

function selectEdition(editionId) {
    if (!isModerator) return;
    if (!getEdition(editionId)) return;

    roomRef.update({
        status: 'category',
        selectedEdition: editionId,
        selectedCategory: null,
        currentCard: null,
        vote: null,
        shuffleSignal: null,
        usedCards: null
    });
}

function selectCategory(catId, editionId = getSelectedEditionId()) {
    if (!isModerator) return;
    const edition = getEdition(editionId);
    const cat = getEditionCategory(editionId, catId);
    if (!cat) return;

    roomRef.update({
        status: 'playing',
        selectedEdition: editionId,
        selectedCategory: catId,
        currentCard: {
            text: 'Tekan "Acak Kartu!" untuk mulai permainan.',
            editionId: editionId,
            editionName: edition ? edition.name : 'Edisi Klasik',
            categoryId: catId,
            categoryName: cat.name,
            categoryHexColor: cat.hexColor,
            categoryIcon: cat.icon,
            isIntro: true
        },
        vote: null,
        shuffleSignal: null,
        usedCards: null
    });
}

function getCategDeck(catId, editionId = getSelectedEditionId()) {
    return getEditionDeck(editionId, catId);
}

function triggerShuffle() {
    if (!isModerator || isShuffling) return;
    if (!currentRoomData || currentRoomData.status !== 'playing') return;

    initAudio(); // pastikan AudioContext aktif saat user gesture

    const editionId = getSelectedEditionId();
    const edition = getEdition(editionId);
    const catId = currentRoomData.selectedCategory;
    const cat = getEditionCategory(editionId, catId);
    if (!cat) return;
    let deck = getCategDeck(catId, editionId);
    if (!deck.length) return;

    let usedCards = currentRoomData.usedCards || [];
    let availableDeck = deck.filter(q => !usedCards.includes(q));

    if (!availableDeck.length) {
        showInfoToast("Semua kartu sudah dimainkan! Mengacak ulang deck.");
        availableDeck = deck;
        usedCards = [];
    }

    const randomQ = availableDeck[Math.floor(Math.random() * availableDeck.length)];
    usedCards.push(randomQ);
    const signalId = 'sig_' + Math.random().toString(36).substr(2, 9);
    const startTimeStamp = firebase.database.ServerValue.TIMESTAMP;

    roomRef.update({
        status: 'shuffling',
        usedCards: usedCards,
        shuffleSignal: {
            id: signalId,
            startAt: startTimeStamp,
            card: {
                text: randomQ,
                editionId: editionId,
                editionName: edition ? edition.name : 'Edisi Klasik',
                categoryId: catId,
                categoryName: cat.name,
                categoryHexColor: cat.hexColor,
                categoryIcon: cat.icon,
                isIntro: false
            }
        }
    });
}

function handleShuffleSignal(signal) {
    if (lastProcessedShuffleSignalId === signal.id) return;
    lastProcessedShuffleSignalId = signal.id;

    initAudio();

    const editionId = getSelectedEditionId();
    const catId = currentRoomData ? currentRoomData.selectedCategory : 'level1';
    const deck = getCategDeck(catId, editionId);
    if (!deck.length) return;
    const cardEl = document.getElementById('sp-card');
    const textEl = document.getElementById('sp-card-text');

    isShuffling = true;
    cardEl.classList.add('animate-shuffle');

    // Disable Acak Kartu during shuffle
    const btnAcak = document.getElementById('btn-acak');
    if (btnAcak) btnAcak.disabled = true;

    const shuffleSpeed = 100;
    const duration = 2000;

    const localStart = Date.now();

    const interval = setInterval(() => {
        const randomQ = deck[Math.floor(Math.random() * deck.length)];
        textEl.textContent = '...' + randomQ;
        playTickSound();

        if (Date.now() - localStart >= duration) {
            clearInterval(interval);

            // Final reveal
            textEl.textContent = '...' + signal.card.text;
            cardEl.classList.remove('animate-shuffle');
            cardEl.classList.remove('animate-pop');
            void cardEl.offsetWidth; // reflow
            cardEl.classList.add('animate-pop');

            playStopSound();

            isShuffling = false;
            if (btnAcak) btnAcak.disabled = false;

            // Moderator writes final state to Firebase
            if (isModerator && currentRoomData && currentRoomData.status === 'shuffling') {
                roomRef.update({ status: 'playing', currentCard: signal.card });
            }
        }
    }, shuffleSpeed);
}

function startVote() {
    if (!isModerator) return;
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    if (!currentRoomData.currentCard || currentRoomData.currentCard.isIntro) return;
    
    const players = currentRoomData.players || {};
    const updates = { status: 'voting', vote: { active: true, votes: {}, startTime: firebase.database.ServerValue.TIMESTAMP } };
    for (let pid in players) {
        updates[`players/${pid}/joinedMidGame`] = null;
    }
    roomRef.update(updates);
}

function submitVote(targetPlayerId) {
    if (!currentRoomData || currentRoomData.status !== 'voting') return;
    const myPlayerData = currentRoomData.players && currentRoomData.players[myPlayerId];
    if (myPlayerData && myPlayerData.joinedMidGame) {
        showInfoToast('Kamu bergabung di tengah sesi vote ini. Tunggu sesi berikutnya!', 'ph-hourglass');
        return;
    }
    const alreadyVoted = currentRoomData.vote && currentRoomData.vote.votes && currentRoomData.vote.votes[myPlayerId];
    if (alreadyVoted) return;
    initAudio();
    playVoteSubmitSound();
    roomRef.child('vote/votes/' + myPlayerId).set(targetPlayerId);
}

function revealResults(force = false) {
    if (!isModerator || !currentRoomData) return;
    const playersCount = currentRoomData.players ? Object.keys(currentRoomData.players).length : 0;
    const votesCount = currentRoomData.vote && currentRoomData.vote.votes ? Object.keys(currentRoomData.vote.votes).length : 0;
    if (!force && votesCount < playersCount) return;

    initAudio();
    playTadaSound();

    // Accumulate leaderboard score for winner(s) of this round
    const players = currentRoomData.players || {};
    const votes = (currentRoomData.vote && currentRoomData.vote.votes) ? currentRoomData.vote.votes : {};
    const voteCounts = {};
    for (let pid in players) voteCounts[pid] = 0;
    for (let voter in votes) {
        const target = votes[voter];
        if (voteCounts[target] !== undefined) voteCounts[target]++;
    }
    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    const updates = { status: 'results' };
    if (maxVotes > 0) {
        const roundsPlayed = (currentRoomData.leaderboard && currentRoomData.leaderboard._rounds) ? currentRoomData.leaderboard._rounds + 1 : 1;
        updates['leaderboard/_rounds'] = roundsPlayed;
        for (let pid in voteCounts) {
            if (voteCounts[pid] === maxVotes) {
                const prevWins = (currentRoomData.leaderboard && currentRoomData.leaderboard[pid]) ? currentRoomData.leaderboard[pid] : 0;
                updates['leaderboard/' + pid] = prevWins + 1;
            }
        }
    }
    roomRef.update(updates);
}

function playAgain() {
    if (!isModerator) return;
    roomRef.update({ status: 'playing', vote: null });
}

async function backToCategory() {
    if (!isModerator) return;
    const ok = await showConfirm('Ganti kategori? Kartu saat ini dan sesi vote akan direset.', 'Ganti Kategori?', 'ph-arrow-clockwise');
    if (!ok) return;
    roomRef.update({
        status: 'category',
        selectedEdition: getSelectedEditionId(),
        vote: null,
        currentCard: null,
        shuffleSignal: null,
        selectedCategory: null,
        usedCards: null
    });
}

// ============================================================
//                       CUSTOM CARD
// ============================================================
function toggleCustomOverlay() {
    if (!isModerator) return;
    const overlay = document.getElementById('custom-overlay');
    const isShown = overlay.classList.toggle('show');
    if (isShown) {
        const input = document.getElementById('custom-card-input');
        input.value = '';
        setTimeout(() => input.focus(), 100);
    } else {
        overlay.classList.remove('keyboard-focus');
    }
    refreshBodyUiState();
}

function submitCustomCard() {
    if (!isModerator || isShuffling) return;
    if (!currentRoomData || currentRoomData.status !== 'playing') return;

    const text = document.getElementById('custom-card-input').value.trim();
    if (!text) {
        showInfoToast("Tulis pertanyaan dulu!");
        return;
    }
    toggleCustomOverlay();
    
    initAudio();

    const editionId = getSelectedEditionId();
    const edition = getEdition(editionId);
    const catId = currentRoomData.selectedCategory;
    const cat = getEditionCategory(editionId, catId) || getEditionCategories(editionId)[0];
    if (!cat) return;
    
    const signalId = 'sig_' + Math.random().toString(36).substr(2, 9);
    const startTimeStamp = firebase.database.ServerValue.TIMESTAMP;

    roomRef.update({
        status: 'shuffling',
        shuffleSignal: {
            id: signalId,
            startAt: startTimeStamp,
            card: {
                text: text,
                editionId: editionId,
                editionName: edition ? edition.name : 'Edisi Klasik',
                categoryId: catId,
                categoryName: cat.name,
                categoryHexColor: cat.hexColor,
                categoryIcon: cat.icon,
                isIntro: false
            }
        }
    });
}

async function backToLobbyFromGame() {
    if (!isModerator) return;
    const ok = await showConfirm('Kembali ke Lobby? Sesi vote aktif akan dihapus dan semua pemain kembali ke lobby.', 'Ke Lobby?', 'ph-house');
    if (!ok) return;
    roomRef.update({
        status: 'lobby',
        vote: null,
        currentCard: null,
        shuffleSignal: null,
        usedCards: null,
        selectedEdition: null,
        selectedCategory: null
    });
}

// ============================================================
//                   SECRET PANEL
// ============================================================
let secretTapCount = 0;
let secretTapTimer = null;

function handleRoomBadgeTap() {
    if (!isModerator) return;
    if (!currentRoomData || (currentRoomData.status !== 'voting' && currentRoomData.status !== 'results')) return;

    secretTapCount++;
    clearTimeout(secretTapTimer);

    if (secretTapCount >= 5) {
        secretTapCount = 0;
        openSecretPanel();
    } else {
        secretTapTimer = setTimeout(() => { secretTapCount = 0; }, 1500);
    }
}

function openSecretPanel() {
    if (!isModerator) return;
    if (!currentRoomData || (currentRoomData.status !== 'voting' && currentRoomData.status !== 'results')) return;
    
    renderSecretVoteList(currentRoomData);
    document.getElementById('secret-vote-panel').classList.add('show');
    refreshBodyUiState();
}

function closeSecretPanel() {
    document.getElementById('secret-vote-panel').classList.remove('show');
    refreshBodyUiState();
}

function renderSecretVoteList(data) {
    if (!isModerator) return;
    
    const players = data.players || {};
    const votes = (data.vote && data.vote.votes) ? data.vote.votes : {};
    const list = document.getElementById('secret-vote-list');
    list.innerHTML = '';
    
    for (let pid in players) {
        const p = players[pid];
        const votedForId = votes[pid];
        const votedFor = votedForId ? players[votedForId] : null;
        
        const row = document.createElement('div');
        row.className = 'secret-vote-row';
        
        const voterEmoji = p.emoji || '👤';
        const voterName = escapeHTML(p.name);
        
        let targetHTML = '';
        if (votedFor) {
            const targetEmoji = votedFor.emoji || '👤';
            const targetName = escapeHTML(votedFor.name);
            targetHTML = `<span class="secret-target-name">${targetEmoji} ${targetName}</span>`;
        } else {
            targetHTML = `<span class="secret-no-vote">belum vote</span>`;
        }
        
        row.innerHTML = `
            <span class="secret-voter-name"><span style="font-size:1.1rem;">${voterEmoji}</span> ${voterName}</span>
            <span class="secret-arrow">→</span>
            ${targetHTML}
        `;
        list.appendChild(row);
    }
}

// ============================================================
//                       UI RENDERING
// ============================================================
function updateUI(data) {
    const st = data.status;
    const votePanel = document.getElementById('vote-panel');
    const resultsPanel = document.getElementById('results-panel');

    if (st === 'lobby') {
        votePanel.classList.remove('show');
        resultsPanel.classList.remove('show');
        showScreen('lobby-screen');
        renderLobby(data);
    } else if (st === 'edition') {
        votePanel.classList.remove('show');
        resultsPanel.classList.remove('show');
        showScreen('edition-screen');
        renderEdition(data);
    } else if (st === 'category') {
        votePanel.classList.remove('show');
        resultsPanel.classList.remove('show');
        showScreen('category-screen');
        renderCategory(data);
    } else {
        // playing, shuffling, voting, results
        showScreen('play-screen');
        renderPlay(data);
    }
}

function renderEdition(data) {
    const list = document.getElementById('online-edition-list');
    list.innerHTML = '';
    document.getElementById('edition-room-badge').textContent = 'ROOM: ' + myRoomCode;

    if (!isModerator) {
        list.innerHTML = `
    <div class="rendered-warning">
        <span style="font-size:1.4rem;">&#9203;</span>
        <span style="font-size:0.8rem;font-weight:800;color:#92400E;line-height:1.3;">Menunggu Moderator memilih edisi...</span>
    </div>
`;
    }

    editionsConfig.forEach(edition => {
        const categories = getEditionCategories(edition.id);
        const database = getEditionDatabase(edition.id);
        const total = Object.values(database).reduce((sum, deck) => sum + deck.length, 0);

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.style.background = edition.hexColor;

        if (isModerator) {
            btn.onclick = () => selectEdition(edition.id);
        } else {
            btn.style.pointerEvents = 'none';
            btn.style.userSelect = 'none';
            btn.style.cursor = 'default';
        }

        btn.innerHTML = `
    <div class="cat-icon-box">
        <i class="ph-bold ${edition.icon}" style="font-size:22px;color:${edition.hexColor};"></i>
    </div>
    <div class="rendered-card-copy">
        <div class="rendered-card-title">${edition.name}</div>
        <div class="rendered-card-desc">${edition.desc}</div>
        <div class="rendered-card-meta">
            ${categories.length} kategori &middot; ${total} kartu
        </div>
    </div>
`;
        list.appendChild(btn);
    });
}

function renderLobby(data) {
    const players = data.players || {};
    const playersCount = Object.keys(players).length;

    document.getElementById('lobby-room-code').textContent = myRoomCode;
    document.getElementById('player-count').textContent = playersCount;

    const progressPct = Math.min((playersCount / 3) * 100, 100);
    const progressFill = document.getElementById('lobby-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPct}%`;
    const progressContainer = document.getElementById('lobby-progress-container');
    const progressLabel = document.getElementById('lobby-progress-label');
    if (progressLabel) {
        progressLabel.textContent = `${playersCount}/3 pemain untuk mulai`;
    }
    if (progressContainer) {
        if (playersCount >= 3) {
            progressContainer.style.display = 'none';
            if (progressLabel) progressLabel.style.display = 'none';
        } else {
            progressContainer.style.display = 'block';
            if (progressLabel) progressLabel.style.display = 'block';
        }
    }

    // Player list
    const pList = document.getElementById('player-list');
    pList.innerHTML = '';
    for (let pid in players) {
        const p = players[pid];
        const isMod = pid === data.moderator;
        const isMe = pid === myPlayerId;
        const showKick = isModerator && !isMod && !isMe;
        const item = document.createElement('div');
        item.className = 'player-list-item';
        item.innerHTML = `
    <span style="display:flex;align-items:center;gap:6px;">
        ${isMod ? '<i class="fa-solid fa-crown" style="color:#FFB800;font-size:0.9rem;"></i>' : '<i class="fa-solid fa-user" style="color:#94A3B8;font-size:0.85rem;"></i>'}
        <span style="font-size:1.2rem;line-height:1;">${p.emoji || '👤'}</span>
        ${escapeHTML(p.name)}${isMe ? ' <span style="font-size:0.7rem;color:#94A3B8;">(Kamu)</span>' : ''}
    </span>
    <span>
        ${showKick ? `<button class="btn-kick" onclick="kickPlayer('${pid}','${escapeHTML(p.name)}')">KICK</button>` : ''}
    </span>
`;
        pList.appendChild(item);
    }

    // Mod vs player view
    const modControls = document.getElementById('mod-lobby-controls');
    const waitingMsg = document.getElementById('lobby-waiting-msg');
    if (isModerator) {
        modControls.style.display = 'flex';
        waitingMsg.style.display = 'none';
        const btnStart = document.getElementById('btn-start-game');
        if (playersCount >= 3) {
            btnStart.disabled = false;
            btnStart.innerHTML = '<i class="ph-bold ph-play"></i> Mulai Permainan!';
        } else {
            btnStart.disabled = true;
            btnStart.innerHTML = `<i class="ph-bold ph-hourglass"></i> Menunggu (${playersCount}/3 min. pemain)`;
        }
    } else {
        modControls.style.display = 'none';
        waitingMsg.style.display = 'block';
    }
}

function renderCategory(data) {
    const list = document.getElementById('online-category-list');
    list.innerHTML = '';
    document.getElementById('cat-room-badge').textContent = 'ROOM: ' + myRoomCode;
    const editionId = getSelectedEditionId(data);
    const edition = getEdition(editionId);
    const categories = getEditionCategories(editionId);
    const title = document.getElementById('category-screen-title');
    if (title) title.textContent = edition ? edition.name : 'Pilih Kategori';

    // Non-mod: show waiting banner on top
    if (!isModerator) {
        list.innerHTML = `
    <div class="rendered-warning">
        <span style="font-size:1.4rem;">&#9203;</span>
        <span style="font-size:0.8rem;font-weight:800;color:#92400E;line-height:1.3;">Menunggu Moderator memilih kategori ${edition ? edition.name : ''}...</span>
    </div>
`;
    }

    const usedCards = data.usedCards || [];

    // Semua pemain lihat daftar kategori
    categories.forEach(cat => {
        let total, used;
        if (cat.id === 'all') {
            total = getEditionDeck(editionId, 'all').length;
            used = usedCards.length;
        } else {
            const deck = getEditionDeck(editionId, cat.id);
            total = deck.length;
            used = usedCards.filter(q => deck.includes(q)).length;
        }
        const pct = total > 0 ? Math.round((used / total) * 100) : 0;

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.style.background = cat.hexColor;

        if (isModerator) {
            btn.onclick = () => selectCategory(cat.id, editionId);
        } else {
            btn.style.pointerEvents = 'none';
            btn.style.userSelect = 'none';
            btn.style.cursor = 'default';
        }

        btn.innerHTML = `
    <div class="cat-icon-box">
        <i class="ph-bold ${cat.icon}" style="font-size:22px;color:${cat.hexColor};"></i>
    </div>
    <div class="rendered-card-copy">
        <div class="rendered-card-title">${cat.name}</div>
        <div class="rendered-card-desc">${cat.desc}</div>
        <div class="rendered-progress">
            <div class="rendered-progress-fill" style="width:${pct}%;"></div>
        </div>
        <div class="rendered-card-meta">
            ${used}/${total} kartu dimainkan
        </div>
    </div>
`;
        list.appendChild(btn);
    });
}

function renderPlay(data) {
    const st = data.status;
    if (st !== 'voting' && st !== 'results') {
        closeSecretPanel();
    }
    document.getElementById('play-room-badge').textContent = 'ROOM: ' + myRoomCode;
    document.getElementById('sp-card-room').textContent = myRoomCode;

    const votePanel = document.getElementById('vote-panel');
    const resultsPanel = document.getElementById('results-panel');
    const modPlayControls = document.getElementById('mod-play-controls');
    const btnAcak = document.getElementById('btn-acak');
    const btnCustom = document.getElementById('btn-custom');
    const btnStartVote = document.getElementById('btn-start-vote');
    const modVoteControls = document.getElementById('mod-vote-controls');
    const modResultsCtrls = document.getElementById('mod-results-controls');
    // Moderator block
    modPlayControls.style.display = isModerator ? 'flex' : 'none';
    if (modVoteControls) modVoteControls.style.display = isModerator ? 'block' : 'none';
    if (modResultsCtrls) modResultsCtrls.style.display = isModerator ? 'flex' : 'none';
    const btnBackCat = document.getElementById('btn-back-to-category');
    if (btnBackCat) btnBackCat.style.display = isModerator ? 'flex' : 'none';

    // Leaderboard buttons visibility
    const hasLeaderboard = data.leaderboard && data.leaderboard._rounds > 0;
    const btnLbMod = document.getElementById('btn-leaderboard-mod');
    const btnLbPlayer = document.getElementById('btn-leaderboard-player');
    if (isModerator) {
        if (btnLbMod) btnLbMod.style.display = hasLeaderboard ? 'flex' : 'none';
        if (btnLbPlayer) btnLbPlayer.style.display = 'none';
    } else {
        if (btnLbMod) btnLbMod.style.display = 'none';
        if (btnLbPlayer) btnLbPlayer.style.display = hasLeaderboard ? 'flex' : 'none';
    }

    // Keep leaderboard overlay fresh if open
    const lbOverlay = document.getElementById('leaderboard-overlay');
    if (lbOverlay && lbOverlay.classList.contains('show')) renderLeaderboard(data);

    // Keep overlay player list fresh (if open)
    const overlay = document.getElementById('players-overlay');
    if (overlay && overlay.classList.contains('show')) renderOverlayPlayerList(data);

    // Update card (unless currently animating shuffle)
    if (data.currentCard && !isShuffling) {
        renderCardData(data.currentCard);
    }

    if (st === 'playing') {
        votePanel.classList.remove('show');
        resultsPanel.classList.remove('show');
        document.getElementById('sp-card-area').classList.remove('panel-open');
        if (isModerator) {
            btnAcak.disabled = false;
            btnAcak.style.display = 'flex';
            if (btnCustom) {
                btnCustom.disabled = false;
                btnCustom.style.display = 'flex';
            }
            // Show "Mulai Vote" always when playing (even before first card)
            const showVote = data.currentCard && !data.currentCard.isIntro;
            btnStartVote.style.display = 'flex';
            btnStartVote.disabled = false;
            if (btnLbMod) btnLbMod.style.display = (showVote && hasLeaderboard) ? 'flex' : (hasLeaderboard ? 'flex' : 'none');
        }
    }
    else if (st === 'shuffling') {
        votePanel.classList.remove('show');
        resultsPanel.classList.remove('show');
        document.getElementById('sp-card-area').classList.remove('panel-open');
        if (isModerator) {
            btnAcak.disabled = true;
            btnAcak.style.display = 'flex';
            if (btnCustom) {
                btnCustom.disabled = true;
                btnCustom.style.display = 'flex';
            }
            btnStartVote.style.display = 'flex';
            btnStartVote.disabled = true;
        }
        if (!isShuffling && data.shuffleSignal) {
            handleShuffleSignal(data.shuffleSignal);
        }
    }
    else if (st === 'voting') {
        if (data.currentCard && !isShuffling) renderCardData(data.currentCard);
        resultsPanel.classList.remove('show');
        renderVotePanel(data);
        if (!votePanel.classList.contains('show')) {
            setTimeout(() => {
                votePanel.classList.add('show');
                document.getElementById('sp-card-area').classList.add('panel-open');
                refreshBodyUiState();
            }, 50);
        }
        if (isModerator) {
            btnAcak.disabled = true;
            btnAcak.style.display = 'flex';
            if (btnCustom) {
                btnCustom.disabled = true;
                btnCustom.style.display = 'flex';
            }
            btnStartVote.style.display = 'none';
        }
    }
    else if (st === 'results') {
        votePanel.classList.remove('show');
        if (data.currentCard && !isShuffling) renderCardData(data.currentCard);
        renderResultsPanel(data);
        if (!resultsPanel.classList.contains('show')) {
            setTimeout(() => {
                resultsPanel.classList.add('show');
                document.getElementById('sp-card-area').classList.add('panel-open');
                refreshBodyUiState();
            }, 50);
        }
        if (isModerator) {
            btnAcak.style.display = 'none';
            if (btnCustom) btnCustom.style.display = 'none';
            btnStartVote.style.display = 'none';
        }
    }
    refreshBodyUiState();
}

function renderCardData(cardData) {
    if (!cardData) return;
    const hexColor = cardData.categoryHexColor || '#10b981';
    const iconClass = cardData.categoryIcon || 'ph-fire';
    const catName = cardData.categoryName || 'SI PALING';
    const editionName = cardData.editionName || 'Edisi Klasik';

    document.getElementById('sp-card-header').style.backgroundColor = hexColor;
    document.getElementById('sp-card-edition').textContent = editionName.toUpperCase();
    document.getElementById('sp-card-lvl').textContent = catName.toUpperCase();
    document.getElementById('sp-card-icon').innerHTML = `<i class="ph-fill ${iconClass}"></i>`;
    document.getElementById('sp-card-icon').style.color = hexColor;
    document.getElementById('sp-card-text').textContent = cardData.isIntro
        ? cardData.text
        : '...' + cardData.text;
}

function renderVotePanel(data) {
    const players = data.players || {};
    const votes = (data.vote && data.vote.votes) ? data.vote.votes : {};
    const playersCount = Object.keys(players).length;
    const votesCount = Object.keys(votes).length;
    const myVote = votes[myPlayerId];
    const hasVoted = !!myVote;

    // Mini status label
    document.getElementById('vote-status-label').textContent = votesCount + '/' + playersCount + ' sudah vote';
    
    const progressPct = playersCount > 0 ? (votesCount / playersCount) * 100 : 0;
    const progressFill = document.getElementById('vote-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPct}%`;
    
    const myPlayerData = players[myPlayerId];
    if (myPlayerData && myPlayerData.joinedMidGame) {
        document.getElementById('vote-status-label').textContent = 'Kamu bergabung di tengah sesi. Tunggu sesi berikutnya!';
    }

    // Build player buttons grid
    const grid = document.getElementById('vote-player-grid');
    grid.innerHTML = '';
    for (let pid in players) {
        const p = players[pid];
        const isSelf = pid === myPlayerId;
        const isChosen = myVote === pid;
        const btn = document.createElement('button');
        btn.className = 'btn-vote-player vote-btn' + (isChosen ? ' voted-mine selected' : '');
        btn.innerHTML = `
            <span class="vote-player-emoji">${p.emoji || '👤'}</span>
            <span class="vote-player-name">
                ${escapeHTML(p.name)}${isSelf ? ' (Kamu)' : ''}
            </span>
        `;
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'center';
        const isMidGame = myPlayerData && myPlayerData.joinedMidGame;
        btn.disabled = hasVoted || isMidGame;
        if (!hasVoted && !isMidGame) btn.onclick = () => submitVote(pid);
        grid.appendChild(btn);
    }

    // Moderator: Buka Hasil button
    if (isModerator) {
        const btnReveal = document.getElementById('btn-reveal-vote');
        const canReveal = votesCount >= playersCount;
        btnReveal.disabled = false;
        btnReveal.innerHTML = canReveal
            ? '<i class="ph-bold ph-chart-bar"></i> Buka Hasil Vote'
            : `<i class="ph-bold ph-chart-bar"></i> Buka Hasil (${votesCount}/${playersCount})`;
    }
}

function renderResultsPanel(data) {
    const players = data.players || {};
    const votes = (data.vote && data.vote.votes) ? data.vote.votes : {};



    // Count votes per player
    const voteCounts = {};
    for (let pid in players) voteCounts[pid] = 0;
    for (let voter in votes) {
        const target = votes[voter];
        if (voteCounts[target] !== undefined) voteCounts[target]++;
    }

    // Sort: votes desc, then name asc
    const sorted = Object.keys(voteCounts).sort((a, b) => {
        const diff = voteCounts[b] - voteCounts[a];
        if (diff !== 0) return diff;
        return (players[a] ? players[a].name : '').localeCompare(players[b] ? players[b].name : '');
    });

    const maxVotes = sorted.length > 0 ? voteCounts[sorted[0]] : 0;

    const list = document.getElementById('results-list');
    list.innerHTML = '';

    if (sorted.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#94A3B8;font-weight:700;">Tidak ada data pemain.</p>';
        return;
    }

    const isMeWinner = sorted.length > 0 && voteCounts[myPlayerId] === maxVotes && maxVotes > 0;
    const rounds = (data.leaderboard && data.leaderboard._rounds) || 0;
    const currentVoteId = data.vote && data.vote.startTime ? `${data.vote.startTime}_r${rounds}` : null;
    if (isMeWinner && currentVoteId && currentVoteId !== lastFiredConfettiVoteId) {
        lastFiredConfettiVoteId = currentVoteId;
        triggerConfetti();
    }

    let rank = 0;
    let prevCount = -1;
    sorted.forEach(pid => {
        const p = players[pid];
        if (!p) return;
        const count = voteCounts[pid];
        const isWinner = count === maxVotes && maxVotes > 0;

        if (count !== prevCount) {
            rank++;
            prevCount = count;
        }
        const rankSymbol = rank === 1
            ? '<i class="ph-fill ph-trophy"></i>'
            : rank === 2
                ? '<i class="ph-fill ph-medal"></i>'
                : rank === 3
                    ? '<i class="ph-bold ph-medal"></i>'
                    : rank + '.';

        const item = document.createElement('div');
        item.className = 'result-item' + (isWinner ? ' winner' : '');
        item.innerHTML = `
    <div class="result-rank">${rankSymbol}</div>
    <div class="result-name"><span style="font-size:1rem;">${p.emoji || '👤'}</span> ${escapeHTML(p.name)}${pid === myPlayerId ? ' <span style="font-size:0.65rem;opacity:0.7;">(Kamu)</span>' : ''}</div>
    <div class="result-vote-badge">${count} vote${count !== 1 ? 's' : ''}</div>
`;
        list.appendChild(item);
    });
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            zIndex: 2000,
            colors: ['#FFB800', '#10b981', '#3b82f6', '#ec4899', '#f97316']
        });
    }
}

// ============================================================
//                     LEADERBOARD
// ============================================================
function toggleLeaderboard() {
    const overlay = document.getElementById('leaderboard-overlay');
    const isShown = overlay.classList.toggle('show');
    if (isShown && currentRoomData) renderLeaderboard(currentRoomData);
    refreshBodyUiState();
}

function renderLeaderboard(data) {
    const players = data.players || {};
    const lb = data.leaderboard || {};
    const rounds = lb._rounds || 0;

    document.getElementById('lb-round-info').textContent = rounds + ' ronde dimainkan';

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    // Build entries for players currently in room
    const entries = [];
    for (let pid in players) {
        entries.push({ pid, name: players[pid].name, emoji: players[pid].emoji, wins: lb[pid] || 0, isMe: pid === myPlayerId });
    }

    if (entries.length === 0) {
        list.innerHTML = '<div class="lb-empty">Belum ada data pemain.</div>';
        return;
    }

    // Sort by wins desc, then name asc
    entries.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

    if (entries.every(e => e.wins === 0)) {
        list.innerHTML = '<div class="lb-empty">Belum ada ronde selesai.<br><br><i class="ph-bold ph-game-controller"></i> Mainkan beberapa ronde dulu!</div>';
        return;
    }

    let rank = 0;
    let prevWins = -1;
    entries.forEach(entry => {
        if (entry.wins !== prevWins) { rank++; prevWins = entry.wins; }
        const rankIcon = rank === 1
            ? '<i class="ph-fill ph-medal"></i>'
            : rank === 2
                ? '<i class="ph-bold ph-medal"></i>'
                : rank === 3
                    ? '<i class="ph-bold ph-medal"></i>'
                    : rank + '.';
        const rowClass = rank === 1 ? 'lb-gold' : rank === 2 ? 'lb-silver' : rank === 3 ? 'lb-bronze' : '';
        const row = document.createElement('div');
        row.className = 'lb-row ' + rowClass;
        row.innerHTML = `
            <div class="lb-rank">${rankIcon}</div>
            <div class="lb-name"><span style="font-size:1rem;">${entry.emoji || '👤'}</span> ${escapeHTML(entry.name)}${entry.isMe ? ' <span style="font-size:0.65rem;opacity:0.7;">(Kamu)</span>' : ''}</div>
            <div class="lb-score">
                <div class="lb-wins">${entry.wins}x <i class="ph-fill ph-trophy"></i></div>
            </div>
        `;
        list.appendChild(row);
    });
}

// ============================================================
//                    SESSION RESTORE
// ============================================================
function restoreSession() {
    if (!_saved || !_saved.roomCode) return;

    db.ref('rooms/' + _saved.roomCode).once('value', snapshot => {
        const data = snapshot.val();
        if (!data) { resetToHome(); return; }

        // Was kicked?
        if (data.kickedPlayers && data.kickedPlayers[_saved.pid]) { clearSession(); return; }

        myPlayerId = _saved.pid;
        myName = _saved.name;
        myRoomCode = _saved.roomCode;
        isModerator = (data.moderator === _saved.pid);
        roomRef = db.ref('rooms/' + myRoomCode);

        if (!isModerator) {
            pRef = roomRef.child('players/' + myPlayerId);
            pRef.set({ name: _saved.name, emoji: _saved.emoji || '' }); // Re-assert presence
        }

        listenToRoom();
        updateUI(data);
    });
}

// Init
function showInfoToast(msg, iconClass = 'ph-info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="ph-bold ${iconClass}"></i><span>${escapeHTML(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setupMobilePolish() {
    refreshBodyUiState();

    const customInput = document.getElementById('custom-card-input');
    const customOverlay = document.getElementById('custom-overlay');
    if (customInput && customOverlay) {
        customInput.addEventListener('focus', () => customOverlay.classList.add('keyboard-focus'));
        customInput.addEventListener('blur', () => customOverlay.classList.remove('keyboard-focus'));
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', refreshBodyUiState);
        window.visualViewport.addEventListener('scroll', refreshBodyUiState);
    } else {
        window.addEventListener('resize', refreshBodyUiState);
    }
}

window.onload = () => {
    setupMobilePolish();
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        const input = document.getElementById('room-code-input');
        if (input) input.value = roomFromUrl.toUpperCase();
        
        if (_saved && _saved.roomCode === roomFromUrl.toUpperCase()) {
            showInfoToast('Melanjutkan sesi sebelumnya...', 'ph-arrow-clockwise');
        } else {
            showInfoToast('Masukkan nama untuk bergabung ke room ' + roomFromUrl.toUpperCase(), 'ph-sign-in');
        }
    }
};

restoreSession();
