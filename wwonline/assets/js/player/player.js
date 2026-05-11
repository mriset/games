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
let isJoiningRoom = false;
let playerLastFirebaseConnected = null;
let selectedPlayerVoteTargetId = '';

function getPlayerTimerNow() {
 return typeof window.getWerewolfSyncedNow === 'function' ? window.getWerewolfSyncedNow() : Date.now();
}

function setPlayerVoteTimerVisible(isVisible) {
 const voteTimerBox = document.getElementById('playerVoteTimerBox');
 if (!voteTimerBox) return;
 voteTimerBox.classList.toggle('is-hidden', !isVisible);
 voteTimerBox.style.display = isVisible ? 'grid' : 'none';
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

window.addEventListener('werewolf:firebase-connection', (event) => {
 const connected = !!event.detail?.connected;
 if (playerLastFirebaseConnected === null) {
 playerLastFirebaseConnected = connected;
 return;
 }
 if (playerLastFirebaseConnected === connected) return;
 playerLastFirebaseConnected = connected;
 if (!document.body.classList.contains('mode-player')) return;
 if (connected) {
 playerToast('Koneksi tersambung kembali.', 'success', 'Online');
 } else {
 playerToast('Koneksi Firebase terputus. Mencoba menyambung ulang...', 'warning', 'Offline');
 }
});

function setBodyMode(mode) {
 document.body.classList.remove('mode-unselected', 'mode-moderator', 'mode-player');
 document.body.classList.add(mode);
}

let gatewayOnlineRole = 'host';

function refreshGatewayIcons() {
 if (window.lucide && typeof window.lucide.createIcons === 'function') {
  window.lucide.createIcons();
 }
}

function showGatewayScreen(screenId) {
 const gateway = document.getElementById('modeGateway');
 if (!gateway) return;
 gateway.querySelectorAll('.gateway-screen').forEach(screen => {
  const isActive = screen.id === screenId;
  screen.classList.toggle('is-active', isActive);
  screen.setAttribute('aria-hidden', isActive ? 'false' : 'true');
 });
 gateway.dataset.activeScreen = screenId.replace(/^gateway/, '').toLowerCase();
 gateway.scrollTo({ top: 0, behavior: 'smooth' });
 refreshGatewayIcons();
}

function showGatewayCover() {
 showGatewayScreen('gatewayCover');
}

function showGatewayHome() {
 showGatewayScreen('gatewayHome');
}

function showGatewayOffline() {
 showGatewayScreen('gatewayOffline');
}

function showGatewayOnline() {
 showGatewayScreen('gatewayOnline');
 selectGatewayOnlineRole(gatewayOnlineRole);
}

function selectGatewayOnlineRole(role) {
 gatewayOnlineRole = role === 'join' ? 'join' : 'host';
 const hostToggle = document.getElementById('gatewayHostToggle');
 const joinToggle = document.getElementById('gatewayJoinToggle');
 const hostCard = document.getElementById('gatewayHostCard');
 const joinCard = document.getElementById('gatewayJoinCard');
 const primaryBtn = document.getElementById('gatewayOnlinePrimaryBtn');
 const panelTitle = document.getElementById('gatewayOnlinePanelTitle');
 const panelText = document.getElementById('gatewayOnlinePanelText');
 if (hostToggle) hostToggle.classList.toggle('active', gatewayOnlineRole === 'host');
 if (joinToggle) joinToggle.classList.toggle('active', gatewayOnlineRole === 'join');
 if (hostCard) hostCard.classList.toggle('active', gatewayOnlineRole === 'host');
 if (joinCard) joinCard.classList.toggle('active', gatewayOnlineRole === 'join');
 if (panelTitle) panelTitle.textContent = gatewayOnlineRole === 'host' ? 'Mulai sebagai moderator' : 'Gabung sebagai pemain';
 if (panelText) {
  panelText.textContent = gatewayOnlineRole === 'host'
   ? 'Buat room online, atur pemain yang masuk, lalu mulai permainan dari perangkat ini.'
   : 'Siapkan nama, masukkan kode room dari moderator, lalu tunggu permainan dimulai.';
 }
 if (primaryBtn) {
  primaryBtn.innerHTML = gatewayOnlineRole === 'host'
   ? '<i data-lucide="paw-print"></i> Buat Room'
   : '<i data-lucide="log-in"></i> Masuk Room';
  primaryBtn.onclick = gatewayOnlineRole === 'host' ? chooseOnlineHost : chooseOnlineJoin;
 }
 refreshGatewayIcons();
}

function showOnlineChoices() {
 const actions = document.getElementById('onlineChoiceActions');
 if (actions) actions.hidden = false;
 showGatewayOnline();
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
 updatePlayerConsoleChrome();
}

function backToModeGateway() {
 setBodyMode('mode-unselected');
 const actions = document.getElementById('onlineChoiceActions');
 if (actions) actions.hidden = true;
 showGatewayCover();
 history.replaceState(null, '', window.location.pathname);
}

function showPlayerScreen(screenId) {
 document.querySelectorAll('.player-screen').forEach(screen => screen.classList.remove('active'));
 const screen = document.getElementById(screenId);
 if (screen) screen.classList.add('active');
 updatePlayerConsoleChrome();
 if (screenId === 'screen-game') {
  syncPlayerTabForPhase();
 }
}

function switchPlayerTab(tabName) {
 const allowedTabs = ['announcements', 'vote', 'role'];
 const nextTab = allowedTabs.includes(tabName) ? tabName : 'announcements';
 document.querySelectorAll('[data-player-panel]').forEach(panel => {
  panel.classList.toggle('is-active', panel.dataset.playerPanel === nextTab);
 });
 document.querySelectorAll('[data-player-tab]').forEach(button => {
  button.classList.toggle('active', button.dataset.playerTab === nextTab);
 });
 updatePlayerConsoleChrome();
 hydrateWerewolfIcons(document.getElementById('playerApp'));
}

function getActivePlayerTab() {
 const active = document.querySelector('[data-player-tab].active');
 return active?.dataset?.playerTab || 'announcements';
}

function syncPlayerTabForPhase() {
 const meta = playerCurrentMeta;
 const activeTab = getActivePlayerTab();
 const isDayVote = !!(meta?.gameStarted && meta.phase === 'day' && meta.voteOpen === true && playerCurrentSelf?.alive);
 if (activeTab === 'vote' && !isDayVote) {
  switchPlayerTab('announcements');
  return;
 }
 if (activeTab !== 'announcements') return;
 if (isDayVote) {
  switchPlayerTab('vote');
 } else if (meta?.rolesSubmitted && !meta?.gameStarted) {
  switchPlayerTab('role');
 } else {
  switchPlayerTab('announcements');
 }
}

function updatePlayerConsoleChrome() {
 const roomDisplay = document.getElementById('playerRoomCodeDisplay');
 const phaseKicker = document.getElementById('playerPhaseKicker');
 const tagline = document.getElementById('playerHeaderTagline');
 const miniText = document.getElementById('playerPhaseMiniText');
 const announcementCardTitle = document.getElementById('playerAnnouncementCardTitle');
 const emptyTitle = document.getElementById('playerAnnouncementEmptyTitle');
 const emptyText = document.getElementById('playerAnnouncementEmptyText');
 const meta = playerCurrentMeta;
 const screenGame = document.getElementById('screen-game');
 const isGameScreen = !!screenGame?.classList.contains('active');
 const isNight = !!(meta?.gameStarted && meta.phase === 'night');
 const isDay = !!(meta?.gameStarted && meta.phase === 'day');
 const roomCode = playerRoomCode || document.getElementById('inputRoom')?.value?.trim()?.toUpperCase() || '------';

 if (roomDisplay) roomDisplay.textContent = roomCode || '------';

 if (!isGameScreen) {
  if (phaseKicker) phaseKicker.textContent = 'Konsol Pemain';
  if (tagline) tagline.textContent = document.getElementById('screen-waiting')?.classList.contains('active') ? 'Menunggu moderator' : 'Masuki room saat bulan naik';
  return;
 }

 if (phaseKicker) {
  phaseKicker.textContent = meta?.isPaused ? 'Game Dijeda' : isNight ? `Malam ${meta?.day || 1}` : isDay ? `Siang ${meta?.day || 1}` : 'Role Dibagikan';
 }
 if (tagline) {
  tagline.textContent = playerCurrentSelf?.alive === false ? 'Kamu sudah mati' : isNight ? 'Tetap diam dan waspada' : isDay ? 'Diskusi dan voting' : 'Role sudah diterima';
 }
 if (miniText) {
  miniText.textContent = playerCurrentSelf?.alive === false ? 'Jangan bicara' : isNight ? 'Tunggu pagi' : isDay ? 'Pilih bijak' : 'Jaga rahasia';
 }
 if (emptyTitle && emptyText) {
  if (announcementCardTitle) announcementCardTitle.textContent = isNight ? 'Pengumuman Malam' : isDay ? 'Pengumuman Pagi' : 'Pengumuman';
  emptyTitle.textContent = isNight ? 'Malam Sedang Berjalan' : isDay ? 'Pagi/Siang Hari' : 'Role Sudah Dibagikan';
  emptyText.textContent = isNight
   ? 'Moderator sedang memandu aksi malam. Perhatikan instruksi dan jangan bocorkan role.'
   : isDay
    ? 'Pengumuman pagi dan hasil penting dari moderator akan muncul di sini.'
    : 'Buka kartu role-mu, lalu tunggu fase permainan dimulai.';
  const morningAnnouncement = meta?.morningAnnouncement || (meta?.announcement?.event === 'morning' ? meta.announcement : null);
  const dayExecutionAnnouncement = meta?.dayExecutionAnnouncement || (meta?.announcement?.event === 'dayExecution' ? meta.announcement : null);
  const dayExecutionAnnouncementDay = Number(dayExecutionAnnouncement?.day || meta?.day || 0);
  const isFreshDayExecutionAnnouncement = !dayExecutionAnnouncement?.day || dayExecutionAnnouncementDay === Number(meta?.day || 0);
  const featuredAnnouncement = dayExecutionAnnouncement && isFreshDayExecutionAnnouncement
   ? dayExecutionAnnouncement
   : morningAnnouncement;
  const announcementDay = Number(featuredAnnouncement?.day || meta?.day || 0);
  const isFreshAnnouncement = !featuredAnnouncement?.day || announcementDay === Number(meta?.day || 0);
  if (featuredAnnouncement && isFreshAnnouncement && isPlayerAnnouncementAllowed(featuredAnnouncement)) {
   if (announcementCardTitle) announcementCardTitle.textContent = featuredAnnouncement.event === 'dayExecution' ? 'Pengumuman Eksekusi' : 'Pengumuman Pagi';
   emptyTitle.textContent = featuredAnnouncement.message || featuredAnnouncement.title || 'Update Game';
   emptyText.textContent = featuredAnnouncement.detail || 'Perhatikan informasi dari moderator.';
  }
 }
}

function copyPlayerRoomCode() {
 const roomCode = playerRoomCode || document.getElementById('inputRoom')?.value?.trim()?.toUpperCase();
 if (!roomCode) {
  playerToast('Belum ada kode room untuk disalin.', 'warning');
  return;
 }
 const onCopied = () => playerToast(`Kode room ${roomCode} disalin.`, 'success', 'Kode Room');
 if (navigator.clipboard?.writeText) {
  navigator.clipboard.writeText(roomCode).then(onCopied).catch(() => playerToast('Gagal menyalin kode room.', 'error'));
  return;
 }
 playerToast(`Kode room: ${roomCode}`, 'info', 'Kode Room');
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
 if (isJoiningRoom) return;
 if (!db) {
 playerToast('Firebase belum dikonfigurasi!', 'error');
 return;
 }

 const nameInput = document.getElementById('inputName');
 const roomInput = document.getElementById('inputRoom');
 playerName = (nameInput?.value || '').trim();
 playerRoomCode = (roomInput?.value || '').trim().toUpperCase();
 updatePlayerConsoleChrome();

 if (!playerName || !playerRoomCode) {
 playerToast('Mohon isi Nama dan Kode Room!', 'warning');
 return;
 }

 setJoinRoomLoading(true, options);
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
 connected: true,
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
 }).finally(() => {
 setJoinRoomLoading(false, options);
 });
}

