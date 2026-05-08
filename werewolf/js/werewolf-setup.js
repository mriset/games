        document.addEventListener('DOMContentLoaded', () => {
            if (window.WEREWOLF_PLAYER_MODE) return;

            createParticles();
            const restored = loadState();
            const savedOnlineRoom = localStorage.getItem('werewolf_online_room');
            
            initRoleDistribution();
            renderRoleReference();
            updateStats();
            renderPlayerGroups();
            updatePhaseBanner();
            renderPlayers();
            renderLog();
            if (restored && gameState.players.length > 0) {
                setBodyMode('mode-moderator');
                // Restore active tab if game was in progress
                if (gameState.started) {
                    switchTab('dashboard');
                }
                showToast(`💾 Sesi dipulihkan — ${gameState.players.length} pemain`, 'success');
            }
            if (savedOnlineRoom && db && typeof attachRoomListeners === 'function') {
                setBodyMode('mode-moderator');
                const onlineSection = document.getElementById('onlineSetupSection');
                if (onlineSection) onlineSection.style.display = '';
                attachRoomListeners(savedOnlineRoom);
            }
        });

        function createParticles() {
            const container = document.getElementById('particles');
            for (let i = 0; i < 30; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                p.style.left = Math.random() * 100 + '%';
                p.style.animationDuration = (Math.random() * 15 + 10) + 's';
                p.style.animationDelay = (Math.random() * 10) + 's';
                p.style.width = p.style.height = (Math.random() * 3 + 1) + 'px';
                container.appendChild(p);
            }
        }

        // ==================== TAB NAVIGATION ====================
        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            // Remove active from all bottom nav items
            document.querySelectorAll('.bottom-nav-item').forEach(t => t.classList.remove('active'));

            document.getElementById('tab-' + tabName).classList.add('active');

            // Add active to bottom nav icon if it exists (some tabs are in the more sheet)
            const navBtn = document.querySelector(`[data-nav="${tabName}"]`);
            if (navBtn && navBtn.classList.contains('bottom-nav-item')) {
                navBtn.classList.add('active');
            } else if (navBtn && navBtn.classList.contains('sheet-menu-item')) {
                // Keep "Lainnya" active if we select a tab inside the sheet
                const lainnyaBtn = document.querySelector('.bottom-nav-item:last-child');
                if (lainnyaBtn) lainnyaBtn.classList.add('active');
            }

            if (tabName === 'night') updateNightPanel();
            if (tabName === 'day') updateDayPanel();
            if (tabName === 'players') renderPlayers();
        }

        function openMoreSheet() {
            document.getElementById('moreSheetOverlay').classList.add('active');
        }

        function closeMoreSheet() {
            document.getElementById('moreSheetOverlay').classList.remove('active');
        }

        function sanitizePlayerName(name) {
            return String(name || '')
                .replace(/[<>"'`\\]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function escapeJsString(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n')
                .replace(/</g, '\\x3C')
                .replace(/>/g, '\\x3E');
        }

        // ==================== PLAYER MANAGEMENT ====================
        function savePlayerGroup() {
            const groupName = document.getElementById('inputGroupName').value.trim();
            if (!groupName) return showToast('Masukkan nama grup!', 'warning');
            if (gameState.players.length === 0) return showToast('Tambahkan pemain terlebih dahulu!', 'warning');

            const groups = JSON.parse(localStorage.getItem('werewolf_player_groups') || '{}');
            groups[groupName] = gameState.players.map(p => p.name);
            localStorage.setItem('werewolf_player_groups', JSON.stringify(groups));

            document.getElementById('inputGroupName').value = '';
            renderPlayerGroups();
            showToast(`Grup "${groupName}" tersimpan!`, 'success');
        }

        function renderPlayerGroups() {
            const select = document.getElementById('selectGroup');
            if (!select) return;
            const groups = JSON.parse(localStorage.getItem('werewolf_player_groups') || '{}');
            const groupNames = Object.keys(groups);

            if (groupNames.length === 0) {
                select.innerHTML = '<option value="">-- Tidak ada preset tersimpan --</option>';
                select.disabled = true;
            } else {
                select.innerHTML = '<option value="">-- Pilih Preset --</option>' +
                    groupNames.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)} (${groups[g].length} pemain)</option>`).join('');
                select.disabled = false;
            }
        }

        function loadPlayerGroup() {
            const select = document.getElementById('selectGroup');
            const groupName = select.value;
            if (!groupName) return showToast('Pilih grup terlebih dahulu!', 'warning');

            const groups = JSON.parse(localStorage.getItem('werewolf_player_groups') || '{}');
            const names = groups[groupName];
            if (!names || names.length === 0) return;

            document.getElementById('inputPlayerName').value = names.join(', ');
            addPlayer();
            showToast(`Memuat grup ${groupName}...`, 'info');
        }

        function deletePlayerGroup() {
            const select = document.getElementById('selectGroup');
            const groupName = select.value;
            if (!groupName) return showToast('Pilih grup yang akan dihapus!', 'warning');

            showConfirm('Hapus Grup', `Hapus grup "${groupName}" dari penyimpanan?`, 'Hapus', true, () => {
                const groups = JSON.parse(localStorage.getItem('werewolf_player_groups') || '{}');
                delete groups[groupName];
                localStorage.setItem('werewolf_player_groups', JSON.stringify(groups));
                renderPlayerGroups();
                showToast(`Grup "${groupName}" dihapus!`, 'info');
            });
        }

        function addPlayer() {
            const nameInput = document.getElementById('inputPlayerName');
            const raw = nameInput.value.trim();
            if (!raw) return showToast('Masukkan nama pemain!', 'error');

            const names = raw.split(/[\n,]+/).map(n => sanitizePlayerName(n)).filter(n => n.length > 0);
            const added = [];
            const skipped = [];

            names.forEach(name => {
                if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                    skipped.push(name);
                } else {
                    gameState.players.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substr(2)),
                        name: name,
                        role: null,
                        alive: true,
                        eliminated: false,
                        notes: ''
                    });
                    added.push(name);
                }
            });

            nameInput.value = '';
            if (added.length > 0) {
                renderPlayers();
                updateStats();
                initRoleDistribution();
                if (added.length === 1) {
                    showToast(`${added[0]} ditambahkan!`, 'success');
                } else {
                    showToast(`${added.length} pemain ditambahkan!`, 'success');
                }
            }
            if (skipped.length > 0) {
                showToast(`Nama sudah ada: ${skipped.join(', ')}`, 'warning');
            }
        }

        function addPlayerFromModal() {
            const name = sanitizePlayerName(document.getElementById('modalPlayerName').value);
            const role = document.getElementById('modalPlayerRole').value;
            if (!name) return showToast('Masukkan nama pemain!', 'error');
            if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                return showToast('Nama sudah ada!', 'error');
            }

            gameState.players.push({
                id: crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substr(2)),
                name: name,
                role: role || null,
                alive: true,
                eliminated: false,
                notes: ''
            });

            if (role) {
                if (!gameState.roles[role]) gameState.roles[role] = 0;
                gameState.roles[role]++;
            }

            closeModal('modalAddPlayer');
            document.getElementById('modalPlayerName').value = '';
            renderPlayers();
            updateStats();
            initRoleDistribution();
            showToast(`${name} ditambahkan!`, 'success');
        }

        function removePlayer(id) {
            const player = gameState.players.find(p => p.id === id);
            if (!player) return;

            showConfirm('Hapus Pemain', `Hapus ${player.name} dari permainan?`, 'Hapus', true, () => {
                gameState.players = gameState.players.filter(p => p.id !== id);
                if (player.role && gameState.roles[player.role]) {
                    gameState.roles[player.role] = Math.max(0, gameState.roles[player.role] - 1);
                }
                if (db && onlineRoomCode) {
                    db.ref(`rooms/${onlineRoomCode}/players/${id}`).remove().catch(err => {
                        console.error('Gagal menghapus pemain dari room online:', err);
                    });
                }
                renderPlayers();
                updateStats();
                initRoleDistribution();
                showToast(`${player.name} dihapus.`, 'info');
            });
        }

        function togglePlayerAlive(id) {
            const player = gameState.players.find(p => p.id === id);
            if (!player) return;
            player.alive = !player.alive;
            if (!player.alive) {
                player.eliminated = true;
                addLog(gameState.phase, `${player.name} (${player.role || 'Tanpa Role'}) mati.`);
                checkWinCondition();
            }
            renderPlayers();
            updateStats();
        }

        function showAddPlayerModal() {
            document.getElementById('modalPlayerName').value = '';
            document.getElementById('modalPlayerRole').value = '';

            const select = document.getElementById('modalPlayerRole');
            select.innerHTML = '<option value="">-- Acak --</option>';
            Object.keys(ROLE_DEFINITIONS).forEach(role => {
                const opt = document.createElement('option');
                opt.value = role;
                opt.textContent = `${ROLE_DEFINITIONS[role].icon} ${role}`;
                select.appendChild(opt);
            });

            openModal('modalAddPlayer');
            setTimeout(() => document.getElementById('modalPlayerName').focus(), 200);
        }

        function showPlayerDetail(id) {
            const player = gameState.players.find(p => p.id === id);
            if (!player) return;

            const content = document.getElementById('detailPlayerContent');
            const roleDef = player.role ? ROLE_DEFINITIONS[player.role] : null;
            const safeName = escapeHtml(player.name);
            const safeNotes = escapeHtml(player.notes || '');

            content.innerHTML = `
<div style="text-align:center;margin-bottom:20px;">
<div style="width:64px;height:64px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2rem;${player.alive ? 'background:linear-gradient(135deg,var(--accent-purple),var(--accent-purple-dark));' : 'background:linear-gradient(135deg,#555,#333);'}">
${roleDef ? roleDef.icon : '👤'}
</div>
<div style="font-family:'Cinzel',serif;font-size:1.3rem;font-weight:700;">${safeName}</div>
<div style="margin-top:4px;">
${player.role ? `<span class="badge badge-${roleDef.category}">${roleDef.icon} ${player.role}</span>` : '<span class="badge badge-neutral">Belum ada role</span>'}
</div>
<div style="margin-top:8px;">
<span style="font-size:0.85rem;color:${player.alive ? 'var(--accent-green)' : 'var(--accent-red)'};">
${player.alive ? '✅ Hidup' : '💀 Mati'}
</span>
</div>
</div>

<div class="form-group">
<label class="form-label">Ubah Role</label>
<select class="form-select" id="detailRoleSelect" onchange="changePlayerRole('${escapeJsString(id)}', this.value)">
<option value="">-- Tanpa Role --</option>
${Object.keys(ROLE_DEFINITIONS).map(r => `<option value="${r}" ${player.role === r ? 'selected' : ''}>${ROLE_DEFINITIONS[r].icon} ${r}</option>`).join('')}
</select>
</div>

<div class="form-group">
<label class="form-label">Catatan Moderator</label>
<textarea class="form-textarea" id="detailNotes" placeholder="Catatan tentang pemain ini..." onchange="updatePlayerNotes('${escapeJsString(id)}', this.value)">${safeNotes}</textarea>
</div>

<div style="display:flex;gap:8px;flex-wrap:wrap;">
<button class="btn ${player.alive ? 'btn-danger' : 'btn-success'} btn-block" onclick="togglePlayerAlive('${escapeJsString(id)}');closeModal('modalPlayerDetail');">
${player.alive ? '💀 Tandai Mati' : '✅ Tandai Hidup'}
</button>
<button class="btn btn-outline btn-block" onclick="removePlayer('${escapeJsString(id)}');closeModal('modalPlayerDetail');">
🗑️ Hapus Pemain
</button>
</div>
`;

            openModal('modalPlayerDetail');
        }

        function changePlayerRole(id, role) {
            const player = gameState.players.find(p => p.id === id);
            if (!player) return;

            // Kurangi count role lama
            if (player.role && gameState.roles[player.role]) {
                gameState.roles[player.role] = Math.max(0, gameState.roles[player.role] - 1);
            }

            player.role = role || null;

            // Tambah count role baru
            if (role) {
                if (!gameState.roles[role]) gameState.roles[role] = 0;
                gameState.roles[role]++;
            }

            initRoleDistribution();
            renderPlayers();
        }

        function updatePlayerNotes(id, notes) {
            const player = gameState.players.find(p => p.id === id);
            if (player) player.notes = notes;
        }

        function clearAllPlayers() {
            showConfirm('Hapus Semua', 'Hapus semua pemain dari permainan?', 'Hapus Semua', true, () => {
                gameState.players = [];
                gameState.roles = {};
                gameState.wolfTeam = [];
                gameState.couples = [];
                if (roomPlayersRef) {
                    roomPlayersRef.remove().catch(err => {
                        console.error('Gagal menghapus semua pemain dari room online:', err);
                    });
                }
                renderPlayers();
                updateStats();
                initRoleDistribution();
                showToast('Semua pemain dihapus.', 'info');
            });
        }

        function renderPlayers() {
            const grid = document.getElementById('playerGrid');
            const countText = document.getElementById('playerCountText');
            const progress = document.getElementById('playerProgress');

            if (gameState.players.length === 0) {
                grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Belum ada pemain. Tambahkan pemain di setup.</div></div>`;
                countText.textContent = '0 pemain';
                progress.style.width = '0%';
                return;
            }

            countText.textContent = `${gameState.players.length} pemain`;
            progress.style.width = Math.min((gameState.players.length / 20) * 100, 100) + '%';

            grid.innerHTML = gameState.players.map((p, i) => {
                const roleDef = p.role ? ROLE_DEFINITIONS[p.role] : null;
                const avatarBg = p.alive ? 'alive' : 'dead';
                const cardClass = p.alive ? '' : 'dead';
                const safeName = escapeHtml(p.name);
                const isCult = gameState.cultMembers && gameState.cultMembers.includes(String(p.id));
                const cultBadge = isCult ? `<span class="player-role-badge revealed" style="background:var(--accent-purple-dark); margin-left:4px;" title="Anggota Sekte Cult">🌑 Sekte</span>` : '';

                return `
<div class="player-card ${cardClass}" onclick="showPlayerDetail('${p.id}')" style="animation-delay:${i * 0.05}s">
<div class="player-avatar ${avatarBg}">
${roleDef ? roleDef.icon : '👤'}
${p.alive ? '<div class="alive-dot"></div>' : ''}
</div>
<div class="player-info">
<div class="player-name">${safeName}</div>
<div>
${p.role ? `<span class="player-role-badge ${roleDef ? roleDef.category : 'unknown'} revealed">${roleDef ? roleDef.icon + ' ' + p.role + (p._wasDoppelganger ? ' (Eks-Doppel)' : '') : '❓ ???'}</span>` : '<span class="player-role-badge unknown">❓ Belum ada role</span>'}
${cultBadge}
</div>
</div>
<div class="player-actions" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
<button class="player-action-btn ${p.alive ? 'danger' : 'success'}" onclick="togglePlayerAlive('${p.id}')" title="${p.alive ? 'Tandai Mati' : 'Tandai Hidup'}">
${p.alive ? '💀' : '✅'}
</button>
<button class="player-action-btn" onclick="showPlayerDetail('${p.id}')" title="Detail">📝</button>
</div>
</div>
`;
            }).join('');
        }

        // ==================== ROLE DISTRIBUTION ====================
        function initRoleDistribution() {
            const container = document.getElementById('roleDistribution');
            document.getElementById('setupPlayerCount').textContent = gameState.players.length;

            const categories = [
                { name: '🐺 Werewolf', roles: ['Werewolf', 'Alpha Wolf', 'Lone Wolf', 'Wolf Cub', 'White Wolf', 'Infector'] },
                { name: '🕵️ Kaki Tangan Serigala', roles: ['Sorcerer', 'Minion'] },
                { name: '🔮 Investigasi', roles: ['Seer', 'Apprentice Seer', 'Aura Seer', 'Tracker', 'Sheriff', 'Priest', 'Gravedigger', 'Little Girl'] },
                { name: '🛡️ Pertahanan', roles: ['Guardian', 'Bodyguard', 'Veteran', 'Witch', 'Wizard', 'Tavern Keeper', 'Tough Guy', 'Drunk'] },
                { name: '🏛️ Kepemimpinan', roles: ['Mayor', 'Hunter', 'Hunters Apprentice', 'Martyr'] },
                { name: '🔗 Transformasi', roles: ['Lycan', 'Cursed'] },
                { name: '👬 Komunitas', roles: ['Mason 1', 'Mason 2'] },
                { name: '🎭 Netral Bertahan', roles: ['Survivor', 'Amnesiac', 'Bounty Hunter'] },
                { name: '🌑 Netral Agresif', roles: ['Jester', 'Cult Leader', 'Vampire', 'Troublemaker', 'Thief'] },
                { name: '🎪 Spesial', roles: ['Cupid', 'Doppelganger', 'Serial Killer', 'Idiot', 'Prince'] },
                { name: '👥 Villager', roles: ['Villager'] }
            ];

            let html = '';
            categories.forEach(cat => {
                html += `<div style="margin-bottom:12px;"><div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;font-weight:600;">${cat.name}</div>`;
                html += '<div class="role-dist-grid">';
                cat.roles.forEach(role => {
                    const def = ROLE_DEFINITIONS[role];
                    const count = gameState.roles[role] || 0;

                    html += `
<div class="role-dist-item">
<div class="role-info">
<span class="role-emoji">${def.icon}</span>
<span class="role-label">${role}</span>
</div>
`;

                    if (role === 'Villager' || role === 'Werewolf') {
                        html += `
<div class="role-counter">
<button class="counter-btn" onclick="changeRoleCount('${role}', -1)">−</button>
<span class="counter-value" id="rc-${role.replace(/[^a-zA-Z]/g, '')}">${count}</span>
<button class="counter-btn" onclick="changeRoleCount('${role}', 1)">+</button>
</div>
`;
                    } else {
                        html += `
<div class="role-counter toggle-container" onclick="toggleRole('${role}')" style="cursor:pointer; background:transparent;">
<div class="toggle ${count > 0 ? 'active' : ''}" id="toggle-${role.replace(/[^a-zA-Z]/g, '')}"></div>
</div>
`;
                    }

                    html += `</div>\n`;
                });
                html += '</div></div>';
            });

            container.innerHTML = html;
            updateStartGameButtonState();
        }

        function updateStartGameButtonState() {
            const btn = document.getElementById('btnStartGame');
            if (!btn) return;

            const playerCount = gameState.players.length;
            const totalRoles = Object.values(gameState.roles).reduce((a, b) => a + b, 0);
            const playersWithoutRole = gameState.players.filter(p => !p.role).length;

            const mason1Count = gameState.roles['Mason 1'] || 0;
            const mason2Count = gameState.roles['Mason 2'] || 0;

            if (mason1Count !== mason2Count) {
                btn.disabled = true;
                // Optional: show warning text for Masons pairing
            } else {
                btn.disabled = playerCount < 5 || totalRoles < playerCount || playersWithoutRole > 0;
            }
        }

        function changeRoleCount(role, delta) {
            if (!gameState.roles[role]) gameState.roles[role] = 0;

            // Aturan jumlah maksimal: Hanya Villager dan Werewolf yang boleh ditambah > 1
            const isMultipleAllowed = role === 'Villager' || role === 'Werewolf';
            if (delta > 0 && !isMultipleAllowed && gameState.roles[role] >= 1) {
                return showToast(`Hanya boleh ada maksimal 1 ${role} dalam game!`, 'warning');
            }

            gameState.roles[role] = Math.max(0, gameState.roles[role] + delta);

            const key = role.replace(/[^a-zA-Z]/g, '');
            const el = document.getElementById('rc-' + key);
            if (el) el.textContent = gameState.roles[role];
            updateStartGameButtonState();
        }

        function toggleRole(role) {
            if (!gameState.roles[role]) gameState.roles[role] = 0;

            if (gameState.roles[role] > 0) {
                gameState.roles[role] = 0;
            } else {
                gameState.roles[role] = 1;
            }

            const key = role.replace(/[^a-zA-Z]/g, '');
            const el = document.getElementById('toggle-' + key);
            if (el) {
                if (gameState.roles[role] > 0) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
            updateStartGameButtonState();
        }

        function clearAllRoles() {
            gameState.roles = {};
            initRoleDistribution();
            gameState.players.forEach(p => p.role = null);
            renderPlayers();
            showToast('Role direset.', 'info');
        }

        function randomAssignRoles() {
            const playerCount = gameState.players.length;
            if (playerCount === 0) return showToast('Tambahkan pemain terlebih dahulu!', 'error');

            let customRolePool = [];
            for (const [role, count] of Object.entries(gameState.roles)) {
                for (let i = 0; i < count; i++) {
                    customRolePool.push(role);
                }
            }

            let totalSelectedRoles = customRolePool.length;

            if (totalSelectedRoles === 0) {
                return showToast('Pilih role terlebih dahulu sebelum mengacak!', 'warning');
            }

            if (totalSelectedRoles > playerCount) {
                return showToast(`Jumlah role (${totalSelectedRoles}) lebih banyak dari pemain (${playerCount})! Kurangi role.`, 'error');
            }

            // Fill the remaining slots with Villagers if not enough roles are selected
            if (totalSelectedRoles < playerCount) {
                let requiredVillagerCount = playerCount - totalSelectedRoles;
                for (let i = 0; i < requiredVillagerCount; i++) {
                    customRolePool.push('Villager');
                }

                // Update gameState.roles so UI reflects the added Villagers
                if (!gameState.roles['Villager']) gameState.roles['Villager'] = 0;
                gameState.roles['Villager'] += requiredVillagerCount;
            }

            // Clear existing role assignments on players to assign the new ones
            gameState.players.forEach(p => p.role = null);

            // Shuffle and assign
            customRolePool = shuffleArray(customRolePool);

            // Assign to players
            gameState.players.forEach((p, i) => {
                p.role = customRolePool[i];
            });

            initRoleDistribution();
            renderPlayers();
            showToast('Role telah diacak ke pemain!', 'success');
        }



        function shuffleArray(arr) {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        // ==================== GAME FLOW ====================
