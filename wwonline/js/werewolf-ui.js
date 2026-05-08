        function addLog(phase, message) {
            const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const timestamp = Date.now();
            const logEntry = { phase, message, time, day: gameState.day, timestamp };

            if (phase === 'night') gameState.nightLog.push(logEntry);
            else gameState.dayLog.push(logEntry);

            renderLog();
        }

        function renderLog() {
            const container = document.getElementById('logContainer');
            const allLogs = [...gameState.nightLog, ...gameState.dayLog].sort((a, b) => {
                // Prioritaskan urutan waktu aktual agar event terurut 100% berdasarkan kronologi terjadinya
                if (a.timestamp !== undefined && b.timestamp !== undefined) return a.timestamp - b.timestamp;
                if (a.day !== b.day) return a.day - b.day;
                if (a.phase !== b.phase) return a.phase === 'night' ? -1 : 1;
                return 0;
            });

            if (allLogs.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">Belum ada log.</div></div>';
                return;
            }

            container.innerHTML = allLogs.map(log => `
<div class="log-entry">
<div class="log-time">${log.time}</div>
<div class="log-content">
<span class="log-phase ${log.phase}">${log.phase === 'night' ? '🌙 Malam' : '☀️ Siang'}</span>
<div class="log-message">${escapeHtml(log.message)}</div>
</div>
</div>
`).join('');

            container.scrollTop = container.scrollHeight;
        }

        function clearLog() {
            showConfirm('Bersihkan Log', 'Bersihkan semua log?', 'Bersihkan', true, () => {
                gameState.nightLog = [];
                gameState.dayLog = [];
                renderLog();
            });
        }

        function exportLog() {
            const allLogs = [...gameState.nightLog, ...gameState.dayLog];
            const text = allLogs.map(l => `[${l.time}] ${l.phase === 'night' ? '🌙' : '☀️'} ${l.message}`).join('\n');

            // UI-08 FIX: Fallback aman jika navigator.clipboard tidak tersedia (misal di HTTP local non-HTTPS)
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text)
                    .then(() => showToast('Log disalin ke clipboard!', 'success'))
                    .catch(() => fallbackCopyTextToClipboard(text));
            } else {
                fallbackCopyTextToClipboard(text);
            }
        }

        function fallbackCopyTextToClipboard(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '-99999px';
            textArea.style.left = '-99999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) showToast('Log disalin ke clipboard! (Fallback)', 'success');
                else showToast('Gagal menyalin log!', 'error');
            } catch (err) {
                showToast('Gagal menyalin log! Coba block manual.', 'error');
            }
            document.body.removeChild(textArea);
        }

        // ==================== STATS & PANELS ====================
        function updateStats() {
            const alive = gameState.players.filter(p => p.alive).length;
            const dead = gameState.players.filter(p => !p.alive).length;

            document.getElementById('statTotal').textContent = gameState.players.length;
            document.getElementById('statAlive').textContent = alive;
            document.getElementById('statDead').textContent = dead;
            document.getElementById('statDay').textContent = gameState.day;

            updateTeamStatusPanel();
            saveState();
        }

        function updateTeamStatusPanel() {
            const panel = document.getElementById('teamStatusPanel');
            const body = document.getElementById('teamStatusBody');
            if (!panel || !body) return;

            if (!gameState.started) {
                panel.style.display = 'none';
                return;
            }

            const allPlayers = gameState.players;
            if (allPlayers.length === 0) {
                panel.style.display = 'none';
                return;
            }

            // Build quick-lookup sets
            const cultSet = new Set((gameState.cultMembers || []).map(String));
            const coupleSet = new Set((gameState.couples || []).flat().map(String));

            // Helper: get couple partner name(s) for a player
            const getPartners = (pid) => {
                const pair = (gameState.couples || []).find(c => c.some(id => String(id) === String(pid)));
                if (!pair) return null;
                return pair
                    .filter(id => String(id) !== String(pid))
                    .map(id => escapeHtml(gameState.players.find(p => String(p.id) === String(id))?.name || '?'))
                    .join(' & ');
            };

            // Determine effective team for each player (alive & dead)
            const groups = {
                wolf: [],
                village: [],
                cult: [],
                neutral: [],
            };

            allPlayers.forEach(p => {
                const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
                const team = def ? def.team : 'Villager';
                const pid = String(p.id);

                // Cult members (including Cult Leader) → always in cult group
                if (cultSet.has(pid)) {
                    groups.cult.push(p);
                    return;
                }

                if (team === 'Werewolf') {
                    groups.wolf.push(p);
                } else if (team === 'Neutral') {
                    groups.neutral.push(p);
                } else {
                    groups.village.push(p);
                }
            });

            const teamDefs = [
                { key: 'wolf', label: '🐺 Tim Serigala', headerClass: 'team-wolf', badgeClass: 'wolf-badge', icon: '🐺' },
                { key: 'village', label: '🏠 Tim Warga', headerClass: 'team-village', badgeClass: 'village-badge', icon: '👥' },
                { key: 'neutral', label: '⚖️ Netral', headerClass: 'team-neutral', badgeClass: 'neutral-badge', icon: '🌟' },
                { key: 'cult', label: '🔮 Sekte', headerClass: 'team-cult', badgeClass: 'cult-badge', icon: '🔮' },
            ];

            let html = '';

            teamDefs.forEach(({ key, label, headerClass, badgeClass, icon }) => {
                const members = groups[key];
                if (members.length === 0) return;

                // Sort: alive first, then dead
                const sorted = [...members].sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0));
                const aliveCount = members.filter(p => p.alive).length;

                html += `<div class="team-group">`;
                html += `<div class="team-group-header ${headerClass}">${label}<span class="team-group-count">${aliveCount}/${members.length} hidup</span></div>`;

                sorted.forEach(p => {
                    const def = p.role ? ROLE_DEFINITIONS[p.role] : null;
                    const roleLabel = def ? `${def.icon} ${p.role}` : p.role || '?';
                    const isDead = !p.alive;
                    const rowIcon = isDead ? '💀' : icon;
                    const nameStyle = isDead ? 'text-decoration:line-through;opacity:0.45;' : '';
                    const rowOpacity = isDead ? 'opacity:0.6;' : '';
                    const extras = [];

                    // Badge Pasangan Cupid (only for alive members to keep it clean)
                    if (!isDead && coupleSet.has(String(p.id))) {
                        const partner = getPartners(p.id);
                        extras.push(`<span class="team-player-role couple-badge">💕${partner ? ' &amp; ' + partner : ''}</span>`);
                    }

                    html += `
<div class="team-player-row" style="${rowOpacity}">
    <span class="team-player-icon">${rowIcon}</span>
    <span class="team-player-name" style="${nameStyle}">${escapeHtml(p.name)}</span>
    <span class="team-player-role ${badgeClass}" style="${isDead ? 'opacity:0.5;' : ''}">${roleLabel}</span>
    <div class="team-player-extras">${extras.join('')}</div>
</div>`;
                });

                html += `</div>`;
            });

            // Pasangan Cupid summary
            if (gameState.couples && gameState.couples.length > 0) {
                html += `<div class="team-group">`;
                html += `<div class="team-group-header team-couple">💕 Pasangan Cupid<span class="team-group-count">${gameState.couples.length} pasang</span></div>`;
                gameState.couples.forEach(couple => {
                    const parts = couple.map(id => {
                        const pl = gameState.players.find(p => String(p.id) === String(id));
                        if (!pl) return '?';
                        const nameStr = escapeHtml(pl.name);
                        return pl.alive ? nameStr : `<span style="text-decoration:line-through;opacity:0.5;">💀 ${nameStr}</span>`;
                    });
                    html += `
<div class="team-player-row">
    <span class="team-player-icon">💕</span>
    <span class="team-player-name">${parts.join(' ❤️ ')}</span>
</div>`;
                });
                html += `</div>`;
            }

            body.innerHTML = html;
            panel.style.display = 'block';
        }

        // ==================== ROLE REFERENCE ====================
        function renderRoleReference() {
            const container = document.getElementById('roleReference');

            const grouped = {
                '🐺 Tim Werewolf': ['Werewolf', 'Alpha Wolf', 'Wolf Cub', 'Lone Wolf', 'Minion', 'Sorcerer', 'Infector', 'White Wolf'],
                '🔮 Investigasi & Deteksi': ['Seer', 'Apprentice Seer', 'Aura Seer', 'Tracker', 'Sheriff', 'Priest', 'Little Girl', 'Gravedigger'],
                '🛡️ Pertahanan & Gangguan': ['Guardian', 'Bodyguard', 'Tough Guy', 'Veteran', 'Witch', 'Wizard', 'Tavern Keeper', 'Martyr'],
                '🏛️ Warga Tambahan': ['Mayor', 'Hunter', 'Hunters Apprentice', 'Drunk', 'Lycan', 'Cursed', 'Mason 1', 'Mason 2'],
                '🎭 Netral & Faksi Baru': ['Cult Leader', 'Vampire', 'Serial Killer', 'Survivor', 'Bounty Hunter', 'Amnesiac', 'Jester', 'Cupid', 'Doppelganger', 'Idiot', 'Prince', 'Thief', 'Troublemaker'],
                '👥 Warga Biasa': ['Villager']
            };

            let html = '';
            Object.entries(grouped).forEach(([category, roles]) => {
                html += `<h3 style="margin:24px 0 12px; color:var(--text-primary); text-shadow: 0 1px 3px rgba(0,0,0,0.5); font-family: 'Cinzel', serif;">${category}</h3>`;
                html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">`;
                roles.forEach(role => {
                    const def = ROLE_DEFINITIONS[role];
                    html += `
<div class="help-card">
<div class="help-card-header">
<span class="help-card-icon">${def.icon}</span>
<div>
<div class="help-card-title">${role}</div>
<div style="font-size:0.78rem;color:var(--text-muted);font-style:italic;margin-top:2px;">${def.name}</div>
<span class="help-card-team badge badge-${def.category}">${def.team}</span>
</div>
</div>
<div class="help-card-body">
${def.description}
</div>
</div>
`;
                });
                html += `</div>`;
            });

            container.innerHTML = html;
        }

        // ==================== MODALS ====================
        function openModal(id) {
            document.getElementById(id).classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
            document.body.style.overflow = '';
        }

        function showConfirm(title, message, okText, isDanger, callback, cancelCallback = null) {
            document.getElementById('modalConfirmTitle').textContent = title;
            document.getElementById('modalConfirmMsg').textContent = message;

            const okBtn = document.getElementById('modalConfirmOkBtn');
            okBtn.textContent = okText;
            okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

            // Replace ok listener
            const newOkBtn = okBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            newOkBtn.addEventListener('click', () => {
                closeModal('modalConfirm');
                callback();
            });

            // Replace cancel listener
            const cancelBtn = document.querySelector('#modalConfirm .btn-outline');
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.addEventListener('click', () => {
                    closeModal('modalConfirm');
                    if (cancelCallback) cancelCallback();
                });
            }

            openModal('modalConfirm');
        }

        function showHelpModal() {
            openModal('modalHelp');
        }

        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (overlay.id === 'modalHunter' || overlay.id === 'modalWolfSacrifice' || overlay.id === 'modalConfirm') return; // Modal kritis wajib ditutup via aksi yang sah

                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // ==================== TOAST NOTIFICATIONS ====================
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
            toast.innerHTML = `<span>${icons[type] || '&#8505;'}</span><span>${escapeHtml(message)}</span>`;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100px)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // ==================== SAVE/EXPORT ====================


        function resetGame() {
            showConfirm('Game Baru', 'Mulai game baru? Semua data akan direset.', 'Mulai Ulang', true, () => {
                gameState = {
                    phase: 'setup',
                    day: 1,
                    nightPhase: 0,
                    isPaused: false,
                    players: [],
                    roles: {},
                    votes: {},
                    wolfTeam: [],
                    couples: [],
                    witchPotions: { heal: true, poison: true },
                    guardLastProtect: null,
                    hunterShot: false,
                    nightLog: [],
                    dayLog: [],
                    eliminatedPlayers: [],
                    winner: null,
                    started: false,
                    veteranAlertsLeft: 2,
                    doppelgangerTarget: null,
                    toughGuyPendingDeath: null,
                    wolfCubKilledThisDay: false,
                    wolfCubDoubleKillActive: false,
                    infectorUsed: false,
                    survivorVestUsed: false,
                    cultMembers: [],
                    vampireTeam: [],
                    bountyHunterTarget: null,
                    drunkPoisonedWolf: false,
                    apprenticeSeerActivated: false,
                    huntersApprenticeActivated: false,
                    troublemakerUsed: false,
                    thiefStolen: null,
                    amnesiacChosen: false,
                    nightState: {
                        wolfKillTarget: null,
                        alphaKillTarget: null,
                        skKillTarget: null,
                        guardProtectTarget: null,
                        bodyguardProtectTarget: null,
                        witchHealTarget: null,
                        witchPoisonTarget: null,
                        veteranIsAlert: false,
                        wizardSilenceTarget: null,
                        infectorInfectId: null,
                        tavernKeeperBlockId: null,
                        trackerTargetId: null,
                        trackerVisitResultId: null,
                        auraSeerTargetId: null,
                        sorcererTargetId: null,
                        whiteWolfKillId: null,
                        cultLeaderRecruitId: null,
                        vampireKillId: null,
                        survivorVestActivated: false,
                        gravediggerInfoShown: false,
                        wolfKillId2: null
                    }
                };

                document.getElementById('gameOverSection').style.display = 'none';
                resetTimer(); // BUG-24 FIX: Hentikan timer yang mungkin masih berjalan
                updatePhaseBanner();
                updateStats();
                renderPlayers();
                initRoleDistribution();
                renderLog();
                switchTab('setup');
                clearSavedState();
                showToast('Game direset total!', 'info');
            });
        }

        function restartGameKeepPlayers() {
            showConfirm('Mulai Ulang Game', 'Mulai game baru dengan daftar pemain yang sama? (Role dan Log akan dikosongkan)', 'Mulai Ulang', true, () => {
                const retainedPlayers = gameState.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    role: null,
                    alive: true,
                    eliminated: false,
                    notes: '',
                    killedByVote: false,
                    _sheriffUsed: false,
                    _priestUsed: false,
                    _hunterUsed: false,
                    _idiotRevealed: false,
                    _princeUsed: false,
                    _mayorRevealed: false,
                    _cupidTemp: null
                }));

                gameState = {
                    phase: 'setup',
                    day: 1,
                    nightPhase: 0,
                    isPaused: false,
                    players: retainedPlayers,
                    roles: {},
                    votes: {},
                    wolfTeam: [],
                    couples: [],
                    witchPotions: { heal: true, poison: true },
                    guardLastProtect: null,
                    hunterShot: false,
                    nightLog: [],
                    dayLog: [],
                    eliminatedPlayers: [],
                    winner: null,
                    started: false,
                    veteranAlertsLeft: 2,
                    doppelgangerTarget: null,
                    toughGuyPendingDeath: null,
                    wolfCubKilledThisDay: false,
                    wolfCubDoubleKillActive: false,
                    infectorUsed: false,
                    survivorVestUsed: false,
                    cultMembers: [],
                    vampireTeam: [],
                    bountyHunterTarget: null,
                    drunkPoisonedWolf: false,
                    apprenticeSeerActivated: false,
                    huntersApprenticeActivated: false,
                    troublemakerUsed: false,
                    thiefStolen: null,
                    amnesiacChosen: false,
                    nightState: {
                        wolfKillTarget: null,
                        alphaKillTarget: null,
                        skKillTarget: null,
                        guardProtectTarget: null,
                        bodyguardProtectTarget: null,
                        witchHealTarget: null,
                        witchPoisonTarget: null,
                        veteranIsAlert: false,
                        wizardSilenceTarget: null,
                        infectorInfectId: null,
                        tavernKeeperBlockId: null,
                        trackerTargetId: null,
                        trackerVisitResultId: null,
                        auraSeerTargetId: null,
                        sorcererTargetId: null,
                        whiteWolfKillId: null,
                        cultLeaderRecruitId: null,
                        vampireKillId: null,
                        survivorVestActivated: false,
                        gravediggerInfoShown: false,
                        wolfKillId2: null
                    }
                };

                document.getElementById('gameOverSection').style.display = 'none';
                resetTimer(); // BUG-24 FIX: Hentikan timer yang mungkin masih berjalan
                updatePhaseBanner();
                updateStats();
                renderPlayers();
                initRoleDistribution();
                renderLog();
                switchTab('setup');
                showToast('Game diulang! Silakan acak role lagi.', 'success');
            });
        }

        // ==================== KEYBOARD SHORTCUTS ====================
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => {
                    if (m.id === 'modalHunter' || m.id === 'modalWolfSacrifice' || m.id === 'modalConfirm') return; // Modal kritis wajib ditutup via aksi yang sah

                    m.classList.remove('active');
                    document.body.style.overflow = '';
                });
            }
        });

        // ==================== DISCUSSION TIMER ====================
        let _timerInterval = null;
        let _timerSeconds = 300;
        let _timerRunning = false;
        let _timerOriginal = 300;

        function setTimer(seconds) {
            resetTimer();
            _timerSeconds = seconds;
            _timerOriginal = seconds;
            updateTimerDisplay();
            document.getElementById('timerStatus').textContent = 'Siap — tekan Mulai';
            // Highlight active preset button
            ['60', '180', '300', '600'].forEach(s => {
                const btn = document.getElementById('timerBtn' + s);
                if (btn) btn.style.background = (parseInt(s) === seconds) ? 'rgba(240,192,64,0.2)' : '';
            });
            pushTimerStateToFirebase();
        }

        function startPauseTimer() {
            if (_timerRunning) {
                clearInterval(_timerInterval);
                _timerRunning = false;
                document.getElementById('timerStartBtn').textContent = '▶ Lanjut';
                document.getElementById('timerStatus').textContent = 'Dijeda';
            } else {
                if (_timerSeconds <= 0) { resetTimer(); return; }
                _timerRunning = true;
                document.getElementById('timerStartBtn').textContent = '⏸ Jeda';
                document.getElementById('timerStatus').textContent = 'Diskusi berjalan...';
                _timerInterval = setInterval(tickTimer, 1000);
            }
            pushTimerStateToFirebase();
        }

        function tickTimer() {
            _timerSeconds--;
            updateTimerDisplay();
            if (_timerSeconds % 5 === 0) pushTimerStateToFirebase(); // Sinkronisasi setiap 5 detik agar tidak membanjiri request
            if (_timerSeconds <= 0) {
                clearInterval(_timerInterval);
                _timerRunning = false;
                document.getElementById('timerStartBtn').textContent = '▶ Mulai';
                document.getElementById('timerStatus').textContent = '⛔ Waktu habis!';
                document.getElementById('timerDisplay').style.color = 'var(--accent-red)';
                playTimerAlarm();
                showToast('⏱️ Waktu diskusi habis!', 'warning');
                pushTimerStateToFirebase(); // sinkronisasi akhir
            }
        }

        function resetTimer() {
            clearInterval(_timerInterval);
            _timerRunning = false;
            _timerSeconds = _timerOriginal;
            updateTimerDisplay();
            const display = document.getElementById('timerDisplay');
            if (display) display.style.color = 'var(--accent-gold)';
            const startBtn = document.getElementById('timerStartBtn');
            if (startBtn) startBtn.textContent = '▶ Mulai';
            const status = document.getElementById('timerStatus');
            if (status) status.textContent = 'Siap — tekan Mulai';
            pushTimerStateToFirebase();
        }

        function updateTimerDisplay() {
            const display = document.getElementById('timerDisplay');
            if (!display) return;
            const m = Math.floor(_timerSeconds / 60).toString().padStart(2, '0');
            const s = (_timerSeconds % 60).toString().padStart(2, '0');
            display.textContent = `${m}:${s}`;
            // Turn red and pulse when ≤10s
            if (_timerSeconds <= 10 && _timerSeconds > 0) {
                display.style.color = 'var(--accent-red)';
                display.style.textShadow = '0 0 30px rgba(255,80,80,0.7)';
            } else if (_timerSeconds > 10) {
                display.style.color = 'var(--accent-gold)';
                display.style.textShadow = '0 0 20px rgba(240,192,64,0.4)';
            }
        }

        function playTimerAlarm() {
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
            } catch (e) { }
        }
