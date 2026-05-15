import { db, ref, set, get, update, onValue, serverTimestamp } from '../core/firebaseClient.js';
import { state } from '../core/state.js';
import { showScreen } from '../ui/screens.js';
import { showToast, showLoading, hideLoading } from '../ui/toast.js';
import { clearTimers, getRandomCard, labelFromIndex, shuffleArray } from './utils.js';
import { formatQuestion, showQuestionScreen, showRevealScreen, showScoreboardScreen, showWinnerScreen } from '../ui/renderers.js';

export function handlePhaseChange(room) {
  const phase = room.phase;
  state.gamePhase = phase;
  state.currentRound = room.currentRound;
  state.totalRounds = room.totalRounds;

  clearTimers();

  if (phase === 'question') showQuestionScreen(room);
  else if (phase === 'writing') showWritingScreen(room);
  else if (phase === 'voting') showVotingScreen(room);
  else if (phase === 'reveal') showRevealScreen(room);
  else if (phase === 'scoreboard') showScoreboardScreen(room);
  else if (phase === 'ended') showWinnerScreen(room);
}

export async function advancePhase(nextPhase) {
  if (!state.isHost) return;
  if (nextPhase === 'writing') {
    await update(ref(db, `rooms/${state.roomCode}`), {
      phase: 'writing',
      writingStartedAt: serverTimestamp(),
      answers: null,
      votes: null,
    });
  } else if (nextPhase === 'voting') {
    // Collect all lies and add true answer, shuffle
    const snap = await get(ref(db, `rooms/${state.roomCode}/answers`));
    const answers = snap.val() || {};
    const card = state.currentQuestion;

    const entries = Object.entries(answers).map(([pid, a]) => ({ pid, text: a }));
    entries.push({ pid: '__truth__', text: card.a });
    const shuffled = shuffleArray(entries);

    await update(ref(db, `rooms/${state.roomCode}`), {
      phase: 'voting',
      shuffledAnswers: shuffled,
      votingStartedAt: serverTimestamp(),
      votes: null,
    });
  }
}

export function showWritingScreen(room) {
  showScreen('screen-writing');
  const card = room.currentCard;
  state.currentQuestion = card;

  document.getElementById('w-ronde').textContent = `Ronde ${room.currentRound}/${room.totalRounds}`;
  document.getElementById('w-question-text').innerHTML = formatQuestion(card.q);

  const textarea = document.getElementById('lie-input');
  textarea.value = '';
  document.getElementById('char-count').textContent = '0';
  textarea.oninput = () => document.getElementById('char-count').textContent = textarea.value.length;

  document.getElementById('submitted-indicator').style.display = 'none';
  document.getElementById('submit-lie-btn').style.display = 'flex';

  // 90-second timer
  let timeLeft = 90;
  const timerEl = document.getElementById('w-timer');
  timerEl.textContent = timeLeft;
  timerEl.classList.remove('urgent');

  state.writeTimer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('urgent');
    if (timeLeft <= 0) {
      clearInterval(state.writeTimer);
      if (!state.myLie) autoSubmitLie();
      if (state.isHost) setTimeout(() => advancePhase('voting'), 2000);
    }
  }, 1000);

  // Watch for all answers
  const answersRef = ref(db, `rooms/${state.roomCode}/answers`);
  const playersRef = ref(db, `rooms/${state.roomCode}/players`);
  const l = onValue(answersRef, async (snap) => {
    const answers = snap.val() || {};
    const playerSnap = await get(playersRef);
    const players = playerSnap.val() || {};
    const total = Object.keys(players).length;
    const submitted = Object.keys(answers).length;
    document.getElementById('submitted-count').textContent = `${submitted}/${total} pemain sudah mengirim jawaban`;
    if (submitted >= total && state.isHost) {
      clearInterval(state.writeTimer);
      setTimeout(() => advancePhase('voting'), 1500);
    }
  });
  state.listeners.push({ ref: answersRef, listener: l });
}

async function autoSubmitLie() {
  if (state.myLie) return;
  const fallback = '—';
  state.myLie = fallback;
  await set(ref(db, `rooms/${state.roomCode}/answers/${state.playerId}`), fallback);
}

export async function submitLie() {
  const text = document.getElementById('lie-input').value.trim();
  if (!text) { showToast('Tulis jawabanmu dulu!', 'error'); return; }
  if (state.myLie) return;

  const card = state.currentQuestion;
  if (text.toLowerCase() === card.a.toLowerCase()) {
    showToast('Jawabanmu terlalu mirip dengan jawaban asli! Coba yang lain.', 'error');
    return;
  }

  state.myLie = text;
  await set(ref(db, `rooms/${state.roomCode}/answers/${state.playerId}`), text);

  document.getElementById('submit-lie-btn').style.display = 'none';
  document.getElementById('submitted-indicator').style.display = 'flex';
  showToast('Kebohonganmu terkirim!', 'success');
}

