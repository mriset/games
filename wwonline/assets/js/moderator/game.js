 function startGame() {
 if (gameState.players.length < 5) {
 return showToast('Minimal 5 pemain untuk memulai game!', 'error');
 }

 const playersWithoutRole = gameState.players.filter(p => !p.role);
 if (playersWithoutRole.length > 0) {
 const preview = playersWithoutRole.slice(0, 3).map(p => p.name).join(', ');
 const extra = playersWithoutRole.length > 3 ? ` dan ${playersWithoutRole.length - 3} lainnya` : '';
 return showToast(`Masih ada pemain tanpa role: ${preview}${extra}.`, 'error');
 }

 const totalRoles = Object.values(gameState.roles).reduce((a, b) => a + b, 0);
 if (totalRoles < gameState.players.length) {
 return showToast('Role belum cukup untuk semua pemain!', 'error');
 }

 gameState.started = true;
 gameState.rolesSubmitted = true;
 gameState.phase = 'night';
 gameState.day = 1;
 gameState.isPaused = false;
 delete gameState._onlineVoteOpenedDay;
 delete gameState._onlineVoteLockedDay;
 gameState._lastNightActionResult = null;
 gameState._lastNightActionPhase = null;
 gameState.nightPhase = 0;
 gameState.votes = {};
 gameState.onlineManualVotes = {};
 gameState.wolfTeam = gameState.players.filter(p => {
 const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
 return def && def.team === 'Werewolf';
 }).map(p => p.name);
 gameState.witchPotions = { heal: true, poison: true };
 gameState.guardLastProtect = null;
 gameState.eliminatedPlayers = [];
 gameState.winner = null;
 gameState.veteranAlertsLeft = 2;
 gameState.doppelgangerTarget = null;
 gameState.toughGuyPendingDeath = null;
 gameState.wolfCubKilledThisDay = false;
 gameState.wolfCubDoubleKillActive = false;
 gameState.infectorUsed = false;
 gameState.survivorVestUsed = false;
 gameState.arsonistDousedIds = [];
 gameState.drunkPoisonedWolf = false;
 gameState.apprenticeSeerActivated = false;
 gameState.thiefStolen = null;
 gameState.huntersApprenticeActivated = false;
 gameState.troublemakerUsed = false;
 gameState.amnesiacChosen = false;

 gameState.bountyHunterTarget = null;
 const bh = gameState.players.find(p => p.role === 'Bounty Hunter');
 if (bh) {
 const otherPlayers = gameState.players.filter(p => p.id !== bh.id);
 if (otherPlayers.length > 0) {
 const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
 gameState.bountyHunterTarget = randomTarget.id;
 addLog('night', ` [MODERATOR ONLY] Bounty Hunter ${bh.name} ditugaskan menarget ${randomTarget.name}.`);
 }
 }

 gameState.cultMembers = [];
 const cl = gameState.players.find(p => p.role === 'Cult Leader');
 if (cl) gameState.cultMembers.push(String(cl.id));

 gameState.vampireTeam = gameState.players.filter(p => p.role === 'Vampire').map(p => String(p.id));

 const minion = gameState.players.find(p => p.role === 'Minion');
 if (minion) {
 const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role] && ROLE_DEFINITIONS[p.role].team === 'Werewolf' && p.role !== 'Minion');
 if (wolves.length > 0) {
 addLog('night', ` [MODERATOR ONLY] Minion ${minion.name} mengetahui bahwa Serigala adalah: ${wolves.map(w => w.name).join(', ')}.`);
 }
 }

 gameState.nightState = createInitialNightState();
 // Alpha Wolf persistent state (survive across nights)
 gameState._alphaAbilityUsed = false;
 gameState._alphaChoice = null; // 'kill' | 'recruit' | null
 gameState._alphaRecruitDone = false; // true setelah rekrut malam 2 selesai
 // Guard rekursi Cupid cascade
 gameState._processingCouples = false;

 addLog('night', ' Permainan dimulai! Selamat bermain.');
 updatePhaseBanner();
 updatePauseControls();
 updateStats();
 switchTab('night');
 showToast(' Game dimulai! Fase malam pertama.', 'success');
 if (typeof saveState === 'function') saveState();
 if (typeof pushAnnouncement === 'function') pushAnnouncement('info', 'Game Dimulai', 'Permainan dimulai. Malam pertama telah tiba.');
 if (typeof playWerewolfSound === 'function') playWerewolfSound('night');
 }

 function roleHasActiveNightStep(role) {
 if (role === 'Werewolf') {
 return gameState.players.some(p => p.alive && (p.role === 'Werewolf' || p.role === 'Wolfman'));
 }
 return gameState.players.some(p => p.role === role && p.alive);
 }

 function getActiveNightRoles() {
 return NIGHT_ORDER.filter(roleHasActiveNightStep);
 }

 function nextPhase() {
 if (!gameState.started) {
 return startGame();
 }
 if (isGameplayPaused()) return;

 if (gameState.phase === 'night') {
 const activeRoles = getActiveNightRoles();

 if (gameState.nightPhase < activeRoles.length) {
 const currentRole = activeRoles[gameState.nightPhase];
 const roleName = currentRole;
 showToast(` Aksi malam belum selesai! Giliran ${roleName}. Selesaikan atau klik Lewati terlebih dahulu.`, 'error');
 return; // Blokir penggantian fase
 }
 } else if (gameState.phase === 'day') {
 const totalVotes = Object.values(gameState.votes).reduce((a, b) => a + b, 0);
 if (totalVotes > 0) {
 showConfirm(
 'Peringatan Voting',
 `Terdapat ${totalVotes} suara voting yang sudah masuk tapi belum dieksekusi. Yakin ingin memaksa lanjut ke Malam (hasil vote akan dihapus)?`,
 'Paksa Lanjut',
 true,
 () => executeNextPhase()
 );
 return;
 }
 }

 const targetPhase = gameState.phase === 'day' ? 'Malam' : 'Siang';
 showConfirm(
 'Lanjut Fase?',
 `Apakah Anda yakin ingin lanjut ke fase ${targetPhase}?`,
 'Lanjut',
 false,
 () => {
 executeNextPhase();
 }
 );
 }

