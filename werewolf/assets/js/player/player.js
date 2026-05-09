let playerRoomCode = '';
let playerName = '';
const PLAYER_SESSION_KEY = 'werewolf_player_session';
let savedPlayerSessionAtBoot = null;
try {
 savedPlayerSessionAtBoot = JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) || 'null');
} catch (e) {
 savedPlayerSessionAtBoot = null;
}
let playerId = localStorage.getItem('werewolf_player_id') || savedPlayerSessionAtBoot?.playerId;
if (!playerId) {
 playerId = 'p_' + Math.random().toString(36).slice(2, 11);
}
try {
 localStorage.setItem('werewolf_player_id', playerId);
} catch (e) {
 // Storage may be unavailable in private browsing.
}

let myRoleData = null;
let playerIsDead = false;
let playerTimerInterval = null;
let playerListenersAttached = false;
let playerListeningRoomCode = '';
let playerMetaRef = null;
let playerSelfRef = null;
let playerListRef = null;
let playerTimerRef = null;
let playerVotesRef = null;
let playerCurrentMeta = null;
let playerCurrentSelf = null;
let playerCurrentPlayers = {};
let playerCurrentVotes = {};
let playerRemovalTimer = null;
let playerTimerBuzzedForUpdate = null;
let playerTimerHasBuzzed = false;

function getPlayerTimerNow() {
 return typeof window.getWerewolfSyncedNow === 'function' ? window.getWerewolfSyncedNow() : Date.now();
}

document.addEventListener('DOMContentLoaded', () => {
 const params = new URLSearchParams(window.location.search);
 const requestedMode = window.WEREWOLF_BOOT_MODE;
 const savedSession = loadPlayerSession();
 const savedModeratorRoom = localStorage.getItem('werewolf_online_room');
 const shouldRestorePlayerMode = requestedMode === 'join' || (!!savedSession?.roomCode && !savedModeratorRoom);

 if (shouldRestorePlayerMode) {
 showPlayerMode();
 const roomInput = document.getElementById('inputRoom');
 const nameInput = document.getElementById('inputName');
 if (params.has('room') && roomInput) {
 roomInput.value = params.get('room').toUpperCase();
 } else if (savedSession?.roomCode && roomInput) {
 roomInput.value = savedSession.roomCode;
 }
 if (savedSession?.name && nameInput) {
 nameInput.value = savedSession.name;
 }
 const canRestoreRoom = savedSession?.roomCode === (roomInput?.value || '').trim().toUpperCase();
 if (canRestoreRoom && nameInput?.value && roomInput?.value) {
 joinRoom({ silent: true });
 }
 return;
 }

 if (!document.body.classList.contains('mode-moderator')) {
 document.body.classList.add('mode-unselected');
 }
});

function setBodyMode(mode) {
 document.body.classList.remove('mode-unselected', 'mode-moderator', 'mode-player');
 document.body.classList.add(mode);
}

function showOnlineChoices() {
 const actions = document.getElementById('onlineChoiceActions');
 if (actions) actions.style.display = 'grid';
}

function chooseOfflineMode() {
 if (typeof initializeModeratorApp === 'function') initializeModeratorApp();
 const onlineSection = document.getElementById('onlineSetupSection');
 if (onlineSection) onlineSection.style.display = 'none';
 setBodyMode('mode-moderator');
 if (typeof switchTab === 'function') switchTab('setup');
}

async function chooseOnlineHost() {
 if (typeof verifyCreateRoomPin === 'function' && !(await verifyCreateRoomPin())) return;

 if (typeof initializeModeratorApp === 'function') initializeModeratorApp();
 const onlineSection = document.getElementById('onlineSetupSection');
 if (onlineSection) onlineSection.style.display = '';
 setBodyMode('mode-moderator');
 if (typeof switchTab === 'function') switchTab('setup');
 const savedRoom = localStorage.getItem('werewolf_online_room');
 if (!onlineRoomCode && savedRoom && db && typeof attachRoomListeners === 'function') {
 attachRoomListeners(savedRoom);
 } else if (!onlineRoomCode && typeof createOnlineRoom === 'function') {
 createOnlineRoom(true);
 }
}