function setJoinRoomLoading(loading, options = {}) {
 isJoiningRoom = loading;
 if (options.silent) return;
 const joinBtn = document.getElementById('joinRoomBtn');
 if (!joinBtn) return;
 joinBtn.disabled = loading;
 joinBtn.innerHTML = loading
 ? '<i data-lucide="loader-circle"></i> Menghubungkan...'
 : '<i data-lucide="log-in"></i> Bergabung';
 hydrateWerewolfIcons(joinBtn);
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

 playerSelfRef.update({
 connected: true,
 lastSeenAt: firebase.database.ServerValue.TIMESTAMP
 }).catch(err => console.warn('Gagal memperbarui presence pemain:', err));
 playerSelfRef.onDisconnect().update({
 connected: false,
 lastSeenAt: firebase.database.ServerValue.TIMESTAMP
 });

 playerMetaRef.on('value', snapshot => {
 const meta = snapshot.val();
 playerCurrentMeta = meta;
 if (!meta) {
 handlePlayerRemovedFromRoom('Room ditutup oleh moderator.');
 return;
 }

 if (meta.closed) {
 handlePlayerRemovedFromRoom('Room ditutup oleh moderator.');
 return;
 }

 if (meta.gameStarted || meta.rolesSubmitted) {
 showPlayerScreen('screen-game');
 const phaseDisplay = document.getElementById('gamePhaseDisplay');
 const pauseNotice = document.getElementById('playerPauseNotice');
 const nightContext = document.getElementById('playerNightContext');
 const playerApp = document.getElementById('playerApp');
 const isNightPhase = !!meta.gameStarted && meta.phase === 'night';
 if (phaseDisplay) {
 if (!meta.gameStarted && meta.rolesSubmitted) {
 phaseDisplay.textContent = 'ROLE DIBAGIKAN';
 phaseDisplay.style.color = 'var(--accent-gold)';
 } else {
 phaseDisplay.textContent = meta.isPaused ? 'GAME DIJEDA' : (isNightPhase ? 'MALAM HARI' : 'SIANG HARI');
 phaseDisplay.style.color = meta.isPaused ? 'var(--accent-orange)' : (isNightPhase ? 'var(--accent-purple-light)' : 'var(--accent-gold)');
 }
 }
 if (pauseNotice) {
 pauseNotice.style.display = meta.isPaused ? 'block' : 'none';
 }
 if (nightContext) {
 nightContext.style.display = isNightPhase && !meta.isPaused ? 'flex' : 'none';
 }
 if (playerApp) {
 playerApp.classList.toggle('phase-night', isNightPhase);
 playerApp.classList.toggle('phase-day', !!meta.gameStarted && !isNightPhase);
 playerApp.classList.toggle('is-paused', !!meta.isPaused);
 }
 const dayDisplay = document.getElementById('gameDayDisplay');
 if (dayDisplay) dayDisplay.textContent = meta.day || 1;
 updatePlayerConsoleChrome();
 if (!meta.gameStarted || meta.phase !== 'day') {
 clearInterval(playerTimerInterval);
 const timerContainer = document.getElementById('playerTimerContainer');
 if (timerContainer) timerContainer.style.display = 'none';
 }
 } else {
 showPlayerScreen('screen-waiting');
 updatePlayerConsoleChrome();
 }
 hideStalePlayerAnnouncement(meta);
 handlePlayerAnnouncement(meta.announcement);
 renderPlayerAnnouncementRoster();
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
 updatePlayerConsoleChrome();
 syncPlayerTabForPhase();
 renderPlayerAnnouncementRoster();
 renderPlayerVotePanel();
 });

 playerListRef.on('value', snapshot => {
 const players = snapshot.val() || {};
 playerCurrentPlayers = players;
 const waitingList = document.getElementById('waitingPlayerList');
 if (waitingList) waitingList.innerHTML = '';

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
 });
 updatePlayerConsoleChrome();
 renderPlayerAnnouncementRoster();
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
 setPlayerVoteTimerVisible(false);
 if (status === 'ready' && timerData?.secondsLeft > 0) playerTimerHasBuzzed = false;
 if (timerData && timerData.secondsLeft === 0 && !playerTimerHasBuzzed && playerTimerBuzzedForUpdate !== timerData.updatedAt) {
 playerTimerHasBuzzed = true;
 playerTimerBuzzedForUpdate = timerData.updatedAt;
 playPlayerBuzzer();
 }
 return;
 }

 if (timerContainer) timerContainer.style.display = 'grid';
 setPlayerVoteTimerVisible(true);
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
 selectedPlayerVoteTargetId = '';
 renderPlayerAnnouncementRoster();
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