function executeNextPhase() {
 if (gameState.isPaused) {
 gameState.isPaused = false;
 updatePauseControls();
 }

 if (gameState.phase === 'day') {
 // Day -> Night
 lastDayExecutionSnapshot = null;
 updateDayUndoButton();
 resetTimer(); // Pastikan timer siang berhenti saat masuk malam
 gameState.phase = 'night';
 gameState.nightPhase = 0;
 gameState.nightState = createInitialNightState();
 gameState._lastNightActionResult = null;
 gameState._lastNightActionPhase = null;
 delete gameState._onlineVoteOpenedDay;
 delete gameState._onlineVoteLockedDay;
 if (gameState.onlineManualVotes) delete gameState.onlineManualVotes[gameState.day];
 // UI-05 FIX: Increment day SEBELUM showPhaseTransition agar overlay
 // menampilkan nomor malam yang benar (bukan nomor lama).
 gameState.day++;
 showPhaseTransition('night');
 addLog('night', ` Malam #${gameState.day} dimulai.`);
 } else if (gameState.phase === 'night') {
 // Night -> Day
 gameState.phase = 'day';
 resetTimer(); // UI-04 FIX: Pastikan timer malam berhenti/reset saat masuk siang
 // LOGIC-07 FIX: Reset vote setiap siang baru dimulai — diam-diam (tanpa toast)
 // agar vote dari siang sebelumnya (misal saat tie/tidak ada eksekusi)
 // tidak terbawa ke ronde berikutnya.
 gameState.votes = {};
 delete gameState._onlineVoteOpenedDay;
 delete gameState._onlineVoteLockedDay;
 if (gameState.onlineManualVotes) delete gameState.onlineManualVotes[gameState.day];
 gameState._lastDayExecuted = null;
 showPhaseTransition('day');
 addLog('day', ` Hari ke-${gameState.day} dimulai.`);

 // Secara otomatis mengumumkan kematian setelah jeda singkat agar overlay transisi berjalan
 setTimeout(() => {
 announceDeaths();
 }, 1000);
 }

 updatePhaseBanner();
 updateStats();
 if (typeof pushAnnouncement === 'function') {
 const phaseTitle = gameState.phase === 'night' ? 'Malam Hari' : 'Siang Hari';
 pushAnnouncement(gameState.phase === 'night' ? 'night' : 'info', phaseTitle, `Fase berganti ke ${phaseTitle.toLowerCase()} hari ke-${gameState.day}.`);
 }
 if (typeof playWerewolfSound === 'function') playWerewolfSound(gameState.phase === 'night' ? 'night' : 'day');

 if (gameState.phase === 'night') switchTab('night');
 else switchTab('day');
 }

 function showPhaseTransition(type) {
 const overlay = document.getElementById('transitionOverlay');
 const icon = document.getElementById('transitionIcon');
 const text = document.getElementById('transitionText');
 const sub = document.getElementById('transitionSub');

 overlay.className = 'fullscreen-transition ' + (type === 'night' ? 'night-bg' : 'day-bg') + ' active';

 if (type === 'night') {
 icon.textContent = '';
 text.textContent = 'MALAM HARI';
 text.style.color = 'var(--accent-purple-light)';
 sub.textContent = `Malam #${gameState.day}. Semua pemain menutup mata...`;
 } else {
 icon.textContent = '';
 text.textContent = 'HARI TERBIT';
 text.style.color = 'var(--accent-gold)';
 sub.textContent = 'Semua pemain membuka mata.';
 }

 setTimeout(() => {
 overlay.classList.remove('active');
 }, 2500);
 }

 function updatePhaseBanner() {
 const banner = document.getElementById('phaseBanner');
 const icon = document.getElementById('phaseIcon');
 const text = document.getElementById('phaseText');
 const dayCount = document.getElementById('phaseDayCount');
 const btn = document.getElementById('btnNextPhase');
 const fab = document.getElementById('fabNextPhase');
 const dashboardNextPhaseText = document.getElementById('dashboardNextPhaseText');
 const sheetNextPhaseText = document.getElementById('sheetNextPhaseText');
 const nextPhaseLabel = gameState.started ? 'Fase Berikutnya' : 'Mulai Permainan';

 if (dashboardNextPhaseText) dashboardNextPhaseText.textContent = nextPhaseLabel;
 if (sheetNextPhaseText) sheetNextPhaseText.textContent = nextPhaseLabel;
 if (fab) fab.title = nextPhaseLabel;

 if (gameState.phase === 'night') {
	 banner.className = 'header night moderator-app';
	 icon.innerHTML = '<i data-lucide="moon"></i>';
	 text.textContent = 'MALAM HARI';
	 text.className = 'phase-text night';
	 dayCount.textContent = `Malam #${gameState.day}`;
	 btn.innerHTML = ' Ke Siang Hari';
	 if (fab) {
	 fab.className = 'fab visible pulse moderator-app';
	 fab.innerHTML = '<i data-lucide="sun"></i>';
	 }
	 } else if (gameState.phase === 'day') {
	 banner.className = 'header day moderator-app';
	 icon.innerHTML = '<i data-lucide="sun"></i>';
	 text.textContent = 'SIANG HARI';
	 text.className = 'phase-text day';
	 dayCount.textContent = `Hari ke-${gameState.day}`;
	 btn.innerHTML = ' Ke Malam';
	 if (fab) {
	 fab.className = 'fab visible pulse moderator-app';
	 fab.innerHTML = '<i data-lucide="moon"></i>';
	 }
	 } else {
	 banner.className = 'header night moderator-app';
	 icon.innerHTML = '<i data-lucide="settings-2"></i>';
	 text.textContent = 'SETUP';
	 text.className = 'phase-text setup';
	 dayCount.textContent = 'Belum mulai';
 btn.innerHTML = ' Mulai Permainan';
 if (fab) {
 fab.className = 'fab moderator-app'; // hide FAB during setup
	 }
	 }
	 if (typeof updateSetupRoleHeaderCount === 'function') updateSetupRoleHeaderCount();
	 if (typeof refreshModeratorCommandState === 'function') refreshModeratorCommandState();
	 if (window.werewolfRefreshInterface && typeof window.werewolfRefreshInterface === 'function') {
	 window.werewolfRefreshInterface(banner);
	 }
 }

 function updatePauseControls() {
 const isPaused = gameState.isPaused;
 const iconName = isPaused ? 'play' : 'pause';
 const label = isPaused ? 'Lanjutkan' : 'Jeda';
 const sheetLabel = isPaused ? 'Lanjutkan Game' : 'Jeda Game';
 const iconMarkup = `<i data-lucide="${iconName}"></i>`;
 const pauseBtn = document.getElementById('btnPause');
 const sheetIcon = document.getElementById('sheetPauseIcon');
 const sheetText = document.getElementById('sheetPauseText');
 const gameplayDisabled = isGameplayPaused(false);

 if (pauseBtn) {
 pauseBtn.innerHTML = iconMarkup;
 pauseBtn.title = label;
 pauseBtn.setAttribute('aria-label', label);
 }
 if (sheetIcon) sheetIcon.innerHTML = iconMarkup;
 if (sheetText) sheetText.textContent = sheetLabel;
 document.body.classList.toggle('game-paused', gameplayDisabled);
 document.querySelectorAll('[data-pause-lock]').forEach(el => {
 el.disabled = gameplayDisabled;
 el.setAttribute('aria-disabled', gameplayDisabled ? 'true' : 'false');
 });
 document.querySelectorAll('button[onclick]').forEach(button => {
 const locked = isPauseLockedControl(button);
 if (!locked) return;
 button.disabled = gameplayDisabled;
 button.setAttribute('aria-disabled', gameplayDisabled ? 'true' : 'false');
 });
 const fab = document.getElementById('fabNextPhase');
 if (fab) {
 fab.disabled = gameplayDisabled;
 fab.setAttribute('aria-disabled', gameplayDisabled ? 'true' : 'false');
 }
 [pauseBtn, sheetIcon, fab].forEach(el => {
 if (el && typeof hydrateWerewolfIcons === 'function') hydrateWerewolfIcons(el);
 });
 }

 function isGameplayPaused(showMessage = true) {
 const paused = !!(gameState.started && gameState.isPaused);
 if (paused && showMessage) {
 showToast('Game sedang dijeda. Lanjutkan game dulu untuk memakai aksi permainan.', 'warning');
 }
 return paused;
 }

 const PAUSE_LOCKED_HANDLERS = [
 'nextPhase',
 'confirmNightAction',
 'skipNightAction',
 'endNightPhase',
 'selectTarget',
 'setArsonistMode',
 'selectArsonistDouseTarget',
 'selectAlphaTarget',
 'setAlphaMode',
 'selectWolf1',
 'selectWolf2',
 'useHealPotion',
 'usePoisonPotion',
 'selectCupid1',
 'selectCupid2',
 'selectTroublemaker1',
 'selectTroublemaker2',
 'infectTarget',
 'tapVote',
 'untapVote',
 'resetVotes',
 'eliminatePlayer',
 'startOnlineVoting',
 'showOnlineVoteToPlayers',
 'saveOnlineVoteResult',
 'setTimer',
 'startPauseTimer',
 'resetTimer',
 'useSheriffAction',
 'usePriestAction',
 'useMayorAction',
 'activateSurvivorVest',
 'processHunterShot',
 'processWolfSacrifice'
 ];

 function isPauseLockedControl(target) {
 const el = target?.closest?.('button, [onclick]');
 if (!el) return false;
 const handler = el.getAttribute('onclick') || '';
 return PAUSE_LOCKED_HANDLERS.some(name => handler.includes(name + '('));
 }

 document.addEventListener('click', event => {
 if (!isGameplayPaused(false) || !isPauseLockedControl(event.target)) return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 isGameplayPaused(true);
 }, true);

 document.addEventListener('contextmenu', event => {
 if (!isGameplayPaused(false) || !isPauseLockedControl(event.target)) return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 isGameplayPaused(true);
 }, true);

 function togglePause() {
 if (!gameState.started) {
 return showToast('Game belum dimulai.', 'warning');
 }
 gameState.isPaused = !gameState.isPaused;
 updatePauseControls();
 renderVoteGrid();
 if (typeof saveState === 'function') saveState();
 if (typeof pushAnnouncement === 'function') pushAnnouncement(gameState.isPaused ? 'warning' : 'info', gameState.isPaused ? 'Game Dijeda' : 'Game Dilanjutkan', gameState.isPaused ? 'Moderator menjeda permainan sementara.' : 'Permainan dilanjutkan.');
 showToast(gameState.isPaused ? 'Game dijeda.' : 'Game dilanjutkan.', 'info');
 }

 // ==================== NIGHT ACTIONS ====================
 let lastNightActionSnapshot = null;
 let lastDayExecutionSnapshot = null;

 function captureNightUndoSnapshot(label) {
 if (!gameState.started || gameState.phase !== 'night') return;
 lastNightActionSnapshot = {
 label,
 state: JSON.parse(JSON.stringify(gameState))
 };
 updateNightUndoButton();
 }

 function updateNightUndoButton() {
 const btn = document.getElementById('btnUndoNightAction');
 if (!btn) return;
 const visible = !!(lastNightActionSnapshot && gameState.started && gameState.phase === 'night');
 btn.style.display = visible ? '' : 'none';
 if (visible) btn.textContent = `Undo ${lastNightActionSnapshot.label || 'Aksi Terakhir'}`;
 }

 function undoLastNightAction() {
 if (!lastNightActionSnapshot) return showToast('Belum ada aksi malam untuk di-undo.', 'warning');
 gameState = JSON.parse(JSON.stringify(lastNightActionSnapshot.state));
 lastNightActionSnapshot = null;
 updateNightPanel();
 updateStats();
 renderPlayers();
 renderLog();
 if (typeof saveState === 'function') saveState();
 updateNightUndoButton();
 showToast('Aksi malam terakhir dibatalkan.', 'info');
 }

 function captureDayExecutionSnapshot(label) {
 if (!gameState.started || gameState.phase !== 'day') return;
 lastDayExecutionSnapshot = {
 label,
 state: JSON.parse(JSON.stringify(gameState))
 };
 updateDayUndoButton();
 }

 function updateDayUndoButton() {
 const btn = document.getElementById('btnUndoDayExecution');
 if (!btn) return;
 const visible = !!(lastDayExecutionSnapshot && gameState.started && gameState.phase === 'day');
 btn.style.display = visible ? '' : 'none';
 if (visible) btn.textContent = `Undo ${lastDayExecutionSnapshot.label || 'Eksekusi Terakhir'}`;
 }

 function undoLastDayExecution() {
 if (!lastDayExecutionSnapshot) return showToast('Belum ada eksekusi siang untuk di-undo.', 'warning');
 gameState = JSON.parse(JSON.stringify(lastDayExecutionSnapshot.state));
 lastDayExecutionSnapshot = null;
 closeModal('modalHunter');
 closeModal('modalConfirm');
 updateStats();
 renderPlayers();
 renderDayActions();
 renderVoteGrid();
 renderVoteResults();
 renderLog();
 if (typeof updateTeamStatusPanel === 'function') updateTeamStatusPanel();
 if (typeof saveState === 'function') saveState();
 updateDayUndoButton();
 showToast('Eksekusi siang terakhir dibatalkan.', 'info');
 }

 function updateNightPanel() {
 if (!gameState.started || gameState.phase !== 'night') {
 document.getElementById('nightNotStarted').style.display = 'block';
 document.getElementById('nightPanel').style.display = 'none';
 return;
 }

 document.getElementById('nightNotStarted').style.display = 'none';
 document.getElementById('nightPanel').style.display = 'block';

 // Guard: Pastikan nightPhase tidak melebihi jumlah peran aktif saat ini jika ada modifikasi dadakan
 const activeRoles = getActiveNightRoles();
 if (gameState.nightPhase > activeRoles.length) {
 gameState.nightPhase = activeRoles.length;
 }

 renderNightSequence();
 renderNightAction();
 updateNightUndoButton();
 }

 function renderNightSequence() {
 const container = document.getElementById('nightSequence');
 const progressLabel = document.getElementById('nightProgressLabel');
 const activeRoles = getActiveNightRoles();

 if (progressLabel) {
 if (activeRoles.length === 0) {
 progressLabel.textContent = 'Tidak ada aksi malam aktif';
 } else if (gameState.nightPhase >= activeRoles.length) {
 progressLabel.textContent = 'Semua aksi malam selesai';
 } else {
 progressLabel.textContent = `Giliran ${gameState.nightPhase + 1} dari ${activeRoles.length}`;
 }
 }

 let html = '';
 activeRoles.forEach((role, i) => {
 const def = ROLE_DEFINITIONS[role];
 const isActive = i === gameState.nightPhase;
 const isCompleted = i < gameState.nightPhase;

 html += `<div class="night-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" title="${role}">
${roleAssetIconMarkup(role, 'role-lucide-icon')}
</div>`;
 if (i < activeRoles.length - 1) html += '<div class="night-step-connector"></div>';
 });

 container.innerHTML = html;
 hydrateWerewolfIcons(container);
 }

 function renderNightAction() {
 const activeRoles = getActiveNightRoles();

 if (gameState.nightPhase >= activeRoles.length) {
 document.getElementById('nightActionPanel').style.display = 'none';
 return;
 }

 document.getElementById('nightActionPanel').style.display = 'block';

 const currentRole = activeRoles[gameState.nightPhase];
 const def = ROLE_DEFINITIONS[currentRole];
 const title = document.getElementById('nightPhaseTitle');
 const subtitle = document.getElementById('nightPhaseSubtitle');
 const targets = document.getElementById('nightTargets');
 const result = document.getElementById('nightActionResult');

 // BUG-22 FIX: Jika ada hasil aksi yang tersimpan untuk fase ini,
 // restore tanpa menghapus (agar hasil Seer dll tidak hilang saat ganti tab).
 const canRestoreCachedResult = currentRole !== 'Guardian' || !!gameState.nightState?.guardProtectId;
 if (canRestoreCachedResult && gameState._lastNightActionResult && gameState._lastNightActionPhase === gameState.nightPhase) {
 result.innerHTML = gameState._lastNightActionResult;
 } else {
 // UI-02 FIX: Bersihkan hasil aksi sebelumnya di AWAL render, bukan di akhir.
 // Ini memastikan panel hasil selalu kosong sebelum konten role baru muncul.
 result.innerHTML = '';
 }

 title.innerHTML = `${roleAssetIconMarkup(currentRole, 'role-inline-icon')} ${currentRole}`;
 hydrateWerewolfIcons(title);

 // BUG-22 FIX: Helper — panggil setelah result.innerHTML di-set untuk menyimpan ke cache.
 function saveNightResult() {
 const r = document.getElementById('nightActionResult');
 if (r) {
 gameState._lastNightActionResult = r.innerHTML;
 gameState._lastNightActionPhase = gameState.nightPhase;
 }
 }

 // Special handling for different roles
 if (currentRole === 'Werewolf') {
 if (gameState.wolfCubDoubleKillActive) {
 subtitle.textContent = 'Serigala mengamuk! Pilih DUA target malam ini (Pilih 2 kali berbeda).';
 renderWerewolfDoubleKillAction();
 } else {
 subtitle.textContent = 'Pilih target untuk dimangsa';
 renderTargetButtons(currentRole, false);
 }
 } else if (currentRole === 'Alpha Wolf') {
 if (gameState._alphaAbilityUsed && gameState._alphaChoice === 'recruit' && !gameState._alphaRecruitDone) {
 subtitle.textContent = `Pilih target rekrut malam ini.`;
 } else if (gameState._alphaAbilityUsed) {
 subtitle.textContent = `Kemampuan khusus telah digunakan — ikut kawanan.`;
 } else {
 subtitle.textContent = `Pilih: Bunuh malam ini, atau Rekrut target.`;
 }
 renderAlphaWolfAction();
 } else if (currentRole === 'Seer') {
 subtitle.textContent = `Pilih pemain untuk diperiksa`;
 renderTargetButtons(currentRole, true);
 } else if (currentRole === 'Guardian' || currentRole === 'Bodyguard') {
 subtitle.textContent = `Pilih pemain untuk dilindungi`;
 renderTargetButtons(currentRole, true);
 } else if (currentRole === 'Witch') {
 subtitle.textContent = 'Gunakan ramuan (penyembuh/racun)';
 renderWitchActions();
 } else if (currentRole === 'Wizard') {
 const wizard = gameState.players.find(p => p.role === 'Wizard' && p.alive);
 const usesLeft = 3 - (wizard._wizardUsedCount || 0);
 if (usesLeft > 0) {
 subtitle.textContent = `Pilih target untuk dibungkam (Sisa: ${usesLeft}x). Semua kemampuan membunuhnya malam ini diblokir.`;
 renderTargetButtons(currentRole, true);
 } else {
 subtitle.textContent = `Sihir habis.`;
 document.getElementById('nightTargets').innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">Sihir bungkam telah habis digunakan (maks 3x). Klik Konfirmasi atau Lewati untuk melanjutkan.</div>`;
 }
 } else if (currentRole === 'Veteran') {
 subtitle.textContent = 'Masuk mode siaga? Siapapun yang menyerang akan mati.';
 renderVeteranAction();
 } else if (currentRole === 'Cupid') {
 subtitle.textContent = gameState.couples.length === 0 ? 'Pilih dua pemain untuk dijodohkan.' : 'Pasangan sudah dibentuk, tidak ada aksi tersisa.';
 if (gameState.couples.length === 0) {
 renderCupidAction();
 } else {
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada aksi malam ini.</div>';
 }
 } else if (currentRole === 'Doppelganger') {
 subtitle.textContent = !gameState.doppelgangerTarget ? 'Pilih satu pemain untuk disalin role-nya' : 'Tidak ada aksi (Target telah ditentukan)';
 if (!gameState.doppelgangerTarget) {
 renderTargetButtons(currentRole, true);
 } else {
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada aksi malam ini.</div>';
 }
 } else if (currentRole === 'Serial Killer') {
 subtitle.textContent = 'Pilih target untuk dibunuh';
 renderTargetButtons(currentRole, false);
 } else if (currentRole === 'Arsonist') {
 subtitle.textContent = 'Siram bensin ke target baru atau nyalakan semua target tersiram.';
 renderArsonistAction();
 } else if (currentRole === 'Little Girl') {
 subtitle.textContent = 'Apakah Little Girl ketahuan mengintip?';
 renderLittleGirlAction();
 } else if (currentRole === 'Lone Wolf' || currentRole === 'Sheriff' || currentRole === 'Martyr') {
 const notes = {
 'Lone Wolf': 'Tidak memilih target. Jika diserang kawanan, ia otomatis berubah menjadi Werewolf saat kematian malam diproses.',
 'Sheriff': 'Tidak punya aksi malam. Pelurunya tersedia di panel Aksi Siang.',
 'Martyr': 'Tidak punya aksi malam. Pengorbanannya muncul saat eksekusi voting siang.'
 };
 subtitle.textContent = 'Role informasi, tidak ada aksi malam.';
 targets.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:20px;line-height:1.5;">${notes[currentRole]}</div>`;

 // --- NEW ROLES ---
 } else if (currentRole === 'Thief') {
 subtitle.textContent = gameState.day === 1 ? 'Pilih pemain untuk dicuri kartunya (Tukar peran secara permanen).' : 'Tidak ada aksi (hanya Malam 1).';
 if (gameState.day === 1) renderTargetButtons(currentRole, false);
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada aksi malam ini.</div>';
 } else if (currentRole === 'Troublemaker') {
 subtitle.textContent = !gameState.troublemakerUsed ? 'Pilih tepat 2 pemain untuk ditukar kartunya tanpa melihat.' : 'Kemampuan sudah digunakan.';
 if (!gameState.troublemakerUsed) renderTroublemakerAction();
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Kemampuan telah habis.</div>';
 } else if (currentRole === 'Mason 1' || currentRole === 'Mason 2') {
 subtitle.textContent = gameState.day === 1 ? 'Membuka mata dan saling memastikan kalian berada di tim Warga.' : 'Tidak ada aksi (hanya Malam 1).';
 if (gameState.day === 1) renderMasonAction(currentRole);
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Beristirahatlah.</div>';
 } else if (currentRole === 'White Wolf') {
 const canKill = gameState.day % 2 === 0;
 subtitle.textContent = canKill ? 'Pilih salah satu Serigala untuk dimangsa malam ini.' : 'Hanya aktif setiap dua malam sekali (Malam genap).';
 if (canKill) renderWhiteWolfAction();
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tetap berbaur dengan kawanan malam ini.</div>';
 } else if (currentRole === 'Infector') {
 subtitle.textContent = !gameState.infectorUsed ? 'Mau menggunakan infeksi pada korban kawanan malam ini?' : 'Infeksi sudah digunakan.';
 if (!gameState.infectorUsed) renderInfectorAction();
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Suntikan infeksi telah habis.</div>';
 } else if (currentRole === 'Apprentice Seer') {
 const seerIsAlive = gameState.players.some(p => p.role === 'Seer' && p.alive);
 subtitle.textContent = !seerIsAlive ? 'Seer sudah mati. Kamu mewarisi kekuatannya. Pilih pemain untuk diperiksa.' : 'Seer masih hidup. Belum ada kekuatan.';
 if (!seerIsAlive) renderTargetButtons('Seer', true); // Use Seer logic
 else targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Belum aktif.</div>';
 } else if (currentRole === 'Aura Seer' || currentRole === 'Sorcerer' || currentRole === 'Tracker' || currentRole === 'Tavern Keeper' || currentRole === 'Cult Leader' || currentRole === 'Vampire') {
 if (currentRole === 'Aura Seer') subtitle.textContent = 'Pilih target untuk mengetahui faksinya (Warga/Serigala/Netral).';
 else if (currentRole === 'Sorcerer') subtitle.textContent = 'Pilih target untuk menemukan Seer asli.';
 else if (currentRole === 'Tracker') subtitle.textContent = 'Pantau kemana target pergi malam ini.';
 else if (currentRole === 'Tavern Keeper') subtitle.textContent = 'Ajak minum 1 orang agar mabuk dan tidak bisa beraksi.';
 else if (currentRole === 'Cult Leader') subtitle.textContent = 'Sentuh 1 orang untuk direkrut menjadi anggota sekte.';
 else if (currentRole === 'Vampire') subtitle.textContent = 'Hisap darah 1 target hingga mati.';
 renderTargetButtons(currentRole, false);
 } else if (currentRole === 'Gravedigger') {
 subtitle.textContent = 'Hasil pemeriksaan kuburan siang hari.';
 renderGravediggerAction();
 } else if (currentRole === 'Amnesiac') {
 if (gameState.amnesiacChosen) {
 subtitle.textContent = 'Kamu sudah memilih peran baru.';
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Sudah memilih peran.</div>';
 } else if (gameState.day >= 3) {
 subtitle.textContent = 'Pilih identitas peran dari pemain yang sudah mati.';
 renderAmnesiacAction();
 } else {
 subtitle.textContent = 'Baru bisa mengambil peran orang mati mulai dari Malam 3.';
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tunggu hingga Malam 3.</div>';
 }
 } else {
 subtitle.textContent = 'Tidak ada aksi malam ini.';
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada aksi.</div>';
 }
 hydrateWerewolfIcons(targets);
 hydrateWerewolfIcons(result);
 }

 function renderTargetButtons(role, showRole) {
 const targets = document.getElementById('nightTargets');
 let validPlayers = gameState.players.filter(p => p.alive);

 // Cegah self-target untuk role yang masuk akal
 if (role === 'Doppelganger' || role === 'Seer' || role === 'Serial Killer') {
 validPlayers = validPlayers.filter(p => p.role !== role);
 }

 targets.innerHTML = validPlayers.map(p => {
 const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
 const isWolf = def && def.team === 'Werewolf';
 let disabled = false;
 let disabledMsg = '';

 if (role === 'Guardian' && p.id === gameState.guardLastProtect) {
 disabled = true;
 disabledMsg = ' (Dilindungi malam sebelumnya)';
 }

 return `
<button class="target-btn" onclick="selectTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}" ${disabled ? 'disabled' : ''}>
<span class="target-icon">${def ? roleAssetIconMarkup(p.role, 'role-lucide-icon') : roleIconMarkup('', 'role-lucide-icon')}</span>
<span>${escapeHtml(p.name)}${disabledMsg}</span>
${showRole && p.role ? `<span class="badge badge-${def.category}" style="margin-left:auto;">${p.role}</span>` : ''}
</button>
`;
 }).join('');
 hydrateWerewolfIcons(targets);
 }

 function actionIconMarkup(iconName) {
 return typeof lucideIconMarkup === 'function'
 ? lucideIconMarkup(iconName, 'role-lucide-icon')
 : `<span class="role-lucide-icon" aria-hidden="true"><i data-lucide="${iconName || 'circle-dot'}"></i></span>`;
 }

 function playerIconMarkup(player) {
 return player?.role ? roleAssetIconMarkup(player.role, 'role-lucide-icon') : roleIconMarkup('', 'role-lucide-icon');
 }

 function hydrateNightResult() {
 hydrateWerewolfIcons(document.getElementById('nightActionResult'));
 }

 let _alphaModeUI = 'kill'; // UI-only state
 function setAlphaMode(mode) {
 if (isGameplayPaused()) return;
 _alphaModeUI = mode;
 const btnKill = document.getElementById('alphaModeKill');
 const btnRecruit = document.getElementById('alphaModeRecruit');
 const hint = document.getElementById('alphaModeHint');
 const targetArea = document.getElementById('alphaTargetArea');
 if (btnKill) btnKill.className = mode === 'kill' ? 'btn btn-danger' : 'btn btn-outline';
 if (btnRecruit) btnRecruit.className = mode === 'recruit' ? 'btn btn-primary' : 'btn btn-outline';
 if (hint) hint.innerHTML = mode === 'kill'
 ? ' <strong>Bunuh</strong> — Pilih target di bawah, kill berlaku malam ini (bisa diblokir proteksi). Kemampuan rekrut hangus.'
 : ' <strong>Rekrut</strong> — Tidak ada kill malam ini. Target rekrut dipilih pada malam berikutnya.';
 // Tampilkan target hanya jika mode bunuh
 if (targetArea) targetArea.style.display = mode === 'kill' ? 'grid' : 'none';
 document.querySelectorAll('#alphaTargetArea .target-btn').forEach(b => b.classList.remove('selected'));
 }

 function renderAlphaWolfAction() {
 const targets = document.getElementById('nightTargets');

 // ── Kasus 1: Malam 2 — pilih target rekrut ──
 if (gameState._alphaAbilityUsed && gameState._alphaChoice === 'recruit' && !gameState._alphaRecruitDone) {
 const nonWolves = gameState.players.filter(p => p.alive && p.role !== 'Alpha Wolf' && ROLE_DEFINITIONS[p.role]?.team !== 'Werewolf');
 if (nonWolves.length === 0) {
 targets.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);"> Tidak ada pemain non-serigala yang bisa direkrut.</div>`;
 return;
 }
 let html = `
<div style="background:rgba(155,89,182,0.08);border:1px solid rgba(155,89,182,0.25);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px;font-size:0.83rem;color:var(--text-secondary);">
 <strong>Rekrutmen Aktif</strong> — Pilih pemain yang akan bergabung menjadi Werewolf malam ini.
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">`;
 html += nonWolves.map(p => `
<button class="target-btn" onclick="selectAlphaTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
 <span class="target-icon">${playerIconMarkup(p)}</span>
 <span>${escapeHtml(p.name)}</span>
</button>`).join('');
 html += `</div>`;
 targets.innerHTML = html;
 return;
 }

 // ── Kasus 2: Kemampuan sudah selesai sepenuhnya ──
 if (gameState._alphaAbilityUsed) {
 targets.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Kemampuan khusus Alpha Wolf telah digunakan. Alpha ikut diskusi kawanan malam ini.</div>`;
 return;
 }

 // ── Kasus 3: Malam 1 — pilih mode Bunuh atau Rekrut ──
 const nonWolves = gameState.players.filter(p => p.alive && p.role !== 'Alpha Wolf' && ROLE_DEFINITIONS[p.role]?.team !== 'Werewolf');

 let html = `
<div style="display:flex;gap:8px;margin-bottom:12px;">
 <button class="btn btn-danger" id="alphaModeKill" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px 4px; min-height:56px; line-height:1.2;" onclick="setAlphaMode('kill')">
 <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;"> Bunuh</div>
 <div style="font-size:0.7rem; opacity:0.85; font-weight:normal; letter-spacing:0.5px;">MALAM INI</div>
 </button>
 <button class="btn btn-outline" id="alphaModeRecruit" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px 4px; min-height:56px; line-height:1.2;" onclick="setAlphaMode('recruit')">
 <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;"> Rekrut</div>
 <div style="font-size:0.7rem; opacity:0.85; font-weight:normal; letter-spacing:0.5px;">MALAM DEPAN</div>
 </button>
</div>
<div id="alphaModeHint" style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px;padding:12px 14px;background:rgba(155,89,182,0.1);border-left:3px solid var(--accent-purple);border-radius:var(--radius-sm);line-height:1.45;"></div>
<div id="alphaTargetArea" style="display:none;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">`;
 html += nonWolves.map(p => `
<button class="target-btn" onclick="selectAlphaTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
 <span class="target-icon">${playerIconMarkup(p)}</span>
 <span>${escapeHtml(p.name)}</span>
</button>`).join('');
 html += `</div>`;
 targets.innerHTML = html;
 setAlphaMode('kill'); // default kill
 hydrateWerewolfIcons(targets);
 }

 function selectAlphaTarget(el, id, name) {
 if (isGameplayPaused()) return;
 document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 el.dataset.id = id;
 el.dataset.name = name;
 el.dataset.selected = 'true';
 }

function selectTarget(el, id, name) {
 if (isGameplayPaused()) return;
 document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 if (el) {
 el.classList.add('selected');
 el.dataset.selected = 'true';
 }
 }

 function renderArsonistAction() {
 const targets = document.getElementById('nightTargets');
 const dousedIds = new Set((gameState.arsonistDousedIds || []).map(String));
 const arsonist = gameState.players.find(p => p.role === 'Arsonist' && p.alive);
 const dousedPlayers = gameState.players.filter(p => dousedIds.has(String(p.id)));
 const aliveDoused = dousedPlayers.filter(p => p.alive);
 const douseTargets = gameState.players.filter(p =>
 p.alive &&
 (!arsonist || String(p.id) !== String(arsonist.id)) &&
 !dousedIds.has(String(p.id))
 );
 const ns = gameState.nightState;
 const currentMode = ns.arsonistMode || 'douse';
 const dousedHtml = dousedPlayers.length
 ? dousedPlayers.map(p => `<span style="display:inline-flex;align-items:center;gap:4px;margin:3px 4px 0 0;padding:4px 8px;border-radius:999px;background:rgba(245,158,11,0.12);color:${p.alive ? 'var(--accent-gold)' : 'var(--text-muted)'};font-size:0.78rem;${p.alive ? '' : 'text-decoration:line-through;'}">${escapeHtml(p.name)}</span>`).join('')
 : '<span style="color:var(--text-muted);font-size:0.82rem;">Belum ada pemain yang tersiram.</span>';

 let html = `
<div style="width:100%;display:grid;gap:12px;">
 <div style="padding:12px 14px;border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-md);background:rgba(245,158,11,0.08);">
  <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;">Target tersiram bensin:</div>
  <div>${dousedHtml}</div>
 </div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;">
  <button class="btn ${currentMode === 'douse' ? 'btn-primary' : 'btn-outline'}" onclick="setArsonistMode('douse')" style="flex:1;min-width:130px;">${actionIconMarkup('fuel')} Siram</button>
  <button class="btn ${currentMode === 'ignite' ? 'btn-danger' : 'btn-outline'}" onclick="setArsonistMode('ignite')" style="flex:1;min-width:130px;" ${aliveDoused.length ? '' : 'disabled'}>${actionIconMarkup('flame')} Nyalakan</button>
 </div>
`;

 if (currentMode === 'ignite') {
 html += aliveDoused.length
 ? `<div style="text-align:center;padding:16px;color:var(--text-secondary);line-height:1.5;">Api akan menyasar: <strong style="color:var(--accent-red);">${aliveDoused.map(p => escapeHtml(p.name)).join(', ')}</strong>.</div>`
 : '<div style="text-align:center;padding:16px;color:var(--text-muted);">Belum ada target hidup yang tersiram untuk dibakar.</div>';
 } else if (douseTargets.length) {
 html += `<div class="night-action-targets">${douseTargets.map(p => `
<button class="target-btn" onclick="selectArsonistDouseTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
 <span class="target-icon">${playerIconMarkup(p)}</span>
 <span>${escapeHtml(p.name)}</span>
</button>`).join('')}</div>`;
 } else {
 html += '<div style="text-align:center;padding:16px;color:var(--text-muted);">Semua target hidup yang valid sudah tersiram. Pilih Nyalakan atau Lewati.</div>';
 }

 html += '</div>';
 targets.innerHTML = html;
 hydrateWerewolfIcons(targets);
 }

 function setArsonistMode(mode) {
 if (isGameplayPaused()) return;
 gameState.nightState.arsonistMode = mode === 'ignite' ? 'ignite' : 'douse';
 gameState.nightState.arsonistDouseId = null;
 document.getElementById('nightActionResult').innerHTML = '';
 renderArsonistAction();
 }

 function selectArsonistDouseTarget(el, id, name) {
 if (isGameplayPaused()) return;
 gameState.nightState.arsonistMode = 'douse';
 gameState.nightState.arsonistDouseId = id;
 selectTarget(el, id, name);
 }

 function syncPairedTargetButtons(group, firstId, secondId) {
 const buttons = document.querySelectorAll(`[data-pair-group="${group}"]`);
 buttons.forEach(btn => {
 const isFirstColumn = btn.dataset.pairSlot === '1';
 const disabledByFirst = isFirstColumn && secondId && btn.dataset.id === String(secondId);
 const disabledBySecond = !isFirstColumn && firstId && btn.dataset.id === String(firstId);
 btn.disabled = !!(disabledByFirst || disabledBySecond);
 btn.classList.toggle('disabled', btn.disabled);
 if (btn.disabled && btn.classList.contains('selected')) {
 btn.classList.remove('selected');
 }
 });
 }

 function renderWerewolfDoubleKillAction() {
 const targets = document.getElementById('nightTargets');
 let validPlayers = gameState.players.filter(p => p.alive);

 targets.innerHTML = `
<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;text-align:center;">
Karena Wolf Cub dibunuh kemarin, Serigala mengamuk dan memangsa 2 target malam ini!
</div>
<div style="display:flex;flex-direction:column;gap:8px;">
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Target Mengamuk 1:</div>
<div class="night-action-targets">
${validPlayers.map(p => {
 return `<button class="target-btn btn-sm" data-pair-group="wolf-double" data-pair-slot="1" data-id="${p.id}" onclick="selectWolf1(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>`;
 }).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Target Mengamuk 2:</div>
<div class="night-action-targets">
${validPlayers.map(p => {
 return `<button class="target-btn btn-sm" data-pair-group="wolf-double" data-pair-slot="2" data-id="${p.id}" onclick="selectWolf2(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>`;
 }).join('')}
</div>
</div>
</div>
`;
 gameState._wolfTemp = { p1: null, p2: null };
 hydrateWerewolfIcons(targets);
 }

 function selectWolf1(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._wolfTemp) gameState._wolfTemp = {};
 gameState._wolfTemp.p1 = { id, name };
 if (gameState._wolfTemp.p2?.id === id) gameState._wolfTemp.p2 = null;
 syncPairedTargetButtons('wolf-double', gameState._wolfTemp.p1?.id, gameState._wolfTemp.p2?.id);
 }

 function selectWolf2(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._wolfTemp) gameState._wolfTemp = {};
 gameState._wolfTemp.p2 = { id, name };
 if (gameState._wolfTemp.p1?.id === id) gameState._wolfTemp.p1 = null;
 syncPairedTargetButtons('wolf-double', gameState._wolfTemp.p1?.id, gameState._wolfTemp.p2?.id);
 }

 function renderWitchActions() {
 const targets = document.getElementById('nightTargets');
 const wolfKillTarget = gameState.nightState.wolfKillTarget;
 const wolfKillId = gameState.nightState.wolfKillId;

 if (gameState.nightState.witchHealTarget || gameState.nightState.witchPoisonTarget) {
 targets.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Satu ramuan telah digunakan malam ini. Witch tidak bisa bertindak lagi.</div>`;
 return;
 }

 let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;">';

 if (gameState.witchPotions.heal) {
 let healHTML = '';
 const arsonistVictims = (gameState.nightState.arsonistIgniteIds || [])
 .map(id => gameState.players.find(p => String(p.id) === String(id)))
 .filter(p => p && p.alive);
 if (gameState.nightState.wolfKillTarget || gameState.nightState.wolfKillTarget2 || arsonistVictims.length) {
 let victims = [];
 if (gameState.nightState.wolfKillTarget) victims.push(gameState.nightState.wolfKillTarget);
 if (gameState.nightState.wolfKillTarget2) victims.push(gameState.nightState.wolfKillTarget2);
 arsonistVictims.forEach(p => victims.push(p.name));

 healHTML += `<div style="font-size:0.82rem;margin-bottom:8px;">Korban malam ini: <strong>${victims.join(' &amp; ')}</strong></div>`;
 if (gameState.nightState.wolfKillTarget) {
 healHTML += `<button class="btn btn-success btn-sm btn-block" style="margin-bottom:4px;" onclick="useHealPotion('${gameState.nightState.wolfKillId}', '${escapeJsString(gameState.nightState.wolfKillTarget)}')">${actionIconMarkup('heart-pulse')} Sembuhkan ${escapeHtml(gameState.nightState.wolfKillTarget)}</button>`;
 }
 if (gameState.nightState.wolfKillTarget2) {
 healHTML += `<button class="btn btn-success btn-sm btn-block" onclick="useHealPotion('${gameState.nightState.wolfKillId2}', '${escapeJsString(gameState.nightState.wolfKillTarget2)}')">${actionIconMarkup('heart-pulse')} Sembuhkan ${escapeHtml(gameState.nightState.wolfKillTarget2)}</button>`;
 }
 arsonistVictims.forEach(p => {
 healHTML += `<button class="btn btn-success btn-sm btn-block" style="margin-top:4px;" onclick="useHealPotion('${p.id}', '${escapeJsString(p.name)}')">${actionIconMarkup('heart-pulse')} Sembuhkan ${escapeHtml(p.name)}</button>`;
 });
 } else {
 healHTML += '<div style="font-size:0.82rem;color:var(--text-muted);">Tidak ada korban malam ini (atau dirahasiakan).</div>';
 }

 html += `
 <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.2);border-radius:var(--radius-md);padding:16px;">
 <div style="font-weight:700;margin-bottom:8px;color:var(--accent-green);"> Ramuan Penyembuh</div>
 ${healHTML}
 </div>`;
 } else {
 html += `
 <div style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-color);border-radius:var(--radius-md);padding:16px;opacity:0.6;">
 <div style="font-weight:700;margin-bottom:8px;color:var(--text-secondary);"> Ramuan Penyembuh</div>
 <div style="font-size:0.78rem;color:var(--text-muted);">Telah habis digunakan.</div>
 </div>`;
 }

 if (gameState.witchPotions.poison) {
 html += `
 <div style="background:rgba(231,76,60,0.05);border:1px solid rgba(231,76,60,0.2);border-radius:var(--radius-md);padding:16px;">
 <div style="font-weight:700;margin-bottom:8px;color:var(--accent-red);"> Ramuan Racun</div>
 <div class="night-action-targets" style="margin-bottom:8px;">
 ${gameState.players.filter(p => {
 const witch = gameState.players.find(w => w.role === 'Witch' && w.alive);
 return p.alive
 && p.id !== wolfKillId // tidak bisa meracuni korban wolf (heal lebih relevan)
 && p.id !== gameState.nightState.wolfKillId2 // guard korban kedua Wolf Cub
 && p.role !== 'Witch' // tidak bisa meracuni diri sendiri
 && (!witch || p.id !== witch.id); // guard ekstra jika role-check tidak cukup
 }).map(p => `
 <button class="target-btn btn-sm" onclick="usePoisonPotion('${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>
 `).join('')}
 </div>
 </div>`;
 } else {
 html += `
 <div style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-color);border-radius:var(--radius-md);padding:16px;opacity:0.6;">
 <div style="font-weight:700;margin-bottom:8px;color:var(--text-secondary);"> Ramuan Racun</div>
 <div style="font-size:0.78rem;color:var(--text-muted);">Telah habis digunakan.</div>
 </div>`;
 }

 html += '</div>';
 targets.innerHTML = html;
 hydrateWerewolfIcons(targets);
 }

 function useHealPotion(id, target) {
 if (isGameplayPaused()) return;
 // Potion hanya dikonsumsi saat resolusi malam (processNightDeaths),
 // agar jika Wizard membungkam Witch, potion bisa dikembalikan.
 gameState.nightState.witchHealTarget = id;
 addLog('night', ` Witch menyelamatkan ${target}.`);
 showToast(`Witch menyelamatkan ${target}!`, 'success');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
 <div class="seer-result-icon">${actionIconMarkup('heart-pulse')}</div>
 <div class="seer-result-text" style="color:var(--accent-green);">Penyembuh Digunakan</div>
 <div class="seer-result-detail">${target} telah diselamatkan.</div>
</div>`;
 hydrateNightResult();
 renderWitchActions();
 }

 function usePoisonPotion(id, target) {
 if (isGameplayPaused()) return;
 // Potion hanya dikonsumsi saat resolusi malam (processNightDeaths),
 // agar jika Wizard membungkam Witch, potion bisa dikembalikan.
 gameState.nightState.witchPoisonTarget = id;
 addLog('night', ` Witch meracuni ${target}.`);
 showToast(`Witch meracuni ${target}!`, 'warning');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
 <div class="seer-result-icon">${actionIconMarkup('skull')}</div>
 <div class="seer-result-text" style="color:var(--accent-red);">Racun Digunakan</div>
 <div class="seer-result-detail">${target} telah diracuni.</div>
</div>`;
 hydrateNightResult();
 renderWitchActions();
 }

 // renderWizardAction() lama sudah dihapus

 function renderVeteranAction() {
 const targets = document.getElementById('nightTargets');
 if (gameState.veteranAlertsLeft > 0) {
 targets.innerHTML = `
 <div style="text-align:center;margin-bottom:12px;color:var(--text-secondary);">Sisa Mode Siaga: <strong>${gameState.veteranAlertsLeft}</strong></div>
 <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
 <button class="btn btn-danger" onclick="veteranAlert(true)">${actionIconMarkup('siren')} Mode Siaga ON</button>
 <button class="btn btn-outline" onclick="veteranAlert(false)">${actionIconMarkup('bed')} Mode Siaga OFF</button>
 </div>
 `;
 } else {
 targets.innerHTML = `
 <div style="text-align:center;padding:20px;color:var(--text-muted);">
 Mode Siaga telah habis digunakan.
 </div>
 `;
 veteranAlert(false); // auto rest
 }
 hydrateWerewolfIcons(targets);
 }

 function veteranAlert(active) {
 if (active && gameState.veteranAlertsLeft <= 0) return;
 if (active) gameState.veteranAlertsLeft--;

 gameState.nightState.veteranIsAlert = active;
 addLog('night', ` Veteran ${active ? 'masuk mode siaga' : 'tidak siaga'} malam ini.`);
 showToast(`Veteran ${active ? 'siaga!' : 'istirahat.'}`, 'info');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
 <div class="seer-result-icon">${actionIconMarkup(active ? 'siren' : 'bed')}</div>
 <div class="seer-result-text">${active ? 'Mode Siaga Aktif' : 'Tidak Siaga'}</div>
 <div class="seer-result-detail">${active ? 'Siapapun yang berniat menyerang akan dibunuh.' : 'Veteran tidur nyenyak malam ini.'}</div>
</div>
`;
 hydrateNightResult();
 }




 function renderCupidAction() {
 const targets = document.getElementById('nightTargets');
 const validTargets = gameState.players.filter(p => p.alive && p.role !== 'Cupid');

 targets.innerHTML = `
<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;text-align:center;">
Pilih pemain pertama, lalu pilih pemain kedua. (Cupid tak dapat memilih dirinya sendiri).
</div>
<div style="display:flex;flex-direction:column;gap:8px;">
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 1:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" data-pair-group="cupid" data-pair-slot="1" data-id="${p.id}" onclick="selectCupid1(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>
`).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 2:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" data-pair-group="cupid" data-pair-slot="2" data-id="${p.id}" onclick="selectCupid2(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>
`).join('')}
</div>
</div>
</div>
`;
 gameState._cupidTemp = { p1: null, p2: null };
 hydrateWerewolfIcons(targets);
 }

 function selectCupid1(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._cupidTemp) gameState._cupidTemp = {};
 gameState._cupidTemp.p1 = { id, name };
 if (gameState._cupidTemp.p2?.id === id) gameState._cupidTemp.p2 = null;
 syncPairedTargetButtons('cupid', gameState._cupidTemp.p1?.id, gameState._cupidTemp.p2?.id);
 }

 function selectCupid2(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._cupidTemp) gameState._cupidTemp = {};
 gameState._cupidTemp.p2 = { id, name };
 if (gameState._cupidTemp.p1?.id === id) gameState._cupidTemp.p1 = null;
 syncPairedTargetButtons('cupid', gameState._cupidTemp.p1?.id, gameState._cupidTemp.p2?.id);
 }

 function renderLittleGirlAction() {
 const targets = document.getElementById('nightTargets');
 targets.innerHTML = `