function chooseOnlineJoin() {
 showPlayerMode();
 const roomInput = document.getElementById('inputRoom');
 if (roomInput) roomInput.focus();
}

function showPlayerMode() {
 setBodyMode('mode-player');
 showPlayerScreen('screen-login');
}

function backToModeGateway() {
 setBodyMode('mode-unselected');
 const actions = document.getElementById('onlineChoiceActions');
 if (actions) actions.style.display = 'grid';
 history.replaceState(null, '', window.location.pathname);
}

function showPlayerScreen(screenId) {
 document.querySelectorAll('.player-screen').forEach(screen => screen.classList.remove('active'));
 const screen = document.getElementById(screenId);
 if (screen) screen.classList.add('active');
}

function loadPlayerSession() {
 try {
 return JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) || 'null');
 } catch (e) {
 localStorage.removeItem(PLAYER_SESSION_KEY);
 return null;
 }
}

function savePlayerSession() {
 try {
 localStorage.setItem('werewolf_player_id', playerId);
 localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({
 roomCode: playerRoomCode,
 name: playerName,
 playerId
 }));
 } catch (e) {
 // Storage may be unavailable in private browsing.
 }
}

function playerToast(message, type = 'info', title) {
 const container = document.getElementById('toastContainer');
 if (!container) return;

 const toastTitles = {
 success: 'Berhasil',
 error: 'Perlu Dicek',
 warning: 'Perhatian',
 info: 'Info Pemain'
 };
 const toastIcons = {
 success: 'check',
 error: 'circle-alert',
 warning: 'triangle-alert',
 info: 'info'
 };

 const toast = document.createElement('div');
 toast.className = `toast player-toast ${type}`;
 toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
 toast.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
 toast.innerHTML = `
 <span class="player-toast-icon"><i data-lucide="${toastIcons[type] || toastIcons.info}" aria-hidden="true"></i></span>
 <span class="player-toast-body">
 <span class="player-toast-title">${escapePlayerHtml(title || toastTitles[type] || toastTitles.info)}</span>
 <span class="player-toast-message">${escapePlayerHtml(message)}</span>
 </span>`;

 container.appendChild(toast);
 hydrateWerewolfIcons(toast);

 while (container.children.length > 3) {
 container.firstElementChild?.remove();
 }

 setTimeout(() => {
 toast.style.opacity = '0';
 toast.style.transform = 'translateY(-12px) scale(0.98)';
 toast.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
 setTimeout(() => toast.remove(), 260);
 }, type === 'error' || type === 'warning' ? 4200 : 3200);
}

function joinRoom(options = {}) {
 if (!db) {
 playerToast('Firebase belum dikonfigurasi!', 'error');
 return;
 }

 const nameInput = document.getElementById('inputName');
 const roomInput = document.getElementById('inputRoom');
 playerName = (nameInput?.value || '').trim();
 playerRoomCode = (roomInput?.value || '').trim().toUpperCase();

 if (!playerName || !playerRoomCode) {
 playerToast('Mohon isi Nama dan Kode Room!', 'warning');
 return;
 }

 db.ref(`rooms/${playerRoomCode}/meta`).once('value').then(snapshot => {
 if (!snapshot.exists()) {
 playerToast('Room tidak ditemukan. Pastikan moderator sudah membuat room.', 'error');
 return false;
 }

 const playerRef = db.ref(`rooms/${playerRoomCode}/players/${playerId}`);
 return playerRef.once('value').then(playerSnapshot => {
 const existingPlayer = playerSnapshot.val();
 const playerUpdate = {
 name: playerName,
 lastSeenAt: firebase.database.ServerValue.TIMESTAMP
 };

 if (!existingPlayer) {
 playerUpdate.joinedAt = firebase.database.ServerValue.TIMESTAMP;
 playerUpdate.alive = true;
 playerUpdate.role = null;
 }

 return playerRef.update(playerUpdate);
 }).then(() => true);
 }).then(joined => {
 if (!joined) return;
 savePlayerSession();
 initPlayerListeners();
 showPlayerScreen('screen-waiting');
 if (!options.silent) {
 playerToast(`Berhasil masuk ke room ${playerRoomCode}`, 'success', 'Masuk Room');
 }
 }).catch(err => {
 console.error('Join error:', err);
 playerToast('Gagal bergabung ke room: ' + err.message, 'error');
 });
}

