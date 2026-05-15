import { db, ref, get } from './firebaseClient.js';
import { state } from './state.js';
import { showLoading, hideLoading } from '../ui/toast.js';

export function saveSession() {
  if (state.roomCode && state.playerId) {
    sessionStorage.setItem('kp_session', JSON.stringify({
      roomCode: state.roomCode,
      playerId: state.playerId,
      playerName: state.playerName,
      isHost: state.isHost
    }));
  }
}

export async function tryReconnect(enterLobby) {
  const saved = sessionStorage.getItem('kp_session');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      showLoading('Menghubungkan kembali...');
      const snap = await get(ref(db, `rooms/${data.roomCode}`));
      if (snap.exists() && snap.val().players && snap.val().players[data.playerId]) {
        state.roomCode = data.roomCode;
        state.playerId = data.playerId;
        state.playerName = data.playerName;
        state.isHost = data.isHost;
        enterLobby(data.roomCode, data.playerId);
        hideLoading();
        return true;
      } else {
        sessionStorage.removeItem('kp_session');
      }
    } catch(e) {
      console.error(e);
      sessionStorage.removeItem('kp_session');
    }
    hideLoading();
  }
  return false;
}