<div style="text-align:center;padding:20px;">
 <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">
 Little Girl telah mengintip serigala. Apakah serigala menyadarinya?
 </div>
 <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
 <button class="btn btn-danger" onclick="littleGirlCaught()">${actionIconMarkup('eye-off')} Ketahuan! Little Girl mati</button>
 <button class="btn btn-outline" onclick="littleGirlSafe()">${actionIconMarkup('eye')} Aman, tidak ketahuan</button>
 </div>
</div>
`;
 hydrateWerewolfIcons(targets);
 }

 function littleGirlCaught() {
 const lg = gameState.players.find(p => p.role === 'Little Girl' && p.alive);
 if (!lg) return;

 if (!gameState.nightKills) gameState.nightKills = [];
 if (!gameState.nightKills.includes(lg.id)) {
 gameState.nightKills.push(lg.id);
 }

 addLog('night', ` Little Girl (${lg.name}) ketahuan mengintip oleh Werewolf! (Mati esok pagi)`);
 showToast(`${lg.name} (Little Girl) ketahuan! Tekan Konfirmasi untuk lanjut.`, 'warning');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('eye-off')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Ketahuan!</div>
<div class="seer-result-detail">${escapeHtml(lg.name)} ketahuan oleh Werewolf. Kematiannya sudah pasti esok pagi dan tidak bisa dilindungi. Silakan klik <strong>Konfirmasi</strong> untuk lanjut ke role berikutnya.</div>
</div>`;
 hydrateNightResult();
 }

 function littleGirlSafe() {
 addLog('night', ` Little Girl mengintip dengan aman malam ini.`);
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('eye')}</div>
<div class="seer-result-text" style="color:var(--accent-green);">Aman!</div>
<div class="seer-result-detail">Little Girl berhasil mengintip tanpa diketahui Werewolf.</div>
</div>`;
 hydrateNightResult();
 }

 // ==================== NEW NIGHT ACTION FUNCTIONS ====================
 function renderTroublemakerAction() {
 const targets = document.getElementById('nightTargets');
 const validTargets = gameState.players.filter(p => p.alive && p.role !== 'Troublemaker');
 targets.innerHTML = `
<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;text-align:center;">
Pilih pemain pertama, lalu pilih pemain kedua. Keduanya akan bertukar kartu peran permanen.
</div>
<div style="display:flex;flex-direction:column;gap:8px;">
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 1:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" data-pair-group="troublemaker" data-pair-slot="1" data-id="${p.id}" onclick="selectTroublemaker1(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>
`).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 2:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" data-pair-group="troublemaker" data-pair-slot="2" data-id="${p.id}" onclick="selectTroublemaker2(this, '${p.id}', '${escapeJsString(p.name)}')"><span class="target-icon">${playerIconMarkup(p)}</span><span>${escapeHtml(p.name)}</span></button>
`).join('')}
</div>
</div>
</div>
`;
 gameState._troublemakerTemp = { p1: null, p2: null };
 hydrateWerewolfIcons(targets);
 }
 function selectTroublemaker1(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._troublemakerTemp) gameState._troublemakerTemp = {};
 gameState._troublemakerTemp.p1 = { id, name };
 if (gameState._troublemakerTemp.p2?.id === id) gameState._troublemakerTemp.p2 = null;
 syncPairedTargetButtons('troublemaker', gameState._troublemakerTemp.p1?.id, gameState._troublemakerTemp.p2?.id);
 }
 function selectTroublemaker2(el, id, name) {
 if (isGameplayPaused()) return;
 el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 el.classList.add('selected');
 if (!gameState._troublemakerTemp) gameState._troublemakerTemp = {};
 gameState._troublemakerTemp.p2 = { id, name };
 if (gameState._troublemakerTemp.p1?.id === id) gameState._troublemakerTemp.p1 = null;
 syncPairedTargetButtons('troublemaker', gameState._troublemakerTemp.p1?.id, gameState._troublemakerTemp.p2?.id);
 }

 function renderMasonAction(currentRole) {
 const targets = document.getElementById('nightTargets');
 const otherMasonRole = currentRole === 'Mason 1' ? 'Mason 2' : 'Mason 1';
 const otherMason = gameState.players.find(p => p.role === otherMasonRole && p.alive);

 if (otherMason) {
 targets.innerHTML = `
<div style="text-align:center;padding:20px;">
 <div style="font-size:1.5rem;margin-bottom:10px;"></div>
 <div style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:8px;">Rekan Anda adalah: <strong>${escapeHtml(otherMason.name)}</strong></div>
 <div style="font-size:0.85rem;color:var(--text-muted);">Kalian berdua adalah pihak warga desa 100%.</div>
</div>
`;
 } else {
 targets.innerHTML = `
<div style="text-align:center;padding:20px;color:var(--text-muted);">
 Rekan Anda (${otherMasonRole}) tidak ada di dalam game atau sudah mati.
</div>
`;
 }
 }

 function renderWhiteWolfAction() {
 const targets = document.getElementById('nightTargets');
 const wWolves = gameState.players.filter(p => p.alive && p.role !== 'White Wolf' && ROLE_DEFINITIONS[p.role]?.team === 'Werewolf');

 if (wWolves.length === 0) {
 targets.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada serigala lain yang tersisa untuk dimangsa.</div>';
 return;
 }

 targets.innerHTML = wWolves.map(p => `
<button class="target-btn" onclick="selectTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
<span class="target-icon">${playerIconMarkup(p)}</span>
<span>${escapeHtml(p.name)}</span>
<span class="badge badge-wolf" style="margin-left:auto;">${p.role}</span>
</button>
`).join('');
 hydrateWerewolfIcons(targets);
 }

 function renderInfectorAction() {
 const targets = document.getElementById('nightTargets');
 const ns = gameState.nightState;

 if (!ns.wolfKillId && !ns.wolfKillId2) {
 targets.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Tidak ada korban serigala malam ini, infeksi tak bisa digunakan.</div>';
 return;
 }

 let html = `