function initPlayerListeners() {
 if (playerListenersAttached && playerListeningRoomCode === playerRoomCode) return;
 detachPlayerListeners();
 if (playerRemovalTimer) {
 clearTimeout(playerRemovalTimer);
 playerRemovalTimer = null;
 }
 playerListenersAttached = true;
 playerListeningRoomCode = playerRoomCode;

 playerMetaRef = db.ref(`rooms/${playerRoomCode}/meta`);
 playerSelfRef = db.ref(`rooms/${playerRoomCode}/players/${playerId}`);
 playerListRef = db.ref(`rooms/${playerRoomCode}/players`);
 playerTimerRef = db.ref(`rooms/${playerRoomCode}/timer`);
 playerVotesRef = db.ref(`rooms/${playerRoomCode}/votes`);

 playerMetaRef.on('value', snapshot => {
 const meta = snapshot.val();
 playerCurrentMeta = meta;
 if (!meta) {
 playerToast('Room ditutup oleh moderator.', 'warning');
 showPlayerScreen('screen-login');
 return;
 }

 if (meta.gameStarted || meta.rolesSubmitted) {
 showPlayerScreen('screen-game');
 const phaseDisplay = document.getElementById('gamePhaseDisplay');
 const pauseNotice = document.getElementById('playerPauseNotice');
 const playerApp = document.getElementById('playerApp');
 if (phaseDisplay) {
 if (!meta.gameStarted && meta.rolesSubmitted) {
 phaseDisplay.textContent = 'ROLE DIBAGIKAN';
 phaseDisplay.style.color = 'var(--accent-gold)';
 } else {
 phaseDisplay.textContent = meta.isPaused ? 'GAME DIJEDA' : (meta.phase === 'night' ? 'MALAM HARI' : 'SIANG HARI');
 phaseDisplay.style.color = meta.isPaused ? 'var(--accent-orange)' : (meta.phase === 'night' ? 'var(--accent-purple-light)' : 'var(--accent-gold)');
 }
 }
 if (pauseNotice) {
 pauseNotice.style.display = meta.isPaused ? 'block' : 'none';
 }
 if (playerApp) {
 playerApp.classList.toggle('phase-night', !!meta.gameStarted && meta.phase === 'night');
 playerApp.classList.toggle('phase-day', !!meta.gameStarted && meta.phase !== 'night');
 playerApp.classList.toggle('is-paused', !!meta.isPaused);
 }
 const dayDisplay = document.getElementById('gameDayDisplay');
 if (dayDisplay) dayDisplay.textContent = meta.day || 1;
 if (!meta.gameStarted || meta.phase !== 'day') {
 clearInterval(playerTimerInterval);
 const timerContainer = document.getElementById('playerTimerContainer');
 if (timerContainer) timerContainer.style.display = 'none';
 }
 } else {
 showPlayerScreen('screen-waiting');
 }
 hideStalePlayerAnnouncement(meta);
 handlePlayerAnnouncement(meta.announcement);
 renderPlayerVotePanel();
 });

 playerSelfRef.on('value', snapshot => {
 const playerData = snapshot.val();
 playerCurrentSelf = playerData;
 if (!playerData) {
 schedulePlayerMissingCheck();
 return;
 }
 if (playerRemovalTimer) {
 clearTimeout(playerRemovalTimer);
 playerRemovalTimer = null;
 }

 const statusBadge = document.getElementById('playerStatusBadge');
 if (!playerData.alive && !playerIsDead) {
 playerIsDead = true;
 playerToast('Kamu telah mati. Jangan beritahu role-mu ke pemain lain.', 'warning', 'Status Berubah');
 } else if (playerData.alive && playerIsDead) {
 playerIsDead = false;
 }

 if (statusBadge) {
 statusBadge.className = `status-badge ${playerData.alive ? 'status-alive' : 'status-dead'}`;
 statusBadge.textContent = playerData.alive ? 'HIDUP' : 'MATI';
 }

 if ((playerData.role || null) !== myRoleData) {
 myRoleData = playerData.role || null;
 updatePlayerRoleCard(myRoleData);
 }
 renderPlayerVotePanel();
 });

 playerListRef.on('value', snapshot => {
 const players = snapshot.val() || {};
 playerCurrentPlayers = players;
 const waitingList = document.getElementById('waitingPlayerList');
 const activeList = document.getElementById('activePlayerList');
 const activeCount = document.getElementById('activePlayerCount');
 if (waitingList) waitingList.innerHTML = '';
 if (activeList) activeList.innerHTML = '';
 if (activeCount) activeCount.textContent = String(Object.keys(players).length);

 Object.keys(players).forEach(id => {
 const player = players[id] || {};
 const safeName = escapePlayerHtml(player.name || 'Tanpa nama');
 const safeInitials = escapePlayerHtml(getPlayerInitials(player.name || '?'));
 if (waitingList) {
 waitingList.insertAdjacentHTML('beforeend', `
<li class="player-item is-alive">
 <span class="player-item-main">
 <span class="player-avatar">${safeInitials}</span>
 <span class="player-name">${safeName}</span>
 </span>
 <span class="player-status-chip">OK</span>
</li>`);
 }
 if (activeList) {
 const isAlive = player.alive !== false;
 const statusIcon = isAlive ? 'HIDUP' : 'MATI';
 activeList.insertAdjacentHTML('beforeend', `
<li class="player-item ${isAlive ? 'is-alive' : 'is-dead'}">
 <span class="player-item-main">
 <span class="player-avatar">${safeInitials}</span>
 <span class="player-name">${safeName}</span>
 </span>
 <span class="player-status-chip">${statusIcon}</span>
</li>`);
 }
 });
 renderPlayerVotePanel();
 });

 playerVotesRef.on('value', snapshot => {
 playerCurrentVotes = snapshot.val() || {};
 renderPlayerVotePanel();
 });

 playerTimerRef.on('value', snapshot => {
 const timerData = snapshot.val();
 clearInterval(playerTimerInterval);
 const timerContainer = document.getElementById('playerTimerContainer');
 const status = timerData?.status || (timerData?.running ? 'running' : 'ready');
 const isDayTimer = playerCurrentMeta?.gameStarted && playerCurrentMeta?.phase === 'day';

 if (!isDayTimer || !timerData || status === 'ready' || timerData.secondsLeft <= 0) {
 if (timerContainer) timerContainer.style.display = 'none';
 if (status === 'ready' && timerData?.secondsLeft > 0) playerTimerHasBuzzed = false;
 if (timerData && timerData.secondsLeft === 0 && !playerTimerHasBuzzed && playerTimerBuzzedForUpdate !== timerData.updatedAt) {
 playerTimerHasBuzzed = true;
 playerTimerBuzzedForUpdate = timerData.updatedAt;
 playPlayerBuzzer();
 }
 return;
 }

 if (timerContainer) timerContainer.style.display = 'block';
 let seconds = getPlayerTimerSeconds(timerData);
 if (seconds > 0) playerTimerHasBuzzed = false;
 updatePlayerTimerUI(seconds);

 if (status !== 'running') return;

 playerTimerInterval = setInterval(() => {
 seconds = getPlayerTimerSeconds(timerData);
 updatePlayerTimerUI(seconds);
 if (seconds === 0) {
 clearInterval(playerTimerInterval);
 if (!playerTimerHasBuzzed && playerTimerBuzzedForUpdate !== timerData.updatedAt) {
 playerTimerHasBuzzed = true;
 playerTimerBuzzedForUpdate = timerData.updatedAt;
 playPlayerBuzzer();
 }
 }
 }, 250);
 });
}