export function showVotingScreen(room) {
  showScreen('screen-voting');
  const card = room.currentCard;
  state.currentQuestion = card;

  document.getElementById('v-ronde').textContent = `Ronde ${room.currentRound}/${room.totalRounds}`;
  document.getElementById('v-question-text').innerHTML = formatQuestion(card.q);

  const answers = room.shuffledAnswers || [];
  const grid = document.getElementById('answers-grid');
  grid.innerHTML = answers.map((a, i) => {
    const isOwn = a.pid === state.playerId;
    return `
      <div class="answer-option ${isOwn ? 'disabled' : ''}" 
           onclick="${!isOwn ? `castVote('${a.pid}', this)` : ''}"
           data-pid="${a.pid}">
        <div class="answer-label">${labelFromIndex(i)}</div>
        <div class="answer-text">${a.text}${isOwn ? ' <span style="font-size:0.7rem;color:var(--text3)">(milikmu)</span>' : ''}</div>
      </div>
    `;
  }).join('');

  document.getElementById('voted-indicator').style.display = 'none';

  // 30-second timer
  let timeLeft = 30;
  const timerEl = document.getElementById('v-timer');
  timerEl.textContent = timeLeft;
  timerEl.classList.remove('urgent');

  state.voteTimer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('urgent');
    if (timeLeft <= 0) {
      clearInterval(state.voteTimer);
      if (state.isHost) revealAnswers(room);
    }
  }, 1000);

  // Watch votes
  const votesRef = ref(db, `rooms/${state.roomCode}/votes`);
  const playersRef = ref(db, `rooms/${state.roomCode}/players`);
  const l = onValue(votesRef, async (snap) => {
    const votes = snap.val() || {};
    const playerSnap = await get(playersRef);
    const players = playerSnap.val() || {};
    const total = Object.keys(players).length;
    const voted = Object.keys(votes).length;
    document.getElementById('voted-count').textContent = `${voted}/${total} pemain sudah memilih`;
    if (voted >= total && state.isHost) {
      clearInterval(state.voteTimer);
      setTimeout(() => revealAnswers(room), 1000);
    }
  });
  state.listeners.push({ ref: votesRef, listener: l });
}

export async function castVote(pid, el) {
  if (state.myVote) return;
  if (pid === state.playerId) { showToast('Tidak bisa memilih jawabanmu sendiri!', 'error'); return; }

  state.myVote = pid;
  document.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
  el.closest('.answer-option').classList.add('selected');

  await set(ref(db, `rooms/${state.roomCode}/votes/${state.playerId}`), pid);
  document.getElementById('voted-indicator').style.display = 'flex';
  showToast('Pilihanmu tercatat!', 'success');
}

// ===== REVEAL =====
export async function revealAnswers(room) {
  if (!state.isHost) return;

  const answersSnap = await get(ref(db, `rooms/${state.roomCode}/answers`));
  const votesSnap = await get(ref(db, `rooms/${state.roomCode}/votes`));
  const playersSnap = await get(ref(db, `rooms/${state.roomCode}/players`));

  const answers = answersSnap.val() || {};
  const votes = votesSnap.val() || {};
  const players = playersSnap.val() || {};
  const shuffledAnswers = room.shuffledAnswers || [];
  const card = room.currentCard;

  // Calculate points
  const roundPoints = {};
  Object.keys(players).forEach(pid => roundPoints[pid] = 0);

  // +2 for guessing truth, +1 for each person fooled
  Object.entries(votes).forEach(([voterId, votedPid]) => {
    if (votedPid === '__truth__') {
      roundPoints[voterId] = (roundPoints[voterId] || 0) + 2;
    } else if (votedPid !== voterId) {
      roundPoints[votedPid] = (roundPoints[votedPid] || 0) + 1;
    }
  });

  // Update scores
  const scoreUpdates = {};
  Object.entries(roundPoints).forEach(([pid, pts]) => {
    if (players[pid]) {
      scoreUpdates[`rooms/${state.roomCode}/players/${pid}/score`] = (players[pid].score || 0) + pts;
    }
  });
  if (Object.keys(scoreUpdates).length > 0) await update(ref(db), scoreUpdates);

  await update(ref(db, `rooms/${state.roomCode}`), {
    phase: 'reveal',
    roundPoints,
    votes,
    answers,
  });
}

export async function nextRound() {
  if (!state.isHost) return;

  const snap = await get(ref(db, `rooms/${state.roomCode}`));
  const room = snap.val();

  // Check win condition for 'race' mode
  if (room.winMode === 'race') {
    const players = room.players || {};
    const winner = Object.entries(players).find(([,p]) => p.score >= 15);
    if (winner) {
      await update(ref(db, `rooms/${state.roomCode}`), { phase: 'ended' });
      return;
    }
  }

  if (room.currentRound >= room.totalRounds) {
    await update(ref(db, `rooms/${state.roomCode}`), { phase: 'scoreboard', showFinal: true });
    return;
  }

  showLoading('Memuat ronde berikutnya...');
  const usedIds = room.usedCardIds || [];
  const card = getRandomCard(room.edition, usedIds);
  usedIds.push(card.id);

  await update(ref(db, `rooms/${state.roomCode}`), {
    phase: 'question',
    currentRound: room.currentRound + 1,
    currentCard: card,
    usedCardIds: usedIds,
    answers: null,
    votes: null,
    shuffledAnswers: null,
    roundPoints: null,
  });
  hideLoading();
}

export async function continueGame() {
  const snap = await get(ref(db, `rooms/${state.roomCode}`));
  const room = snap.val();
  showLoading('Memuat ronde berikutnya...');
  const usedIds = room.usedCardIds || [];
  const card = getRandomCard(room.edition, usedIds);
  usedIds.push(card.id);

  await update(ref(db, `rooms/${state.roomCode}`), {
    phase: 'question',
    currentRound: room.currentRound + 1,
    currentCard: card,
    usedCardIds: usedIds,
    answers: null, votes: null, shuffledAnswers: null, roundPoints: null, showFinal: false
  });
  hideLoading();
}

export async function endGame() {
  await update(ref(db, `rooms/${state.roomCode}`), { phase: 'ended' });
}