<div style="text-align:center;padding:20px;">
 <div style="font-size:1.5rem;margin-bottom:10px;"></div>
 <div style="color:var(--text-secondary);margin-bottom:15px;">Pilih salah satu korban kawanan malam ini untuk diinfeksi:</div>
 <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">`;

 if (ns.wolfKillId) {
 html += `<button class="btn btn-primary" onclick="infectTarget('${ns.wolfKillId}', '${escapeJsString(ns.wolfKillTarget)}')">${actionIconMarkup('biohazard')} Infeksi ${escapeHtml(ns.wolfKillTarget)}</button>`;
 }
 if (ns.wolfKillId2) {
 html += `<button class="btn btn-primary" onclick="infectTarget('${ns.wolfKillId2}', '${escapeJsString(ns.wolfKillTarget2)}')">${actionIconMarkup('biohazard')} Infeksi ${escapeHtml(ns.wolfKillTarget2)}</button>`;
 }
 html += `<button class="btn btn-outline" onclick="skipInfectorAction()">${actionIconMarkup('skip-forward')} Lewati Malam Ini</button>
 </div>
</div>`;
 targets.innerHTML = html;
 hydrateWerewolfIcons(targets);
 }
 function skipInfectorAction() {
 gameState.nightState.infectorInfectId = null;
 document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
 <div class="seer-result-icon">${actionIconMarkup('skip-forward')}</div>
 <div class="seer-result-text" style="color:var(--text-muted);">Aksi Dilewati</div>
 <div class="seer-result-detail">Pilihan infeksi dibatalkan. (Silakan tekan Konfirmasi)</div>
</div>`;
 hydrateNightResult();
 showToast('Tindakan infeksi dilewati.', 'info');
 }
 function infectTarget(id, name) {
 if (isGameplayPaused()) return;
 gameState.nightState.infectorInfectId = id;
 document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
 addLog('night', ` Infector menitipkan infeksi untuk ${name}.`);
 showToast('Target dipilih untuk diinfeksi!', 'success');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
 <div class="seer-result-icon">${actionIconMarkup('biohazard')}</div>
 <div class="seer-result-text" style="color:var(--accent-purple-light);">Infeksi Disiapkan</div>
 <div class="seer-result-detail">${escapeHtml(name)} akan diubah menjadi Werewolf dan lolos dari maut. (Silakan tekan Konfirmasi)</div>
</div>`;
 hydrateNightResult();
 }

 function renderGravediggerAction() {
 const targets = document.getElementById('nightTargets');
 const dayExecutedName = gameState._lastDayExecuted;
 if (dayExecutedName) {
 const p = gameState.players.find(x => x.name === dayExecutedName);
 if (p) {
 const def = ROLE_DEFINITIONS[p.role];
 targets.innerHTML = `
<div style="text-align:center;padding:20px;">
 <div style="font-size:1.5rem;margin-bottom:10px;"></div>
 <div style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:8px;">Pemain dieksekusi hari ini: <strong>${escapeHtml(p.name)}</strong></div>
 <div style="font-size:0.9rem;color:var(--text-muted);"><span class="role-emoji">${roleAssetIconMarkup(p.role, 'role-inline-icon')}</span> Peran aslinya adalah <strong>${p.role}</strong>.</div>
</div>
`;
 hydrateWerewolfIcons(targets);
 gameState.nightState.gravediggerInfoShown = true;
 return;
 }
 }
 targets.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Tidak ada korban eksekusi hari ini.</div>';
 }

 function renderAmnesiacAction() {
 const targets = document.getElementById('nightTargets');
 const deadPlayers = gameState.players.filter(p => !p.alive && p.role);
 if (deadPlayers.length === 0) {
 targets.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Belum ada karakter yang bisa diambil perannya (kuburan kosong).</div>';
 return;
 }
 targets.innerHTML = deadPlayers.map(p => {
 const def = ROLE_DEFINITIONS[p.role];
 return `
<button class="target-btn" onclick="selectTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
<span class="target-icon">${playerIconMarkup(p)}</span>
<span>${escapeHtml(p.name)} (${p.role})</span>
<span class="badge badge-${def?.category || 'unknown'}" style="margin-left:auto;">${p.role}</span>
</button>
`;
 }).join('');
 hydrateWerewolfIcons(targets);
 }

 function confirmNightAction() {
 if (isGameplayPaused()) return;
 const activeRoles = getActiveNightRoles();

 if (gameState.nightPhase >= activeRoles.length) return;

 const currentRole = activeRoles[gameState.nightPhase];
 captureNightUndoSnapshot(currentRole);

 // Silent/immediate skip roles
 if (currentRole === 'Cupid' || currentRole === 'Little Girl' || currentRole === 'Lone Wolf' || currentRole === 'Sheriff' || currentRole === 'Martyr' || (currentRole === 'Doppelganger' && gameState.doppelgangerTarget) || currentRole === 'Mason 1' || currentRole === 'Mason 2' || currentRole === 'Gravedigger') {
 if (currentRole === 'Cupid') {
 if (gameState.couples.length === 0) {
 if (!gameState._cupidTemp?.p1 || !gameState._cupidTemp?.p2) {
 return showToast('Pilih dua pemain untuk dijodohkan!', 'warning');
 }
 if (gameState._cupidTemp.p1.id === gameState._cupidTemp.p2.id) {
 return showToast('Pilih dua pemain yang berbeda!', 'warning');
 }
 gameState.couples.push([String(gameState._cupidTemp.p1.id), String(gameState._cupidTemp.p2.id)]);
 addLog('night', ` Cupid telah menjodohkan ${gameState._cupidTemp.p1.name} dengan ${gameState._cupidTemp.p2.name}.`);
 } else {
 addLog('night', ` Cupid memantau pasangannya.`);
 }
 }
 if (currentRole === 'Gravedigger') {
 gameState.nightState.gravediggerInfoShown = true;
 }
 if (currentRole === 'Lone Wolf' || currentRole === 'Sheriff' || currentRole === 'Martyr') {
 addLog('night', ` ${currentRole} tidak memiliki aksi malam aktif.`);
 }
 // BUG-22 FIX: Hapus cache hasil aksi saat nightPhase maju ke giliran berikutnya.
 gameState._lastNightActionResult = null;
 gameState._lastNightActionPhase = null;
 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 return;
 }
 if (currentRole === 'Veteran' || currentRole === 'Witch' || currentRole === 'Infector') {
 gameState._lastNightActionResult = null;
 gameState._lastNightActionPhase = null;
 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 return;
 }
 if (currentRole === 'Wizard') {
 const wizard = gameState.players.find(p => p.role === 'Wizard' && p.alive);
 const usesLeft = 3 - (wizard?._wizardUsedCount || 0);
 if (usesLeft <= 0) {
 addLog('night', ` Wizard tidak melakukan tindakan (sihir habis).`);
 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 return;
 }
 }

 if (currentRole === 'Apprentice Seer') {
 const seerIsAlive = gameState.players.some(p => p.role === 'Seer' && p.alive);
 if (seerIsAlive) {
 addLog('night', ` Murid Peramal (Apprentice Seer) belum aktif karena Seer asli masih hidup.`);
 gameState._lastNightActionResult = null;
 gameState._lastNightActionPhase = null;
 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 return;
 }
 }

 const selected = document.querySelector('.target-btn.selected');

 // --- Validation logic ---
 if (currentRole === 'Alpha Wolf') {
 const isNight2Recruit = gameState._alphaAbilityUsed && gameState._alphaChoice === 'recruit' && !gameState._alphaRecruitDone;
 const isNight1Kill = !gameState._alphaAbilityUsed && typeof _alphaModeUI !== 'undefined' && _alphaModeUI === 'kill';
 if ((isNight2Recruit || isNight1Kill) && !selected) {
 return showToast('Pilih target terlebih dahulu!', 'warning');
 }
 } else if (currentRole === 'Troublemaker') {
 if (!gameState._troublemakerTemp?.p1 || !gameState._troublemakerTemp?.p2) {
 return showToast('Pilih dua pemain untuk ditukar!', 'warning');
 }
 if (gameState._troublemakerTemp.p1.id === gameState._troublemakerTemp.p2.id) {
 return showToast('Pilih dua pemain yang berbeda!', 'warning');
 }
 } else if (currentRole === 'White Wolf') {
 const canKill = gameState.day % 2 === 0;
 if (canKill && !selected) return showToast('Pilih target terlebih dahulu!', 'warning');
 } else if (currentRole === 'Amnesiac') {
 if (gameState.day >= 3 && !gameState.amnesiacChosen && !selected) return showToast('Pilih peran untuk diambil!', 'warning');
 } else if (currentRole === 'Arsonist') {
 const mode = gameState.nightState.arsonistMode || 'douse';
 const aliveDoused = gameState.players.filter(p => p.alive && (gameState.arsonistDousedIds || []).map(String).includes(String(p.id)));
 if (mode === 'ignite' && aliveDoused.length === 0) return showToast('Belum ada target tersiram yang masih hidup!', 'warning');
 if (mode !== 'ignite' && !gameState.nightState.arsonistDouseId && !selected) return showToast('Pilih target untuk disiram bensin!', 'warning');
 } else {
 // Generic requirement
 if (!selected) {
 return showToast('Pilih target terlebih dahulu!', 'warning');
 }
 }

 const targetId = selected ? selected.dataset.id : null;
 const targetName = selected ? (selected.dataset.name || selected.querySelector('span:last-child')?.textContent.trim() || selected.textContent.trim()) : null;
 const player = targetId ? gameState.players.find(p => p.id == targetId) : null;

 // Handle different role actions
 if (currentRole === 'Seer' || currentRole === 'Apprentice Seer') {
 const isWolf = player && (
 (ROLE_DEFINITIONS[player.role] && ROLE_DEFINITIONS[player.role].team === 'Werewolf' && player.role !== 'Wolfman') ||
 player.role === 'Lycan'
 );
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup(isWolf ? 'paw-print' : 'shield-check')}</div>
<div class="seer-result-text" style="color:${isWolf ? 'var(--accent-red)' : 'var(--accent-green)'};">
${isWolf ? 'Target adalah SERIGALA!' : 'Target BUKAN serigala.'}
</div>
<div class="seer-result-detail">${targetName} ${isWolf ? 'tergabung dalam tim werewolf (atau terlihat sepertinya).' : 'bersih, bukan serigala.'}</div>
</div>
`;
 addLog('night', `${currentRole} memeriksa ${targetName}. Hasil: ${isWolf ? 'SERIGALA' : 'Bukan serigala'}.`);
 } else if (currentRole === 'Aura Seer') {
 let faksi = player ? ROLE_DEFINITIONS[player.role].team : 'Unknown';

 // BUG-09 FIX: Lycan and Cult Member override
 if (player && player.role === 'Lycan') {
 faksi = 'Werewolf';
 } else if (player && player.role === 'Wolfman') {
 faksi = 'Villager';
 } else if (player && gameState.cultMembers && gameState.cultMembers.includes(String(player.id))) {
 faksi = 'Sekte (Neutral)';
 }

 let icon = faksi === 'Werewolf' ? actionIconMarkup('paw-print') : (faksi.includes('Neutral') ? actionIconMarkup('scale') : actionIconMarkup('house'));
 let color = faksi === 'Werewolf' ? 'var(--accent-red)' : (faksi.includes('Neutral') ? 'var(--accent-gold)' : 'var(--accent-green)');
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${icon}</div>
<div class="seer-result-text" style="color:${color};">Faksi: ${faksi}</div>
<div class="seer-result-detail">${targetName} berada di pihak ${faksi}.</div>
</div>`;
 addLog('night', ` Aura Seer memeriksa ${targetName}. Hasil: Faksi ${faksi}.`);
 gameState.nightState.auraSeerTargetId = targetId;
 } else if (currentRole === 'Sorcerer') {
 const isSeer = player && player.role === 'Seer';
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup(isSeer ? 'eye' : 'x-circle')}</div>
<div class="seer-result-text" style="color:${isSeer ? 'var(--accent-green)' : 'var(--accent-red)'};">${isSeer ? 'SEER ASLI KETEMU!' : 'Bukan Seer'}</div>
<div class="seer-result-detail">${targetName} ${isSeer ? 'adalah Seer yang kamu cari.' : 'tidak memiliki kekuatan mata Seer.'}</div>
</div>`;
 addLog('night', ` Sorcerer mencari Seer pada ${targetName}. Hasil: ${isSeer ? 'Ketemu' : 'Tidak Ketemu'}.`);
 gameState.nightState.sorcererTargetId = targetId;
 } else if (currentRole === 'Tracker') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('route')}</div>
<div class="seer-result-text" style="color:var(--accent-gold);">Sedang Melacak</div>
<div class="seer-result-detail">Jejak langka ${targetName} dipantau. Hasil akan diumumkan saat resolusi kematian.</div>
</div>`;
 addLog('night', ` Tracker mulai memantau gerak-gerik ${targetName}.`);
 gameState.nightState.trackerTargetId = targetId;
 } else if (currentRole === 'Tavern Keeper') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('cup-soda')}</div>
<div class="seer-result-text" style="color:var(--accent-purple-light);">Target Dimabukkan</div>
<div class="seer-result-detail">${targetName} diajak minum dan tidak akan bisa menggunakan kemampuannya diblokir malam ini.</div>
</div>`;
 addLog('night', ` Tavern Keeper mengajak minum ${targetName}.`);
 gameState.nightState.tavernKeeperBlockId = targetId;
 } else if (currentRole === 'Cult Leader') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('users-round')}</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Target Disentuh</div>
<div class="seer-result-detail">${targetName} direkrut malam ini.</div>
</div>`;
 addLog('night', ` Cult Leader mengubah sekte, merekrut ${targetName}.`);
 gameState.nightState.cultLeaderRecruitId = targetId;
 } else if (currentRole === 'Vampire') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('droplet')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Digigit</div>