function detachPlayerListeners() {
 if (playerRemovalTimer) {
 clearTimeout(playerRemovalTimer);
 playerRemovalTimer = null;
 }
 if (playerMetaRef) playerMetaRef.off();
 if (playerSelfRef) playerSelfRef.off();
 if (playerListRef) playerListRef.off();
 if (playerTimerRef) playerTimerRef.off();
 if (playerVotesRef) playerVotesRef.off();
 playerListenersAttached = false;
 playerListeningRoomCode = '';
 playerMetaRef = null;
 playerSelfRef = null;
 playerListRef = null;
 playerTimerRef = null;
 playerVotesRef = null;
 playerCurrentMeta = null;
 playerCurrentSelf = null;
 playerCurrentPlayers = {};
 playerCurrentVotes = {};
}

function schedulePlayerMissingCheck() {
 if (playerRemovalTimer) return;

 playerRemovalTimer = setTimeout(() => {
 playerRemovalTimer = null;
 db.ref(`rooms/${playerRoomCode}/players/${playerId}`).once('value').then(snapshot => {
 if (snapshot.exists()) return;
 handlePlayerRemovedFromRoom();
 }).catch(err => {
 console.error('Player missing check error:', err);
 handlePlayerRemovedFromRoom();
 });
 }, 1200);
}

