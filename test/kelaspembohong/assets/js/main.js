import { showScreen } from './ui/screens.js';
import { initEditionList, selectEdition, adjustRounds, selectWinMode } from './ui/renderers.js';

function showMessage(message, type = 'error') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  } else {
    alert(message);
  }
}

function getOnlineSetupErrorMessage() {
  if (window.location.protocol === 'file:') {
    return 'Fitur online harus dibuka lewat server lokal (http://localhost), bukan langsung dari file.';
  }
  if (!navigator.onLine) {
    return 'Fitur online belum siap. Cek koneksi internet lalu refresh halaman.';
  }
  return 'Fitur online belum siap. Firebase/CDN gagal dimuat, cek koneksi lalu refresh halaman.';
}

function checkPinAndGoToCreateFallback() {
  const pin = prompt('Masukkan PIN untuk membuat ruangan:');
  if (pin === '183729') {
    showScreen('screen-create');
  } else {
    showMessage('PIN salah!');
  }
}

const onlineModulesReady = Promise.all([
  import('./game/room.js'),
  import('./game/phases.js'),
  import('./core/session.js'),
]).then(([room, phases, session]) => {
  Object.assign(window, {
    checkPinAndGoToCreate: room.checkPinAndGoToCreate,
    createRoom: room.createRoom,
    joinRoom: room.joinRoom,
    copyRoomCode: room.copyRoomCode,
    goToGameSettings: room.goToGameSettings,
    exitGameMiddle: room.exitGameMiddle,
    leaveRoom: room.leaveRoom,
    startGame: room.startGame,
    returnToHome: room.returnToHome,
    advancePhase: phases.advancePhase,
    submitLie: phases.submitLie,
    castVote: phases.castVote,
    nextRound: phases.nextRound,
    continueGame: phases.continueGame,
    endGame: phases.endGame,
  });

  return { room, session };
});

async function runWhenOnline(actionName, label, ...args) {
  try {
    showMessage(`${label}...`, 'success');
    await onlineModulesReady;
    return window[actionName](...args);
  } catch(e) {
    console.error(e);
    showMessage(getOnlineSetupErrorMessage());
    return null;
  }
}

Object.assign(window, {
  showScreen,
  selectEdition,
  adjustRounds,
  selectWinMode,
  checkPinAndGoToCreate: checkPinAndGoToCreateFallback,
  createRoom: () => runWhenOnline('createRoom', 'Menyiapkan ruangan'),
  joinRoom: () => runWhenOnline('joinRoom', 'Menyiapkan koneksi'),
  copyRoomCode: () => runWhenOnline('copyRoomCode', 'Menyiapkan salin kode'),
  goToGameSettings: () => runWhenOnline('goToGameSettings', 'Membuka setting'),
  exitGameMiddle: () => runWhenOnline('exitGameMiddle', 'Menyiapkan game'),
  leaveRoom: () => showScreen('screen-home'),
  startGame: () => runWhenOnline('startGame', 'Menyiapkan game'),
  advancePhase: (phase) => runWhenOnline('advancePhase', 'Menyiapkan fase', phase),
  submitLie: () => runWhenOnline('submitLie', 'Menyiapkan jawaban'),
  castVote: (pid) => runWhenOnline('castVote', 'Menyiapkan vote', pid),
  nextRound: () => runWhenOnline('nextRound', 'Menyiapkan ronde'),
  continueGame: () => runWhenOnline('continueGame', 'Menyiapkan game'),
  endGame: () => runWhenOnline('endGame', 'Menyiapkan akhir game'),
  returnToHome: () => showScreen('screen-home'),
});

document.addEventListener('DOMContentLoaded', async () => {
  initEditionList();

  try {
    const { room, session } = await onlineModulesReady;
    const reconnected = await session.tryReconnect(room.enterLobby);
    if (!reconnected) {
      document.getElementById('screen-splash').classList.add('active');
    }
  } catch(e) {
    console.error(e);
    document.getElementById('screen-splash').classList.add('active');
  }
});