<div class="seer-result-detail">${targetName} akan dihabisi darahnya malam ini.</div>
</div>`;
 addLog('night', ` Vampire mengincar ${targetName}.`);
 gameState.nightState.vampireKillId = targetId;
 } else if (currentRole === 'White Wolf') {
 if (gameState.day % 2 === 0) {
 gameState.nightState.whiteWolfKillId = targetId;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('moon')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Pengkhianatan</div>
<div class="seer-result-detail">${targetName} akan dihabisi oleh White Wolf malam ini.</div>
</div>`;
 addLog('night', ` White Wolf mengkhianati dan mengincar ${targetName}.`);
 }
 } else if (currentRole === 'Thief') {
 if (gameState.day === 1 && player) {
 const thiefPlayer = gameState.players.find(p => p.role === 'Thief' && p.alive);
 if (thiefPlayer) {
 const tempRole = player.role;
 const tempDopp = player._wasDoppelganger;

 player.role = 'Thief';
 player._wasThiefSwapped = true;
 player._eksRole = tempRole;

 thiefPlayer.role = tempRole;
 if (tempDopp) thiefPlayer._wasDoppelganger = true;
 // Thief's original was Thief, no need for _eksRole since they hijacked.

 gameState.thiefStolen = targetId;

 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('key-round')}</div>
<div class="seer-result-text" style="color:var(--accent-green);">Peran Dicuri!</div>
<div class="seer-result-detail">Pencuri menjadi <strong>${tempRole}</strong>. ${targetName} menjadi Thief (Eks-${tempRole}).</div>
</div>`;
 addLog('night', ` Thief menukar kartunya dengan ${targetName}. Target menjadi Thief (Eks-${tempRole}).`);
 }
 }
 } else if (currentRole === 'Troublemaker') {
 const p1 = gameState.players.find(p => String(p.id) === String(gameState._troublemakerTemp.p1.id));
 const p2 = gameState.players.find(p => String(p.id) === String(gameState._troublemakerTemp.p2.id));
 if (p1 && p2) {
 const oldRole1 = p1.role;
 const oldRole2 = p2.role;

 p1.role = oldRole2;
 p2.role = oldRole1;

 const tempDopp = p1._wasDoppelganger;
 p1._wasDoppelganger = p2._wasDoppelganger;
 p2._wasDoppelganger = tempDopp;

 p1._troublemakerSwapped = true;
 p2._troublemakerSwapped = true;
 p1._eksRole = oldRole1;
 p2._eksRole = oldRole2;

 gameState.troublemakerUsed = true;

 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('shuffle')}</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Kartu Ditukar!</div>
<div class="seer-result-detail">${p1.name} (kini ${p1.role}) dan ${p2.name} (kini ${p2.role}) telah bertukar kartu ROLE.</div>
</div>`;
 addLog('night', ` Troublemaker menukar kartu ${p1.name} dengan ${p2.name}.`);
 }
 } else if (currentRole === 'Amnesiac') {
 if (!gameState.amnesiacChosen && player && player.role) {
 const amnPlayer = gameState.players.find(p => p.role === 'Amnesiac' && p.alive);
 if (amnPlayer) {
 amnPlayer.role = player.role;
 gameState.amnesiacChosen = true;

 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('brain')}</div>
<div class="seer-result-text" style="color:var(--accent-blue);">Ingatan Pulih!</div>
<div class="seer-result-detail">Amnesiac mengingat bahwa dia adalah <strong>${player.role}</strong>.</div>
</div>`;
 addLog('night', ` Amnesiac mengambil identitas ${targetName} dan menjadi ${player.role}.`);
 }
 }
 } else if (currentRole === 'Guardian') {
 gameState.nightState.guardProtectTarget = targetName;
 gameState.nightState.guardProtectId = targetId;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('shield')}</div>
<div class="seer-result-text" style="color:var(--accent-green);">Perlindungan Aktif</div>
<div class="seer-result-detail">${targetName} dilindungi malam ini.</div>
</div>
`;
 addLog('night', ` Guardian melindungi ${targetName}.`);
 } else if (currentRole === 'Werewolf') {
 if (gameState.wolfCubDoubleKillActive) {
 if (!gameState._wolfTemp?.p1 || !gameState._wolfTemp?.p2) {
 return showToast('Pilih DUA target untuk dimangsa!', 'warning');
 }
 if (gameState._wolfTemp.p1.id === gameState._wolfTemp.p2.id) {
 return showToast('Pilih dua pemain yang berbeda!', 'warning');
 }
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('paw-print')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Dua Target Dipilih</div>
<div class="seer-result-detail">${escapeHtml(gameState._wolfTemp.p1.name)} dan ${escapeHtml(gameState._wolfTemp.p2.name)} menjadi incaran serigala.</div>
</div>
`;
 gameState.nightState.wolfKillTarget = gameState._wolfTemp.p1.name;
 gameState.nightState.wolfKillId = gameState._wolfTemp.p1.id;
 gameState.nightState.wolfKillTarget2 = gameState._wolfTemp.p2.name;
 gameState.nightState.wolfKillId2 = gameState._wolfTemp.p2.id;
 addLog('night', ` ${currentRole} (Mengamuk) memilih ${escapeHtml(gameState._wolfTemp.p1.name)} dan ${escapeHtml(gameState._wolfTemp.p2.name)} sebagai korban.`);
 } else {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('paw-print')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dipilih</div>
<div class="seer-result-detail">${targetName} menjadi incaran serigala malam ini.</div>
</div>
`;
 gameState.nightState.wolfKillTarget = targetName;
 gameState.nightState.wolfKillId = targetId;
 addLog('night', ` ${currentRole} memilih ${targetName} sebagai korban.`);
 }
 } else if (currentRole === 'Alpha Wolf') {
 // ── Kasus A: Malam 2 — pilih dan eksekusi target rekrut ──
 if (gameState._alphaAbilityUsed && gameState._alphaChoice === 'recruit' && !gameState._alphaRecruitDone) {
 const alphaSelected = document.querySelector('.target-btn.selected');
 if (!alphaSelected) {
 return showToast('Pilih target rekrut terlebih dahulu!', 'warning');
 }
 const alphaTargetId = alphaSelected.dataset.id;
 const alphaTargetName = alphaSelected.dataset.name || alphaSelected.querySelector('span:last-child')?.textContent.trim() || alphaSelected.textContent.trim();
 gameState.nightState.alphaRecruitId = alphaTargetId;
 gameState._alphaRecruitDone = true;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('users-round')}</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Rekrutmen Dieksekusi!</div>
<div class="seer-result-detail">${alphaTargetName} resmi bergabung tim serigala malam ini.</div>
</div>`;
 addLog('night', ` Alpha Wolf merekrut ${alphaTargetName} — bergabung tim serigala malam ini!`);

 // ── Kasus B: Kemampuan sudah selesai ──
 } else if (gameState._alphaAbilityUsed) {
 // Tidak ada aksi khusus, lanjut saja

 // ── Kasus C: Malam 1 — pilih mode Bunuh atau Rekrut ──
 } else {
 if (_alphaModeUI === 'kill') {
 // Bunuh — perlu target
 const alphaSelected = document.querySelector('#alphaTargetArea .target-btn.selected');
 if (!alphaSelected) {
 return showToast('Pilih target untuk dibunuh!', 'warning');
 }
 const alphaTargetId = alphaSelected.dataset.id;
 const alphaTargetName = alphaSelected.dataset.name || alphaSelected.querySelector('span:last-child')?.textContent.trim() || alphaSelected.textContent.trim();
 gameState.nightState.alphaKillId = alphaTargetId;
 gameState._alphaAbilityUsed = true;
 gameState._alphaChoice = 'kill';
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('skull')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dibunuh</div>
<div class="seer-result-detail">${alphaTargetName} menjadi korban Alpha Wolf malam ini. Kemampuan rekrut hangus selamanya.</div>
</div>`;
 addLog('night', ` Alpha Wolf memilih BUNUH: ${alphaTargetName} menjadi incaran.`);
 } else {
 // Rekrut — tidak perlu target sekarang, target baru dipilih malam depan.
 // LOGIC-02 FIX: Kawanan tidak membunuh malam ini karena Alpha mengumumkan rekrut.
 // wolfKillId yang sudah diset Werewolf sebelumnya di-null-kan di sini.
 gameState._alphaAbilityUsed = true;
 gameState._alphaChoice = 'recruit';
 gameState._alphaRecruitDone = false;
 // Batalkan kill Werewolf malam ini — kawanan sepakat rekrut, bukan membunuh
 gameState.nightState.wolfKillId = null;
 gameState.nightState.wolfKillTarget = null;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('users-round')}</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Mode Rekrut Dipilih</div>
<div class="seer-result-detail">Malam berikutnya, Alpha Wolf akan memilih siapa yang direkrut. <strong>Kawanan serigala TIDAK membunuh malam ini.</strong></div>
</div>`;
 addLog('night', ` Alpha Wolf memilih mode REKRUT — kawanan serigala tidak membunuh malam ini. Target rekrut dipilih malam berikutnya.`);
 }
 }

 } else if (currentRole === 'Bodyguard') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('shield-plus')}</div>
<div class="seer-result-text" style="color:var(--accent-green);">Bodyguard Siaga</div>
<div class="seer-result-detail">${targetName} dilindungi. Jika diserang, Bodyguard & penyerang mati.</div>
</div>
`;
 gameState.nightState.bodyguardProtectTarget = targetName;
 gameState.nightState.bodyguardProtectId = targetId;
 addLog('night', ` Bodyguard melindungi ${targetName}.`);
 } else if (currentRole === 'Serial Killer') {
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('skull')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dipilih</div>
<div class="seer-result-detail">${targetName} akan dibunuh malam ini.</div>
</div>
`;
 gameState.nightState.skKillTarget = targetName;
 gameState.nightState.skKillId = targetId;
 addLog('night', ` Serial Killer memilih ${targetName}.`);
 } else if (currentRole === 'Arsonist') {
 const ns = gameState.nightState;
 const mode = ns.arsonistMode || 'douse';
 if (mode === 'ignite') {
 const dousedIds = new Set((gameState.arsonistDousedIds || []).map(String));
 const igniteIds = gameState.players
 .filter(p => p.alive && dousedIds.has(String(p.id)))
 .map(p => p.id);
 ns.arsonistIgniteIds = igniteIds;
 ns.arsonistDouseId = null;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('flame')}</div>
<div class="seer-result-text" style="color:var(--accent-red);">Api Dinyalakan</div>
<div class="seer-result-detail">${igniteIds.length ? gameState.players.filter(p => igniteIds.includes(p.id)).map(p => escapeHtml(p.name)).join(', ') : 'Tidak ada target hidup'} akan terbakar malam ini.</div>
</div>
`;
 addLog('night', ` Arsonist menyalakan api untuk ${igniteIds.length} target tersiram.`);
 } else {
 const douseId = ns.arsonistDouseId || targetId;
 const douseTarget = gameState.players.find(p => String(p.id) === String(douseId));
 if (douseTarget) {
 ns.arsonistMode = 'douse';
 ns.arsonistDouseId = douseTarget.id;
 ns.arsonistIgniteIds = [];
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('fuel')}</div>
<div class="seer-result-text" style="color:var(--accent-gold);">Target Disiram</div>
<div class="seer-result-detail">${escapeHtml(douseTarget.name)} kini tersiram bensin.</div>
</div>
`;
 addLog('night', ` Arsonist menyiram bensin ke ${douseTarget.name}.`);
 }
 }
 } else if (currentRole === 'Doppelganger') {
 if (!gameState.doppelgangerTarget && player) {
 gameState.doppelgangerTarget = targetId;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('copy')}</div>
<div class="seer-result-text" style="color:var(--accent-orange);">Target Salin Dipilih</div>
<div class="seer-result-detail">Doppelganger menunggu kematian ${targetName} untuk mewarisi role.</div>
</div>
`;
 addLog('night', ` Doppelganger mengincar ${targetName} untuk ditiru rolenya nanti.`);
 }
 } else if (currentRole === 'Wizard') {
 gameState.nightState.wizardSilenceTarget = targetId;
 document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${actionIconMarkup('wand-sparkles')}</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Bungkam Terkunci!</div>
<div class="seer-result-detail">Kemampuan ${targetName} disegel sepenuhnya malam ini.</div>
</div>`;
 addLog('night', ` Wizard membungkam ${targetName} malam ini!`);
 const wizard = gameState.players.find(p => p.role === 'Wizard' && p.alive);
 if (wizard) wizard._wizardUsedCount = (wizard._wizardUsedCount || 0) + 1;
 } else {
                addLog('night', `${currentRole} memilih ${targetName}.`);
 }

 // BUG-22 FIX: Simpan hasil ke cache — akan ditampilkan kembali jika moderator ganti tab
 // sebelum menekan Konfirmasi lagi. Cache di-invalidate otomatis saat fase berubah.
 const _resultEl = document.getElementById('nightActionResult');
 if (_resultEl && _resultEl.innerHTML) {
 gameState._lastNightActionResult = _resultEl.innerHTML;
 gameState._lastNightActionPhase = gameState.nightPhase;
 }
 gameState.nightPhase++;
 // Fase sudah naik: cache sekarang otomatis tidak valid (fase berbeda), tidak perlu di-null.
 renderNightSequence();
 renderNightAction();
 }


 function skipNightAction() {
 if (isGameplayPaused()) return;
 const activeRoles = getActiveNightRoles();

 if (gameState.nightPhase >= activeRoles.length) return;

 const currentRole = activeRoles[gameState.nightPhase];
 captureNightUndoSnapshot(`Lewati ${currentRole}`);

 // Doppelganger malam pertama WAJIB memilih — tidak bisa skip
 if (currentRole === 'Doppelganger' && gameState.day === 1) {
 return showToast('Doppelganger WAJIB memilih target di malam pertama!', 'error');
 }

 // LOGIC-05 FIX: Role kritis (pembunuh) memerlukan konfirmasi sebelum skip,
 // agar moderator tidak tidak sengaja melewatkan aksi yang mengubah jalannya game.
 const criticalKillerRoles = ['Werewolf', 'Alpha Wolf', 'Arsonist', 'Serial Killer'];
 if (criticalKillerRoles.includes(currentRole)) {
 showConfirm(
 `Skip Aksi ${currentRole}?`,
 `${currentRole} tidak akan membunuh siapapun malam ini. Ini valid jika memang sengaja (pilihan tidak membunuh). Yakin ingin melewatkan?`,
 'Ya, Skip',
 true,
 () => {
            addLog('night', `${currentRole} melewatkan aksi — tidak ada korban malam ini dari ${currentRole}.`);
 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 }
 );
 return;
 }

            addLog('night', `${currentRole} melewatkan aksi.`);

 gameState.nightPhase++;
 renderNightSequence();
 renderNightAction();
 }

 function endNightPhase() {
 if (isGameplayPaused()) return;
 if (!gameState.started || gameState.phase !== 'night') return;
 processNightDeaths();
 lastNightActionSnapshot = null;
 updateNightUndoButton();

 if (gameState._pendingWolfSacrifice) {
 return openWolfSacrificeModal();
 }

 nextPhase();
 }

function processNightDeaths() {
 gameState._pendingWolfSacrifice = false; // Reset state tumbal tiap awal pemrosesan malam
 const preResolvedNightKills = Array.isArray(gameState.nightKills) ? [...gameState.nightKills] : [];
 let deaths = [];
 let kills = [];
 const ns = gameState.nightState;
 gameState.nightDeathDetails = {};
 const addDeathDetail = (id, detail) => {
 if (!id || !detail) return;
 if (!gameState.nightDeathDetails[id]) gameState.nightDeathDetails[id] = [];
 if (!gameState.nightDeathDetails[id].includes(detail)) {
 gameState.nightDeathDetails[id].push(detail);
 }
 };
 const addDeath = (id, detail) => {
 if (!id) return;
 deaths.push(id);
 addDeathDetail(id, detail);
 };
 const describeKill = (k, targetPlayer) => {
 if (targetPlayer?.role === 'Little Girl' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
 return 'dibunuh serigala setelah ketahuan/mengintip';
 }
 const labels = {
 wolf: 'dibunuh serigala',
 alpha: 'dibunuh Alpha Wolf',
 whitewolf: 'dibunuh White Wolf',
 vampire: 'dibunuh Vampire',
 arsonist: 'terbakar oleh Arsonist',
 sk: 'dibunuh Serial Killer',
 witch: 'diracun Witch'
 };
 return labels[k.attacker] || 'mati karena aksi malam';
 };

 preResolvedNightKills.forEach(id => {
 const p = gameState.players.find(pl => pl.id === id);
 addDeath(id, p?.role === 'Little Girl' ? 'ketahuan mengintip Werewolf' : 'mati karena aksi malam khusus');
 });

 // Wolf Cub Double Kill Check
 if (gameState.wolfCubKilledThisDay) {
 gameState.wolfCubDoubleKillActive = true;
 gameState.wolfCubKilledThisDay = false;
 addLog('night', ` Kawanan Werewolf mengamuk karena Wolf Cub telah dibunuh! Mereka bisa membunuh 2 orang malam ini.`);
 }

 // Drunk Poisoned Check
 if (gameState.drunkPoisonedWolf) {
 ns.wolfKillId = null;
 ns.wolfKillTarget = null;
 ns.wolfKillId2 = null;
 ns.wolfKillTarget2 = null;
 gameState.drunkPoisonedWolf = false;
 addLog('night', ` Werewolf masih keracunan akibat Pemabuk kemarin! Serangan dibatalkan malam ini.`);
 }

 // Evaluasi Sihir Bungkam Wizard (Roleblock parameter)
 if (ns.wizardSilenceTarget) {
 const blockedPlayer = gameState.players.find(p => p.id == ns.wizardSilenceTarget);
 if (blockedPlayer) {
 const r = blockedPlayer.role;
 const rDef = ROLE_DEFINITIONS[r];
 if (r === 'Serial Killer' && ns.skKillId) {
 ns.skKillId = null;
 addLog('night', ` Sihir Wizard berhasil memblokir aksi Serial Killer malam ini!`);
 }
 if (r === 'Arsonist') {
 if (ns.arsonistDouseId || (ns.arsonistIgniteIds && ns.arsonistIgniteIds.length)) {
 ns.arsonistDouseId = null;
 ns.arsonistIgniteIds = [];
 addLog('night', ` Sihir Wizard berhasil memblokir aksi Arsonist malam ini!`);
 }
 }
 if (r === 'Witch') {
 if (ns.witchPoisonTarget) {
 ns.witchPoisonTarget = null;
 addLog('night', ` Sihir Wizard menggagalkan racun Witch!`);
 }
 if (ns.witchHealTarget) {
 ns.witchHealTarget = null;
 addLog('night', ` Sihir Wizard menggagalkan penyembuhan Witch!`);
 }
 }
 if (r === 'Alpha Wolf') {
 if (ns.alphaKillId) {
 ns.alphaKillId = null;
 addLog('night', ` Sihir Wizard berhasil memblokir serangan Alpha Wolf!`);
 }
 if (ns.alphaRecruitId) {
 ns.alphaRecruitId = null;
 addLog('night', ` Sihir Wizard menggagalkan upaya rekrutmen Alpha Wolf!`);
 }
 }
 if (rDef && rDef.team === 'Werewolf') {
 if (ns.wolfKillId || ns.wolfKillId2) {
 ns.wolfKillId = null;
 ns.wolfKillId2 = null;
 addLog('night', ` Sihir Wizard membungkam Werewolf (${blockedPlayer.name}), sehingga seluruh kawanan batal menyerang!`);
 }
 }
 }
 }

 // Evaluasi Tavern Keeper Roleblock
 if (ns.tavernKeeperBlockId) {
 const blockedPlayer = gameState.players.find(p => p.id == ns.tavernKeeperBlockId);
 if (blockedPlayer) {
 if (ns.trackerTargetId && gameState.players.find(p => p.role === 'Tracker')?.id == ns.tavernKeeperBlockId) ns.trackerTargetId = null;
 if (ns.auraSeerTargetId && gameState.players.find(p => p.role === 'Aura Seer')?.id == ns.tavernKeeperBlockId) ns.auraSeerTargetId = null;
 if (ns.guardProtectId && gameState.players.find(p => p.role === 'Guardian')?.id == ns.tavernKeeperBlockId) ns.guardProtectId = null;
 if (ns.sorcererTargetId && gameState.players.find(p => p.role === 'Sorcerer')?.id == ns.tavernKeeperBlockId) ns.sorcererTargetId = null;
 if (ns.infectorInfectId && gameState.players.find(p => p.role === 'Infector')?.id == ns.tavernKeeperBlockId) ns.infectorInfectId = null;
 if ((ns.arsonistDouseId || (ns.arsonistIgniteIds && ns.arsonistIgniteIds.length)) && gameState.players.find(p => p.role === 'Arsonist')?.id == ns.tavernKeeperBlockId) {
 ns.arsonistDouseId = null;
 ns.arsonistIgniteIds = [];
 }
 addLog('night', ` Tavern Keeper memblokir aksi ${blockedPlayer.name} malam ini.`);
 }
 }

 // Konsumsi potion Witch hanya jika aksinya TIDAK diblokir Wizard.
 // Jika Wizard menggagalkan efeknya, potion dikembalikan (tidak dikonsumsi).
 if (ns.witchHealTarget) gameState.witchPotions.heal = false;
 if (ns.witchPoisonTarget) gameState.witchPotions.poison = false;

 // LOGIC-02 Guard (defensif): Jika Alpha Wolf baru saja mengumumkan Rekrut
 // (malam pertama — bukan malam eksekusi rekrut), kawanan serigala TIDAK membunuh.
 // wolfKillId seharusnya sudah di-null oleh confirmNightAction, ini hanya fallback.
 if (gameState._alphaChoice === 'recruit' && !gameState._alphaRecruitDone && (ns.wolfKillId || ns.wolfKillId2)) {
 addLog('night', ` [Guard] Alpha Wolf memilih Rekrut — wolfKill dibatalkan secara otomatis.`);
 ns.wolfKillId = null;
 ns.wolfKillTarget = null;
 ns.wolfKillId2 = null;
 ns.wolfKillTarget2 = null;
 }

 // Infector check (mengubah wolfKillId menjadi infeksi Werewolf)
 if (ns.infectorInfectId && !gameState.infectorUsed) {
 const infectorTarget = gameState.players.find(p => p.id == ns.infectorInfectId);
 if (infectorTarget && infectorTarget.alive && (ns.infectorInfectId === ns.wolfKillId || ns.infectorInfectId === ns.wolfKillId2)) {
 infectorTarget.role = 'Werewolf';
 if (!gameState.wolfTeam.includes(infectorTarget.name)) {
 gameState.wolfTeam.push(infectorTarget.name);
 }
 if (ns.infectorInfectId === ns.wolfKillId) ns.wolfKillId = null; // Cancel kill
 if (ns.infectorInfectId === ns.wolfKillId2) ns.wolfKillId2 = null; // Cancel kill
 gameState.infectorUsed = true;
 addLog('night', ` Infector menginfeksi ${infectorTarget.name}! Kini menjadi Werewolf baru.`);
 }
 }

 // Process Alpha Wolf Recruitment
 if (ns.alphaRecruitId) {
 const targetPlayer = gameState.players.find(p => p.id === ns.alphaRecruitId);
 if (targetPlayer && targetPlayer.alive) {
 // Target is converted to Werewolf instantly
 targetPlayer.role = 'Werewolf';
 // Update wolfTeam so the Dashboard panel reflects the new member
 if (!gameState.wolfTeam.includes(targetPlayer.name)) {
 gameState.wolfTeam.push(targetPlayer.name);
 }
 addLog('night', ` Konversi Selesai! ${targetPlayer.name} kini resmi berubah menjadi Werewolf!`);
 }
 }

 if (ns.arsonistDouseId) {
 const douseTarget = gameState.players.find(p => String(p.id) === String(ns.arsonistDouseId));
 if (douseTarget && douseTarget.alive) {
 if (!gameState.arsonistDousedIds) gameState.arsonistDousedIds = [];
 if (!gameState.arsonistDousedIds.map(String).includes(String(douseTarget.id))) {
 gameState.arsonistDousedIds.push(douseTarget.id);
 }
 addLog('night', ` Bensin Arsonist melekat pada ${douseTarget.name}.`);
 }
 }

 // Evaluate Kills
 if (ns.wolfKillId) {
 const wolfTarget = gameState.players.find(p => p.id === ns.wolfKillId);
 if (wolfTarget && wolfTarget.role === 'Lone Wolf') {
 wolfTarget.role = 'Werewolf';
 if (!gameState.wolfTeam.includes(wolfTarget.name)) {
 gameState.wolfTeam.push(wolfTarget.name);
 }
 addLog('night', ` Target serangan Serigala ternyata adalah Serigala Liar (Lone Wolf)! ${wolfTarget.name} batal mati dan seketika menyatu memeluk insting Serigalanya.`);
 ns.wolfKillId = null;
 } else {
 kills.push({ attacker: 'wolf', target: ns.wolfKillId });
 }
 }
 if (ns.wolfKillId2) {
 const wolfTarget2 = gameState.players.find(p => p.id === ns.wolfKillId2);
 if (wolfTarget2 && wolfTarget2.role === 'Lone Wolf') {
 wolfTarget2.role = 'Werewolf';
 if (!gameState.wolfTeam.includes(wolfTarget2.name)) {
 gameState.wolfTeam.push(wolfTarget2.name);
 }
 addLog('night', ` Target serangan Serigala ke-2 ternyata adalah Serigala Liar (Lone Wolf)! ${wolfTarget2.name} batal mati dan seketika menyatu memeluk insting Serigalanya.`);
 ns.wolfKillId2 = null;
 } else {
 kills.push({ attacker: 'wolf', target: ns.wolfKillId2 });
 }
 }
 if (ns.alphaKillId) {
 const alphaTarget = gameState.players.find(p => p.id === ns.alphaKillId);
 if (alphaTarget && alphaTarget.role === 'Lone Wolf') {
 alphaTarget.role = 'Werewolf';
 if (!gameState.wolfTeam.includes(alphaTarget.name)) {
 gameState.wolfTeam.push(alphaTarget.name);
 }
 addLog('night', ` Serangan maut Alpha Wolf mencabik Serigala Liar (Lone Wolf)! Darah Alpha membangkitkan ${alphaTarget.name} menjadi Werewolf seutuhnya.`);
 ns.alphaKillId = null;
 } else {
 kills.push({ attacker: 'alpha', target: ns.alphaKillId });
 }
 }
 if (ns.whiteWolfKillId) {
 const whiteWolfTarget = gameState.players.find(p => p.id == ns.whiteWolfKillId);
 if (whiteWolfTarget && whiteWolfTarget.alive && ROLE_DEFINITIONS[whiteWolfTarget.role]?.team === 'Werewolf') {
 kills.push({ attacker: 'whitewolf', target: ns.whiteWolfKillId });
 }
 }
 if (ns.vampireKillId) kills.push({ attacker: 'vampire', target: ns.vampireKillId });
 if (Array.isArray(ns.arsonistIgniteIds)) {
 ns.arsonistIgniteIds.forEach(id => {
 if (id) kills.push({ attacker: 'arsonist', target: id });
 });
 }
 if (ns.skKillId) kills.push({ attacker: 'sk', target: ns.skKillId });
 if (ns.witchPoisonTarget) kills.push({ attacker: 'witch', target: ns.witchPoisonTarget });

 // Tough Guy pending death execution
 if (gameState.toughGuyPendingDeath) {
 const tg = gameState.players.find(p => p.id == gameState.toughGuyPendingDeath);
 if (tg && tg.alive) {
 addDeath(tg.id, 'menyerah karena luka lama Tough Guy dari serangan malam sebelumnya');
 addLog('night', ` ${tg.name} (Tough Guy) akhirnya menyerah dari luka kemarin.`);
 }
 gameState.toughGuyPendingDeath = null;
 }

 // Process protections & veteran counter-attacks
 for (const k of kills) {
 const targetPlayer = gameState.players.find(p => p.id === k.target);
 if (!targetPlayer) continue;

 let blocked = false;

 // Serial Killer immunity to Werewolf attack
 if (targetPlayer.role === 'Serial Killer' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
 blocked = true;
 addLog('night', ` Serial Killer diserang oleh serigala, namun ia kebal!`);
 }

 // Tough Guy - Deferred Death
 if (targetPlayer.role === 'Tough Guy' && (k.attacker === 'wolf' || k.attacker === 'alpha') && !gameState.toughGuyPendingDeath) {
 gameState.toughGuyPendingDeath = targetPlayer.id;
 addLog('night', ` ${targetPlayer.name} (Tough Guy) terkena serangan, namun ia bertahan seharian! Akan mati malam berikutnya.`);
 blocked = true; // Tidak mati malam ini
 }

 // Cursed - Converts to Wolf
 if (targetPlayer.role === 'Cursed' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
 targetPlayer.role = 'Werewolf';
 if (!gameState.wolfTeam.includes(targetPlayer.name)) {
 gameState.wolfTeam.push(targetPlayer.name);
 }
 addLog('night', ` ${targetPlayer.name} (Terkutuk) diserang wolf! Ia tidak mati melainkan berubah menjadi Werewolf!`);
 blocked = true; // Tidak mati
 }

 // Drunk - Poisons the Wolf for next night
 if (targetPlayer.role === 'Drunk' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
 gameState.drunkPoisonedWolf = true; // Wolf skip kill malam depan
 addLog('night', ` ${targetPlayer.name} (Pemabuk) digigit! Werewolf keracunan dan tidak bisa membunuh malam depan.`);
 // Pemabuk tetap mati (tidak di-blocked)
 }

 // Survivor - Rompi Pelindung
 if (ns.survivorVestActivated && targetPlayer.role === 'Survivor' && !gameState.survivorVestUsed) {
 gameState.survivorVestUsed = true;
 blocked = true;
 addLog('night', ` Survivor menggunakan rompi pelindung! Selamat dari serangan.`);
 }

 // Veteran Alert Check
 if (ns.veteranIsAlert && targetPlayer.role === 'Veteran' && k.attacker !== 'arsonist') {
 if (k.attacker === 'witch') {
 addLog('night', ` Penyihir melempar ramuan mematikan ke Veteran yang sedang siaga! Veteran berhasil menembak mati sang Penyihir, namun tak selamat dari racunnya (Keduanya tewas).`);
 addDeath(targetPlayer.id, 'diracun Witch saat Veteran sedang siaga');
 const witch = gameState.players.find(p => p.role === 'Witch' && p.alive);
 if (witch) addDeath(witch.id, 'ditembak Veteran saat mencoba meracuninya');
 blocked = true; // Set true agar Guardian/Bodyguard tidak mencoba melindungi Veteran yang sudah diracun
 } else {
 blocked = true;
 let attackerName = k.attacker === 'wolf' ? 'Serigala' :
 k.attacker === 'alpha' ? 'Alpha Wolf' :
 k.attacker === 'whitewolf' ? 'White Wolf' :
 k.attacker === 'vampire' ? 'Vampir' :
 k.attacker === 'sk' ? 'Serial Killer' : 'Seseorang';
 addLog('night', ` ${attackerName} mencoba menyerang Veteran yang sedang siaga! Penyerang mati ditembak sebelum berhasil menyentuh Veteran.`);

 if (k.attacker === 'wolf') {
 const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role]?.team === 'Werewolf' && p.alive && !deaths.includes(p.id));
 if (wolves.length === 1) {
 addDeath(wolves[0].id, 'ditembak Veteran saat menyerang');
 addLog('night', ` Serigala terakhir (${wolves[0].name}) terbunuh peluru Veteran!`);
 } else if (wolves.length > 1) {
 gameState._pendingWolfSacrifice = true;
 gameState._pendingWolfSacrificeReason = 'Veteran';
 }
 } else if (k.attacker === 'alpha') {
 const alpha = gameState.players.find(p => p.role === 'Alpha Wolf' && p.alive);
 if (alpha) addDeath(alpha.id, 'ditembak Veteran saat menyerang');
 } else if (k.attacker === 'sk') {
 const sk = gameState.players.find(p => p.role === 'Serial Killer' && p.alive);
 if (sk) addDeath(sk.id, 'ditembak Veteran saat menyerang');
 } else if (k.attacker === 'whitewolf') {
 const ww = gameState.players.find(p => p.role === 'White Wolf' && p.alive);
 if (ww) addDeath(ww.id, 'ditembak Veteran saat menyerang');
 } else if (k.attacker === 'vampire') {
 const vamp = gameState.players.find(p => p.role === 'Vampire' && p.alive);
 if (vamp) addDeath(vamp.id, 'ditembak Veteran saat menyerang');
 }
 }
 }

 // Alpha Wolf kill diperlakukan sama seperti kill werewolf biasa
 // (bisa diblokir Guardian, Bodyguard, Witch Heal, dan Veteran)
 if (!blocked) {
 // Little Girl tidak bisa dilindungi dari serangan wolf/alpha
 if (targetPlayer.role === 'Little Girl' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
 addLog('night', ` Little Girl diserang serigala! Tidak dapat dilindungi.`);
 } else {
 // Guardian
 if (k.target === ns.guardProtectId) {
 blocked = true;
 addLog('night', ` Serangan terhadap ${targetPlayer.name} diblokir oleh Guardian.`);
 }
 // Bodyguard
 if (k.target === ns.bodyguardProtectId) {
 blocked = true;
 ns.bodyguardProtectId = null; // Bodyguard hanya bisa menahan 1 kali serangan
 addLog('night', ` Bodyguard melindungi ${targetPlayer.name} dari serangan!`);
 const bg = gameState.players.find(p => p.role === 'Bodyguard' && p.alive);
 if (bg) addDeath(bg.id, `mati melindungi ${targetPlayer.name} sebagai Bodyguard`);
 // Penyerang juga mati
 if (k.attacker === 'wolf' || k.attacker === 'alpha' || k.attacker === 'whitewolf') {
 const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role]?.team === 'Werewolf' && p.alive && !deaths.includes(p.id));
 if (wolves.length === 1) {
 addDeath(wolves[0].id, `terbunuh saat menyerang target yang dilindungi Bodyguard (${targetPlayer.name})`);
 addLog('night', ` Serigala ${wolves[0].name} terbunuh melawan Bodyguard!`);
 } else if (wolves.length > 1) {
 gameState._pendingWolfSacrifice = true;
 gameState._pendingWolfSacrificeReason = 'Bodyguard';
 }
 } else if (k.attacker === 'sk') {
 const sk = gameState.players.find(p => p.role === 'Serial Killer' && p.alive);
 if (sk) addDeath(sk.id, `terbunuh saat menyerang target yang dilindungi Bodyguard (${targetPlayer.name})`);
 } else if (k.attacker === 'vampire') {
 const vamp = gameState.players.find(p => p.role === 'Vampire' && p.alive);
 if (vamp) addDeath(vamp.id, `terbunuh saat menyerang target yang dilindungi Bodyguard (${targetPlayer.name})`);
 }
 }
 // Witch Heal
 if (k.target === ns.witchHealTarget) {
 blocked = true;
 addLog('night', ` Witch menyembuhkan ${targetPlayer.name}.`);
 }
 }
 }

 if (!blocked) {
 addDeath(targetPlayer.id, describeKill(k, targetPlayer));
 }
 }

 // Tracker Result Logging
 if (ns.trackerTargetId) {
 const trackerTarget = gameState.players.find(p => p.id == ns.trackerTargetId);
 const visitors = evaluateVisitors(ns.trackerTargetId);
 addLog('night', ` Tracker melacak ${trackerTarget?.name}: dikunjungi oleh ${visitors.join(', ') || 'tidak ada'}.`);
 }
 // Cult Leader Recruitment Execution
 if (ns.cultLeaderRecruitId) {
 const newMember = gameState.players.find(p => p.id == ns.cultLeaderRecruitId);
 if (newMember && newMember.alive && !gameState.cultMembers.includes(String(newMember.id))) {
 gameState.cultMembers.push(String(newMember.id));
 addLog('night', ` Cult Leader merekrut ${newMember.name} ke dalam sektenya.`);
 }
 }

 gameState.nightKills = [...new Set(deaths)]; // Unique IDs
 gameState.guardLastProtect = ns.guardProtectId || null;
 gameState.wolfCubDoubleKillActive = false; // Turn off after processing
 addLog('night', ' Fase memproses serangan malam selesai.');
 }

 function evaluateVisitors(targetId) {
 const ns = gameState.nightState;
 const visitors = [];
 if (ns.wolfKillId == targetId) visitors.push('Serigala');
 if (ns.alphaKillId == targetId) visitors.push('Serigala');
 if (ns.alphaRecruitId == targetId) visitors.push('Serigala');
 if (ns.skKillId == targetId) visitors.push('Serial Killer');
 if (ns.vampireKillId == targetId) visitors.push('Vampir');
 if (ns.arsonistDouseId == targetId) visitors.push('Arsonist');
 if (ns.whiteWolfKillId == targetId) visitors.push('Serigala Putih');
 if (ns.guardProtectId == targetId) visitors.push('Guardian');
 if (ns.bodyguardProtectId == targetId) visitors.push('Bodyguard');
 if (ns.witchHealTarget == targetId) visitors.push('Witch (heal)');
 if (ns.witchPoisonTarget == targetId) visitors.push('Witch (racun)');
 if (ns.tavernKeeperBlockId == targetId) visitors.push('Tavern Keeper');
 if (ns.cultLeaderRecruitId == targetId) visitors.push('Cult Leader');
 return visitors;
 }

 function openWolfSacrificeModal() {
 const select = document.getElementById('selectWolfSacrifice');
 const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role]?.team === 'Werewolf' && p.alive && !gameState.nightKills.includes(p.id));

 select.innerHTML = wolves.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${w.role})</option>`).join('');

 const msg = document.getElementById('wolfSacrificeMsg');
 msg.textContent = gameState._pendingWolfSacrificeReason === 'Veteran'
 ? 'Veteran menembak mati penyerangnya! Karena serigala menyerang berkelompok, pilih Serigala mana yang maju dan mati:'
 : 'Bodyguard terbunuh melindungi targetnya dan membunuh sang penyerang! Pilih Serigala mana yang mati:';

 openModal('modalWolfSacrifice');
 }

 function processWolfSacrifice() {
 if (isGameplayPaused()) return;
 const targetId = document.getElementById('selectWolfSacrifice').value;
 if (!targetId) return showToast('Pilih serigala yang mati!', 'warning');

 const wolf = gameState.players.find(p => p.id == targetId);
 if (wolf) {
 gameState.nightKills.push(wolf.id);
 if (!gameState.nightDeathDetails) gameState.nightDeathDetails = {};
 const reason = gameState._pendingWolfSacrificeReason === 'Veteran'
 ? 'ditembak Veteran saat menyerang'
 : 'terbunuh saat menyerang target yang dilindungi Bodyguard';
 gameState.nightDeathDetails[wolf.id] = [reason];
 addLog('night', ` Serigala ${wolf.name} terbunuh karena menyerang ${gameState._pendingWolfSacrificeReason === 'Veteran' ? 'Veteran' : 'target yang dilindungi Bodyguard'}!`);
 }

 gameState._pendingWolfSacrifice = false;
 closeModal('modalWolfSacrifice');
 nextPhase();
 }

 function cancelWolfSacrifice() {
 gameState._pendingWolfSacrifice = false;
 closeModal('modalWolfSacrifice');
 addLog('night', ' Moderator membatalkan pengorbanan Serigala (Aksi Override).');
 showToast('Pengorbanan dibatalkan', 'info');
 nextPhase();
 }

 // ==================== DAY ACTIONS ====================
 function renderDayActions() {
 const panel = document.getElementById('dayActionsPanel');
 if (!panel) return;
 let html = '';
 const alivePlayers = gameState.players.filter(p => p.alive);

 // Sheriff
 const sheriff = gameState.players.find(p => p.role === 'Sheriff' && p.alive && !p._sheriffUsed);
 if (sheriff) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-gold); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-gold);">
 <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-gold);"> Aksi Sheriff (${escapeHtml(sheriff.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Bisa menembak 1 pemain siang ini. Jika korban BUKAN serigala, Sheriff akan ikut mati! (1x pakai)</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;">
 <select id="sheriffTarget" class="form-select" style="max-width: 200px;">
 <option value="">-- Pilih Target --</option>
 ${alivePlayers.filter(p => p.id !== sheriff.id).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
 </select>
 <button class="btn btn-danger btn-sm" onclick="useSheriffAction('${sheriff.id}')"> Tembak</button>
 </div>
 </div>
 `;
 }

 // Priest
 const priest = gameState.players.find(p => p.role === 'Priest' && p.alive && !p._priestUsed);
 if (priest) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-cyan); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-cyan);">
 <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-cyan);"> Perjudian Priest (${escapeHtml(priest.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Menyiram air suci. Jika target Serigala, Serigala mati. Jika baik, Priest yang mati! (1x pakai)</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;">
 <select id="priestTarget" class="form-select" style="max-width: 200px;">
 <option value="">-- Pilih Target --</option>
 ${alivePlayers.filter(p => p.id !== priest.id).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
 </select>
 <button class="btn btn-primary btn-sm" onclick="usePriestAction('${priest.id}')"> Siram Air Suci</button>
 </div>
 </div>
 `;
 }

 // Mayor
 const mayor = gameState.players.find(p => p.role === 'Mayor' && p.alive && !p._mayorRevealed);
 if (mayor) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-purple); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-purple);">
 <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-purple-light);"> Deklarasi Mayor (${escapeHtml(mayor.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Buka identitas. Setelah mengungkap diri, saat di-vote ia akan mendapatkan perlakuan khusus, dan moderator menambah 2 suara di tally-nya jika ia vote orang lain.</div>
 <button class="btn btn-gold btn-sm" onclick="useMayorAction('${mayor.id}')"> Ungkap Identitas</button>
 </div>
 `;
 }

 // Survivor
 const survivor = gameState.players.find(p => p.role === 'Survivor' && p.alive && !gameState.survivorVestUsed && !gameState.nightState.survivorVestActivated);
 if (survivor) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-green); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-green);">
 <div style="font-weight:700;margin-bottom:8px;color:var(--accent-green);"> Rompi Pelindung (${escapeHtml(survivor.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Survivor mengaktifkan rompi agar kebal dari semua pembunuhan untuk malam hari berikutnya (1x pakai seumur hidup).</div>
 <button class="btn btn-primary btn-sm" onclick="activateSurvivorVest()"> Aktifkan Rompi</button>
 </div>
 `;
 }

 // Bounty Hunter
 const bountyHunter = gameState.players.find(p => p.role === 'Bounty Hunter' && p.alive);
 if (bountyHunter && gameState.bountyHunterTarget) {
 const bhTarget = gameState.players.find(p => p.id === gameState.bountyHunterTarget);
 if (bhTarget && bhTarget.alive) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-gold); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-gold);">
 <div style="font-weight:700;margin-bottom:8px;color:var(--accent-gold);"> Target Bounty Hunter (${escapeHtml(bountyHunter.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);">Target Utama: <strong style="color:white">${escapeHtml(bhTarget.name)}</strong>. Jika target ini divote gantung siang ini, Bounty Hunter langsung menang sendiri!</div>
 </div>
 `;
 }
 }

 // Martyr (Aksi intercept dijalankan via modal saat eliminatePlayer)
 const martyr = gameState.players.find(p => p.role === 'Martyr' && p.alive && !p._martyrUsed);
 if (martyr) {
 html += `
 <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-purple); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-purple);">
 <div style="font-weight:700;margin-bottom:8px;color:var(--accent-purple-light);"> Pengorbanan Martyr (${escapeHtml(martyr.name)})</div>
 <div style="font-size:0.82rem;color:var(--text-secondary);">Martyr dapat mengorbankan dirinya menggantikan pemain yang dieksekusi siang hari. (Tombol akan otomatis muncul saat eksekusi).</div>
 </div>
 `;
 }

 panel.innerHTML = html;
 }

 function useSheriffAction(sheriffId) {
 if (isGameplayPaused()) return;
 const targetId = document.getElementById('sheriffTarget').value;
 if (!targetId) return showToast('Pilih target tembakan Sheriff!', 'warning');

 showConfirm('Tembakan Sheriff', 'Apakah Sheriff yakin ingin menembak?', 'Tembak', true, () => {
 const sheriff = gameState.players.find(p => p.id == sheriffId);
 const target = gameState.players.find(p => p.id == targetId);
 sheriff._sheriffUsed = true;

 const targetDef = ROLE_DEFINITIONS[target.role];
 const targetIsWolf = targetDef && targetDef.team === 'Werewolf';

 if (targetIsWolf) {
 target.alive = false;
 target.eliminated = true;
 addLog('day', ` Sheriff ${sheriff.name} menembak mati ${target.name}. Ternyata dia adalah Serigala!`);
 showToast('Tembakan tepat mematikan Serigala!', 'success');
 checkCouplesDeath(target.name);
 checkDoppelgangerInheritance(target);
 } else {
 target.alive = false;
 target.eliminated = true;
 sheriff.alive = false;
 sheriff.eliminated = true;
 addLog('day', ` Sheriff ${sheriff.name} menembak mati ${target.name} (Bukan serigala). Karena menyadari kesalahannya, Sheriff bunuh diri!`);
 showToast('Tembakan salah sasaran!', 'error');
 checkCouplesDeath(target.name);
 checkCouplesDeath(sheriff.name);
 checkDoppelgangerInheritance(target);
 checkDoppelgangerInheritance(sheriff);
 if (target.role === 'Hunter' && !target._hunterUsed) {
 setTimeout(() => openHunterModal(target), 500);
 }
 }

 updateStats();
 renderPlayers();
 renderVoteGrid();
 renderDayActions();
 checkWinCondition();
 });
 }

 function usePriestAction(priestId) {
 if (isGameplayPaused()) return;
 const targetId = document.getElementById('priestTarget').value;
 if (!targetId) return showToast('Pilih target Priest!', 'warning');

 showConfirm('Siram Air Suci', 'Apakah Priest yakin ingin menyiram air suci?', 'Siram', true, () => {
 const priest = gameState.players.find(p => p.id == priestId);
 const target = gameState.players.find(p => p.id == targetId);
 priest._priestUsed = true;

 const targetDef = ROLE_DEFINITIONS[target.role];
 const targetIsWolf = targetDef && targetDef.team === 'Werewolf';

 if (targetIsWolf) {
 target.alive = false;
 target.eliminated = true;
 addLog('day', ` Priest ${priest.name} menyiramkan Air Suci ke ${target.name}. Berhasil! Dia adalah Serigala!`);
 showToast('Air Suci membakar serigala!', 'success');
 checkCouplesDeath(target.name);
 checkDoppelgangerInheritance(target);
 } else {
 priest.alive = false;
 priest.eliminated = true;
 addLog('day', ` Priest ${priest.name} menyiram ${target.name}. Ternyata dia bukan serigala! Dewa menghukum Priest dengan kematian.`);
 showToast('Air Suci meleset!', 'error');
 checkCouplesDeath(priest.name);
 checkDoppelgangerInheritance(priest);
 }

 updateStats();
 renderPlayers();
 renderVoteGrid();
 renderDayActions();
 checkWinCondition();
 });
 }

 function useMayorAction(mayorId) {
 if (isGameplayPaused()) return;
 const mayor = gameState.players.find(p => p.id == mayorId);
 showConfirm('Identitas Mayor', 'Yakin ingin mengungkap identitas Mayor?', 'Ungkap', true, () => {
 mayor._mayorRevealed = true;
 addLog('day', ` Mayor ${mayor.name} mendeklarasikan posisinya! Ucapannya kini bernilai dua suara.`);
 showToast(`Mayor ${mayor.name} mengungkap identitas!`, 'info');
 renderDayActions();
 if (typeof refreshOnlineVotes === 'function') refreshOnlineVotes();
 updateStats();
 });
 }

 function activateSurvivorVest() {
 if (isGameplayPaused()) return;
 showConfirm('Aktifkan Rompi', 'Survivor yakin ingin mengaktifkan rompi pelindung malam ini? (1x pakai seumur hidup)', 'Aktifkan', true, () => {
 gameState.nightState.survivorVestActivated = true;
 addLog('day', ` Survivor telah mengaktifkan rompi pelindung untuk malam ini.`);
 showToast(`Rompi Survivor aktif!`, 'success');
 renderDayActions();
 });
 }

 function updateDayPanel() {
 if (!gameState.started) return;

 const idiot = gameState.players.find(p => p.role === 'Idiot' && p._idiotRevealed && p.alive);
 if (idiot) {
 document.getElementById('idiotReminderPanel').style.display = 'block';
 document.getElementById('idiotReminderName').textContent = `(${idiot.name})`;
 } else {
 document.getElementById('idiotReminderPanel').style.display = 'none';
 }

 renderVoteGrid();
 renderDayActions();
 updateDayUndoButton();
 }

 function announceDeaths() {
 const allKills = gameState.nightKills || [];
 const announcement = document.getElementById('dayAnnouncementText');
 const title = document.getElementById('dayAnnouncementTitle');

 if (allKills.length > 0) {
 title.textContent = ' Pengumuman Kematian';
 let killNames = [];
 allKills.forEach(id => {
 const p = gameState.players.find(pl => pl.id === id);
 if (p && p.alive) {
 p.alive = false;
 p.eliminated = true;
 killNames.push(p.name);
 checkDoppelgangerInheritance(p);
 }
 });

 if (killNames.length > 0) {
 // BUG-06 FIX: Proses kematian couple cascade SEBELUM pengumuman dibuat.
 // Dengan demikian: Hunter cascade dari couple (setTimeout 300ms) terpicu
 // lebih dulu dan lebih awal dari Hunter korban langsung (setTimeout 400ms+),
 // sehingga urutan modal Hunter sudah benar dan terprediksable.
 killNames.forEach(n => checkCouplesDeath(n));

 announcement.innerHTML = `
 <strong style="color:var(--accent-red);">${killNames.map(name => escapeHtml(name)).join(' dan ')} ditemukan mati tadi malam.</strong>
 `;
 addLog('day', ` ${killNames.join(', ')} ditemukan meninggal malam ini.`);
 if (typeof pushGameStateToFirebase === 'function') pushGameStateToFirebase();
 pushMorningAnnouncementToPlayers(killNames);

 // Hunter mati di malam hari → buka modal tembak.
 // Hanya tangani Hunter korban LANGSUNG (killNames); Hunter dari couple cascade
 // sudah ditangani di dalam checkCouplesDeath di atas.
 const hunters = gameState.players.filter(p =>
 !p.alive && p.role === 'Hunter' && !p._hunterUsed && killNames.includes(p.name)
 );
 if (hunters.length > 0) {
 // Buka modal Hunter secara bertahap jika ada lebih dari satu.
 // Delay mulai dari 400ms agar muncul SETELAH cascade Hunter (300ms).
 let delay = 400;
 hunters.forEach(h => {
 setTimeout(() => {
 addLog('day', ` Hunter ${h.name} terbunuh malam ini! Dia sempat menembak sebelum mati.`);
 openHunterModal(h);
 }, delay);
 delay += 200; // jeda antar modal jika ada beberapa hunter
 });
 }
 }
 } else {
 title.textContent = ' Pengumuman Pagi';
 announcement.innerHTML = '<strong style="color:var(--accent-green);">Semua orang selamat malam ini! Tidak ada yang mati.</strong>';
 addLog('day', ' Semua orang selamat malam ini.');
 pushMorningAnnouncementToPlayers([]);
 }

 updateStats();
 renderPlayers();
 renderVoteGrid();
 checkWinCondition();

 gameState.nightKills = []; // Reset nightKills agar tidak diproses ganda
 }

 function pushMorningAnnouncementToPlayers(killNames) {
 if (typeof pushAnnouncement !== 'function') return;
 const publicNames = (killNames || []).filter(Boolean);
 const hasDeaths = publicNames.length > 0;
 pushAnnouncement(
 hasDeaths ? 'warning' : 'info',
 'Pengumuman Pagi',
 hasDeaths
 ? `${publicNames.join(' dan ')} ditemukan mati tadi malam.`
 : 'Tidak ada korban malam ini.',
 {
  event: 'morning',
  publicOnly: true,
  spoilerSafe: true,
  detail: hasDeaths ? (publicNames.length === 1 ? 'Ia adalah...' : 'Mereka adalah...') : 'Desa masih utuh pagi ini.',
  victimCount: publicNames.length
 }
 );
 }

 function checkDoppelgangerInheritance(deadPlayer) {
 // Passive: Wolf Cub (Jika mati di siang hari, serigala double kill malam harinya)
 if (deadPlayer.role === 'Wolf Cub' && gameState.phase === 'day') {
 gameState.wolfCubKilledThisDay = true;
 addLog('day', " Wolf Cub telah terbunuh siang ini! Kawanan Werewolf akan mengamuk dan membunuh 2 kali malam nanti.");
 showToast("Wolf Cub Terbunuh! Werewolf Mengamuk!", "warning");
 }

 // Passive: Hunters Apprentice (Mewarisi peran Hunter)
 if (deadPlayer.role === 'Hunter') {
 const apprentice = gameState.players.find(p => p.role === 'Hunters Apprentice' && p.alive);
 if (apprentice) {
 apprentice.role = 'Hunter';
 apprentice._hunterUsed = false;
 addLog('day', ` Hunters Apprentice memungut senjata Hunter yang gugur dan kini resmi menjadi Hunter!`);
 showToast("Apprentice menjadi Hunter!", "info");
 }
 }

 // Passive: Doppelganger
 if (gameState.doppelgangerTarget === String(deadPlayer.id)) {
 const dopp = gameState.players.find(p => p.role === 'Doppelganger');
 if (dopp && dopp.alive) {
 dopp.role = deadPlayer.role;
 dopp._wasDoppelganger = true;

 // LOGIC-06 FIX: Jika role yang diwarisi adalah tim Werewolf,
 // tambahkan Doppelganger ke wolfTeam untuk konsistensi state.
 // (Panel Dashboard sudah menggunakan ROLE_DEFINITIONS[p.role].team
 // sehingga tampilan sudah benar, ini hanya memperbaiki array tracking.)
 const inheritedDef = ROLE_DEFINITIONS[dopp.role];
 if (inheritedDef && inheritedDef.team === 'Werewolf') {
 if (!gameState.wolfTeam.includes(dopp.name)) {
 gameState.wolfTeam.push(dopp.name);
 }
 }

 // Reset state global agar Doppelganger bisa menggunakan role barunya seutuhnya (Witch, Veteran, Alpha)
 if (dopp.role === 'Veteran') {
 gameState.veteranAlertsLeft = 2;
 } else if (dopp.role === 'Witch') {
 gameState.witchPotions = { heal: true, poison: true };
 } else if (dopp.role === 'Alpha Wolf') {
 gameState._alphaAbilityUsed = false;
 gameState._alphaChoice = null;
 gameState._alphaRecruitDone = false;
 }
 addLog('day', ` Doppelganger (${dopp.name}) resmi mewarisi role ${deadPlayer.role} dari ${deadPlayer.name}!`);
 showToast(`Doppelganger terbangun sebagai ${deadPlayer.role}!`, 'info');
 gameState.doppelgangerTarget = null;
 }
 }
 }

 function openHunterModal(hunterPlayer) {
 const alivePlayers = gameState.players.filter(p => p.alive && p.id !== hunterPlayer.id);
 const select = document.getElementById('selectHunterTarget');
 select.innerHTML = '<option value="">-- Pilih Target Tembakan --</option>' + alivePlayers.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

 document.getElementById('hunterSourceId').value = hunterPlayer.id;
 document.getElementById('modalHunter').classList.add('active');
 document.body.style.overflow = 'hidden';
 }

 function processHunterShot() {
 if (isGameplayPaused()) return;
 const targetId = document.getElementById('selectHunterTarget').value;
 const hunterId = document.getElementById('hunterSourceId').value;

 if (!targetId) return showToast('Pilih target yang akan ditembak!', 'warning');

 const hunter = gameState.players.find(p => p.id == hunterId);
 const targetPlayer = gameState.players.find(p => p.id == targetId);

 if (hunter) hunter._hunterUsed = true;

 closeModal('modalHunter');

 if (targetPlayer && targetPlayer.alive) {
 targetPlayer.alive = false;
 targetPlayer.eliminated = true;
 gameState.eliminatedPlayers.push(targetPlayer.name);
 addLog('day', ` Hunter ${hunter ? hunter.name : ''} menembak mati ${targetPlayer.name} sebelum menghembuskan napas terakhir!`);
 showToast(`Hunter menembak ${targetPlayer.name}!`, 'error');
 checkCouplesDeath(targetPlayer.name);
 checkDoppelgangerInheritance(targetPlayer);
 }

 // Resume original elimination queue
 if (hunter) {
 if (hunter._pendingExecution) {
 hunter._pendingExecution = false;
 executePlayerActually(hunter);
 } else {
 finalizeElimination(hunter);
 }
 } else {
 updateStats();
 renderPlayers();
 renderVoteGrid();
 checkWinCondition();
 }
 }

 function cancelHunterShot() {
 const hunterId = document.getElementById('hunterSourceId').value;
 const hunter = gameState.players.find(p => p.id == hunterId);

 closeModal('modalHunter');
 addLog('day', ` Hunter ${hunter ? hunter.name : ''} menolak melepas tembakan dan mati dengan tenang.`);
 showToast('Tembakan Hunter dibatalkan.', 'info');

 // Resume original elimination queue
 if (hunter) {
 if (hunter._pendingExecution) {
 hunter._pendingExecution = false;
 executePlayerActually(hunter);
 } else {
 finalizeElimination(hunter);
 }
 } else {
 updateStats();
 renderPlayers();
 renderVoteGrid();
 checkWinCondition();
 }
 }


 function renderVoteGrid() {
 const grid = document.getElementById('voteGrid');
 if (!grid) return;
 const canVoteNow = !!(gameState.started && gameState.phase === 'day');
 const alivePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);
 const isOnlineVote = !!(onlineRoomCode && canVoteNow);
 const pauseLocked = isGameplayPaused(false);
 const showOnlineVoteBtn = document.getElementById('showOnlineVoteBtn');
 const saveOnlineVoteBtn = document.getElementById('saveOnlineVoteBtn');
 const startOnlineVoteBtn = document.getElementById('startOnlineVoteBtn');
 const onlineVoteOpen = !!(typeof isOnlineVotingOpenForCurrentDay === 'function' && isOnlineVotingOpenForCurrentDay());
 if (startOnlineVoteBtn) {
 startOnlineVoteBtn.style.display = isOnlineVote ? '' : 'none';
 startOnlineVoteBtn.disabled = onlineVoteOpen || pauseLocked;
 startOnlineVoteBtn.textContent = onlineVoteOpen ? 'Voting Dibuka' : 'Mulai Voting';
 startOnlineVoteBtn.title = pauseLocked ? 'Game sedang dijeda' : (onlineVoteOpen ? 'Voting sudah dibuka untuk pemain' : 'Buka voting untuk pemain');
 }
 if (showOnlineVoteBtn) showOnlineVoteBtn.style.display = isOnlineVote ? '' : 'none';
 if (saveOnlineVoteBtn) saveOnlineVoteBtn.style.display = isOnlineVote ? '' : 'none';

 if (!canVoteNow) {
 grid.innerHTML = '';
 renderVoteResults();
 renderOnlineVoteModeratorPanel();
 return;
 }

 grid.innerHTML = alivePlayers.map(p => {
 const voteCount = gameState.votes[p.name] || 0;
 // UI-01 FIX: isLeading hanya dari vote eligible players (hidup & tidak _idiotRevealed)
 // agar vote stale pemain mati tidak memengaruhi indikator 'terdepan'.
 const eligibleVotes = Object.entries(gameState.votes)
 .filter(([name, v]) => v > 0 && alivePlayers.some(pl => pl.name === name))
 .map(([, v]) => v);
 // UI-07 FIX: Gunakan array.reduce daripada Math.max(...array) untuk menghindari call stack size limit
 const maxEligibleVote = eligibleVotes.length > 0 ? eligibleVotes.reduce((max, curr) => Math.max(max, curr), 0) : 0;
 const isLeading = voteCount > 0 && voteCount === maxEligibleVote;
 const voteAttrs = pauseLocked
 ? `disabled title="Game sedang dijeda"`
 : `onclick="handleVoteClick(event,'${escapeJsString(p.id)}','${escapeJsString(p.name)}')" onpointerdown="startVoteLongPress(event,'${escapeJsString(p.id)}','${escapeJsString(p.name)}')" onpointerup="endVoteLongPress()" onpointercancel="endVoteLongPress()" onpointerleave="endVoteLongPress()" oncontextmenu="untapVote(event,'${escapeJsString(p.id)}','${escapeJsString(p.name)}')" title="${isOnlineVote ? 'Klik untuk tambah vote manual moderator. Klik kanan untuk kurangi. Di HP tahan 1 detik untuk hapus semua vote target ini.' : 'Klik untuk tambah vote. Klik kanan untuk kurangi. Di HP tahan 1 detik untuk hapus semua vote target ini.'}"`;
 return `