function handlePlayerRemovedFromRoom() {
 detachPlayerListeners();
 clearInterval(playerTimerInterval);
 playerTimerInterval = null;
 playerIsDead = false;
 myRoleData = null;
 localStorage.removeItem(PLAYER_SESSION_KEY);

 const statusBadge = document.getElementById('playerStatusBadge');
 if (statusBadge) {
 statusBadge.className = 'status-badge status-alive';
 statusBadge.textContent = 'HIDUP';
 }

 const timerContainer = document.getElementById('playerTimerContainer');
 if (timerContainer) timerContainer.style.display = 'none';
 const votePanel = document.getElementById('playerVotePanel');
 if (votePanel) votePanel.style.display = 'none';
 updatePlayerRoleCard(null);
 showPlayerScreen('screen-login');
 playerToast('Kamu dikeluarkan dari room oleh moderator.', 'warning');
}

function renderPlayerVotePanel() {
 const panel = document.getElementById('playerVotePanel');
 const status = document.getElementById('playerVoteStatus');
 const reveal = document.getElementById('playerVoteReveal');
 const options = document.getElementById('playerVoteOptions');
 if (!panel || !status || !options) return;

 const meta = playerCurrentMeta;
 const self = playerCurrentSelf;
 const isDayPhase = !!(meta?.gameStarted && meta.phase === 'day');
 const isPaused = !!meta?.isPaused;
 const isDayVote = !!(isDayPhase && !isPaused && meta.voteOpen !== false);
 const canVote = !!(isDayVote && self?.alive && !self?._idiotRevealed);
 const publicResult = meta?.publicVoteResult?.day === meta?.day ? meta.publicVoteResult : null;
 const voteSummary = meta?.voteSummary?.day === meta?.day ? meta.voteSummary : null;

 if (!isDayPhase) {
 panel.style.display = 'none';
 if (reveal) {
 reveal.style.display = 'none';
 reveal.innerHTML = '';
 }
 options.innerHTML = '';
 return;
 }

 panel.style.display = 'block';
 renderPlayerVoteReveal(publicResult);
 const dayVotes = playerCurrentVotes?.[meta.day] || {};
 const myVote = dayVotes?.[playerId] || null;
 const targetId = myVote?.targetId ? String(myVote.targetId) : '';
 const players = Object.entries(playerCurrentPlayers || {})
 .map(([id, data]) => ({ id, ...(data || {}) }))
 .filter(player => String(player.id) !== String(playerId) && player.alive && !player._idiotRevealed);

 if (!self?.alive) {
 status.textContent = 'Kamu sudah mati, jadi tidak bisa ikut voting.';
 options.innerHTML = '';
 return;
 }

 if (self?._idiotRevealed) {
 status.textContent = 'Hak voting kamu sudah hilang.';
 options.innerHTML = '';
 return;
 }

 if (!canVote) {
 const voteSaved = meta?.savedVoteResult?.day === meta?.day;
 status.textContent = isPaused
 ? (targetId
 ? `Game dijeda moderator. Vote kamu tersimpan: ${playerCurrentPlayers[targetId]?.name || myVote.targetName || 'target terpilih'}`
 : 'Game sedang dijeda oleh moderator. Voting sementara dikunci.')
 : targetId
 ? `Voting dikunci. Vote kamu: ${playerCurrentPlayers[targetId]?.name || myVote.targetName || 'target terpilih'}`
 : (voteSaved ? 'Voting sudah dikunci oleh moderator.' : 'Voting belum dibuka oleh moderator.');
 options.innerHTML = '';
 return;
 }

 const summaryText = voteSummary
 ? ` ${Number(voteSummary.votedCount) || 0}/${Number(voteSummary.totalVoters) || 0} vote masuk${voteSummary.leaderName ? `, sementara: ${voteSummary.leaderName}` : ''}.`
 : '';

 status.textContent = (targetId
 ? `Vote kamu: ${playerCurrentPlayers[targetId]?.name || myVote.targetName || 'target terpilih'}`
 : 'Pilih satu pemain untuk voting pengusiran.') + summaryText;

 options.innerHTML = players.map(player => {
 const selected = String(player.id) === targetId;
 const safeName = escapePlayerHtml(player.name || 'Tanpa nama');
 return `
<button type="button" class="player-vote-option${selected ? ' selected' : ''}" onclick="submitPlayerVote('${escapePlayerJsString(player.id)}')">
 <span>${safeName}</span>
 <span>${selected ? 'Terpilih' : 'Pilih'}</span>
</button>`;
 }).join('');

 if (targetId) {
 options.insertAdjacentHTML('beforeend', `
<button type="button" class="player-vote-option clear" onclick="clearPlayerVote()">
 <span>Batalkan vote</span>
 <span>Reset</span>
</button>`);
 }
}

