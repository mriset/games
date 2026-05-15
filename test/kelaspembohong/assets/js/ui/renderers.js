import { state } from '../core/state.js';
import { EDITIONS } from '../data/editions.js';
import { showScreen } from './screens.js';
import { labelFromIndex } from '../game/utils.js';

function icon(name, className = '') {
  return `<i data-lucide="${name}"${className ? ` class="${className}"` : ''}></i>`;
}

function refreshDynamicIcons() {
  if (window.refreshIcons) {
    requestAnimationFrame(window.refreshIcons);
  }
}

function setButtonLabel(id, label, iconName = 'arrow-right') {
  const button = document.getElementById(id);
  if (!button) return;
  button.innerHTML = `${icon(iconName)}<span>${label}</span>`;
  refreshDynamicIcons();
}

export function initEditionList() {
  const el = document.getElementById('edition-list');
  if (!el) return;
  el.innerHTML = Object.entries(EDITIONS).map(([key, ed]) => `
    <div class="edition-item ${key === state.selectedEdition ? 'selected' : ''}" onclick="selectEdition('${key}')">
      <div class="edition-icon">${icon(ed.icon)}</div>
      <div class="edition-info">
        <div class="edition-name">${ed.name}</div>
        <div class="edition-meta">${ed.desc} - Kesulitan ${ed.difficulty}/3</div>
      </div>
      <div class="edition-check">${icon('check')}</div>
    </div>
  `).join('');
  refreshDynamicIcons();
}

export function selectEdition(key) {
  state.selectedEdition = key;
  document.querySelectorAll('.edition-item').forEach(el => {
    el.classList.toggle('selected', el.onclick.toString().includes(`'${key}'`));
  });
}

export function adjustRounds(delta) {
  state.roundCount = Math.max(5, Math.min(30, state.roundCount + delta));
  document.getElementById('round-count').textContent = state.roundCount;
}