<div style="display:flex;align-items:center;justify-content:center;">
<button class="vote-btn${voteCount > 0 ? ' selected' : ''}" 
 ${voteAttrs}
 data-id="${p.id}" 
 style="width:100%;position:relative;${pauseLocked ? 'cursor:default;' : ''}${p.role === 'Mayor' && p._mayorRevealed ? 'border-color:var(--accent-gold);' : ''}${isLeading && voteCount > 0 ? 'border-color:var(--accent-red);box-shadow:0 0 10px rgba(239,68,68,0.4);' : ''}">
 ${escapeHtml(p.name)}
 ${voteCount > 0 ? `<span style="position:absolute;top:4px;right:6px;background:var(--accent-red);color:#fff;border-radius:50%;width:20px;height:20px;font-size:0.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;">${voteCount}</span>` : ''}
</button>
</div>
`;
 }).join('');

 // BUG-19 FIX: Tampilkan peringatan jika ada suara yang jatuh ke pemain mati/tidak berhak.
 const deadVotes = Object.entries(gameState.votes)
 .filter(([name, count]) => count > 0 && !alivePlayers.some(p => p.name === name));

 if (deadVotes.length > 0) {
 const deadVoteHtml = deadVotes.map(([name, count]) =>
 `<span style="margin-right:8px"> <strong>${escapeHtml(name)}</strong>: ${count} suara</span>`
 ).join('');
 grid.innerHTML += `
