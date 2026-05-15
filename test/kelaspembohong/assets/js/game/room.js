import { db, ref, set, get, update, onValue, off, remove, serverTimestamp } from '../core/firebaseClient.js';
import { state } from '../core/state.js';
import { showScreen } from '../ui/screens.js';
import { showToast, showLoading, hideLoading } from '../ui/toast.js';
import { syncGameSettingsUI, updateLobbyUI } from '../ui/renderers.js';
import { AVATAR_COLORS, clearTimers, generatePlayerId, generateRoomCode, getRandomCard } from './utils.js';
import { handlePhaseChange } from './phases.js';
import { saveSession } from '../core/session.js';

export function checkPinAndGoToCreate() {
  const pin = prompt('Masukkan PIN untuk membuat ruangan:');
  if (pin === '183729') {
    showScreen('screen-create');
  } else {
    showToast('PIN salah!', 'error');
  }
};

export async function createRoom() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { showToast('Masukkan nama panggilanmu!', 'error'); return; }

  showLoading('Membuat ruangan...');
  const code = generateRoomCode();
  const pid = generatePlayerId();
  state.playerId = pid;
  state.playerName = name;
  state.isHost = true;
  state.roomCode = code;
  state.selectedEdition = 'base';
  state.roundCount = 10;
  state.winMode = 'standard';
  saveSession();

  const roomData = {
    code,
    hostId: pid,
    edition: 'base',
    totalRounds: 10,
    winMode: 'standard',
    settingsReady: false,
    phase: 'lobby',
    currentRound: 0,
    usedCardIds: [],
    createdAt: serverTimestamp(),
    players: {
      [pid]: {
        name, isHost: true, score: 0, color: AVATAR_COLORS[0], joinedAt: Date.now()
      }
    }
  };

  try {
    await set(ref(db, `rooms/${code}`), roomData);
    hideLoading();
    enterLobby(code, pid);
  } catch(e) {
    hideLoading();
    showToast('Gagal membuat ruangan. Cek koneksi internet.', 'error');
    console.error(e);
  }
}

// ===== JOIN ROOM =====
export async function joinRoom() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();
  if (!code || code.length < 4) { showToast('Masukkan kode ruangan!', 'error'); return; }
  if (!name) { showToast('Masukkan nama panggilanmu!', 'error'); return; }

  showLoading('Bergabung...');
  try {
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) {
      hideLoading();
      showToast('Ruangan tidak ditemukan!', 'error');
      return;
    }
    const room = snap.val();
    if (room.phase !== 'lobby') {
      hideLoading();
      showToast('Game sudah dimulai! Tidak bisa bergabung.', 'error');
      return;
    }
    const playerCount = Object.keys(room.players || {}).length;
    if (playerCount >= 16) {
      hideLoading();
      showToast('Ruangan penuh (max 16 pemain)!', 'error');
      return;
    }

    const pid = generatePlayerId();
    state.playerId = pid;
    state.playerName = name;
    state.isHost = false;
    state.roomCode = code;
    saveSession();

    await set(ref(db, `rooms/${code}/players/${pid}`), {
      name, isHost: false, score: 0,
      color: AVATAR_COLORS[playerCount % AVATAR_COLORS.length],
      joinedAt: Date.now()
    });

    hideLoading();
    enterLobby(code, pid);
  } catch(e) {
    hideLoading();
    showToast('Gagal bergabung. Coba lagi.', 'error');
    console.error(e);
  }
}

// ===== LOBBY =====
export function enterLobby(code, pid) {
  showScreen('screen-lobby');
  document.getElementById('lobby-room-code').textContent = code;
  state.roomRef = ref(db, `rooms/${code}`);

  const listener = onValue(state.roomRef, (snap) => {
    if (!snap.exists()) { 
      if (!state.isHost) showToast('Ruangan telah ditutup oleh host.', 'error', 4000);
      leaveRoom(true); 
      return; 
    }
    const room = snap.val();
    updateLobbyUI(room);
    if (room.phase !== 'lobby') {
      handlePhaseChange(room);
    } else if (state.gamePhase && state.gamePhase !== 'lobby') {
      state.gamePhase = 'lobby';
      showScreen('screen-lobby');
      clearTimers();
    }
  });
  state.listeners.push({ ref: state.roomRef, listener });
}