function renderPlayerVoteReveal(result) {
 const reveal = document.getElementById('playerVoteReveal');
 if (!reveal) return;

 if (!result || !Array.isArray(result.results) || result.results.length === 0) {
 reveal.style.display = 'none';
 reveal.innerHTML = '';
 return;
 }

 const leaders = Array.isArray(result.leaders) ? result.leaders : [];
 const leaderText = leaders.length > 1
 ? `Seri terbanyak: ${leaders.map(r => r.name).join(', ')}`
 : `Voting terbanyak: ${leaders[0]?.name || result.results[0].name}`;

 reveal.style.display = 'block';
 reveal.innerHTML = `
<div style="padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:rgba(245,158,11,0.08);">
 <div style="font-size:0.82rem;color:var(--accent-gold);font-weight:800;margin-bottom:8px;">${escapePlayerHtml(leaderText)}</div>
 <div style="display:grid;gap:6px;">
 ${result.results.map(row => `
 <div class="player-vote-option" style="min-height:38px;padding:8px 10px;cursor:default;">
 <span>${escapePlayerHtml(row.name)}</span>
 <span>${Number(row.count) || 0} vote</span>
 </div>`).join('')}
 </div>
</div>`;
}

function submitPlayerVote(targetId) {
 if (!db || !playerRoomCode || !playerCurrentMeta?.day) return;
 if (playerCurrentMeta.isPaused) {
 playerToast('Game sedang dijeda moderator. Voting sementara dikunci.', 'warning');
 return;
 }
 if (playerCurrentMeta.voteOpen === false) {
 const voteSaved = playerCurrentMeta.savedVoteResult?.day === playerCurrentMeta.day;
 playerToast(voteSaved ? 'Voting sudah dikunci moderator.' : 'Voting belum dibuka moderator.', 'warning');
 return;
 }
 if (String(targetId) === String(playerId)) {
 playerToast('Kamu tidak bisa vote diri sendiri.', 'warning');
 return;
 }
 const target = playerCurrentPlayers?.[targetId];
 if (!target || !target.alive || target._idiotRevealed) {
 playerToast('Target vote tidak tersedia.', 'error');
 return;
 }

 db.ref(`rooms/${playerRoomCode}/votes/${playerCurrentMeta.day}/${playerId}`).set({
 targetId,
 targetName: target.name || '',
 voterName: playerName || playerCurrentSelf?.name || '',
 updatedAt: firebase.database.ServerValue.TIMESTAMP
 }).then(() => {
 if (typeof playWerewolfSound === 'function') playWerewolfSound('vote');
 playerToast(`Vote terkirim: ${target.name}`, 'success', 'Vote Terkirim');
 }).catch(err => {
 playerToast('Gagal mengirim vote: ' + err.message, 'error');
 });
}