<div style="grid-column:1/-1;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.08);border:1px dashed rgba(239,68,68,0.4);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--accent-red);">
 <strong>Suara tidak sah</strong> — diberikan ke pemain yang sudah mati (abaikan):
 <div style="margin-top:4px;color:var(--text-secondary);">${deadVoteHtml}</div>
</div>`;
 }

 renderOnlineVoteModeratorPanel();
 }


 let voteLongPressTimer = null;
 let voteLongPressSuppressUntil = 0;

 function startVoteLongPress(event, id, name) {
 if (isGameplayPaused(false)) return;
 if (event?.pointerType === 'mouse') return;
 endVoteLongPress();
 if (event?.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
 try {
 event.currentTarget.setPointerCapture(event.pointerId);
 } catch (err) {
 // Pointer capture can fail on older mobile browsers; the timer still works.
 }
 }
 voteLongPressTimer = setTimeout(() => {
 voteLongPressSuppressUntil = Date.now() + 800;
 clearVotesForTarget(id, name);
 }, 1000);
 }

 function endVoteLongPress() {
 if (voteLongPressTimer) {
 clearTimeout(voteLongPressTimer);
 voteLongPressTimer = null;
 }
 }

 function handleVoteClick(event, id, name) {
 if (Date.now() < voteLongPressSuppressUntil) {
 event?.preventDefault?.();
 return;
 }
 tapVote(id, name);
 }

 function tapVote(id, name) {
 if (isGameplayPaused()) return;
 if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa dilakukan saat fase siang.', 'warning');
 if (onlineRoomCode && gameState.started && gameState.phase === 'day') {
 adjustOnlineManualVote(id, 1);
 return;
 }
 if (!gameState.votes[name]) gameState.votes[name] = 0;
 gameState.votes[name]++;
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 }

 function clearVotesForTarget(id, name) {
 if (isGameplayPaused()) return;
 if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa diubah saat fase siang.', 'warning');
 if (onlineRoomCode && gameState.started && gameState.phase === 'day') {
 clearOnlineVotesForTarget(id, name);
 return;
 }
 if (!gameState.votes[name] || gameState.votes[name] <= 0) return;
 delete gameState.votes[name];
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 showToast(`Semua vote untuk ${name} dihapus.`, 'info');
 }

 function untapVote(event, id, name) {
 event.preventDefault();
 if (isGameplayPaused()) return;
 if (!gameState.started || gameState.phase !== 'day') return showToast('Voting hanya bisa diubah saat fase siang.', 'warning');
 if (onlineRoomCode && gameState.started && gameState.phase === 'day') {
 adjustOnlineManualVote(id, -1);
 return;
 }
 if (!gameState.votes[name] || gameState.votes[name] <= 0) return;
 gameState.votes[name]--;
 if (gameState.votes[name] <= 0) delete gameState.votes[name];
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 }

 function clearOnlineVotesForTarget(targetId, name) {
 if (!targetId) return;
 const dayKey = String(gameState.day);
 let changed = false;

 if (gameState.onlineManualVotes?.[dayKey]?.[targetId]) {
 delete gameState.onlineManualVotes[dayKey][targetId];
 if (Object.keys(gameState.onlineManualVotes[dayKey]).length === 0) delete gameState.onlineManualVotes[dayKey];
 changed = true;
 }

 const dayVotes = onlineVotesCache?.[dayKey] || {};
 const removals = [];
 Object.entries(dayVotes).forEach(([voterId, ballot]) => {
 if (String(ballot?.targetId) === String(targetId)) {
 delete dayVotes[voterId];
 removals.push(String(voterId));
 changed = true;
 }
 });

 const finish = () => {
 if (typeof buildOnlineVoteSnapshot === 'function') {
 const snapshot = buildOnlineVoteSnapshot();
 gameState.votes = snapshot.tally;
 if (typeof pushVoteSummaryToFirebase === 'function') pushVoteSummaryToFirebase(snapshot);
 }
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 if (changed) showToast(`Semua vote untuk ${name} dihapus.`, 'info');
 };

 if (removals.length && typeof db !== 'undefined' && onlineRoomCode) {
 Promise.all(removals.map(voterId => db.ref(`rooms/${onlineRoomCode}/votes/${dayKey}/${voterId}`).remove()))
 .catch(err => showToast('Gagal menghapus sebagian vote online: ' + err.message, 'error'))
 .finally(finish);
 return;
 }

 finish();
 }

 function adjustOnlineManualVote(targetId, delta) {
 if (!targetId) return;
 if (!gameState.onlineManualVotes) gameState.onlineManualVotes = {};
 const dayKey = String(gameState.day);
 if (!gameState.onlineManualVotes[dayKey]) gameState.onlineManualVotes[dayKey] = {};
 const bucket = gameState.onlineManualVotes[dayKey];
 const current = Number(bucket[targetId]) || 0;
 const next = Math.max(0, current + delta);

 if (next > 0) {
 bucket[targetId] = next;
 } else {
 delete bucket[targetId];
 }
 if (Object.keys(bucket).length === 0) delete gameState.onlineManualVotes[dayKey];

 if (typeof buildOnlineVoteSnapshot === 'function') {
 const snapshot = buildOnlineVoteSnapshot();
 gameState.votes = snapshot.tally;
 if (typeof pushVoteSummaryToFirebase === 'function') pushVoteSummaryToFirebase(snapshot);
 }
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 }


 function renderVoteResults() {
 const container = document.getElementById('voteResults');
 if (!container) return;
 if (!gameState.started || gameState.phase !== 'day') {
 container.innerHTML = '';
 renderOnlineVoteModeratorPanel();
 return;
 }
 // UI-01 FIX: Filter hanya vote untuk pemain yang masih hidup dan berhak divote.
 // Mencegah nama pemain mati (misal korban Sheriff) muncul di panel hasil vote.
 const eligiblePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);
 const entries = Object.entries(gameState.votes)
 .filter(([name, count]) => count > 0 && eligiblePlayers.some(p => p.name === name))
 .sort((a, b) => b[1] - a[1]);

 if (entries.length === 0) {
 container.innerHTML = '';
 renderOnlineVoteModeratorPanel();
 return;
 }

 container.innerHTML = entries.map(([name, count]) => `
