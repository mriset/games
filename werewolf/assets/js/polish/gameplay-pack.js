(function () {
 const AUDIO_KEY = 'werewolf_audio_muted';
 let muted = localStorage.getItem(AUDIO_KEY) === 'true';

 function updateAudioLabel() {
 const label = document.getElementById('sheetAudioText');
 if (label) label.textContent = muted ? 'Audio Mati' : 'Audio Aktif';
 }

 window.toggleWerewolfMute = function () {
 muted = !muted;
 localStorage.setItem(AUDIO_KEY, muted ? 'true' : 'false');
 updateAudioLabel();
 if (typeof showToast === 'function') showToast(muted ? 'Audio dimatikan.' : 'Audio diaktifkan.', 'info');
 };

 window.playWerewolfSound = function (kind = 'info') {
 if (muted) return;
 try {
 const ctx = new (window.AudioContext || window.webkitAudioContext)();
 const patterns = {
 night: [196, 146],
 day: [392, 523],
 timer: [880, 880, 660],
 vote: [523, 659],
 role: [330, 494, 659],
 info: [440]
 };
 const notes = patterns[kind] || patterns.info;
 notes.forEach((freq, index) => {
 const start = ctx.currentTime + index * 0.14;
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = kind === 'night' ? 'triangle' : 'sine';
 osc.frequency.setValueAtTime(freq, start);
 gain.gain.setValueAtTime(0.0001, start);
 gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
 gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(start);
 osc.stop(start + 0.24);
 });
 } catch (e) {
 // Audio can be blocked until the first user gesture.
 }
 };

 window.saveGameHistory = function (winner, subtitle) {
 try {
 const key = 'werewolf_game_history';
 const history = JSON.parse(localStorage.getItem(key) || '[]');
 const players = Array.isArray(window.gameState?.players) ? window.gameState.players : (typeof gameState !== 'undefined' ? gameState.players : []);
 const entry = {
 winner,
 subtitle,
 day: typeof gameState !== 'undefined' ? gameState.day : 1,
 playerCount: players.length,
 deaths: players.filter(p => !p.alive).map(p => ({ name: p.name, role: p.role })),
 finishedAt: new Date().toISOString()
 };
 history.unshift(entry);
 localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
 } catch (e) {
 // Ignore storage failures.
 }
 };

 function addAriaLabels() {
 document.querySelectorAll('button[title]:not([aria-label])').forEach(btn => {
 btn.setAttribute('aria-label', btn.getAttribute('title'));
 });
 document.querySelectorAll('.counter-btn:not([aria-label])').forEach(btn => {
 btn.setAttribute('aria-label', btn.textContent.trim() === '+' ? 'Tambah jumlah role' : 'Kurangi jumlah role');
 });
 }

 function registerServiceWorker() {
 if (!('serviceWorker' in navigator)) return;
 if (location.protocol === 'file:') return;
 navigator.serviceWorker.register('sw.js').catch(err => {
 console.warn('Service worker tidak aktif:', err);
 });
 }

 document.addEventListener('DOMContentLoaded', () => {
 updateAudioLabel();
 updateNightTimerDisplay();
 addAriaLabels();
 registerServiceWorker();
 });
})();