function handlePlayerRemovedFromRoom(message = 'Kamu dikeluarkan dari room oleh moderator.') {
 detachPlayerListeners();
 clearInterval(playerTimerInterval);
 playerTimerInterval = null;
 playerIsDead = false;
 myRoleData = null;
 playerRoomCode = '';
 localStorage.removeItem(PLAYER_SESSION_KEY);

 const statusBadge = document.getElementById('playerStatusBadge');
 if (statusBadge) {
 statusBadge.className = 'status-badge status-alive';
 statusBadge.textContent = 'HIDUP';
 }

 const timerContainer = document.getElementById('playerTimerContainer');
 if (timerContainer) timerContainer.style.display = 'none';
 setPlayerVoteTimerVisible(false);
 const votePanel = document.getElementById('playerVotePanel');
 if (votePanel) votePanel.style.display = 'none';
 const lockedVotePanel = document.getElementById('playerVoteLockedPanel');
 if (lockedVotePanel) lockedVotePanel.classList.remove('is-hidden');
 updatePlayerRoleCard(null);
 showPlayerScreen('screen-login');
 playerToast(message, 'warning');
}

function renderPlayerAnnouncementRoster() {
 const aliveTitle = document.getElementById('playerAliveRosterTitle');
 const deadTitle = document.getElementById('playerDeadRosterTitle');
 const aliveList = document.getElementById('playerAliveRoster');
 const deadList = document.getElementById('playerDeadRoster');
 if (!aliveTitle || !deadTitle || !aliveList || !deadList) return;

 const players = Object.entries(playerCurrentPlayers || {})
 .map(([id, data]) => ({ id, ...(data || {}) }))
 .sort((a, b) => {
  if (String(a.id) === String(playerId)) return -1;
  if (String(b.id) === String(playerId)) return 1;
  return String(a.name || '').localeCompare(String(b.name || ''), 'id', { sensitivity: 'base' });
 });
 const alivePlayers = players.filter(player => player.alive !== false);
 const deadPlayers = players.filter(player => player.alive === false);

 aliveTitle.textContent = `Pemain Hidup (${alivePlayers.length})`;
 deadTitle.textContent = `Pemain Mati (${deadPlayers.length})`;

 const renderItem = (player, state) => {
  const isSelf = String(player.id) === String(playerId);
  const safeName = escapePlayerHtml(isSelf ? 'Kamu' : (player.name || 'Tanpa nama'));
  const safeInitials = escapePlayerHtml(getPlayerInitials(player.name || '?'));
  const statusText = state === 'dead' ? 'Mati' : 'Hidup';
  return `
<div class="player-roster-mini is-${state}${isSelf ? ' is-self' : ''}">
 <span class="player-roster-avatar">${safeInitials}</span>
 <span class="player-roster-name">${safeName}</span>
 ${isSelf ? '<span class="player-self-badge">Anda</span>' : ''}
 <span class="player-roster-state">${statusText}</span>
</div>`;
 };

 aliveList.innerHTML = alivePlayers.length
 ? alivePlayers.map(player => renderItem(player, 'alive')).join('')
 : '<div class="player-roster-empty">Belum ada pemain hidup.</div>';
 deadList.innerHTML = deadPlayers.length
 ? deadPlayers.map(player => renderItem(player, 'dead')).join('')
 : '<div class="player-roster-empty">Belum ada pemain mati.</div>';
}