function clearPlayerVote() {
 if (!db || !playerRoomCode || !playerCurrentMeta?.day) return;
 if (playerCurrentMeta.isPaused) {
 playerToast('Game sedang dijeda moderator. Voting sementara dikunci.', 'warning');
 return;
 }
 if (playerCurrentMeta.voteOpen === false) {
 const voteSaved = playerCurrentMeta.savedVoteResult?.day === playerCurrentMeta.day;
 playerToast(voteSaved ? 'Voting sudah dikunci moderator.' : 'Voting belum dibuka moderator.', 'warning');
 return;
 }
 db.ref(`rooms/${playerRoomCode}/votes/${playerCurrentMeta.day}/${playerId}`).remove()
 .then(() => playerToast('Vote dibatalkan.', 'info'))
 .catch(err => playerToast('Gagal membatalkan vote: ' + err.message, 'error'));
}

function updatePlayerTimerUI(seconds) {
 const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
 const rest = (seconds % 60).toString().padStart(2, '0');
 const timer = document.getElementById('playerTimerDisplay');
 if (!timer) return;
 timer.textContent = `${minutes}:${rest}`;
 timer.style.color = seconds <= 10 ? 'var(--accent-red)' : 'var(--accent-gold)';
}

function getPlayerTimerSeconds(timerData) {
 if (timerData?.running && timerData.endsAt) {
 return Math.max(0, Math.ceil((timerData.endsAt - getPlayerTimerNow()) / 1000));
 }

 if (timerData?.running && timerData.updatedAt) {
 return Math.max(0, timerData.secondsLeft - Math.floor((getPlayerTimerNow() - timerData.updatedAt) / 1000));
 }

 return Math.max(0, timerData?.secondsLeft || 0);
}

function playPlayerBuzzer() {
 if (typeof playWerewolfSound === 'function') {
 playWerewolfSound('timer');
 return;
 }
 try {
 const ctx = new (window.AudioContext || window.webkitAudioContext)();
 [0, 0.2, 0.4].forEach(delay => {
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.type = 'sine';
 osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
 gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
 osc.start(ctx.currentTime + delay);
 osc.stop(ctx.currentTime + delay + 0.3);
 });
 } catch (e) {
 console.warn('Audio tidak tersedia.', e);
 }
}