export function copyRoomCode() {
  navigator.clipboard.writeText(state.roomCode).then(() => showToast('Kode disalin!', 'success'));
};

export async function goToGameSettings() {
  if (!state.isHost) return;

  try {
    const snap = await get(ref(db, `rooms/${state.roomCode}`));
    if (!snap.exists()) {
      showToast('Ruangan tidak ditemukan.', 'error');
      return;
    }

    const room = snap.val();
    if (room.phase !== 'lobby') {
      showToast('Game sudah dimulai.', 'error');
      return;
    }

    syncGameSettingsUI(room);
    showScreen('screen-game-settings');
  } catch(e) {
    showToast('Gagal membuka setting game.', 'error');
    console.error(e);
  }
}

export function exitGameMiddle() {
  if (state.isHost) {
    if (confirm('Akhiri permainan ini dan kembali ke lobby?')) {
      update(ref(db, `rooms/${state.roomCode}`), { phase: 'lobby' });
    }
  } else {
    if (confirm('Keluar dari ruangan ini?')) {
      leaveRoom();
    }
  }
};

export function leaveRoom(force = false) {
  if (state.isHost && !force) {
    if (!confirm('Apakah kamu yakin ingin menutup ruangan? Semua pemain akan dikeluarkan.')) return;
  }

  // Remove listeners
  state.listeners.forEach(l => off(l.ref, 'value', l.listener));
  state.listeners = [];
  clearTimers();

  if (state.roomCode && state.isHost) {
    remove(ref(db, `rooms/${state.roomCode}`)).catch(() => {});
  } else if (state.roomCode && state.playerId) {
    remove(ref(db, `rooms/${state.roomCode}/players/${state.playerId}`)).catch(() => {});
  }
  state.roomCode = null;
  state.playerId = null;
  state.playerName = null;
  state.isHost = false;
  state.roomRef = null;
  sessionStorage.removeItem('kp_session');
  showScreen('screen-home');
}

export async function startGame() {
  if (!state.isHost) return;

  showLoading('Memulai game...');
  try {
    const snap = await get(ref(db, `rooms/${state.roomCode}`));
    if (!snap.exists()) {
      hideLoading();
      showToast('Ruangan tidak ditemukan.', 'error');
      return;
    }

    const room = snap.val();
    const playerCount = Object.keys(room.players || {}).length;
    if (playerCount < 3) {
      hideLoading();
      showToast(`Butuh minimal 3 pemain untuk mulai (${playerCount}/3).`, 'error');
      return;
    }

    if (room.phase !== 'lobby') {
      hideLoading();
      showToast('Game sudah dimulai.', 'error');
      return;
    }

    const edition = state.selectedEdition || room.edition || 'base';
    const totalRounds = state.roundCount || room.totalRounds || 10;
    const winMode = state.winMode || room.winMode || 'standard';
    const card = getRandomCard(edition, []);

    await update(ref(db, `rooms/${state.roomCode}`), {
      edition,
      totalRounds,
      winMode,
      settingsReady: true,
      phase: 'question',
      currentRound: 1,
      usedCardIds: [card.id],
      currentCard: card,
      answers: null,
      votes: null,
    });
    hideLoading();
  } catch(e) {
    hideLoading();
    showToast('Gagal memulai game. Coba lagi.', 'error');
    console.error(e);
  }
}

export function returnToHome() {
  state.listeners.forEach(l => off(l.ref, 'value', l.listener));
  state.listeners = [];
  clearTimers();
  if (state.roomCode && state.isHost) {
    remove(ref(db, `rooms/${state.roomCode}`)).catch(() => {});
  } else if (state.roomCode && state.playerId) {
    remove(ref(db, `rooms/${state.roomCode}/players/${state.playerId}`)).catch(() => {});
  }
  state.roomCode = null;
  state.playerId = null;
  sessionStorage.removeItem('kp_session');
  showScreen('screen-home');
}