function renderPlayerVotePanel() {
 const panel = document.getElementById('playerVotePanel');
 const status = document.getElementById('playerVoteStatus');
 const reveal = document.getElementById('playerVoteReveal');
 const options = document.getElementById('playerVoteOptions');
 const lockedPanel = document.getElementById('playerVoteLockedPanel');
 const submitButton = document.getElementById('playerVoteSubmitBtn');
 if (!panel || !status || !options) return;

 const meta = playerCurrentMeta;
 const self = playerCurrentSelf;
 const isDayPhase = !!(meta?.gameStarted && meta.phase === 'day');
 const isPaused = !!meta?.isPaused;
 const isDayVote = !!(isDayPhase && !isPaused && meta.voteOpen === true);
 const canVote = !!(isDayVote && self?.alive && !self?._idiotRevealed);
 const publicResult = meta?.publicVoteResult?.day === meta?.day ? meta.publicVoteResult : null;

 if (!isDayPhase) {
  panel.style.display = 'none';
  if (lockedPanel) lockedPanel.classList.remove('is-hidden');
  selectedPlayerVoteTargetId = '';
  if (submitButton) submitButton.disabled = true;
  if (reveal) {
  reveal.style.display = 'none';
  reveal.innerHTML = '';
 }
 options.innerHTML = '';
 return;
 }

 panel.style.display = 'grid';
 if (lockedPanel) lockedPanel.classList.add('is-hidden');
 renderPlayerVoteReveal(publicResult);
 const dayVotes = playerCurrentVotes?.[meta.day] || {};
 const myVote = dayVotes?.[playerId] || null;
 const targetId = myVote?.targetId ? String(myVote.targetId) : '';
 if (targetId) selectedPlayerVoteTargetId = targetId;
 const players = Object.entries(playerCurrentPlayers || {})
 .map(([id, data]) => ({ id, ...(data || {}) }))
 .filter(player => player.alive !== false && !player._idiotRevealed);
 const validTargetIds = players
 .filter(player => String(player.id) !== String(playerId))
 .map(player => String(player.id));
 if (selectedPlayerVoteTargetId && !validTargetIds.includes(String(selectedPlayerVoteTargetId))) {
  selectedPlayerVoteTargetId = targetId && validTargetIds.includes(targetId) ? targetId : '';
 }

 if (!self?.alive) {
  status.textContent = 'Kamu sudah mati, jadi tidak bisa ikut voting.';
  options.innerHTML = '';
  if (submitButton) submitButton.disabled = true;
  return;
 }

 if (self?._idiotRevealed) {
  status.textContent = 'Hak voting kamu sudah hilang.';
  options.innerHTML = '';
  if (submitButton) submitButton.disabled = true;
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
  if (submitButton) submitButton.disabled = true;
  return;
 }

 status.textContent = targetId
 ? `Vote kamu: ${playerCurrentPlayers[targetId]?.name || myVote.targetName || 'target terpilih'}`
 : 'Pilih 1 pemain yang ingin dieliminasi. Hanya pemain hidup yang dapat dipilih.';

 options.innerHTML = players.map(player => {
 const isSelf = String(player.id) === String(playerId);
 const selected = String(player.id) === String(selectedPlayerVoteTargetId || targetId);
 const safeName = escapePlayerHtml(isSelf ? 'Kamu' : (player.name || 'Tanpa nama'));
 const safeInitials = escapePlayerHtml(getPlayerInitials(player.name || '?'));
 return `
<button type="button" class="player-vote-option${selected ? ' selected' : ''}${isSelf ? ' is-self' : ''}" ${isSelf ? 'disabled' : `onclick="selectPlayerVoteTarget('${escapePlayerJsString(player.id)}')"`}>
 <span class="player-vote-person">
  <span class="player-vote-avatar">${safeInitials}</span>
  <span>${safeName}</span>
 </span>
 ${isSelf ? '<span class="player-self-badge">Anda</span>' : ''}
 <span class="player-vote-radio" aria-hidden="true"></span>
</button>`;
 }).join('');

 if (submitButton) {
  submitButton.disabled = !selectedPlayerVoteTargetId || String(selectedPlayerVoteTargetId) === String(targetId);
 }

 if (targetId) {
 options.insertAdjacentHTML('beforeend', `
<button type="button" class="player-vote-option clear" onclick="clearPlayerVote()">
 <span class="player-vote-person">
  <span class="player-vote-avatar"><i data-lucide="rotate-ccw"></i></span>
  <span>Batalkan vote</span>
 </span>
 <span>Reset</span>
</button>`);
 }
 hydrateWerewolfIcons(options);
}