<div class="vote-result-item">
<span>${name}</span>
<span class="vote-result-count">${count} vote${count > 1 ? 's' : ''}</span>
</div>
`).join('');
 renderOnlineVoteModeratorPanel();
 }

 function renderOnlineVoteModeratorPanel() {
 const panel = document.getElementById('onlineVoteModeratorPanel');
 if (!panel) return;

 const isOnlineVote = !!(onlineRoomCode && gameState.started && gameState.phase === 'day');
 if (!isOnlineVote || typeof buildOnlineVoteSnapshot !== 'function') {
 panel.style.display = 'none';
 panel.innerHTML = '';
 return;
 }

 const snapshot = buildOnlineVoteSnapshot();
 const onlineVoteOpen = !!(typeof isOnlineVotingOpenForCurrentDay === 'function' && isOnlineVotingOpenForCurrentDay());
 panel.style.display = 'block';
 const ballotsHtml = snapshot.ballots.length
 ? snapshot.ballots.map(v => `
<div class="vote-result-item">
 <span>${escapeHtml(v.voterName)}</span>
 <span style="color:var(--text-secondary);">pilih <strong style="color:var(--accent-gold);">${escapeHtml(v.targetName)}</strong>${v.weight > 1 ? ` (${v.weight} suara)` : ''}</span>
</div>`).join('')
 : '<div style="font-size:0.82rem;color:var(--text-muted);">Belum ada pemain yang vote.</div>';
 const manualHtml = snapshot.manualBallots?.length
 ? `
 <div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted);">Vote manual moderator:</div>
 <div style="display:grid;gap:8px;margin-top:6px;">
 ${snapshot.manualBallots.map(v => `
 <div class="vote-result-item">
  <span>${escapeHtml(v.targetName)}</span>
  <span style="color:var(--accent-gold);font-weight:700;">+${v.count} vote</span>
 </div>`).join('')}
 </div>`
 : '';
 const missingHtml = snapshot.missing.length
 ? snapshot.missing.map(p => `<span style="display:inline-block;margin:4px 6px 0 0;padding:4px 8px;border-radius:999px;background:rgba(239,68,68,0.1);color:var(--accent-red);font-size:0.78rem;">${escapeHtml(p.name)}</span>`).join('')
 : '<span style="color:var(--accent-green);font-weight:700;">Semua pemain aktif sudah vote.</span>';

 panel.innerHTML = `
<div style="padding:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);">
 <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;">
 <strong style="color:var(--accent-gold);">Monitor Vote Online${onlineVoteOpen ? '' : ' (Belum Dibuka)'}</strong>
 <span style="font-size:0.8rem;color:var(--text-secondary);">${snapshot.votedCount}/${snapshot.totalVoters} sudah vote</span>
 </div>
 ${onlineVoteOpen ? '' : '<div style="margin-bottom:10px;font-size:0.82rem;color:var(--text-muted);">Pemain belum bisa voting. Tekan <strong style="color:var(--accent-gold);">Mulai Voting</strong> saat diskusi selesai.</div>'}
 <div style="display:grid;gap:8px;">${ballotsHtml}</div>
 ${manualHtml}
 <div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted);">Belum vote:</div>
 <div>${missingHtml}</div>
</div>`;
 }

 function resetVotes(options = {}) {
 if (isGameplayPaused()) return;
 gameState.votes = {};
 if (gameState.onlineManualVotes) delete gameState.onlineManualVotes[gameState.day];
 if (typeof clearOnlineVotesForCurrentDay === 'function') {
 clearOnlineVotesForCurrentDay({ keepClosed: !!options.keepOnlineVoteClosed });
 }
 document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('selected'));
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 if (!gameState.started || gameState.phase !== 'day') return showToast('Voting belum aktif karena game belum masuk fase siang.', 'warning');
 showToast('Vote direset.', 'info');
 }

 function resetVotesAfterExecution() {
 if (isGameplayPaused()) return;
 resetVotes({ keepOnlineVoteClosed: true });
 if (typeof closeOnlineVotingForCurrentDay === 'function') {
 closeOnlineVotingForCurrentDay();
 }
 renderVoteGrid();
 renderVoteResults();
 if (typeof saveState === 'function') saveState();
 }

 function eliminatePlayer() {
 if (isGameplayPaused()) return;
 if (!gameState.started || gameState.phase !== 'day') return showToast('Eksekusi hanya bisa dilakukan saat fase siang.', 'warning');
 // Filter vote hanya untuk pemain yang MASIH HIDUP dan berhak divote.
 // Mencegah "zombie vote": vote lama untuk pemain mati (misal korban malam)
 // tidak sengaja memenangkan voting dan mengeksekusi pemain yang sudah mati.
 const eligiblePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);
 const entries = Object.entries(gameState.votes)
 .filter(([name, count]) => count > 0 && eligiblePlayers.some(p => p.name === name));
 if (entries.length === 0) return showToast('Tidak ada vote!', 'warning');

 // Find the player with most votes
 const maxVotes = Math.max(...entries.map(([, c]) => c));
 const tied = entries.filter(([, c]) => c === maxVotes);

 if (tied.length > 1) {
 return showToast(`Vote seri! ${tied.map(([n]) => n).join(', ')} sama-sama ${maxVotes} vote.`, 'warning');
 }

 const [targetName] = tied[0];
 let player = gameState.players.find(p => p.name === targetName);

 if (!player) return;
 captureDayExecutionSnapshot(`Eksekusi ${player.name}`);

 // Jester tidak perlu shortcut endGame di sini. 
 // Ia akan dieksekusi normal dan terdeteksi menang lewat checkWinCondition().

 // Check Idiot
 if (player.role === 'Idiot' && !player._idiotRevealed) {
 player._idiotRevealed = true;
 showToast(`${player.name} adalah Idiot! Dia batal dieksekusi dan kehilangan hak vote-nya selamanya.`, 'info');
 addLog('day', ` ${player.name} adalah Idiot! Dieksekusi tapi selamat. Dia kehilangan hak suaranya dalam rapat.`);
 resetVotesAfterExecution(); // Tutup voting hari ini agar tidak muncul lagi di konsol pemain.
 return;
 }

 // Check Prince (first time only)
 if (player.role === 'Prince' && !player._princeUsed) {
 player._princeUsed = true;
 showToast(`${player.name} adalah Prince! Tidak mati, tapi role terungkap.`, 'info');
 addLog('day', ` ${player.name} divote mati tapi karena dia adalah Prince, maka dia tidak mati. Role terungkap.`);
 resetVotesAfterExecution(); // Tutup voting hari ini agar tidak muncul lagi di konsol pemain.
 return;
 }


 // Check Martyr survival replacement FIRST
 const martyr = gameState.players.find(p => p.role === 'Martyr' && p.alive && !p._martyrUsed);
 if (martyr && martyr.id !== player.id) {
 showConfirm(
 'Pengorbanan Martyr?',
 `Pemain ${escapeHtml(player.name)} akan dieksekusi. Apakah letnan Martyr (${escapeHtml(martyr.name)}) ingin mengorbankan diri menggantikannya?`,
 'Martyr Berkorban',
 true,
 () => {
 martyr._martyrUsed = true;
 showToast(`Martyr berkorban! ${player.name} selamat.`, 'info');
 addLog('day', ` Martyr ${martyr.name} mengorbankan diri di tiang gantungan untuk menyelamatkan ${player.name}!`);
 resetVotesAfterExecution();
 continueElimination(martyr);
 },
 () => {
 continueElimination(player);
 }
 );
 return;
 }

 continueElimination(player);

 function continueElimination(executionTarget) {
 // Handle Hunter death
 if (executionTarget.role === 'Hunter' && !executionTarget._hunterUsed) {
 showToast(`${executionTarget.name} adalah Hunter! Dia harus menembak sebelum mati.`, 'warning');
 addLog('day', ` Hunter ${executionTarget.name} mulai diusir... namun dia menarik pelatuknya sebelum digantung!`);
 executionTarget._pendingExecution = true;
 return openHunterModal(executionTarget);
 }

 executePlayerActually(executionTarget);
 }
 }

 function executePlayerActually(player) {
 player.alive = false;
 player.eliminated = true;
 player.killedByVote = true; // mati karena voting siang hari
 gameState.eliminatedPlayers.push(player.name);
 gameState._lastDayExecuted = player.name; // BUG-07 FIX
 addLog('day', ` ${player.name} (${player.role || '???'}) diusir dan mati di tiang gantungan.`);
 if (typeof pushAnnouncement === 'function') {
 pushAnnouncement(
 'warning',
 'Pengumuman Eksekusi',
 `${player.name} dieksekusi oleh warga.`,
 {
 event: 'dayExecution',
 publicOnly: true,
 spoilerSafe: true,
 detail: `Hari ke-${gameState.day}: eksekusi terjadi karena hasil voting warga.`,
 victimCount: 1
 }
 );
 }

 finalizeElimination(player);
 }

 function finalizeElimination(player) {
 checkCouplesDeath(player.name);
 checkDoppelgangerInheritance(player);

 updateStats();
 renderPlayers();
 renderVoteGrid();
 resetVotesAfterExecution();
 checkWinCondition();

 showToast(`${player.name} telah tewas/dieliminasi!`, 'success');
 }

 function checkCouplesDeath(deadName) {
 const deadPlayer = gameState.players.find(p => p.name === deadName);
 if (!deadPlayer) return;
 const deadId = String(deadPlayer.id);

 // Guard: cegah re-entrancy jika sedang diproses (cascade protection)
 if (gameState._processingCouples) return;
 gameState._processingCouples = true;

 try {
 // BFS queue: proses cascade kematian pasangan secara bertahap, tidak rekursif
 const queue = [deadId];
 const processedThisCycle = new Set([deadId]);

 while (queue.length > 0) {
 const currentDeadId = queue.shift();

 gameState.couples.forEach(couple => {
 if (!couple.includes(currentDeadId)) return;

 const otherId = couple.find(id => id !== currentDeadId);
 if (!otherId || processedThisCycle.has(otherId)) return;

 const otherPlayer = gameState.players.find(p => String(p.id) === otherId);
 if (!otherPlayer || !otherPlayer.alive) return;

 otherPlayer.alive = false;
 otherPlayer.eliminated = true;
 gameState.eliminatedPlayers.push(otherPlayer.name);

 const currentDeadPlayer = gameState.players.find(p => String(p.id) === currentDeadId);
 const currentDeadName = currentDeadPlayer ? currentDeadPlayer.name : '?';

 addLog('day', `${otherPlayer.name} (pasangan ${currentDeadName}) ikut mati karena cinta.`);
 showToast(`${otherPlayer.name} ikut mati karena cinta!`, 'error');

 processedThisCycle.add(otherId);
 queue.push(otherId);

 // Tangani Hunter couple death
 if (otherPlayer.role === 'Hunter' && !otherPlayer._hunterUsed) {
 addLog('day', `Hunter ${otherPlayer.name} ikut mati karena cinta... namun sempat menembak!`);
 setTimeout(() => openHunterModal(otherPlayer), 300);
 }

 // Doppelganger inheritance
 checkDoppelgangerInheritance(otherPlayer);
 });
 }

 // Bersihkan couple yang sudah tidak lengkap
 gameState.couples = gameState.couples.filter(c =>
 c.every(id => gameState.players.find(p => String(p.id) === id)?.alive)
 );

 updateTeamStatusPanel();
 } finally {
 gameState._processingCouples = false;
 }
 }


 function checkWinCondition() {
 // LOGIC-03 FIX: Jika sudah ada pemenang, jangan proses ulang kondisi menang.
 // Tanpa guard ini, checkWinCondition() yang dipanggil dari berbagai tempat
 // (announceDeaths, finalizeElimination, dll.) akan men-trigger endGame() berulang kali
 // — termasuk killedByVote Jester yang tetap ada di state setelah game selesai.
 if (gameState.winner) return;

 const alivePlayers = gameState.players.filter(p => p.alive);
 const aliveWolves = alivePlayers.filter(p => {
 const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
 return def && def.team === 'Werewolf';
 });
 const aliveVillagers = alivePlayers.filter(p => {
 const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
 return def && def.team === 'Villager';
 });
 const aliveNeutrals = alivePlayers.filter(p => {
 const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
 return def && def.team === 'Neutral';
 });

 // Check Jester win — hanya menang jika mati karena voting siang,
 // BUKAN karena dibunuh serigala atau aksi malam lainnya
 const jester = gameState.players.find(p => p.role === 'Jester' && !p.alive && p.killedByVote);
 if (jester) {
 endGame(' JESTER MENANG!', `${jester.name} berhasil diusir lewat voting dan memenangkan permainan!`);
 return;
 }

 // Check Bounty Hunter Win
 const bountyHunter = alivePlayers.find(p => p.role === 'Bounty Hunter');
 if (bountyHunter && gameState.bountyHunterTarget) {
 const bhTarget = gameState.players.find(p => p.id === gameState.bountyHunterTarget);
 if (bhTarget && !bhTarget.alive && bhTarget.killedByVote) {
 endGame(' BOUNTY HUNTER MENANG!', `Bounty Hunter ${bountyHunter.name} berhasil memprovokasi desa untuk mengeksekusi target utamanya!`);
 return;
 }
 }

 // Check Draw (Semua mati karena serangan silang/bodyguard/veteran)
 if (alivePlayers.length === 0) {
 endGame(' SEMUA MATI (DRAW)', 'Tidak ada seorang pun yang selamat di desa ini...');
 return;
 }

 const aliveArsonists = alivePlayers.filter(p => p.role === 'Arsonist');
 if (alivePlayers.length === 1 && aliveArsonists.length === 1) {
 endGame(' ARSONIST MENANG!', `Arsonist ${aliveArsonists[0].name} menjadi satu-satunya pemain yang masih hidup.`);
 return;
 }

 // Check Lovers Win (Faksi ketiga)
 // Syarat: Minimal ada 1 pasangan yang hidup, dan SELURUH pemain sisa adalah bagian dari pasangan atau Cupid.
 if (gameState.couples && gameState.couples.length > 0) {
 const loversFactionIds = new Set();
 gameState.couples.forEach(c => c.forEach(id => loversFactionIds.add(String(id))));
 alivePlayers.forEach(p => {
 if (p.role === 'Cupid') loversFactionIds.add(String(p.id));
 });

 const allAliveAreLovers = aliveArsonists.length === 0 && alivePlayers.every(p => loversFactionIds.has(String(p.id)));
 if (allAliveAreLovers) {
 let text = `Kekuatan abadi cinta mengalahkan segalanya! Cupid beserta pasangannya sukses bertahan hingga akhir.`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor');
 if (survivor) text += ` Survivor (${survivor.name}) juga ikut memenangkan pertandingan.`;
 endGame(' FAKSI LOVERS MENANG!', text);
 return;
 }
 }

 // Check Cult Leader Win
 const cultLeader = alivePlayers.find(p => p.role === 'Cult Leader');
 if (cultLeader) {
 const allAliveInCult = alivePlayers.every(p => gameState.cultMembers.includes(String(p.id)));
 if (allAliveInCult) {
 let text = `Seluruh penduduk desa yang tersisa telah tunduk dan bergabung dengan sekte gelap Cult Leader!`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor' && !gameState.cultMembers.includes(String(p.id)));
 if (survivor) text += ` Survivor (${survivor.name}) yang tersisa juga ikut menang.`;
 endGame(' CULT LEADER MENANG!', text);
 return;
 }
 }

 // Check Serial Killer win
 const aliveSK = alivePlayers.filter(p => p.role === 'Serial Killer');
 const aliveVampire = alivePlayers.filter(p => p.role === 'Vampire');
 if (aliveSK.length > 0 && alivePlayers.length <= aliveSK.length + 1 && aliveWolves.length === 0 && aliveVampire.length === 0 && aliveArsonists.length === 0) {
 let text = `Tinggal tersisa dengan 1 orang (atau sendirian), Serial Killer tidak dapat dihentikan lagi!`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor');
 if (survivor) text += ` Survivor (${survivor.name}) berhasil hidup hingga akhir dan ikut memenangkan permainan.`;
 endGame(' SERIAL KILLER MENANG!', text);
 return;
 }

 // Check Vampire Win
 if (aliveVampire.length > 0 && alivePlayers.length <= aliveVampire.length + 1 && aliveWolves.length === 0 && aliveSK.length === 0 && aliveArsonists.length === 0) {
 let text = `Vampir telah menguasai dan menghisap habis seluruh penduduk desa!`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor');
 if (survivor) text += ` Survivor (${survivor.name}) ikut memenangkan pertandingan berdampingan dengan Vampir.`;
 endGame(' VAMPIRE MENANG!', text);
 return;
 }

 // Wolf win: wolves >= non-wolves
 if (aliveWolves.length > 0 && aliveWolves.length >= alivePlayers.length - aliveWolves.length) {
 let text = `Tim serigala (${aliveWolves.map(p => p.name).join(', ')}) mendominasi!`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor');
 if (survivor) text += ` Survivor (${survivor.name}) membuktikan insting bertahannya dan ikut menang.`;
 endGame(' WEREWOLF MENANG!', text);
 return;
 }

 // Villager win: all wolves dead AND all SKs dead AND all Vampires dead AND Cult Leader dead AND at least one villager alive
 const aliveCultLeader = alivePlayers.filter(p => p.role === 'Cult Leader');
 if (aliveWolves.length === 0 && aliveSK.length === 0 && aliveVampire.length === 0 && aliveArsonists.length === 0 && aliveCultLeader.length === 0 && aliveVillagers.length > 0) {
 // Pastikan Cult Leader tidak sendirian menguasai kota, dicek oleh kondisi sebelumnya
 let text = `Semua ancaman telah dikalahkan! Desa kini damai dan Warga berhasil menang.`;
 const survivor = alivePlayers.find(p => p.role === 'Survivor');
 if (survivor) text += ` Survivor (${survivor.name}) merayakan kemenangan bersama warga.`;
 endGame(' VILLAGER MENANG!', text);
 return;
 }

 // Cupid lone survivor but lovers are dead (or no lovers made) -> Cupid loses, game Over (Draw)
 const aliveCupid = alivePlayers.filter(p => p.role === 'Cupid');
 if (aliveWolves.length === 0 && aliveSK.length === 0 && aliveVampire.length === 0 && aliveArsonists.length === 0 && aliveVillagers.length === 0 && aliveCupid.length > 0) {
 endGame(' GAME OVER (CUPID KALAH)', `Semua pemain telah mati kecuali Cupid! Namun karena pasangannya juga telah tiada, kisah cinta ini berakhir tragis tanpa pemenang.`);
 return;
 }
 }

 function endGame(title, subtitle) {
 gameState.winner = title;
 document.getElementById('gameOverSection').style.display = 'block';
 const gameOverIcon = document.getElementById('gameOverIcon');
 if (gameOverIcon) {
 gameOverIcon.innerHTML = '<i data-lucide="trophy" aria-hidden="true"></i>';
 hydrateWerewolfIcons(gameOverIcon);
 }
 document.getElementById('gameOverTitle').textContent = title;
 document.getElementById('gameOverSubtitle').textContent = subtitle;

 addLog('day', ` ${title} - ${subtitle}`);
 if (typeof saveGameHistory === 'function') saveGameHistory(title, subtitle);
 if (typeof pushAnnouncement === 'function') pushAnnouncement('success', title, subtitle);
 showToast(title, 'success');
 }

 // ==================== LOG ====================
