 let moderatorInitialized = false;
 let roleReferenceRendered = false;
 let moderatorRenderFrame = null;
 const moderatorRenderQueue = { players: false, stats: false, roles: false, log: false };

 document.addEventListener('DOMContentLoaded', () => {
 if (window.WEREWOLF_PLAYER_MODE) return;

 const hasSavedModeratorState = !!localStorage.getItem('werewolf_moderator_state');
 const savedOnlineRoom = localStorage.getItem('werewolf_online_room');
 if (hasSavedModeratorState || savedOnlineRoom) {
 initializeModeratorApp();
 }
 });

 function initializeModeratorApp() {
 if (moderatorInitialized) return;
 moderatorInitialized = true;

 createParticles();
 const restored = loadState();
 const savedOnlineRoom = localStorage.getItem('werewolf_online_room');

 initRoleDistribution();
 updateStats();
 renderPlayerGroups();
 updatePhaseBanner();
 if (typeof updatePauseControls === 'function') updatePauseControls();
 renderPlayers();
 renderLog();
 if (restored && gameState.players.length > 0) {
 setBodyMode('mode-moderator');
 // Restore active tab if game was in progress
 if (gameState.started) {
 switchTab('dashboard');
 }
 showToast(` Sesi dipulihkan — ${gameState.players.length} pemain`, 'success');
 }
 if (savedOnlineRoom && db && typeof attachRoomListeners === 'function') {
 setBodyMode('mode-moderator');
 const onlineSection = document.getElementById('onlineSetupSection');
 if (onlineSection) onlineSection.style.display = '';
 attachRoomListeners(savedOnlineRoom);
 }
 }

 function scheduleModeratorRender(parts = {}) {
 if (parts.players) moderatorRenderQueue.players = true;
 if (parts.stats) moderatorRenderQueue.stats = true;
 if (parts.roles) moderatorRenderQueue.roles = true;
 if (parts.log) moderatorRenderQueue.log = true;
 if (moderatorRenderFrame) return;

 const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
 moderatorRenderFrame = schedule(flushModeratorRenderQueue);
 }

 function flushModeratorRenderQueue() {
 moderatorRenderFrame = null;
 const shouldRenderPlayers = moderatorRenderQueue.players;
 const shouldUpdateStats = moderatorRenderQueue.stats;
 const shouldRenderRoles = moderatorRenderQueue.roles;
 const shouldRenderLog = moderatorRenderQueue.log;
 moderatorRenderQueue.players = false;
 moderatorRenderQueue.stats = false;
 moderatorRenderQueue.roles = false;
 moderatorRenderQueue.log = false;

 if (shouldUpdateStats) updateStats();
 if (shouldRenderRoles) initRoleDistribution();
 if (shouldRenderPlayers) renderPlayers();
 if (shouldRenderLog) renderLog();
 updateSetupRoleHeaderCount();
 }

 window.initializeModeratorApp = initializeModeratorApp;

 function getSelectedRoleCount() {
 return Object.values(gameState.roles || {}).reduce((total, count) => total + count, 0);
 }

 function updateSetupRoleHeaderCount() {
 const phaseDayCount = document.getElementById('phaseDayCount');
 if (!phaseDayCount || typeof gameState === 'undefined' || gameState.started || gameState.phase !== 'setup') return;

 if (document.body.dataset.activeTab !== 'role-setup') {
 phaseDayCount.textContent = 'Belum mulai';
 return;
 }

 const playerCount = gameState.players.length;
 const selectedRoleCount = getSelectedRoleCount();
 phaseDayCount.textContent = `Belum mulai - Role ${selectedRoleCount}/${playerCount}`;
 }

 window.updateSetupRoleHeaderCount = updateSetupRoleHeaderCount;

	 function createParticles() {
	 // The current theme uses CSS-only atmosphere; avoid creating animated DOM particles.
	 }

 // ==================== TAB NAVIGATION ====================
	 function switchTab(tabName) {
	 if (!moderatorInitialized) initializeModeratorApp();
	 document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
	 document.querySelectorAll('[data-nav]').forEach(t => t.classList.remove('active'));
	
	 const tab = document.getElementById('tab-' + tabName);
	 if (!tab) return;
	 tab.classList.add('active');
	
	 document.querySelectorAll(`[data-nav="${tabName}"]`).forEach(navBtn => navBtn.classList.add('active'));
	 const mobileNavBtn = document.querySelector(`.bottom-nav-item[data-nav="${tabName}"]`);
	 if (!mobileNavBtn) {
	 const lainnyaBtn = document.querySelector('.bottom-nav-item:last-child');
	 if (lainnyaBtn) lainnyaBtn.classList.add('active');
	 }
	 document.body.dataset.activeTab = tabName;
	
	 if (tabName === 'night') updateNightPanel();
	 if (tabName === 'day') updateDayPanel();
	 if (tabName === 'players') renderPlayers();
	 if (tabName === 'roles' && !roleReferenceRendered) {
	 renderRoleReference();
	 roleReferenceRendered = true;
	 }
	 updateSetupRoleHeaderCount();
	 if (window.werewolfRefreshInterface && typeof window.werewolfRefreshInterface === 'function') {
	 window.werewolfRefreshInterface(tab);
	 }
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
 gameState.rolesSubmitted = false;
 scheduleModeratorRender({ players: true, stats: true, roles: true });
 if (typeof saveState === 'function') saveState();
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
 gameState.rolesSubmitted = false;

 closeModal('modalAddPlayer');
 document.getElementById('modalPlayerName').value = '';
 scheduleModeratorRender({ players: true, stats: true, roles: true });
 if (typeof saveState === 'function') saveState();
 showToast(`${name} ditambahkan!`, 'success');
 }

 function removePlayer(id) {
 const player = gameState.players.find(p => p.id === id);
 if (!player) return;

 showConfirm('Hapus Pemain', `Hapus ${player.name} dari permainan?`, 'Hapus', true, () => {
 gameState.players = gameState.players.filter(p => p.id !== id);
 gameState.rolesSubmitted = false;
 if (player.role && gameState.roles[player.role]) {
 gameState.roles[player.role] = Math.max(0, gameState.roles[player.role] - 1);
 }
 if (db && onlineRoomCode) {
 db.ref(`rooms/${onlineRoomCode}/players/${id}`).remove().catch(err => {
 console.error('Gagal menghapus pemain dari room online:', err);
 });
 }
 scheduleModeratorRender({ players: true, stats: true, roles: true });
 if (typeof saveState === 'function') saveState();
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
 scheduleModeratorRender({ players: true, stats: true });
 if (typeof saveState === 'function') saveState();
 }

 function showAddPlayerModal() {
 document.getElementById('modalPlayerName').value = '';
 document.getElementById('modalPlayerRole').value = '';

 const select = document.getElementById('modalPlayerRole');
 select.innerHTML = '<option value="">-- Acak --</option>';
 Object.keys(ROLE_DEFINITIONS).forEach(role => {
 const opt = document.createElement('option');
 opt.value = role;
 opt.textContent = role;
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
${roleDef ? roleAssetIconMarkup(player.role, 'role-lucide-icon role-lucide-icon-lg') : roleIconMarkup('', 'role-lucide-icon role-lucide-icon-lg')}
</div>
<div style="font-family:'Cinzel',serif;font-size:1.3rem;font-weight:700;">${safeName}</div>
<div style="margin-top:4px;">
${player.role ? `<span class="badge badge-${roleDef.category}">${roleAssetIconMarkup(player.role, 'role-inline-icon')} ${player.role}</span>` : '<span class="badge badge-neutral">Belum ada role</span>'}
</div>
<div style="margin-top:8px;">
<span style="font-size:0.85rem;color:${player.alive ? 'var(--accent-green)' : 'var(--accent-red)'};">
<i data-lucide="${player.alive ? 'heart-pulse' : 'skull'}" aria-hidden="true"></i> ${player.alive ? 'Hidup' : 'Mati'}
</span>
</div>
</div>

<div class="form-group">
<label class="form-label">Ubah Role</label>
<select class="form-select" id="detailRoleSelect" onchange="changePlayerRole('${escapeJsString(id)}', this.value)">
<option value="">-- Tanpa Role --</option>
${Object.keys(ROLE_DEFINITIONS).map(r => `<option value="${r}" ${player.role === r ? 'selected' : ''}>${r}</option>`).join('')}
</select>
</div>

<div class="form-group">
<label class="form-label">Catatan Moderator</label>
<textarea class="form-textarea" id="detailNotes" placeholder="Catatan tentang pemain ini..." onchange="updatePlayerNotes('${escapeJsString(id)}', this.value)">${safeNotes}</textarea>
</div>

<div style="display:flex;gap:8px;flex-wrap:wrap;">
<button class="btn ${player.alive ? 'btn-danger' : 'btn-success'} btn-block" onclick="togglePlayerAlive('${escapeJsString(id)}');closeModal('modalPlayerDetail');">
<i data-lucide="${player.alive ? 'skull' : 'heart-pulse'}" aria-hidden="true"></i> ${player.alive ? 'Tandai Mati' : 'Tandai Hidup'}
</button>
<button class="btn btn-outline btn-block" onclick="removePlayer('${escapeJsString(id)}');closeModal('modalPlayerDetail');">
<i data-lucide="trash-2" aria-hidden="true"></i> Hapus Pemain
</button>
</div>
`;

 openModal('modalPlayerDetail');
 hydrateWerewolfIcons(content);
 }

 function changePlayerRole(id, role) {
 const player = gameState.players.find(p => p.id === id);
 if (!player) return;

 // Kurangi count role lama
 if (player.role && gameState.roles[player.role]) {
 gameState.roles[player.role] = Math.max(0, gameState.roles[player.role] - 1);
 }

 player.role = role || null;
 gameState.rolesSubmitted = false;

 // Tambah count role baru
 if (role) {
 if (!gameState.roles[role]) gameState.roles[role] = 0;
 gameState.roles[role]++;
 }

 scheduleModeratorRender({ players: true, roles: true });
 if (typeof saveState === 'function') saveState();
 }

 function updatePlayerNotes(id, notes) {
 const player = gameState.players.find(p => p.id === id);
 if (player) {
 player.notes = notes;
 if (typeof saveState === 'function') saveState();
 }
 }

 function clearAllPlayers() {
 showConfirm('Hapus Semua', 'Hapus semua pemain dari permainan?', 'Hapus Semua', true, () => {
 gameState.players = [];
 gameState.roles = {};
 gameState.rolesSubmitted = false;
 gameState.wolfTeam = [];
 gameState.couples = [];
 if (roomPlayersRef) {
 roomPlayersRef.remove().catch(err => {
 console.error('Gagal menghapus semua pemain dari room online:', err);
 });
 }
 scheduleModeratorRender({ players: true, stats: true, roles: true });
 if (typeof saveState === 'function') saveState();
 showToast('Semua pemain dihapus.', 'info');
 });
 }

 function renderPlayers() {
 const grid = document.getElementById('playerGrid');
 const countText = document.getElementById('playerCountText');
 const progress = document.getElementById('playerProgress');

 if (gameState.players.length === 0) {
 grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon" data-empty-icon="users"><i data-lucide="users"></i></div><div class="empty-state-text">Belum ada pemain. Tambahkan pemain di setup.</div></div>`;
 countText.textContent = '0 pemain';
 progress.style.width = '0%';
 hydrateWerewolfIcons(grid);
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
 const cultBadge = isCult ? `<span class="player-role-badge revealed" style="background:var(--accent-purple-dark); margin-left:4px;" title="Anggota Sekte Cult"> Sekte</span>` : '';

 return `
<div class="player-card ${cardClass}" onclick="showPlayerDetail('${p.id}')" style="animation-delay:${i * 0.05}s">
<div class="player-avatar ${avatarBg}">
${roleDef ? roleAssetIconMarkup(p.role, 'role-lucide-icon') : roleIconMarkup('', 'role-lucide-icon')}
${p.alive ? '<div class="alive-dot"></div>' : ''}
</div>
<div class="player-info">
<div class="player-name">${safeName}</div>
<div>
${p.role ? `<span class="player-role-badge ${roleDef ? roleDef.category : 'unknown'} revealed">${roleDef ? roleAssetIconMarkup(p.role, 'role-inline-icon') + ' ' + p.role + (p._wasDoppelganger ? ' (Eks-Doppel)' : '') : '???'}</span>` : '<span class="player-role-badge unknown">Belum ada role</span>'}
${cultBadge}
</div>
</div>
<div class="player-actions" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
<button class="player-action-btn ${p.alive ? 'danger' : 'success'}" onclick="togglePlayerAlive('${p.id}')" title="${p.alive ? 'Tandai Mati' : 'Tandai Hidup'}">
<i data-lucide="${p.alive ? 'skull' : 'heart-pulse'}" aria-hidden="true"></i>
</button>
<button class="player-action-btn" onclick="showPlayerDetail('${p.id}')" title="Detail">
<i data-lucide="file-text" aria-hidden="true"></i>
</button>
</div>
</div>
`;
 }).join('');
 hydrateWerewolfIcons(grid);
 }

// ==================== ROLE DISTRIBUTION ====================
 function getRoleControlKey(role) {
 return String(role).replace(/[^a-zA-Z0-9]/g, '');
 }

 function initRoleDistribution() {
 const container = document.getElementById('roleDistribution');
 document.getElementById('setupPlayerCount').textContent = gameState.players.length;
 updateSetupRoleHeaderCount();
 renderRoleRecommendation();

 const categories = [
 { name: ' Werewolf', roles: ['Werewolf', 'Wolfman', 'Alpha Wolf', 'Lone Wolf', 'Wolf Cub', 'White Wolf', 'Infector'] },
 { name: ' Kaki Tangan Serigala', roles: ['Sorcerer', 'Minion'] },
 { name: ' Investigasi', roles: ['Seer', 'Apprentice Seer', 'Aura Seer', 'Tracker', 'Sheriff', 'Priest', 'Gravedigger', 'Little Girl'] },
 { name: ' Pertahanan', roles: ['Guardian', 'Bodyguard', 'Veteran', 'Witch', 'Wizard', 'Tavern Keeper', 'Tough Guy', 'Drunk'] },
 { name: ' Kepemimpinan', roles: ['Mayor', 'Hunter', 'Hunters Apprentice', 'Martyr'] },
 { name: ' Transformasi', roles: ['Lycan', 'Cursed'] },
 { name: ' Komunitas', roles: ['Mason 1', 'Mason 2'] },
 { name: ' Netral Bertahan', roles: ['Survivor', 'Amnesiac', 'Bounty Hunter'] },
 { name: ' Netral Agresif', roles: ['Jester', 'Cult Leader', 'Vampire', 'Arsonist', 'Troublemaker', 'Thief'] },
 { name: ' Spesial', roles: ['Cupid', 'Doppelganger', 'Serial Killer', 'Idiot', 'Prince'] },
 { name: ' Villager', roles: ['Villager'] }
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
${roleAssetIconMarkup(role, 'role-lucide-icon role-dist-icon')}
<span class="role-label">${role}</span>
</div>
`;

 if (role === 'Villager' || role === 'Werewolf') {
 html += `
<div class="role-counter">
<button class="counter-btn" onclick="changeRoleCount('${role}', -1)">−</button>
	<span class="counter-value" id="rc-${getRoleControlKey(role)}">${count}</span>
<button class="counter-btn" onclick="changeRoleCount('${role}', 1)">+</button>
</div>
`;
 } else {
 html += `
<div class="role-counter toggle-container" onclick="toggleRole('${role}')" style="cursor:pointer; background:transparent;">
	<div class="toggle ${count > 0 ? 'active' : ''}" id="toggle-${getRoleControlKey(role)}"></div>
</div>
`;
 }

 html += `</div>\n`;
 });
 html += '</div></div>';
 });

 container.innerHTML = html;
 hydrateWerewolfIcons(container);
 updateStartGameButtonState();
 }

 const ROLE_COMPOSITION_RECOMMENDATIONS = {
 5: [
 { name: 'Klasik', note: 'Paling ringan untuk pemula dan diskusi cepat.', roles: { Werewolf: 1, Seer: 1, Guardian: 1, Villager: 2 } },
 { name: 'Seimbang', note: 'Investigasi jelas dengan satu ancaman tersembunyi.', roles: { Werewolf: 1, Seer: 1, Hunter: 1, Villager: 2 } },
 { name: 'Chaos Ringan', note: 'Ada target netral kecil tanpa membuat desa kewalahan.', roles: { Werewolf: 1, Seer: 1, Jester: 1, Villager: 2 } },
 { name: 'Aksi Malam', note: 'Lebih banyak keputusan malam untuk moderator.', roles: { Werewolf: 1, Seer: 1, Witch: 1, Villager: 2 } },
 { name: 'Expert', note: 'Bluff lebih ramai untuk meja kecil berpengalaman.', roles: { Werewolf: 1, 'Aura Seer': 1, Cupid: 1, Hunter: 1, Villager: 1 } }
 ],
 6: [
 { name: 'Klasik', note: 'Tempo aman dengan satu serigala dan pelindung.', roles: { Werewolf: 1, Seer: 1, Guardian: 1, Villager: 3 } },
 { name: 'Seimbang', note: 'Proteksi diganti tekanan siang dari Hunter.', roles: { Werewolf: 1, Seer: 1, Hunter: 1, Villager: 3 } },
 { name: 'Chaos Ringan', note: 'Jester membuat voting lebih taktis.', roles: { Werewolf: 1, Seer: 1, Guardian: 1, Jester: 1, Villager: 2 } },
 { name: 'Aksi Malam', note: 'Witch menambah pilihan penyelamatan dan serangan.', roles: { Werewolf: 1, Seer: 1, Witch: 1, Guardian: 1, Villager: 2 } },
 { name: 'Expert', note: 'Cursed memberi risiko transformasi saat malam.', roles: { Werewolf: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Villager: 2 } }
 ],
 7: [
 { name: 'Klasik', note: 'Dua serigala dengan info dasar desa.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Villager: 3 } },
 { name: 'Seimbang', note: 'Hunter memberi desa ancaman balasan.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Hunter: 1, Villager: 2 } },
 { name: 'Chaos Ringan', note: 'Jester mengganggu konsensus tanpa terlalu berat.', roles: { Werewolf: 2, Seer: 1, Jester: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Witch membuat hasil malam lebih dinamis.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Villager: 2 } },
 { name: 'Expert', note: 'Wolf Cub dan Lycan membuka ruang bluff lanjutan.', roles: { Werewolf: 1, 'Wolf Cub': 1, 'Aura Seer': 1, Lycan: 1, Hunter: 1, Villager: 2 } }
 ],
 8: [
 { name: 'Klasik', note: 'Struktur sederhana untuk sesi stabil.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Villager: 4 } },
 { name: 'Seimbang', note: 'Kekuatan desa tersebar antara info dan reaksi.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Hunter: 1, Villager: 3 } },
 { name: 'Chaos Ringan', note: 'Jester dan Mayor membuat siang lebih hidup.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Jester: 1, Mayor: 1, Villager: 2 } },
 { name: 'Aksi Malam', note: 'Banyak aksi malam tanpa faksi ketiga berat.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Villager: 2 } },
 { name: 'Expert', note: 'Alpha Wolf memberi serigala opsi permainan panjang.', roles: { Werewolf: 1, 'Alpha Wolf': 1, 'Aura Seer': 1, Bodyguard: 1, Cupid: 1, Villager: 3 } }
 ],
 9: [
 { name: 'Klasik', note: 'Dua serigala dan desa cukup kuat.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Hunter: 1, Villager: 4 } },
 { name: 'Seimbang', note: 'Witch menambah koreksi saat malam kacau.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Villager: 4 } },
 { name: 'Chaos Ringan', note: 'Jester dan Cupid menambah agenda tersembunyi.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Jester: 1, Cupid: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Tracker memperkaya informasi malam.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Tracker: 1, Villager: 3 } },
 { name: 'Expert', note: 'Minion membantu serigala tanpa ikut membunuh.', roles: { Werewolf: 2, Minion: 1, 'Aura Seer': 1, Bodyguard: 1, Prince: 1, Villager: 3 } }
 ],
 10: [
 { name: 'Klasik', note: 'Komposisi mudah dibaca untuk grup sedang.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Villager: 4 } },
 { name: 'Seimbang', note: 'Mayor memperkuat politik siang.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Mayor: 1, Villager: 4 } },
 { name: 'Chaos Ringan', note: 'Jester memberi jebakan voting yang ringan.', roles: { Werewolf: 2, Seer: 1, Guardian: 1, Witch: 1, Jester: 1, Villager: 4 } },
 { name: 'Aksi Malam', note: 'Tracker dan Bodyguard membuat malam lebih ramai.', roles: { Werewolf: 2, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, Hunter: 1, Villager: 3 } },
 { name: 'Expert', note: 'Sorcerer mencari Seer dan Lycan mengacaukan info.', roles: { Werewolf: 2, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Lycan: 1, Prince: 1, Villager: 3 } }
 ],
 11: [
 { name: 'Klasik', note: 'Tiga serigala dengan desa kuat tapi sederhana.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Villager: 4 } },
 { name: 'Seimbang', note: 'Mayor menambah pusat debat siang.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Villager: 3 } },
 { name: 'Chaos Ringan', note: 'Cupid dan Jester memberi kejutan sosial.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Cupid: 1, Jester: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Tracker memberi jejak tambahan di malam hari.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Tracker: 1, Hunter: 1, Villager: 3 } },
 { name: 'Expert', note: 'Alpha dan Minion membuat koordinasi jahat lebih halus.', roles: { Werewolf: 2, 'Alpha Wolf': 1, Minion: 1, 'Aura Seer': 1, Bodyguard: 1, Prince: 1, Villager: 4 } }
 ],
 12: [
 { name: 'Klasik', note: 'Fondasi besar yang tetap mudah dipandu.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Villager: 4 } },
 { name: 'Seimbang', note: 'Bodyguard membuat proteksi lebih berisiko.', roles: { Werewolf: 3, Seer: 1, Witch: 1, Bodyguard: 1, Hunter: 1, Mayor: 1, Villager: 4 } },
 { name: 'Chaos Ringan', note: 'Jester dan Cupid memberi dinamika tanpa faksi ketiga agresif.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Tracker dan Tavern Keeper memperbanyak keputusan malam.', roles: { Werewolf: 3, Seer: 1, Witch: 1, Tracker: 1, 'Tavern Keeper': 1, Bodyguard: 1, Hunter: 1, Villager: 3 } },
 { name: 'Expert', note: 'White Wolf membuat tekanan internal di kubu serigala.', roles: { Werewolf: 2, 'White Wolf': 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Lycan: 1, Prince: 1, Villager: 4 } }
 ],
 13: [
 { name: 'Klasik', note: 'Tiga serigala dan paket desa lengkap.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Villager: 5 } },
 { name: 'Seimbang', note: 'Mason memberi jangkar kepercayaan untuk desa.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, 'Mason 1': 1, 'Mason 2': 1, Mayor: 1, Villager: 4 } },
 { name: 'Chaos Ringan', note: 'Netral ringan menambah lapisan voting.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Mayor: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Banyak role aktif dengan tempo tetap terbaca.', roles: { Werewolf: 3, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, Villager: 3 } },
 { name: 'Expert', note: 'Infector dan Cursed membuka risiko perubahan faksi.', roles: { Werewolf: 2, Infector: 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Prince: 1, 'Bounty Hunter': 1, Villager: 4 } }
 ],
 14: [
 { name: 'Klasik', note: 'Komposisi besar yang masih ramah moderator.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Villager: 6 } },
 { name: 'Seimbang', note: 'Dua Mason membantu desa membangun trust.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, 'Mason 1': 1, 'Mason 2': 1, Mayor: 1, Villager: 4 } },
 { name: 'Chaos Ringan', note: 'Jester, Cupid, dan Prince membuat siang penuh kalkulasi.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, Villager: 3 } },
 { name: 'Aksi Malam', note: 'Tracker, Bodyguard, dan Tavern Keeper meramaikan malam.', roles: { Werewolf: 3, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, Villager: 3 } },
 { name: 'Expert', note: 'White Wolf dan Sorcerer memberi tekanan tingkat lanjut.', roles: { Werewolf: 2, 'White Wolf': 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Bodyguard: 1, Lycan: 1, Thief: 1, Prince: 1, Villager: 4 } }
 ],
 15: [
 { name: 'Klasik', note: 'Setup besar yang tetap stabil dan mudah dijelaskan.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 5 } },
 { name: 'Seimbang', note: 'Info, proteksi, dan kekuatan siang tersebar rapi.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, Villager: 5 } },
 { name: 'Chaos Ringan', note: 'Tiga agenda ekstra tanpa membuat faksi utama hilang.', roles: { Werewolf: 3, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, Villager: 4 } },
 { name: 'Aksi Malam', note: 'Pilihan malam padat untuk grup yang suka aksi.', roles: { Werewolf: 3, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 3 } },
 { name: 'Expert', note: 'Faksi serigala fleksibel dengan banyak bluff lanjutan.', roles: { Werewolf: 2, 'Alpha Wolf': 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, Villager: 4 } }
 ],
 16: [
 { name: 'Klasik', note: 'Empat serigala mulai memberi tekanan besar dengan desa tetap solid.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 5 } },
 { name: 'Seimbang', note: 'Info dan proteksi tersebar, cocok untuk meja besar yang masih rapi.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, Villager: 5 } },
 { name: 'Chaos Ringan', note: 'Netral sosial memberi kejutan tanpa terlalu memecah fokus utama.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, Villager: 4 } },
 { name: 'Aksi Malam', note: 'Malam lebih ramai dengan pelacak, kedai, dan peran tahan serangan.', roles: { Werewolf: 4, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 3 } },
 { name: 'Expert', note: 'Serigala punya dukungan rahasia dan desa punya informasi bertingkat.', roles: { Werewolf: 3, 'Alpha Wolf': 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, Villager: 4 } }
 ],
 17: [
 { name: 'Klasik', note: 'Empat serigala melawan paket desa lengkap dan beberapa warga biasa.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 6 } },
 { name: 'Seimbang', note: 'Tracker membantu desa membaca pola tanpa mengurangi ruang debat.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, Villager: 6 } },
 { name: 'Chaos Ringan', note: 'Jester dan Cupid menambah agenda, Prince menjaga voting tidak datar.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, Villager: 5 } },
 { name: 'Aksi Malam', note: 'Pilihan malam banyak, tapi masih ada cukup warga untuk bluff.', roles: { Werewolf: 4, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 4 } },
 { name: 'Expert', note: 'Alpha, Minion, dan Thief membuat informasi awal lebih licin.', roles: { Werewolf: 3, 'Alpha Wolf': 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, Villager: 5 } }
 ],
 18: [
 { name: 'Klasik', note: 'Komposisi besar yang tetap mudah dipandu untuk moderator.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 7 } },
 { name: 'Seimbang', note: 'Bodyguard dan Tracker memberi desa alat baca dan pertahanan tambahan.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, Villager: 6 } },
 { name: 'Chaos Ringan', note: 'Netral ringan membuat siang lebih taktis tanpa faksi pembunuh mandiri.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 4 } },
 { name: 'Aksi Malam', note: 'Banyak kunjungan malam dengan cadangan info dari Apprentice Seer.', roles: { Werewolf: 4, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Villager: 4 } },
 { name: 'Expert', note: 'White Wolf menambah risiko internal di kubu serigala.', roles: { Werewolf: 3, 'White Wolf': 1, Sorcerer: 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, Villager: 5 } }
 ],
 19: [
 { name: 'Klasik', note: 'Empat serigala, dua Mason, dan cukup warga untuk diskusi panjang.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 8 } },
 { name: 'Seimbang', note: 'Paket desa kuat untuk mengimbangi jumlah pemain yang mulai padat.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, Villager: 7 } },
 { name: 'Chaos Ringan', note: 'Jester, Cupid, dan Prince membuat voting besar lebih hidup.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 5 } },
 { name: 'Aksi Malam', note: 'Malam padat dengan beberapa sumber informasi dan gangguan.', roles: { Werewolf: 4, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Villager: 4 } },
 { name: 'Expert', note: 'Infector membuka ancaman perubahan faksi pada meja besar.', roles: { Werewolf: 3, Infector: 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, Villager: 6 } }
 ],
 20: [
 { name: 'Klasik', note: 'Empat serigala dan desa besar yang masih mudah dijelaskan.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 9 } },
 { name: 'Seimbang', note: 'Peran aktif tersebar cukup rata untuk menjaga semua fase berarti.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 7 } },
 { name: 'Chaos Ringan', note: 'Tambahan netral sosial menjaga voting ramai di grup besar.', roles: { Werewolf: 4, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Villager: 5 } },
 { name: 'Aksi Malam', note: 'Banyak aksi malam dengan Gravedigger sebagai info lanjutan.', roles: { Werewolf: 4, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Villager: 5 } },
 { name: 'Expert', note: 'Alpha dan Sorcerer menambah koordinasi serigala, neutral memberi tekanan voting.', roles: { Werewolf: 3, 'Alpha Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Villager: 6 } }
 ],
 21: [
 { name: 'Klasik', note: 'Lima serigala mulai cocok untuk meja sangat besar.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 9 } },
 { name: 'Seimbang', note: 'Desa mendapat alat baca dan bertahan untuk menghadapi lima serigala.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 7 } },
 { name: 'Chaos Ringan', note: 'Netral sosial membantu memecah voting tanpa menambah pembunuh mandiri.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Villager: 5 } },
 { name: 'Aksi Malam', note: 'Banyak fase malam untuk grup yang suka permainan panjang.', roles: { Werewolf: 5, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Villager: 5 } },
 { name: 'Expert', note: 'Kubu serigala kompleks dengan perlindungan bluff dari Lycan dan Cursed.', roles: { Werewolf: 4, 'Alpha Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Villager: 6 } }
 ],
 22: [
 { name: 'Klasik', note: 'Lima serigala dengan paket desa lengkap dan warga cukup banyak.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 10 } },
 { name: 'Seimbang', note: 'Banyak alat desa tanpa membuat role khusus terlalu padat.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 8 } },
 { name: 'Chaos Ringan', note: 'Agenda tersembunyi cukup banyak untuk meja yang besar dan ramai.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Villager: 6 } },
 { name: 'Aksi Malam', note: 'Malam punya banyak keputusan, siang masih punya cukup warga biasa.', roles: { Werewolf: 5, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Martyr: 1, Villager: 5 } },
 { name: 'Expert', note: 'Infector membuat jumlah serigala bisa berubah selama permainan.', roles: { Werewolf: 4, Infector: 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Bodyguard: 1, Villager: 6 } }
 ],
 23: [
 { name: 'Klasik', note: 'Lima serigala dan desa besar untuk permainan panjang yang stabil.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 11 } },
 { name: 'Seimbang', note: 'Komposisi kuat dengan cukup warga biasa untuk menjaga bluff tetap hidup.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Villager: 9 } },
 { name: 'Chaos Ringan', note: 'Lebih banyak agenda sosial agar voting besar tidak monoton.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Idiot: 1, Villager: 6 } },
 { name: 'Aksi Malam', note: 'Paket aksi malam lengkap dengan Martyr sebagai perlindungan siang.', roles: { Werewolf: 5, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Martyr: 1, Villager: 6 } },
 { name: 'Expert', note: 'Banyak lapisan bluff dan informasi untuk meja berpengalaman.', roles: { Werewolf: 4, Infector: 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Bodyguard: 1, Survivor: 1, Villager: 6 } }
 ],
 24: [
 { name: 'Klasik', note: 'Lima serigala dengan desa sangat besar dan alur tetap sederhana.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 12 } },
 { name: 'Seimbang', note: 'Desa punya banyak alat, serigala tetap unggul jumlah tersembunyi.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Gravedigger: 1, Villager: 9 } },
 { name: 'Chaos Ringan', note: 'Netral sosial dan Mason membuat meja besar lebih berlapis.', roles: { Werewolf: 5, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Idiot: 1, Villager: 7 } },
 { name: 'Aksi Malam', note: 'Semua fase punya keputusan penting untuk moderator dan pemain.', roles: { Werewolf: 5, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Martyr: 1, 'Hunters Apprentice': 1, Villager: 6 } },
 { name: 'Expert', note: 'White Wolf menciptakan ketegangan di faksi serigala pada grup besar.', roles: { Werewolf: 4, 'White Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Bodyguard: 1, Survivor: 1, Villager: 7 } }
 ],
25: [
 { name: 'Klasik', note: 'Enam serigala untuk meja maksimum dengan struktur tetap jelas.', roles: { Werewolf: 6, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, Villager: 12 } },
 { name: 'Seimbang', note: 'Desa diberi banyak alat untuk menahan tekanan enam serigala.', roles: { Werewolf: 6, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Mayor: 1, Tracker: 1, Bodyguard: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Gravedigger: 1, Villager: 9 } },
 { name: 'Chaos Ringan', note: 'Voting besar punya banyak jebakan sosial dan hubungan rahasia.', roles: { Werewolf: 6, Seer: 1, Guardian: 1, Witch: 1, Hunter: 1, Jester: 1, Cupid: 1, Prince: 1, Mayor: 1, 'Mason 1': 1, 'Mason 2': 1, 'Little Girl': 1, Idiot: 1, Villager: 7 } },
 { name: 'Aksi Malam', note: 'Preset paling ramai untuk grup besar yang ingin banyak aksi.', roles: { Werewolf: 6, Seer: 1, Witch: 1, Tracker: 1, Bodyguard: 1, 'Tavern Keeper': 1, Hunter: 1, Mayor: 1, 'Tough Guy': 1, 'Apprentice Seer': 1, Guardian: 1, Gravedigger: 1, Martyr: 1, 'Hunters Apprentice': 1, Villager: 6 } },
 { name: 'Expert', note: 'Faksi serigala kompleks, bluff tebal, dan netral kecil untuk tekanan siang.', roles: { Werewolf: 5, 'Alpha Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Cursed: 1, Lycan: 1, Thief: 1, 'Bounty Hunter': 1, Prince: 1, 'Apprentice Seer': 1, Bodyguard: 1, Survivor: 1, Villager: 7 } }
 ]
 };

 function getAdditionalPresetWolfCount(playerCount) {
 if (playerCount <= 6) return 1;
 if (playerCount <= 10) return 2;
 if (playerCount <= 15) return 3;
 if (playerCount <= 20) return 4;
 if (playerCount <= 24) return 5;
 return 6;
 }

 function addConditionalRole(roles, role, enabled) {
 if (enabled) roles[role] = 1;
 return roles;
 }

 function createAdditionalRoleRecommendation(playerCount, name, note, roles) {
 const cleanedRoles = {};
 Object.entries(roles).forEach(([role, count]) => {
 if (count > 0) cleanedRoles[role] = count;
 });
 const assignedTotal = getRoleCompositionTotal(cleanedRoles);
 const villagerCount = playerCount - assignedTotal;
 if (villagerCount > 0) cleanedRoles.Villager = (cleanedRoles.Villager || 0) + villagerCount;
 return { name, note, roles: cleanedRoles };
 }

 function buildSlyWolfPresetRoles(playerCount, wolfCount) {
 if (playerCount <= 6) {
 const roles = { Werewolf: wolfCount, Seer: 1, Lycan: 1 };
 return addConditionalRole(roles, 'Cursed', playerCount >= 6);
 }
 if (playerCount <= 10) {
 return { Werewolf: wolfCount - 1, 'Alpha Wolf': 1, Seer: 1, Lycan: 1, Cursed: 1 };
 }
 if (playerCount <= 15) {
 return { Werewolf: wolfCount - 1, 'Alpha Wolf': 1, Minion: 1, 'Aura Seer': 1, Witch: 1, Lycan: 1, Cursed: 1 };
 }
 return { Werewolf: wolfCount - 1, 'Alpha Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Witch: 1, Lycan: 1, Cursed: 1, Thief: 1 };
 }

 function buildBluffExpertPresetRoles(playerCount, wolfCount) {
 if (playerCount <= 6) {
 const roles = { Werewolf: wolfCount, 'Aura Seer': 1, Cupid: 1, Cursed: 1 };
 return addConditionalRole(roles, 'Thief', playerCount >= 6);
 }
 if (playerCount <= 10) {
 return { Werewolf: wolfCount, 'Aura Seer': 1, Thief: 1, Doppelganger: 1, Cursed: 1 };
 }
 if (playerCount <= 15) {
 return { Werewolf: wolfCount - 1, 'Alpha Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Thief: 1, 'Bounty Hunter': 1, Cursed: 1, Lycan: 1 };
 }
 const roles = { Werewolf: wolfCount - 1, 'White Wolf': 1, Minion: 1, Sorcerer: 1, 'Aura Seer': 1, Thief: 1, 'Bounty Hunter': 1, Survivor: 1, Cursed: 1, Lycan: 1, 'Apprentice Seer': 1 };
 return addConditionalRole(roles, 'Arsonist', playerCount >= 21);
 }

 function buildAdditionalRoleRecommendations(playerCount) {
 const wolfCount = getAdditionalPresetWolfCount(playerCount);
 const recommendation = (name, note, roles) => createAdditionalRoleRecommendation(playerCount, name, note, roles);

 const protectionRoles = { Werewolf: wolfCount, Guardian: 1, Witch: 1, Bodyguard: 1 };
 addConditionalRole(protectionRoles, 'Tough Guy', playerCount >= 9);
 addConditionalRole(protectionRoles, 'Veteran', playerCount >= 13);

 const investigationRoles = { Werewolf: wolfCount, Seer: 1, 'Aura Seer': 1 };
 addConditionalRole(investigationRoles, 'Tracker', playerCount >= 7);
 addConditionalRole(investigationRoles, 'Gravedigger', playerCount >= 12);
 addConditionalRole(investigationRoles, 'Apprentice Seer', playerCount >= 15);

 const neutralSocialRoles = { Werewolf: wolfCount, Seer: 1, Jester: 1 };
 addConditionalRole(neutralSocialRoles, 'Cupid', playerCount >= 6);
 addConditionalRole(neutralSocialRoles, 'Prince', playerCount >= 8);
 addConditionalRole(neutralSocialRoles, 'Idiot', playerCount >= 13);
 addConditionalRole(neutralSocialRoles, 'Bounty Hunter', playerCount >= 17);

 const thirdKillerRoles = { Werewolf: wolfCount, 'Serial Killer': 1, Seer: 1, Guardian: 1 };
 addConditionalRole(thirdKillerRoles, 'Witch', playerCount >= 9);
 addConditionalRole(thirdKillerRoles, 'Bodyguard', playerCount >= 12);
 addConditionalRole(thirdKillerRoles, 'Survivor', playerCount >= 18);
 addConditionalRole(thirdKillerRoles, 'Vampire', playerCount >= 21);

 const busyNightRoles = { Werewolf: wolfCount, Seer: 1, Witch: 1 };
 addConditionalRole(busyNightRoles, 'Tracker', playerCount >= 7);
 addConditionalRole(busyNightRoles, 'Tavern Keeper', playerCount >= 8);
 addConditionalRole(busyNightRoles, 'Bodyguard', playerCount >= 10);
 addConditionalRole(busyNightRoles, 'Wizard', playerCount >= 14);
 addConditionalRole(busyNightRoles, 'Gravedigger', playerCount >= 18);

 const villagePoliticsRoles = { Werewolf: wolfCount, Seer: 1, Mayor: 1, Hunter: 1 };
 addConditionalRole(villagePoliticsRoles, 'Prince', playerCount >= 8);
 addConditionalRole(villagePoliticsRoles, 'Sheriff', playerCount >= 12);
 addConditionalRole(villagePoliticsRoles, 'Priest', playerCount >= 15);
 addConditionalRole(villagePoliticsRoles, 'Mason 1', playerCount >= 16);
 addConditionalRole(villagePoliticsRoles, 'Mason 2', playerCount >= 16);

 return [
 recommendation('Pemula Cepat', 'Ritme sederhana dengan info dan proteksi dasar.', { Werewolf: wolfCount, Seer: 1, Guardian: 1 }),
 recommendation('Debat Sosial', 'Mayor dan Hunter membuat siang terasa penting tanpa malam terlalu padat.', addConditionalRole({ Werewolf: wolfCount, Seer: 1, Mayor: 1 }, 'Hunter', playerCount >= 8)),
 recommendation('Proteksi Berat', 'Banyak pertahanan untuk permainan yang memberi desa waktu membaca pola.', protectionRoles),
 recommendation('Investigasi Tebal', 'Beberapa sumber informasi membantu desa membangun argumen bertahap.', investigationRoles),
 recommendation('Serigala Licin', 'Kubu serigala punya ruang bluff, sementara desa masih punya alat baca.', buildSlyWolfPresetRoles(playerCount, wolfCount)),
 recommendation('Netral Sosial', 'Role netral sosial membuat voting lebih tajam tanpa menambah terlalu banyak kill.', neutralSocialRoles),
 recommendation('Pembunuh Ketiga', 'Ancaman pembunuh mandiri mengubah prioritas desa dan serigala.', thirdKillerRoles),
 recommendation('Malam Padat', 'Banyak aksi malam untuk grup yang suka keputusan berlapis.', busyNightRoles),
 recommendation('Politik Desa', 'Kekuatan siang dan figur publik membuat diskusi lebih strategis.', villagePoliticsRoles),
 recommendation('Bluff Expert', 'Preset penuh tipu daya untuk meja yang sudah akrab dengan role lanjutan.', buildBluffExpertPresetRoles(playerCount, wolfCount))
 ];
 }

 Object.keys(ROLE_COMPOSITION_RECOMMENDATIONS).forEach(playerCount => {
 ROLE_COMPOSITION_RECOMMENDATIONS[playerCount].push(...buildAdditionalRoleRecommendations(Number(playerCount)));
 });

 let selectedRoleRecommendationIndex = 0;
 let lastRoleRecommendationPlayerCount = null;

 function getRoleRecommendationOptions(playerCount = gameState.players.length) {
 return ROLE_COMPOSITION_RECOMMENDATIONS[playerCount] || [];
 }

 function getSelectedRoleRecommendation(playerCount = gameState.players.length) {
 const options = getRoleRecommendationOptions(playerCount);
 if (selectedRoleRecommendationIndex >= options.length) selectedRoleRecommendationIndex = 0;
 return options[selectedRoleRecommendationIndex] || null;
 }

 function selectRoleRecommendation(index) {
 index = Number(index);
 const options = getRoleRecommendationOptions();
 if (!options[index]) return;
 selectedRoleRecommendationIndex = index;
 renderRoleRecommendation();
 }

 function getRecommendedRoleComposition(playerCount = gameState.players.length) {
 const rec = getSelectedRoleRecommendation(playerCount);
 if (!rec) return { roles: {}, note: playerCount > 25 ? 'Rekomendasi otomatis tersedia sampai 25 pemain.' : 'Minimal 5 pemain untuk rekomendasi role.' };
 return rec;
 }

 function getRoleCompositionTotal(roles) {
 return Object.values(roles || {}).reduce((total, count) => total + count, 0);
 }

 function renderRoleRecommendation() {
 const panel = document.getElementById('roleRecommendationPanel');
 if (!panel) return;
 const playerCount = gameState.players.length;
 if (lastRoleRecommendationPlayerCount !== playerCount) {
 selectedRoleRecommendationIndex = 0;
 lastRoleRecommendationPlayerCount = playerCount;
 }
 const options = getRoleRecommendationOptions(playerCount);
 if (playerCount < 5) {
 panel.innerHTML = `<div class="empty-state-text">Tambahkan minimal 5 pemain untuk melihat rekomendasi role.</div>`;
 return;
 }
 if (playerCount > 25) {
 panel.innerHTML = `<div class="empty-state-text">Rekomendasi otomatis tersedia untuk 5 sampai 25 pemain. Atur role manual untuk ${playerCount} pemain.</div>`;
 return;
 }
 if (selectedRoleRecommendationIndex >= options.length) selectedRoleRecommendationIndex = 0;
 const selectedRec = options[selectedRoleRecommendationIndex];
 const entries = Object.entries(selectedRec.roles);
 const total = getRoleCompositionTotal(selectedRec.roles);
 panel.innerHTML = `
 <div class="role-rec-head">
 <div>
 <div class="role-rec-title">Rekomendasi Komposisi</div>
 <div class="role-rec-copy">Pilih preset ringkas untuk ${playerCount} pemain aktif.</div>
 </div>
 <span class="player-count-pill">${playerCount} pemain</span>
 </div>
 <div class="role-rec-compact">
 <select class="form-select role-rec-select" onchange="selectRoleRecommendation(this.value)" aria-label="Pilih rekomendasi komposisi role">
 ${options.map((rec, index) => {
 return `<option value="${index}" ${index === selectedRoleRecommendationIndex ? 'selected' : ''}>${escapeHtml(rec.name)}</option>`;
 }).join('')}
 </select>
 <div class="role-rec-summary">
 <div class="role-rec-option-head">
 <span class="role-rec-option-name">${escapeHtml(selectedRec.name)}</span>
 <span class="role-rec-option-total">${total}/${playerCount}</span>
 </div>
 <div class="role-rec-option-note">${escapeHtml(selectedRec.note)}</div>
 <div class="role-rec-list">
 ${entries.map(([role, count]) => `<span class="role-rec-pill">${roleAssetIconMarkup(role, 'role-inline-icon')} ${escapeHtml(role)} x${count}</span>`).join('')}
 </div>
 </div>
 </div>`;
 hydrateWerewolfIcons(panel);
 }

 function applyRecommendedRoles() {
 const rec = getRecommendedRoleComposition();
 if (Object.keys(rec.roles).length === 0) {
 const message = gameState.players.length > 25 ? 'Rekomendasi otomatis tersedia sampai 25 pemain.' : 'Tambahkan minimal 5 pemain dulu.';
 return showToast(message, 'warning');
 }
 gameState.roles = Object.assign({}, rec.roles);
 gameState.rolesSubmitted = false;
 gameState.players.forEach(p => { p.role = null; });
 scheduleModeratorRender({ players: true, roles: true, stats: true });
 if (typeof saveState === 'function') saveState();
 showToast(`Rekomendasi ${rec.name} diterapkan. Klik Acak Role Otomatis untuk membagikan.`, 'success');
 }

 function updateStartGameButtonState() {
 const btn = document.getElementById('btnStartGame');
 const submitBtn = document.getElementById('btnSubmitRoles');
 if (!btn && !submitBtn) return;

 const playerCount = gameState.players.length;
 const totalRoles = getSelectedRoleCount();
 const playersWithoutRole = gameState.players.filter(p => !p.role).length;
 const canSubmitRoles = playerCount >= 1 && totalRoles === playerCount && playersWithoutRole === 0;

 const mason1Count = gameState.roles['Mason 1'] || 0;
 const mason2Count = gameState.roles['Mason 2'] || 0;
 const masonsBalanced = mason1Count === mason2Count;

 if (submitBtn) submitBtn.disabled = !canSubmitRoles || !masonsBalanced;

 if (btn && mason1Count !== mason2Count) {
 btn.disabled = true;
 // Optional: show warning text for Masons pairing
 } else if (btn) {
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
 gameState.rolesSubmitted = false;
 gameState.players.forEach(p => { p.role = null; });

	 const key = getRoleControlKey(role);
 const el = document.getElementById('rc-' + key);
 if (el) el.textContent = gameState.roles[role];
 updateStartGameButtonState();
 updateSetupRoleHeaderCount();
 if (typeof saveState === 'function') saveState();
 }

 function toggleRole(role) {
 if (!gameState.roles[role]) gameState.roles[role] = 0;

 if (gameState.roles[role] > 0) {
 gameState.roles[role] = 0;
 } else {
 gameState.roles[role] = 1;
 }
 gameState.rolesSubmitted = false;
 gameState.players.forEach(p => { p.role = null; });

	 const key = getRoleControlKey(role);
 const el = document.getElementById('toggle-' + key);
 if (el) {
 if (gameState.roles[role] > 0) {
 el.classList.add('active');
 } else {
 el.classList.remove('active');
 }
 }
 updateStartGameButtonState();
 updateSetupRoleHeaderCount();
 if (typeof saveState === 'function') saveState();
 }

 function clearAllRoles() {
 gameState.roles = {};
 gameState.rolesSubmitted = false;
 scheduleModeratorRender({ roles: true });
 gameState.players.forEach(p => p.role = null);
 scheduleModeratorRender({ players: true });
 if (typeof saveState === 'function') saveState();
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
 gameState.rolesSubmitted = false;

 // Shuffle and assign
 customRolePool = shuffleArray(customRolePool);

 // Assign to players
 gameState.players.forEach((p, i) => {
 p.role = customRolePool[i];
 });

 scheduleModeratorRender({ players: true, roles: true });
 if (typeof saveState === 'function') saveState();
 showToast('Role telah diacak ke pemain!', 'success');
 }

 function getRoleSubmissionError() {
 const playerCount = gameState.players.length;
 if (playerCount === 0) return 'Tambahkan pemain terlebih dahulu!';

 const totalRoles = Object.values(gameState.roles || {}).reduce((a, b) => a + b, 0);
 if (totalRoles < playerCount) return 'Role belum cukup untuk semua pemain. Klik Acak Role Otomatis dulu.';
 if (totalRoles > playerCount) return `Jumlah role (${totalRoles}) lebih banyak dari pemain (${playerCount})! Kurangi role.`;

 const playersWithoutRole = gameState.players.filter(p => !p.role);
 if (playersWithoutRole.length > 0) {
 const preview = playersWithoutRole.slice(0, 3).map(p => p.name).join(', ');
 const extra = playersWithoutRole.length > 3 ? ` dan ${playersWithoutRole.length - 3} lainnya` : '';
 return `Masih ada pemain tanpa role: ${preview}${extra}. Klik Acak Role Otomatis dulu.`;
 }

 const mason1Count = gameState.roles['Mason 1'] || 0;
 const mason2Count = gameState.roles['Mason 2'] || 0;
 if (mason1Count !== mason2Count) return 'Mason 1 dan Mason 2 harus berpasangan dengan jumlah yang sama.';

 return '';
 }

 function submitRoles() {
 const error = getRoleSubmissionError();
 if (error) return showToast(error, 'warning');
 if (!db || !onlineRoomCode || !roomPlayersRef || !roomMetaRef) {
 return showToast('Buat atau sambungkan room online dulu agar role bisa muncul di layar player.', 'warning');
 }

 gameState.rolesSubmitted = true;
 if (typeof saveState === 'function') saveState();
 if (typeof pushAnnouncement === 'function') {
 pushAnnouncement('info', 'Role Dibagikan', 'Role sudah dibagikan. Buka kartu role masing-masing sebelum game dimulai.', { rolePreview: true });
 }
 scheduleModeratorRender({ players: true, roles: true, stats: true });
 showToast('Role dikirim ke layar setiap player.', 'success');
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