function selectPlayerVoteTarget(targetId) {
 selectedPlayerVoteTargetId = String(targetId || '');
 renderPlayerVotePanel();
}

function submitSelectedPlayerVote() {
 if (!selectedPlayerVoteTargetId) {
  playerToast('Pilih pemain dulu sebelum mengirim vote.', 'warning');
  return;
 }
 submitPlayerVote(selectedPlayerVoteTargetId);
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
 const topResult = leaders[0] || result.results[0];
 const leaderText = `Voting terbanyak: ${topResult.name}`;

 reveal.style.display = 'block';
 reveal.innerHTML = `
<div class="player-vote-reveal-card">
 <div class="player-vote-reveal-title">${escapePlayerHtml(leaderText)}</div>
 <div class="player-vote-reveal-row">
 <span>${escapePlayerHtml(topResult.name)}</span>
 <span>${Number(topResult.count) || 0} vote</span>
 </div>
</div>`;
}

function submitPlayerVote(targetId) {
 if (!db || !playerRoomCode || !playerCurrentMeta?.day) return;
 if (playerCurrentMeta.isPaused) {
 playerToast('Game sedang dijeda moderator. Voting sementara dikunci.', 'warning');
 return;
 }
 if (playerCurrentMeta.voteOpen !== true) {
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
 selectedPlayerVoteTargetId = String(targetId);
 renderPlayerVotePanel();
 const submitButton = document.getElementById('playerVoteSubmitBtn');
 if (submitButton) submitButton.disabled = true;
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
 if (playerCurrentMeta.voteOpen !== true) {
 const voteSaved = playerCurrentMeta.savedVoteResult?.day === playerCurrentMeta.day;
 playerToast(voteSaved ? 'Voting sudah dikunci moderator.' : 'Voting belum dibuka moderator.', 'warning');
 return;
 }
 db.ref(`rooms/${playerRoomCode}/votes/${playerCurrentMeta.day}/${playerId}`).remove()
 .then(() => {
 selectedPlayerVoteTargetId = '';
 playerToast('Vote dibatalkan.', 'info');
 renderPlayerVotePanel();
 })
 .catch(err => playerToast('Gagal membatalkan vote: ' + err.message, 'error'));
}

function updatePlayerTimerUI(seconds) {
 const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
 const rest = (seconds % 60).toString().padStart(2, '0');
 const timer = document.getElementById('playerTimerDisplay');
 const voteTimer = document.getElementById('playerVoteTimerDisplay');
 const timeText = `${minutes}:${rest}`;
 [timer, voteTimer].forEach(timerNode => {
  if (!timerNode) return;
  timerNode.textContent = timeText;
  timerNode.style.color = seconds <= 10 ? 'var(--accent-red)' : 'var(--accent-gold)';
 });
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
 const roleFactionBadge = document.getElementById('roleFactionBadge');
 const team = roleDef.team || null;

 if (roleName) roleName.textContent = role || 'Belum Ada Role';
 if (roleFactionBadge) {
 roleFactionBadge.textContent = team || 'Belum ada faksi';
 roleFactionBadge.className = `role-faction-badge role-faction-${team ? team.toLowerCase() : 'unknown'}`;
 }
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
 if (announcement.event === 'morning' || announcement.event === 'dayExecution') {
  if (banner) banner.style.display = 'none';
  playerToast(announcement.message || announcement.title || 'Ada update dari moderator.', announcement.type || 'info', announcement.title || 'Update Game');
  return;
 }
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
 if (announcement.event === 'dayExecution') {
 return playerCurrentMeta?.gameStarted && playerCurrentMeta?.phase === 'day' && announcement.phase === 'day';
 }
 return true;
}

function hideStalePlayerAnnouncement(meta) {
 const banner = document.getElementById('playerAnnouncementBanner');
 if (!banner || banner.style.display === 'none') return;
 const isMorningBanner = banner.dataset.event === 'morning';
 const isDayExecutionBanner = banner.dataset.event === 'dayExecution';
 const isDifferentDay = banner.dataset.day && Number(banner.dataset.day) !== Number(meta?.day || 0);
 if ((isMorningBanner || isDayExecutionBanner) && (meta?.phase !== 'day' || isDifferentDay)) {
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