export function selectWinMode(btn, mode) {
  state.winMode = mode;
  document.querySelectorAll('.win-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

export function syncGameSettingsUI(room = {}) {
  state.selectedEdition = room.edition || state.selectedEdition || 'base';
  state.roundCount = room.totalRounds || state.roundCount || 10;
  state.winMode = room.winMode || state.winMode || 'standard';

  document.querySelectorAll('.edition-item').forEach(el => {
    el.classList.toggle('selected', el.onclick.toString().includes(`'${state.selectedEdition}'`));
  });

  const roundCount = document.getElementById('round-count');
  if (roundCount) roundCount.textContent = state.roundCount;

  document.querySelectorAll('.win-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === state.winMode);
  });

  const players = Object.keys(room.players || {}).length;
  const hint = document.getElementById('settings-start-hint');
  if (hint) {
    hint.textContent = players >= 3
      ? `${players} pemain siap. Pilih setting lalu mulai game.`
      : `Butuh minimal 3 pemain untuk mulai game (${players}/3)`;
  }
}

export function updateLobbyUI(room) {
  const edition = EDITIONS[room.edition] || EDITIONS.base;
  const editionEl = document.getElementById('lobby-edition');
  editionEl.innerHTML = `<span class="lobby-edition-icon">${icon(edition.icon)}</span><span>${edition.name}</span>`;
  document.getElementById('lobby-rounds').textContent = `${room.totalRounds} Ronde`;
  const winModes = { standard:'Poin Tertinggi', race:'Balapan ke 15 Poin', elimination:'Eliminasi' };
  document.getElementById('lobby-winmode').textContent = winModes[room.winMode] || 'Standar';

  const players = Object.entries(room.players || {});
  document.getElementById('player-count').textContent = players.length;
  const list = document.getElementById('players-list');
  list.innerHTML = players.sort((a,b) => a[1].joinedAt - b[1].joinedAt).map(([id, p]) => `
    <div class="player-item">
      <div class="player-avatar" style="background:${p.color}20; color:${p.color}; border-color:${p.color}55">
        ${p.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div class="player-name">${p.name}</div>
        ${id === state.playerId ? '<div class="sb-you">Kamu</div>' : ''}
      </div>
      ${p.isHost ? '<span class="player-badge badge-host">HOST</span>' : '<span class="player-badge badge-ready">Siap</span>'}
    </div>
  `).join('');

  if (state.isHost) {
    document.getElementById('host-actions').style.display = 'block';
    document.getElementById('waiting-msg').style.display = 'none';
    const hint = document.getElementById('start-hint');
    const enough = players.length >= 3;
    hint.textContent = enough
      ? `${players.length} pemain siap. Lanjutkan untuk pilih edisi dan setting.`
      : `Pemain bisa join sekarang. Minimal 3 pemain untuk mulai (${players.length}/3).`;
  } else {
    document.getElementById('host-actions').style.display = 'none';
    document.getElementById('waiting-msg').style.display = 'flex';
  }

  refreshDynamicIcons();
}

export function showQuestionScreen(room) {
  showScreen('screen-question');
  const card = room.currentCard;
  state.currentQuestion = card;
  state.myLie = null;
  state.myVote = null;

  document.getElementById('q-ronde').textContent = `Ronde ${room.currentRound}/${room.totalRounds}`;
  document.getElementById('q-category').textContent = card.cat;
  document.getElementById('q-text').innerHTML = formatQuestion(card.q);

  updateMiniScores(room.players);

  if (state.isHost) {
    document.getElementById('host-next-btn').style.display = 'block';
    document.getElementById('waiting-host-start').style.display = 'none';
  } else {
    document.getElementById('host-next-btn').style.display = 'none';
    document.getElementById('waiting-host-start').style.display = 'flex';
  }

  refreshDynamicIcons();
}

export function formatQuestion(q) {
  return q.replace('[...]', '<span class="blank">...</span>');
}

export function showRevealScreen(room) {
  showScreen('screen-reveal');
  const card = room.currentCard;

  document.getElementById('r-ronde').textContent = `Ronde ${room.currentRound}/${room.totalRounds}`;
  document.getElementById('reveal-truth').textContent = card.a;
  document.getElementById('reveal-question').textContent = card.q.replace('[...]', '___');

  const shuffledAnswers = room.shuffledAnswers || [];
  const votes = room.votes || {};
  const roundPoints = room.roundPoints || {};
  const players = room.players || {};
  const myId = state.playerId;

  const revealEl = document.getElementById('reveal-answers');
  revealEl.innerHTML = shuffledAnswers.map((a, i) => {
    const isTruth = a.pid === '__truth__';
    const author = isTruth ? 'Jawaban Asli' : (players[a.pid]?.name || '?');
    const whoVoted = Object.entries(votes).filter(([,v]) => v === a.pid).map(([voterId]) => players[voterId]?.name || '?');

    return `
      <div class="reveal-answer-item ${isTruth ? 'is-truth' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="reveal-answer-top">
          <div>
            <span class="answer-index">${labelFromIndex(i)}.</span>
            <span class="reveal-answer-text"> ${a.text}</span>
          </div>
        </div>
        <div class="reveal-answer-author">${isTruth ? icon('badge-check') : icon('user-round')}<span>${author}</span></div>
        ${whoVoted.length > 0 ? `<div class="reveal-votes">${whoVoted.map(n => `<span class="vote-chip ${isTruth ? 'correct' : 'fooled'}">+${isTruth ? '2' : '1'} ${n}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');

  const sortedRoundPts = Object.entries(roundPoints).sort((a,b) => b[1]-a[1]);
  document.getElementById('round-scores').innerHTML = `
    <div class="round-scores-title">Poin Ronde Ini</div>
    ${sortedRoundPts.map(([pid, pts]) => `
      <div class="rs-item">
        <span>${players[pid]?.name || '?'}${pid === myId ? ' (kamu)' : ''}</span>
        <span class="rs-delta ${pts === 0 ? 'zero' : ''}">${pts > 0 ? '+'+pts : pts} poin</span>
      </div>
    `).join('')}
  `;

  if (state.isHost) {
    document.getElementById('host-reveal-next').style.display = 'block';
    document.getElementById('player-reveal-wait').style.display = 'none';
    const isLastRound = room.currentRound >= room.totalRounds;
    setButtonLabel('next-round-btn', isLastRound ? 'Lihat Hasil Akhir' : 'Ronde Berikutnya', isLastRound ? 'trophy' : 'arrow-right');
  } else {
    document.getElementById('host-reveal-next').style.display = 'none';
    document.getElementById('player-reveal-wait').style.display = 'flex';
  }

  refreshDynamicIcons();
}

export function showScoreboardScreen(room) {
  showScreen('screen-scoreboard');
  const players = room.players || {};
  const sorted = Object.entries(players).sort((a,b) => b[1].score - a[1].score);
  const isFinal = room.showFinal;

  document.getElementById('score-ronde-info').textContent = isFinal
    ? `Game Selesai! ${room.totalRounds} Ronde`
    : `Setelah Ronde ${room.currentRound}/${room.totalRounds}`;

  const rankIcons = ['crown', 'medal', 'award'];
  document.getElementById('scoreboard-list').innerHTML = sorted.map(([pid, p], i) => `
    <div class="sb-item" style="animation-delay:${i*0.1}s">
      <div class="sb-rank">${rankIcons[i] ? icon(rankIcons[i]) : i + 1}</div>
      <div class="player-avatar" style="background:${p.color}20;color:${p.color};border-color:${p.color}55">
        ${p.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div class="sb-name">${p.name}</div>
        ${pid === state.playerId ? '<div class="sb-you">Kamu</div>' : ''}
      </div>
      <div class="sb-score">${p.score}</div>
    </div>
  `).join('');

  if (state.isHost) {
    document.getElementById('host-score-actions').style.display = 'flex';
    document.getElementById('host-score-actions').style.flexDirection = 'column';
    document.getElementById('host-score-actions').style.gap = '8px';
    document.getElementById('player-score-wait').style.display = 'none';
    document.getElementById('continue-game-btn').style.display = isFinal ? 'none' : 'flex';
  } else {
    document.getElementById('host-score-actions').style.display = 'none';
    document.getElementById('player-score-wait').style.display = 'flex';
  }

  refreshDynamicIcons();
}

export function showWinnerScreen(room) {
  showScreen('screen-winner');
  const players = room.players || {};
  const sorted = Object.entries(players).sort((a,b) => b[1].score - a[1].score);
  const [winId, winPlayer] = sorted[0] || ['?', { name: '???', score: 0 }];

  document.getElementById('winner-name').textContent = winPlayer.name;
  document.getElementById('winner-score').textContent = `${winPlayer.score} Poin`;

  const rankIcons = ['crown', 'medal', 'award'];
  document.getElementById('final-scoreboard').innerHTML = sorted.map(([pid, p], i) => `
    <div class="fs-item">
      <span>${rankIcons[i] ? icon(rankIcons[i]) : `<strong>${i + 1}</strong>`} ${p.name}${pid === state.playerId ? ' (kamu)' : ''}</span>
      <span class="fs-score">${p.score} poin</span>
    </div>
  `).join('');

  launchConfetti();
  refreshDynamicIcons();
}

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#f6c945','#e85d3f','#4fa3ff','#31c48d','#f472b6','#f7f1d6'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 3 + 's';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    container.appendChild(piece);
  }
}

export function updateMiniScores(players) {
  if (!players) return;
  const sorted = Object.entries(players).sort((a,b) => b[1].score - a[1].score).slice(0, 5);
  document.getElementById('scores-mini').innerHTML = sorted.map(([pid, p]) => `
    <div class="score-mini-item">
      <div class="smi-name">${p.name.substring(0,6)}</div>
      <div class="smi-score">${p.score}</div>
    </div>
  `).join('');
}