function updatePlayerRoleCard(role) {
 const roleDef = ROLE_DEFINITIONS[role] || {};
 const roleName = document.getElementById('roleName');
 const roleIcon = document.getElementById('roleIcon');
 const roleDesc = document.getElementById('roleDesc');
 const roleCard = document.getElementById('roleCard');

 if (roleName) roleName.textContent = role || 'Belum Ada Role';
 if (roleIcon) {
 roleIcon.innerHTML = role ? roleAssetIconMarkup(role, 'role-lucide-icon role-lucide-icon-lg') : '<i data-lucide="house" aria-hidden="true"></i>';
 hydrateWerewolfIcons(roleIcon);
 }
 if (roleDesc) roleDesc.textContent = roleDef.description || 'Belum ada role yang dibagikan. Tunggu moderator mengacak peran.';
 if (roleCard) {
 roleCard.classList.remove('is-flipped');
 roleCard.classList.remove('role-card-received');
 if (role) {
 void roleCard.offsetWidth;
 roleCard.classList.add('role-card-received');
 if (typeof playWerewolfSound === 'function') playWerewolfSound('role');
 }
 }
}

function handlePlayerAnnouncement(announcement) {
 if (!announcement || !announcement.id || !playerRoomCode) return;
 if (!isPlayerAnnouncementAllowed(announcement)) return;
 const key = `werewolf_player_last_announcement_${playerRoomCode}`;
 const lastSeen = localStorage.getItem(key);
 if (lastSeen === announcement.id) return;
 localStorage.setItem(key, announcement.id);
 const banner = document.getElementById('playerAnnouncementBanner');
 if (banner) {
 banner.style.display = 'block';
 banner.className = `player-announcement-banner ${announcement.type || 'info'}`;
 banner.dataset.event = announcement.event || '';
 banner.dataset.day = announcement.day || '';
 banner.innerHTML = `<strong>${escapePlayerHtml(announcement.title || 'Update Game')}</strong><span>${escapePlayerHtml(announcement.message || '')}</span>`;
 }
 playerToast(announcement.message || announcement.title || 'Ada update dari moderator.', announcement.type || 'info', announcement.title || 'Update Game');
}

function isPlayerAnnouncementAllowed(announcement) {
 if (announcement.event === 'morning') {
 return playerCurrentMeta?.gameStarted && playerCurrentMeta?.phase === 'day' && announcement.phase === 'day';
 }
 return true;
}

function hideStalePlayerAnnouncement(meta) {
 const banner = document.getElementById('playerAnnouncementBanner');
 if (!banner || banner.style.display === 'none') return;
 const isMorningBanner = banner.dataset.event === 'morning';
 const isDifferentDay = banner.dataset.day && Number(banner.dataset.day) !== Number(meta?.day || 0);
 if (isMorningBanner && (meta?.phase !== 'day' || isDifferentDay)) {
 banner.style.display = 'none';
 banner.removeAttribute('data-event');
 banner.removeAttribute('data-day');
 }
}

function escapePlayerHtml(value) {
 return String(value ?? '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');
}

function escapePlayerJsString(value) {
 return String(value ?? '')
 .replace(/\\/g, '\\\\')
 .replace(/'/g, "\\'")
 .replace(/\r/g, '\\r')
 .replace(/\n/g, '\\n')
 .replace(/</g, '\\x3C')
 .replace(/>/g, '\\x3E');
}

function getPlayerInitials(name) {
 const words = String(name || '')
 .trim()
 .split(/\s+/)
 .filter(Boolean);

 if (words.length === 0) return '?';
 if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
 return (words[0][0] + words[1][0]).toUpperCase();
}
