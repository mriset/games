        // ==================== FIREBASE CONFIG AND INIT ====================
        // GANTI CONFIG INI DENGAN CONFIG DARI FIREBASE CONSOLE PROJECT KAMU!
        const firebaseConfig = {
            apiKey: "AIzaSyBiFLIVROIksZMPS5kl3-ijiNnD6G1L8Lk",
            authDomain: "wwonline-e773c.firebaseapp.com",
            databaseURL: "https://wwonline-e773c-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "wwonline-e773c",
            storageBucket: "wwonline-e773c.firebasestorage.app",
            messagingSenderId: "399653834294",
            appId: "1:399653834294:web:42b78b940a4d3512e29297",
            measurementId: "G-BCRC7M0Q7T"
        };

        let db = null;
        let onlineRoomCode = null;
        let roomPlayersRef = null;
        let roomMetaRef = null;
        let timerRef = null;

        if (Object.keys(firebaseConfig).length > 0) {
            try {
                firebase.initializeApp(firebaseConfig);
                db = firebase.database();
                
                // Connection state listener
                db.ref(".info/connected").on("value", (snap) => {
                    if (snap.val() === true) {
                        console.log("Firebase Connected");
                    } else {
                        console.warn("Firebase Disconnected");
                    }
                });
            } catch (e) {
                console.error("Firebase init error:", e);
            }
        } else {
            console.warn("Firebase tidak terkonfigurasi. Online Mode tidak akan berjalan. Cek konfigurasi Firebase di file HTML.");
        }

        // ==================== GAME STATE ====================
        let gameState = {
            phase: 'setup', // setup, night, day, gameover
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

        // ==================== PERSISTENCE ====================
        const SAVE_KEY = 'werewolf_moderator_state';

        function saveState() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
                if (onlineRoomCode) {
                    localStorage.setItem('werewolf_online_room', onlineRoomCode);
                }
            } catch (e) {
                // Quota exceeded or private mode — silently ignore
            }
            if (onlineRoomCode) {
                pushGameStateToFirebase();
            }
        }

        // ==================== FIREBASE ONLINE MODE ====================
        function generateRoomCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        const CREATE_ROOM_PIN = '183729';

        function verifyCreateRoomPin() {
            const pin = window.prompt('Masukkan PIN untuk membuat room:');
            if (pin === null) return false;

            if (String(pin).trim() !== CREATE_ROOM_PIN) {
                showToast('PIN salah. Room tidak dibuat.', 'error');
                return false;
            }

            return true;
        }

        function createOnlineRoom(skipPinCheck = false) {
            if (!skipPinCheck && !verifyCreateRoomPin()) return;

            if (!db) {
                return showToast('Firebase belum terkonfigurasi!', 'error');
            }
            onlineRoomCode = generateRoomCode();
            attachRoomListeners(onlineRoomCode);
            saveState();
        }

        function attachRoomListeners(code) {
            onlineRoomCode = code;
            roomMetaRef = db.ref(`rooms/${onlineRoomCode}/meta`);
            roomPlayersRef = db.ref(`rooms/${onlineRoomCode}/players`);
            timerRef = db.ref(`rooms/${onlineRoomCode}/timer`);

            // Register/Update room info
            roomMetaRef.update({
                phase: gameState.phase,
                day: gameState.day,
                gameStarted: gameState.started,
                announcement: "Selamat datang di Room Werewolf!",
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                console.log("Room meta updated in Firebase");
            }).catch(err => {
                console.error("Firebase Room Meta Error:", err);
                alert("Gagal koneksi ke Firebase: " + err.message + "\n\nPeriksa apakah Realtime Database sudah di-enable dan Rules-nya 'public'.");
            });

            // Listen to joined players
            roomPlayersRef.on('child_added', snapshot => {
                const pd = snapshot.val();
                const pId = snapshot.key; // We use the push key as player ID

                // Cek apakah pemain sudah ada
                if (!gameState.players.find(p => p.id === pId)) {
                    gameState.players.push({
                        id: pId,
                        name: pd.name,
                        role: null,
                        alive: true,
                        eliminated: false,
                        notes: ''
                    });
                    renderPlayers();
                    updateStats();
                    initRoleDistribution();
                    showToast(`${pd.name} bergabung ke room!`, 'success');
                    saveState();
                }
            });

            // Update UI
            document.getElementById('onlineModeSetup').style.display = 'none';
            document.getElementById('onlineModeActive').style.display = 'block';
            document.getElementById('roomCodeDisplay').textContent = onlineRoomCode;

            showToast('Mode Online Aktif!', 'success');
        }

        function copyRoomCode() {
            navigator.clipboard.writeText(onlineRoomCode || '').then(() => {
                showToast('Kode room berhasil disalin!', 'success');
            });
        }

        function disconnectRoom() {
            if (!onlineRoomCode) return;

            showConfirm('Tutup Room', 'Tutup room online dan hapus semua data dari database?', 'Tutup & Hapus', true, () => {
                const codeToRemove = onlineRoomCode;
                
                // Remove from Firebase
                db.ref(`rooms/${codeToRemove}`).remove().then(() => {
                    console.log("Room deleted from Firebase");
                }).catch(err => {
                    console.error("Error deleting room:", err);
                });

                // Stop listening
                if (roomPlayersRef) roomPlayersRef.off();
                if (roomMetaRef) roomMetaRef.off();
                if (timerRef) timerRef.off();

                onlineRoomCode = null;
                localStorage.removeItem('werewolf_online_room');
                
                // Update UI
                document.getElementById('onlineModeSetup').style.display = 'block';
                document.getElementById('onlineModeActive').style.display = 'none';
                showToast('Room telah ditutup dan dihapus.', 'info');
            });
        }

        function pushGameStateToFirebase() {
            if (!db || !onlineRoomCode) return;
            try {
                // Update Meta
                db.ref(`rooms/${onlineRoomCode}/meta`).update({
                    phase: gameState.phase,
                    day: gameState.day,
                    gameStarted: gameState.started
                });

                // Update players (only the ones present locally)
                const updates = {};
                gameState.players.forEach(p => {
                    updates[p.id] = {
                        name: p.name,
                        role: p.role,
                        alive: p.alive,
                        eliminated: p.eliminated
                    };
                });
                // Note: ini tidak menghapus pemain yang terputus, dsb
                // untuk kemudahan.
                roomPlayersRef.update(updates);
            } catch (e) {
                console.error("Firebase sync error: ", e);
            }
        }

        function pushTimerStateToFirebase() {
            if (!db || !onlineRoomCode) return;
            try {
                timerRef.set({
                    running: _timerRunning,
                    secondsLeft: _timerSeconds,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (e) {
                console.error("Firebase timer sync error: ", e);
            }
        }

        function loadState() {
            try {
                const raw = localStorage.getItem(SAVE_KEY);
                if (!raw) return false;
                const saved = JSON.parse(raw);
                // Merge into gameState so any new fields from code updates have defaults
                gameState = Object.assign(gameState, saved);
                // Restore nested nightState safely
                if (saved.nightState) {
                    gameState.nightState = Object.assign(gameState.nightState || {}, saved.nightState);
                }
                return true;
            } catch (e) {
                localStorage.removeItem(SAVE_KEY);
                return false;
            }
        }

        function clearSavedState() {
            localStorage.removeItem(SAVE_KEY);
        }

        const ROLE_DEFINITIONS = {
            'Werewolf': { name: 'Serigala Biasa', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Bangun tiap malam bersama kawanan, sepakat memilih 1 target untuk dicabik-cabik.', count: 0, priority: 1 },
            'Alpha Wolf': { name: 'Alpha Wolf', icon: '👑', category: 'wolf', team: 'Werewolf', description: 'Sekali seumur permainan, dapat memberikan gigitan maut, ATAU merekrut 1 pemain non-serigala untuk menjadi Werewolf.', count: 0, priority: 2 },
            'Lone Wolf': { name: 'Serigala Liar', icon: '🐺', category: 'villager', team: 'Villager', description: 'Dianggap sebagai Warga Biasa. Namun, jika ia diincar oleh Werewolf di malam hari, ia batal mati dan seketika berubah sepenuhnya menjadi Werewolf.', count: 0, priority: 3 },
            'Seer': { name: 'Sang Peramal', icon: '🔮', category: 'villager', team: 'Villager', description: 'Menunjuk 1 pemain tiap malam. Mengetahui secara pasti apakah targetnya faksi Serigala atau bukan.', count: 0, priority: 5 },
            'Guardian': { name: 'Sang Pelindung', icon: '🛡️', category: 'villager', team: 'Villager', description: 'Melindungi 1 pemain dari kematian di malam hari. Syarat: Tidak bisa melindungi orang yang sama dua malam berturut-turut.', count: 0, priority: 6 },
            'Witch': { name: 'Sang Penyihir', icon: '🧪', category: 'villager', team: 'Villager', description: 'Punya 1 Ramuan Hidup (menyelamatkan korban) dan 1 Ramuan Mati (membunuh). Masing-masing hanya bisa dipakai satu kali.', count: 0, priority: 7 },
            'Wizard': { name: 'Penyihir Agung', icon: '🧙', category: 'villager', team: 'Villager', description: 'Hingga 3x per permainan, bisa membungkam 1 pemain di malam hari. Target yang dibungkam tidak bisa menggunakan kemampuannya malam itu.', count: 0, priority: 8 },
            'Hunter': { name: 'Sang Pemburu', icon: '🏹', category: 'villager', team: 'Villager', description: 'Jika mati (dibunuh malam/digantung siang), berhak langsung menembak mati 1 pemain lain sebelum keluar.', count: 0, priority: 9 },
            'Veteran': { name: 'Sang Veteran', icon: '⚔️', category: 'villager', team: 'Villager', description: 'Punya jatah 2x "Siaga" di malam hari. Siapapun yang mengunjunginya dengan niat membunuh akan tertembak mati.', count: 0, priority: 10 },
            'Bodyguard': { name: 'Perisai Hidup', icon: '💂', category: 'villager', team: 'Villager', description: 'Melindungi 1 pemain. Jika target diserang, Bodyguard mati menggantikannya, TETAPI sang penyerang ikut mati seketika.', count: 0, priority: 11 },
            'Priest': { name: 'Sang Pendeta', icon: '⛪', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa menyiram Air Suci ke 1 pemain. Jika targetnya Serigala mati. Jika baik, Pendeta yang otomatis mati.', count: 0, priority: 12 },
            'Mayor': { name: 'Sang Walikota', icon: '🏛️', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa membuka identitasnya. Sejak saat itu, suaranya dihitung sebagai 2 vote dalam eksekusi.', count: 0, priority: 13 },
            'Sheriff': { name: 'Sang Sheriff', icon: '⭐', category: 'villager', team: 'Villager', description: 'Punya 1 peluru. Di siang hari, bisa menembak mati 1 pemain tanpa voting. Jika ia menembak orang baik, Sheriff bunuh diri.', count: 0, priority: 14 },
            'Jester': { name: 'Sang Badut', icon: '🃏', category: 'neutral', team: 'Neutral', description: 'Tujuan tunggalnya memanipulasi warga agar curiga padanya. Jika berhasil divote mati, ia langsung MENANG MUTLAK.', count: 0, priority: 15 },
            'Cupid': { name: 'Sang Pemikat', icon: '💕', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, merantai 2 pemain. Jika salah satu mati, pasangannya ikut mati karena patah hati.', count: 0, priority: 16 },
            'Doppelganger': { name: 'Sang Peniru', icon: '🎭', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, menunjuk 1 pemain. Begitu pemain itu mati, langsung mewarisi peran, faksi, dan kekuatannya.', count: 0, priority: 17 },
            'Serial Killer': { name: 'Pembunuh Berantai', icon: '🔪', category: 'neutral', team: 'Neutral', description: 'Bangun setiap malam sendirian untuk membunuh 1 orang. Kebal dari serangan Serigala. Menang jika jadi pemain terakhir.', count: 0, priority: 18 },
            'Idiot': { name: 'Si Pandir', icon: '😅', category: 'neutral', team: 'Neutral', description: 'Jika digantung di siang hari, ia batal mati, namun kehilangan hak suara (vote) selamanya.', count: 0, priority: 19 },
            'Prince': { name: 'Sang Pangeran', icon: '🤴', category: 'neutral', team: 'Neutral', description: 'Jika divote mati, identitasnya terbuka dan eksekusi batal. Tetap mempertahankan hak suaranya untuk hari berikutnya.', count: 0, priority: 20 },
            'Little Girl': { name: 'Gadis Kecil', icon: '👧', category: 'neutral', team: 'Neutral', description: 'Boleh membuka mata saat serigala berdiskusi. Jika ketahuan dan ditunjuk, ia langsung mati tanpa bisa dilindungi.', count: 0, priority: 21 },
            'Villager': { name: 'Warga Biasa', icon: '👥', category: 'villager', team: 'Villager', description: 'Tidak punya kemampuan gaib. Senjata murninya adalah logika, manipulasi argumen, dan hak suara di siang hari.', count: 0, priority: 22 },

            // === WOLF TEAM ===
            'Wolf Cub': { name: 'Anak Serigala', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Werewolf biasa yang sangat disayangi kawanannya. Jika mati dibunuh warga, kawanan dapat membunuh 2 orang malam berikutnya.', count: 0, priority: 4 },
            'Minion': { name: 'Kaki Tangan', icon: '🕵️', category: 'wolf', team: 'Werewolf', description: 'Manusia yang memihak Serigala. Tahu siapa saja Werewolf sejak awal, namun para Werewolf tidak tahu siapa dia.', count: 0, priority: 4.5 },
            'Sorcerer': { name: 'Penyihir Gelap', icon: '🧿', category: 'wolf', team: 'Werewolf', description: 'Menerawang setiap malam untuk mencari tahu siapa Seer asli. Tidak bangun bersama Werewolf.', count: 0, priority: 5.5 },
            'Infector': { name: 'Penginfeksi', icon: '🦠', category: 'wolf', team: 'Werewolf', description: '1x per game: mengubah korban serangan wolf menjadi Werewolf baru alih-alih membunuhnya.', count: 0, priority: 2.5 },
            'White Wolf': { name: 'Serigala Putih', icon: '🐺', category: 'wolf', team: 'Werewolf', description: 'Bangun setiap malam bersama kawanan. Setiap dua malam sekali, terbangun sendirian untuk memangsa sesama Werewolf.', count: 0, priority: 3.5 },

            // === VILLAGER TEAM ===
            'Tough Guy': { name: 'Jagoan', icon: '💪', category: 'villager', team: 'Villager', description: 'Jika diserang Werewolf di malam hari, baru mati di malam berikutnya (masih hidup seharian penuh).', count: 0, priority: 22.5 },
            'Mason 1': { name: 'Pekerja Batuan 1', icon: '⛏️', category: 'villager', team: 'Villager', description: 'Di malam pertama membuka mata untuk melihat Mason 2. Keduanya saling memastikan 100% pihak warga.', count: 0, priority: 23 },
            'Mason 2': { name: 'Pekerja Batuan 2', icon: '⛏️', category: 'villager', team: 'Villager', description: 'Pasangan Mason 1. Di malam pertama membuka mata bersama Mason 1. Keduanya 100% terpercaya satu sama lain.', count: 0, priority: 23.5 },
            'Lycan': { name: 'Serigala Jinak', icon: '🐾', category: 'villager', team: 'Villager', description: 'Sepenuhnya memihak warga desa. Namun jika diterawang Seer, identitasnya terbaca sebagai Werewolf.', count: 0, priority: 22.8 },
            'Cursed': { name: 'Terkutuk', icon: '😈', category: 'villager', team: 'Villager', description: 'Jika diserang Werewolf, tidak mati melainkan langsung berubah menjadi Werewolf baru.', count: 0, priority: 22.9 },
            'Apprentice Seer': { name: 'Murid Peramal', icon: '🔮', category: 'villager', team: 'Villager', description: 'Begitu Seer asli mati, mewarisi bola kristalnya dan dapat menerawang setiap malam selanjutnya.', count: 0, priority: 23.1 },
            'Gravedigger': { name: 'Penggali Kubur', icon: '⚰️', category: 'villager', team: 'Villager', description: 'Di malam hari, diberi tahu Moderator apa peran asli pemain yang baru dieksekusi warga pada siang harinya.', count: 0, priority: 23.2 },
            'Drunk': { name: 'Pemabuk', icon: '🍺', category: 'villager', team: 'Villager', description: 'Jika digigit Werewolf, wolf tersebut keracunan dan kehilangan kemampuan membunuh malam berikutnya. Pemabuk tetap mati.', count: 0, priority: 22.7 },
            'Tavern Keeper': { name: 'Penjaga Kedai', icon: '🍻', category: 'villager', team: 'Villager', description: 'Setiap malam, memilih 1 pemain untuk diajak minum. Orang itu mabuk dan tidak bisa menggunakan kemampuannya malam itu.', count: 0, priority: 11.5 },
            'Aura Seer': { name: 'Peramal Aura', icon: '👁️', category: 'villager', team: 'Villager', description: 'Tidak bisa melihat role spesifik, tapi mengetahui faksi seseorang: Warga, Serigala, atau Netral.', count: 0, priority: 5.1 },
            'Martyr': { name: 'Martir', icon: '✝️', category: 'villager', team: 'Villager', description: 'Di siang hari, bisa mengorbankan nyawanya untuk menyelamatkan pemain lain yang akan dieksekusi.', count: 0, priority: 23.3 },
            'Tracker': { name: 'Pelacak', icon: '🔍', category: 'villager', team: 'Villager', description: 'Memilih 1 orang malam hari. Moderator memberi tahu siapa yang dikunjungi orang tersebut malam itu.', count: 0, priority: 5.2 },
            'Hunters Apprentice': { name: 'Murid Pemburu', icon: '🏹', category: 'villager', team: 'Villager', description: 'Jika Hunter asli mati, dia mengambil senjatanya dan mendapat 1 peluru yang bisa ditembakkan kapan saja.', count: 0, priority: 9.5 },

            // === NEUTRAL TEAM ===
            'Amnesiac': { name: 'Hilang Ingatan', icon: '🌀', category: 'neutral', team: 'Neutral', description: 'Di malam ke-3, bisa memilih untuk mengambil alih 1 peran dari pemain yang sudah mati.', count: 0, priority: 21.5 },
            'Thief': { name: 'Pencuri', icon: '🎴', category: 'neutral', team: 'Neutral', description: 'Di malam pertama, menukar kartu perannya dengan kartu milik pemain lain tanpa mereka sadari.', count: 0, priority: 16.5 },
            'Survivor': { name: 'Penyintas', icon: '🛡️', category: 'neutral', team: 'Neutral', description: 'Tujuannya hanya hidup sampai akhir. Punya 1 rompi pelindung kebal dari serangan (1x pakai).', count: 0, priority: 21.8 },
            'Cult Leader': { name: 'Pemimpin Sekte', icon: '🌑', category: 'neutral', team: 'Neutral', description: 'Setiap malam merekrut 1 anggota. Menang mandiri jika semua pemain hidup yang tersisa adalah anggota sektenya.', count: 0, priority: 21.9 },
            'Vampire': { name: 'Vampir', icon: '🧛', category: 'neutral', team: 'Neutral', description: 'Faksi ketiga yang memusuhi Desa dan Serigala. Membunuh 1 orang setiap malamnya secara mandiri.', count: 0, priority: 18.5 },
            'Troublemaker': { name: 'Pembuat Onar', icon: '🃏', category: 'neutral', team: 'Neutral', description: 'Satu kali di malam hari, menukar kartu peran dua pemain lain tanpa melihat kartunya.', count: 0, priority: 17.5 },
            'Bounty Hunter': { name: 'Pemburu Hadiah', icon: '🎯', category: 'neutral', team: 'Neutral', description: 'Di awal game, Moderator menunjuk 1 pemain secara acak sebagai target. Jika target itu digantung warga di siang hari, dia menang sendiri.', count: 0, priority: 20.5 }
        };

        const NIGHT_ORDER = [
            // Lone Wolf sengaja tidak ada di sini — transformasinya terjadi otomatis via processNightDeaths, bukan aksi malam
            'Thief', 'Troublemaker', 'Cupid', 'Mason 1', 'Mason 2', 'Doppelganger', 'White Wolf', 'Werewolf', 'Alpha Wolf', 'Infector', 'Seer', 'Apprentice Seer', 'Aura Seer', 'Sorcerer', 'Tracker', 'Guardian', 'Bodyguard', 'Tavern Keeper', 'Witch', 'Veteran', 'Wizard', 'Gravedigger', 'Amnesiac', 'Cult Leader', 'Vampire', 'Serial Killer', 'Little Girl'
        ];

        // ==================== INITIALIZATION ====================
        document.addEventListener('DOMContentLoaded', () => {
            createParticles();
            const restored = loadState();
            
            // Restore Online Room if exists
            const savedRoom = localStorage.getItem('werewolf_online_room');
            if (savedRoom && db) {
                attachRoomListeners(savedRoom);
            }

            initRoleDistribution();
            renderRoleReference();
            updateStats();
            renderPlayerGroups();
            updatePhaseBanner();
            renderPlayers();
            renderLog();
            if (restored && gameState.players.length > 0) {
                // Restore active tab if game was in progress
                if (gameState.started) {
                    switchTab('dashboard');
                }
                showToast(`💾 Sesi dipulihkan — ${gameState.players.length} pemain`, 'success');
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
            gameState.phase = 'night';
            gameState.day = 1;
            gameState.nightPhase = 0;
            gameState.votes = {};
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
                    addLog('night', `🎯 [MODERATOR ONLY] Bounty Hunter ${bh.name} ditugaskan menarget ${randomTarget.name}.`);
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
                    addLog('night', `🕵️ [MODERATOR ONLY] Minion ${minion.name} mengetahui bahwa Serigala adalah: ${wolves.map(w => w.name).join(', ')}.`);
                }
            }

            gameState.nightState = {
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
            };
            // Alpha Wolf persistent state (survive across nights)
            gameState._alphaAbilityUsed = false;
            gameState._alphaChoice = null;      // 'kill' | 'recruit' | null
            gameState._alphaRecruitDone = false; // true setelah rekrut malam 2 selesai
            // Guard rekursi Cupid cascade
            gameState._processingCouples = false;

            addLog('night', '🎮 Permainan dimulai! Selamat bermain.');
            updatePhaseBanner();
            updateStats();
            switchTab('night');
            showToast('🎮 Game dimulai! Fase malam pertama.', 'success');
        }

        function nextPhase() {
            if (!gameState.started) {
                return startGame();
            }

            if (gameState.phase === 'night') {
                const activeRoles = NIGHT_ORDER.filter(role => {
                    return gameState.players.some(p => p.role === role && p.alive);
                });

                if (gameState.nightPhase < activeRoles.length) {
                    const currentRole = activeRoles[gameState.nightPhase];
                    const roleName = ROLE_DEFINITIONS[currentRole]?.icon ? `${ROLE_DEFINITIONS[currentRole].icon} ${currentRole}` : currentRole;
                    showToast(`🛑 Aksi malam belum selesai! Giliran ${roleName}. Selesaikan atau klik Lewati terlebih dahulu.`, 'error');
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
                document.getElementById('btnPause').innerHTML = '⏸️ Jeda';
            }

            if (gameState.phase === 'day') {
                // Day -> Night
                resetTimer(); // Pastikan timer siang berhenti saat masuk malam
                gameState.phase = 'night';
                gameState.nightPhase = 0;
                gameState.nightState = {
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
                };
                // UI-05 FIX: Increment day SEBELUM showPhaseTransition agar overlay
                // menampilkan nomor malam yang benar (bukan nomor lama).
                gameState.day++;
                showPhaseTransition('night');
                addLog('night', `🌙 Malam #${gameState.day} dimulai.`);
            } else if (gameState.phase === 'night') {
                // Night -> Day
                gameState.phase = 'day';
                resetTimer(); // UI-04 FIX: Pastikan timer malam berhenti/reset saat masuk siang
                // LOGIC-07 FIX: Reset vote setiap siang baru dimulai — diam-diam (tanpa toast)
                // agar vote dari siang sebelumnya (misal saat tie/tidak ada eksekusi)
                // tidak terbawa ke ronde berikutnya.
                gameState.votes = {};
                gameState._lastDayExecuted = null;
                showPhaseTransition('day');
                addLog('day', `☀️ Hari ke-${gameState.day} dimulai.`);

                // Secara otomatis mengumumkan kematian setelah jeda singkat agar overlay transisi berjalan
                setTimeout(() => {
                    announceDeaths();
                }, 1000);
            }

            updatePhaseBanner();
            updateStats();

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
                icon.textContent = '🌙';
                text.textContent = 'MALAM HARI';
                text.style.color = 'var(--accent-purple-light)';
                sub.textContent = `Malam #${gameState.day}. Semua pemain menutup mata...`;
            } else {
                icon.textContent = '☀️';
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
                banner.className = 'header night';
                icon.textContent = '🌙';
                text.textContent = 'MALAM HARI';
                text.className = 'phase-text night';
                dayCount.textContent = `Malam #${gameState.day}`;
                btn.innerHTML = '☀️ Ke Siang Hari';
                if (fab) {
                    fab.className = 'fab visible pulse';
                    fab.innerHTML = '☀️';
                }
            } else if (gameState.phase === 'day') {
                banner.className = 'header day';
                icon.textContent = '☀️';
                text.textContent = 'SIANG HARI';
                text.className = 'phase-text day';
                dayCount.textContent = `Hari ke-${gameState.day}`;
                btn.innerHTML = '🌙 Ke Malam';
                if (fab) {
                    fab.className = 'fab visible pulse';
                    fab.innerHTML = '🌙';
                }
            } else {
                banner.className = 'header night';
                icon.textContent = '⚙️';
                text.textContent = 'SETUP';
                text.className = 'phase-text setup';
                dayCount.textContent = 'Belum mulai';
                btn.innerHTML = '🚀 Mulai Permainan';
                if (fab) {
                    fab.className = 'fab'; // hide FAB during setup
                }
            }
        }

        function togglePause() {
            gameState.isPaused = !gameState.isPaused;
            document.getElementById('btnPause').innerHTML = gameState.isPaused ? '▶️ Lanjut' : '⏸️ Jeda';
            showToast(gameState.isPaused ? 'Game dijeda.' : 'Game dilanjutkan.', 'info');
        }

        // ==================== NIGHT ACTIONS ====================
        function updateNightPanel() {
            if (!gameState.started || gameState.phase !== 'night') {
                document.getElementById('nightNotStarted').style.display = 'block';
                document.getElementById('nightPanel').style.display = 'none';
                return;
            }

            document.getElementById('nightNotStarted').style.display = 'none';
            document.getElementById('nightPanel').style.display = 'block';

            // Guard: Pastikan nightPhase tidak melebihi jumlah peran aktif saat ini jika ada modifikasi dadakan
            const activeRoles = NIGHT_ORDER.filter(role => {
                return gameState.players.some(p => p.role === role && p.alive);
            });
            if (gameState.nightPhase > activeRoles.length) {
                gameState.nightPhase = activeRoles.length;
            }

            renderNightSequence();
            renderNightAction();
        }

        function renderNightSequence() {
            const container = document.getElementById('nightSequence');
            const activeRoles = NIGHT_ORDER.filter(role => {
                return gameState.players.some(p => p.role === role && p.alive);
            });

            let html = '';
            activeRoles.forEach((role, i) => {
                const def = ROLE_DEFINITIONS[role];
                const isActive = i === gameState.nightPhase;
                const isCompleted = i < gameState.nightPhase;

                html += `<div class="night-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" title="${def.icon} ${role}">
${def.icon}
</div>`;
                if (i < activeRoles.length - 1) html += '<div class="night-step-connector"></div>';
            });

            container.innerHTML = html;
        }

        function renderNightAction() {
            const activeRoles = NIGHT_ORDER.filter(role => {
                return gameState.players.some(p => p.role === role && p.alive);
            });

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
            if (gameState._lastNightActionResult && gameState._lastNightActionPhase === gameState.nightPhase) {
                result.innerHTML = gameState._lastNightActionResult;
            } else {
                // UI-02 FIX: Bersihkan hasil aksi sebelumnya di AWAL render, bukan di akhir.
                // Ini memastikan panel hasil selalu kosong sebelum konten role baru muncul.
                result.innerHTML = '';
            }

            title.textContent = `${def.icon} ${currentRole}`;

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
            } else if (currentRole === 'Little Girl') {
                subtitle.textContent = 'Apakah Little Girl ketahuan mengintip?';
                renderLittleGirlAction();

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
<span class="target-icon">${def ? def.icon : '👤'}</span>
<span>${escapeHtml(p.name)}${disabledMsg}</span>
${showRole && p.role ? `<span class="badge badge-${def.category}" style="margin-left:auto;">${p.role}</span>` : ''}
</button>
`;
            }).join('');
        }

        let _alphaModeUI = 'kill'; // UI-only state
        function setAlphaMode(mode) {
            _alphaModeUI = mode;
            const btnKill = document.getElementById('alphaModeKill');
            const btnRecruit = document.getElementById('alphaModeRecruit');
            const hint = document.getElementById('alphaModeHint');
            const targetArea = document.getElementById('alphaTargetArea');
            if (btnKill) btnKill.className = mode === 'kill' ? 'btn btn-danger' : 'btn btn-outline';
            if (btnRecruit) btnRecruit.className = mode === 'recruit' ? 'btn btn-primary' : 'btn btn-outline';
            if (hint) hint.innerHTML = mode === 'kill'
                ? '🔪 <strong>Bunuh</strong> — Pilih target di bawah, kill berlaku malam ini (bisa diblokir proteksi). Kemampuan rekrut hangus.'
                : '🐺 <strong>Rekrut</strong> — Tidak ada kill malam ini. Target rekrut dipilih pada malam berikutnya.';
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
                    targets.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">⚠️ Tidak ada pemain non-serigala yang bisa direkrut.</div>`;
                    return;
                }
                let html = `
<div style="background:rgba(155,89,182,0.08);border:1px solid rgba(155,89,182,0.25);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px;font-size:0.83rem;color:var(--text-secondary);">
  🐺 <strong>Rekrutmen Aktif</strong> — Pilih pemain yang akan bergabung menjadi Werewolf malam ini.
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">`;
                html += nonWolves.map(p => `
<button class="target-btn" onclick="selectAlphaTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
  <span class="target-icon">👤</span>
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
    <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">🔪 Bunuh</div>
    <div style="font-size:0.7rem; opacity:0.85; font-weight:normal; letter-spacing:0.5px;">MALAM INI</div>
  </button>
  <button class="btn btn-outline" id="alphaModeRecruit" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px 4px; min-height:56px; line-height:1.2;" onclick="setAlphaMode('recruit')">
    <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">🐺 Rekrut</div>
    <div style="font-size:0.7rem; opacity:0.85; font-weight:normal; letter-spacing:0.5px;">MALAM DEPAN</div>
  </button>
</div>
<div id="alphaModeHint" style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px;padding:12px 14px;background:rgba(155,89,182,0.1);border-left:3px solid var(--accent-purple);border-radius:var(--radius-sm);line-height:1.45;"></div>
<div id="alphaTargetArea" style="display:none;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">`;
            html += nonWolves.map(p => `
<button class="target-btn" onclick="selectAlphaTarget(this, '${p.id}', '${escapeJsString(p.name)}')" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
  <span class="target-icon">👤</span>
  <span>${escapeHtml(p.name)}</span>
</button>`).join('');
            html += `</div>`;
            targets.innerHTML = html;
            setAlphaMode('kill'); // default kill
        }

        function selectAlphaTarget(el, id, name) {
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            el.dataset.id = id;
            el.dataset.name = name;
            el.dataset.selected = 'true';
        }

        function selectTarget(el, id, name) {
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            if (el) {
                el.classList.add('selected');
                el.dataset.selected = 'true';
            }
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
                return `<button class="target-btn btn-sm" onclick="selectWolf1(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>`;
            }).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Target Mengamuk 2:</div>
<div class="night-action-targets">
${validPlayers.map(p => {
                return `<button class="target-btn btn-sm" onclick="selectWolf2(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>`;
            }).join('')}
</div>
</div>
</div>
`;
            gameState._wolfTemp = { p1: null, p2: null };
        }

        function selectWolf1(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._wolfTemp) gameState._wolfTemp = {};
            gameState._wolfTemp.p1 = { id, name };
        }

        function selectWolf2(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._wolfTemp) gameState._wolfTemp = {};
            gameState._wolfTemp.p2 = { id, name };
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
                if (gameState.nightState.wolfKillTarget || gameState.nightState.wolfKillTarget2) {
                    let victims = [];
                    if (gameState.nightState.wolfKillTarget) victims.push(gameState.nightState.wolfKillTarget);
                    if (gameState.nightState.wolfKillTarget2) victims.push(gameState.nightState.wolfKillTarget2);

                    healHTML += `<div style="font-size:0.82rem;margin-bottom:8px;">Korban malam ini: <strong>${victims.join(' &amp; ')}</strong></div>`;
                    if (gameState.nightState.wolfKillTarget) {
                        healHTML += `<button class="btn btn-success btn-sm btn-block" style="margin-bottom:4px;" onclick="useHealPotion('${gameState.nightState.wolfKillId}', '${escapeJsString(gameState.nightState.wolfKillTarget)}')">💚 Sembuhkan ${escapeHtml(gameState.nightState.wolfKillTarget)}</button>`;
                    }
                    if (gameState.nightState.wolfKillTarget2) {
                        healHTML += `<button class="btn btn-success btn-sm btn-block" onclick="useHealPotion('${gameState.nightState.wolfKillId2}', '${escapeJsString(gameState.nightState.wolfKillTarget2)}')">💚 Sembuhkan ${escapeHtml(gameState.nightState.wolfKillTarget2)}</button>`;
                    }
                } else {
                    healHTML += '<div style="font-size:0.82rem;color:var(--text-muted);">Tidak ada korban malam ini (atau dirahasiakan).</div>';
                }

                html += `
  <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.2);border-radius:var(--radius-md);padding:16px;">
    <div style="font-weight:700;margin-bottom:8px;color:var(--accent-green);">💚 Ramuan Penyembuh</div>
    ${healHTML}
  </div>`;
            } else {
                html += `
  <div style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-color);border-radius:var(--radius-md);padding:16px;opacity:0.6;">
    <div style="font-weight:700;margin-bottom:8px;color:var(--text-secondary);">💚 Ramuan Penyembuh</div>
    <div style="font-size:0.78rem;color:var(--text-muted);">Telah habis digunakan.</div>
  </div>`;
            }

            if (gameState.witchPotions.poison) {
                html += `
  <div style="background:rgba(231,76,60,0.05);border:1px solid rgba(231,76,60,0.2);border-radius:var(--radius-md);padding:16px;">
    <div style="font-weight:700;margin-bottom:8px;color:var(--accent-red);">💜 Ramuan Racun</div>
    <div class="night-action-targets" style="margin-bottom:8px;">
      ${gameState.players.filter(p => {
                    const witch = gameState.players.find(w => w.role === 'Witch' && w.alive);
                    return p.alive
                        && p.id !== wolfKillId   // tidak bisa meracuni korban wolf (heal lebih relevan)
                        && p.role !== 'Witch'    // tidak bisa meracuni diri sendiri
                        && (!witch || p.id !== witch.id); // guard ekstra jika role-check tidak cukup
                }).map(p => `
        <button class="target-btn btn-sm" onclick="usePoisonPotion('${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>
      `).join('')}
    </div>
  </div>`;
            } else {
                html += `
  <div style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-color);border-radius:var(--radius-md);padding:16px;opacity:0.6;">
    <div style="font-weight:700;margin-bottom:8px;color:var(--text-secondary);">💜 Ramuan Racun</div>
    <div style="font-size:0.78rem;color:var(--text-muted);">Telah habis digunakan.</div>
  </div>`;
            }

            html += '</div>';
            targets.innerHTML = html;
        }

        function useHealPotion(id, target) {
            // Potion hanya dikonsumsi saat resolusi malam (processNightDeaths),
            // agar jika Wizard membungkam Witch, potion bisa dikembalikan.
            gameState.nightState.witchHealTarget = id;
            addLog('night', `🧪 Witch menyelamatkan ${target}.`);
            showToast(`Witch menyelamatkan ${target}!`, 'success');
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
  <div class="seer-result-icon">💚</div>
  <div class="seer-result-text" style="color:var(--accent-green);">Penyembuh Digunakan</div>
  <div class="seer-result-detail">${target} telah diselamatkan.</div>
</div>`;
            renderWitchActions();
        }

        function usePoisonPotion(id, target) {
            // Potion hanya dikonsumsi saat resolusi malam (processNightDeaths),
            // agar jika Wizard membungkam Witch, potion bisa dikembalikan.
            gameState.nightState.witchPoisonTarget = id;
            addLog('night', `🧪 Witch meracuni ${target}.`);
            showToast(`Witch meracuni ${target}!`, 'warning');
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
  <div class="seer-result-icon">💜</div>
  <div class="seer-result-text" style="color:var(--accent-red);">Racun Digunakan</div>
  <div class="seer-result-detail">${target} telah diracuni.</div>
</div>`;
            renderWitchActions();
        }

        // renderWizardAction() lama sudah dihapus

        function renderVeteranAction() {
            const targets = document.getElementById('nightTargets');
            if (gameState.veteranAlertsLeft > 0) {
                targets.innerHTML = `
  <div style="text-align:center;margin-bottom:12px;color:var(--text-secondary);">Sisa Mode Siaga: <strong>${gameState.veteranAlertsLeft}</strong></div>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
    <button class="btn btn-danger" onclick="veteranAlert(true)">⚔️ Mode Siaga ON</button>
    <button class="btn btn-outline" onclick="veteranAlert(false)">😴 Mode Siaga OFF</button>
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
        }

        function veteranAlert(active) {
            if (active && gameState.veteranAlertsLeft <= 0) return;
            if (active) gameState.veteranAlertsLeft--;

            gameState.nightState.veteranIsAlert = active;
            addLog('night', `⚔️ Veteran ${active ? 'masuk mode siaga' : 'tidak siaga'} malam ini.`);
            showToast(`Veteran ${active ? 'siaga!' : 'istirahat.'}`, 'info');
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
  <div class="seer-result-icon">${active ? '⚔️' : '😴'}</div>
  <div class="seer-result-text">${active ? 'Mode Siaga Aktif' : 'Tidak Siaga'}</div>
  <div class="seer-result-detail">${active ? 'Siapapun yang berniat menyerang akan dibunuh.' : 'Veteran tidur nyenyak malam ini.'}</div>
</div>
`;
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
<button class="target-btn" onclick="selectCupid1(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>
`).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 2:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" onclick="selectCupid2(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>
`).join('')}
</div>
</div>
</div>
`;
            gameState._cupidTemp = { p1: null, p2: null };
        }

        function selectCupid1(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._cupidTemp) gameState._cupidTemp = {};
            gameState._cupidTemp.p1 = { id, name };
        }

        function selectCupid2(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._cupidTemp) gameState._cupidTemp = {};
            gameState._cupidTemp.p2 = { id, name };
        }

        function renderLittleGirlAction() {
            const targets = document.getElementById('nightTargets');
            targets.innerHTML = `
<div style="text-align:center;padding:20px;">
  <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">
    Little Girl telah mengintip serigala. Apakah serigala menyadarinya?
  </div>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
    <button class="btn btn-danger" onclick="littleGirlCaught()">🔴 Ketahuan! Little Girl mati</button>
    <button class="btn btn-outline" onclick="littleGirlSafe()">✅ Aman, tidak ketahuan</button>
  </div>
</div>
`;
        }

        function littleGirlCaught() {
            const lg = gameState.players.find(p => p.role === 'Little Girl' && p.alive);
            if (!lg) return;

            if (!gameState.nightKills) gameState.nightKills = [];
            if (!gameState.nightKills.includes(lg.id)) {
                gameState.nightKills.push(lg.id);
            }

            addLog('night', `👧 Little Girl (${lg.name}) ketahuan mengintip oleh Werewolf! (Mati esok pagi)`);
            showToast(`${lg.name} (Little Girl) ketahuan! Tekan Konfirmasi untuk lanjut.`, 'warning');
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">💀</div>
<div class="seer-result-text" style="color:var(--accent-red);">Ketahuan!</div>
<div class="seer-result-detail">${escapeHtml(lg.name)} ketahuan oleh Werewolf. Kematiannya sudah pasti esok pagi dan tidak bisa dilindungi. Silakan klik <strong>Konfirmasi</strong> untuk lanjut ke role berikutnya.</div>
</div>`;
        }

        function littleGirlSafe() {
            addLog('night', `👧 Little Girl mengintip dengan aman malam ini.`);
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">👧</div>
<div class="seer-result-text" style="color:var(--accent-green);">Aman!</div>
<div class="seer-result-detail">Little Girl berhasil mengintip tanpa diketahui Werewolf.</div>
</div>`;
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
<button class="target-btn" onclick="selectTroublemaker1(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>
`).join('')}
</div>
</div>
<div>
<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Pemain 2:</div>
<div class="night-action-targets">
${validTargets.map(p => `
<button class="target-btn" onclick="selectTroublemaker2(this, '${p.id}', '${escapeJsString(p.name)}')">${escapeHtml(p.name)}</button>
`).join('')}
</div>
</div>
</div>
`;
            gameState._troublemakerTemp = { p1: null, p2: null };
        }
        function selectTroublemaker1(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._troublemakerTemp) gameState._troublemakerTemp = {};
            gameState._troublemakerTemp.p1 = { id, name };
        }
        function selectTroublemaker2(el, id, name) {
            el.parentElement.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
            if (!gameState._troublemakerTemp) gameState._troublemakerTemp = {};
            gameState._troublemakerTemp.p2 = { id, name };
        }

        function renderMasonAction(currentRole) {
            const targets = document.getElementById('nightTargets');
            const otherMasonRole = currentRole === 'Mason 1' ? 'Mason 2' : 'Mason 1';
            const otherMason = gameState.players.find(p => p.role === otherMasonRole && p.alive);

            if (otherMason) {
                targets.innerHTML = `
<div style="text-align:center;padding:20px;">
  <div style="font-size:1.5rem;margin-bottom:10px;">⛏️</div>
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
<span class="target-icon">🐺</span>
<span>${escapeHtml(p.name)}</span>
<span class="badge badge-wolf" style="margin-left:auto;">${p.role}</span>
</button>
`).join('');
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
  <div style="font-size:1.5rem;margin-bottom:10px;">🦠</div>
  <div style="color:var(--text-secondary);margin-bottom:15px;">Pilih salah satu korban kawanan malam ini untuk diinfeksi:</div>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">`;

            if (ns.wolfKillId) {
                html += `<button class="btn btn-primary" onclick="infectTarget('${ns.wolfKillId}', '${escapeJsString(ns.wolfKillTarget)}')">💉 Infeksi ${escapeHtml(ns.wolfKillTarget)}</button>`;
            }
            if (ns.wolfKillId2) {
                html += `<button class="btn btn-primary" onclick="infectTarget('${ns.wolfKillId2}', '${escapeJsString(ns.wolfKillTarget2)}')">💉 Infeksi ${escapeHtml(ns.wolfKillTarget2)}</button>`;
            }
            html += `<button class="btn btn-outline" onclick="skipInfectorAction()">Lewati Malam Ini</button>
  </div>
</div>`;
            targets.innerHTML = html;
        }
        function skipInfectorAction() {
            gameState.nightState.infectorInfectId = null;
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
  <div class="seer-result-icon">⏩</div>
  <div class="seer-result-text" style="color:var(--text-muted);">Aksi Dilewati</div>
  <div class="seer-result-detail">Pilihan infeksi dibatalkan. (Silakan tekan Konfirmasi)</div>
</div>`;
            showToast('Tindakan infeksi dilewati.', 'info');
        }
        function infectTarget(id, name) {
            gameState.nightState.infectorInfectId = id;
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
            addLog('night', `🦠 Infector menitipkan infeksi untuk ${name}.`);
            showToast('Target dipilih untuk diinfeksi!', 'success');
            document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
  <div class="seer-result-icon">🦠</div>
  <div class="seer-result-text" style="color:var(--accent-purple-light);">Infeksi Disiapkan</div>
  <div class="seer-result-detail">${escapeHtml(name)} akan diubah menjadi Werewolf dan lolos dari maut. (Silakan tekan Konfirmasi)</div>
</div>`;
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
  <div style="font-size:1.5rem;margin-bottom:10px;">⚰️</div>
  <div style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:8px;">Pemain dieksekusi hari ini: <strong>${escapeHtml(p.name)}</strong></div>
  <div style="font-size:0.9rem;color:var(--text-muted);"><span class="role-emoji">${def?.icon || '👤'}</span> Peran aslinya adalah <strong>${p.role}</strong>.</div>
</div>
`;
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
<span class="target-icon">💀</span>
<span>${escapeHtml(p.name)} (${p.role})</span>
<span class="badge badge-${def?.category || 'unknown'}" style="margin-left:auto;">${p.role}</span>
</button>
`;
            }).join('');
        }

        function confirmNightAction() {
            const activeRoles = NIGHT_ORDER.filter(role => {
                return gameState.players.some(p => p.role === role && p.alive);
            });

            if (gameState.nightPhase >= activeRoles.length) return;

            const currentRole = activeRoles[gameState.nightPhase];

            // Silent/immediate skip roles
            if (currentRole === 'Cupid' || currentRole === 'Little Girl' || (currentRole === 'Doppelganger' && gameState.doppelgangerTarget) || currentRole === 'Mason 1' || currentRole === 'Mason 2' || currentRole === 'Gravedigger') {
                if (currentRole === 'Cupid') {
                    if (gameState.couples.length === 0) {
                        if (!gameState._cupidTemp?.p1 || !gameState._cupidTemp?.p2) {
                            return showToast('Pilih dua pemain untuk dijodohkan!', 'warning');
                        }
                        if (gameState._cupidTemp.p1.id === gameState._cupidTemp.p2.id) {
                            return showToast('Pilih dua pemain yang berbeda!', 'warning');
                        }
                        gameState.couples.push([String(gameState._cupidTemp.p1.id), String(gameState._cupidTemp.p2.id)]);
                        addLog('night', `💕 Cupid telah menjodohkan ${gameState._cupidTemp.p1.name} dengan ${gameState._cupidTemp.p2.name}.`);
                    } else {
                        addLog('night', `💕 Cupid memantau pasangannya.`);
                    }
                }
                if (currentRole === 'Gravedigger') {
                    gameState.nightState.gravediggerInfoShown = true;
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
                    addLog('night', `✨ Wizard tidak melakukan tindakan (sihir habis).`);
                    gameState.nightPhase++;
                    renderNightSequence();
                    renderNightAction();
                    return;
                }
            }

            if (currentRole === 'Apprentice Seer') {
                const seerIsAlive = gameState.players.some(p => p.role === 'Seer' && p.alive);
                if (seerIsAlive) {
                    addLog('night', `👁️ Murid Peramal (Apprentice Seer) belum aktif karena Seer asli masih hidup.`);
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
                    (ROLE_DEFINITIONS[player.role] && ROLE_DEFINITIONS[player.role].team === 'Werewolf') ||
                    player.role === 'Lycan'
                );
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${isWolf ? '🐺' : '😊'}</div>
<div class="seer-result-text" style="color:${isWolf ? 'var(--accent-red)' : 'var(--accent-green)'};">
${isWolf ? 'Target adalah SERIGALA!' : 'Target BUKAN serigala.'}
</div>
<div class="seer-result-detail">${targetName} ${isWolf ? 'tergabung dalam tim werewolf (atau terlihat sepertinya).' : 'bersih, bukan serigala.'}</div>
</div>
`;
                addLog('night', `${ROLE_DEFINITIONS[currentRole].icon} ${currentRole} memeriksa ${targetName}. Hasil: ${isWolf ? 'SERIGALA' : 'Bukan serigala'}.`);
            } else if (currentRole === 'Aura Seer') {
                let faksi = player ? ROLE_DEFINITIONS[player.role].team : 'Unknown';

                // BUG-09 FIX: Lycan and Cult Member override
                if (player && player.role === 'Lycan') {
                    faksi = 'Werewolf';
                } else if (player && gameState.cultMembers && gameState.cultMembers.includes(String(player.id))) {
                    faksi = 'Sekte (Neutral)';
                }

                let icon = faksi === 'Werewolf' ? '🐺' : (faksi.includes('Neutral') ? '🎭' : '👥');
                let color = faksi === 'Werewolf' ? 'var(--accent-red)' : (faksi.includes('Neutral') ? 'var(--accent-gold)' : 'var(--accent-green)');
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${icon}</div>
<div class="seer-result-text" style="color:${color};">Faksi: ${faksi}</div>
<div class="seer-result-detail">${targetName} berada di pihak ${faksi}.</div>
</div>`;
                addLog('night', `👁️ Aura Seer memeriksa ${targetName}. Hasil: Faksi ${faksi}.`);
                gameState.nightState.auraSeerTargetId = targetId;
            } else if (currentRole === 'Sorcerer') {
                const isSeer = player && player.role === 'Seer';
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">${isSeer ? '🔮' : '❌'}</div>
<div class="seer-result-text" style="color:${isSeer ? 'var(--accent-green)' : 'var(--accent-red)'};">${isSeer ? 'SEER ASLI KETEMU!' : 'Bukan Seer'}</div>
<div class="seer-result-detail">${targetName} ${isSeer ? 'adalah Seer yang kamu cari.' : 'tidak memiliki kekuatan mata Seer.'}</div>
</div>`;
                addLog('night', `🧿 Sorcerer mencari Seer pada ${targetName}. Hasil: ${isSeer ? 'Ketemu' : 'Tidak Ketemu'}.`);
                gameState.nightState.sorcererTargetId = targetId;
            } else if (currentRole === 'Tracker') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🐾</div>
<div class="seer-result-text" style="color:var(--accent-gold);">Sedang Melacak</div>
<div class="seer-result-detail">Jejak langka ${targetName} dipantau. Hasil akan diumumkan saat resolusi kematian.</div>
</div>`;
                addLog('night', `🔍 Tracker mulai memantau gerak-gerik ${targetName}.`);
                gameState.nightState.trackerTargetId = targetId;
            } else if (currentRole === 'Tavern Keeper') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🍻</div>
<div class="seer-result-text" style="color:var(--accent-purple-light);">Target Dimabukkan</div>
<div class="seer-result-detail">${targetName} diajak minum dan tidak akan bisa menggunakan kemampuannya diblokir malam ini.</div>
</div>`;
                addLog('night', `🍻 Tavern Keeper mengajak minum ${targetName}.`);
                gameState.nightState.tavernKeeperBlockId = targetId;
            } else if (currentRole === 'Cult Leader') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🌑</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Target Disentuh</div>
<div class="seer-result-detail">${targetName} direkrut malam ini.</div>
</div>`;
                addLog('night', `🌑 Cult Leader mengubah sekte, merekrut ${targetName}.`);
                gameState.nightState.cultLeaderRecruitId = targetId;
            } else if (currentRole === 'Vampire') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🧛</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Digigit</div>
<div class="seer-result-detail">${targetName} akan dihabisi darahnya malam ini.</div>
</div>`;
                addLog('night', `🧛 Vampire mengincar ${targetName}.`);
                gameState.nightState.vampireKillId = targetId;
            } else if (currentRole === 'White Wolf') {
                if (gameState.day % 2 === 0) {
                    gameState.nightState.whiteWolfKillId = targetId;
                    document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🐺</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Pengkhianatan</div>
<div class="seer-result-detail">${targetName} akan dihabisi oleh White Wolf malam ini.</div>
</div>`;
                    addLog('night', `🐺 White Wolf mengkhianati dan mengincar ${targetName}.`);
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
<div class="seer-result-icon">🎴</div>
<div class="seer-result-text" style="color:var(--accent-green);">Peran Dicuri!</div>
<div class="seer-result-detail">Pencuri menjadi <strong>${tempRole}</strong>. ${targetName} menjadi Thief (Eks-${tempRole}).</div>
</div>`;
                        addLog('night', `🎴 Thief menukar kartunya dengan ${targetName}. Target menjadi Thief (Eks-${tempRole}).`);
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
<div class="seer-result-icon">🃏</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Kartu Ditukar!</div>
<div class="seer-result-detail">${p1.name} (kini ${p1.role}) dan ${p2.name} (kini ${p2.role}) telah bertukar kartu ROLE.</div>
</div>`;
                    addLog('night', `🃏 Troublemaker menukar kartu ${p1.name} dengan ${p2.name}.`);
                }
            } else if (currentRole === 'Amnesiac') {
                if (!gameState.amnesiacChosen && player && player.role) {
                    const amnPlayer = gameState.players.find(p => p.role === 'Amnesiac' && p.alive);
                    if (amnPlayer) {
                        amnPlayer.role = player.role;
                        gameState.amnesiacChosen = true;

                        document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🌀</div>
<div class="seer-result-text" style="color:var(--accent-blue);">Ingatan Pulih!</div>
<div class="seer-result-detail">Amnesiac mengingat bahwa dia adalah <strong>${player.role}</strong>.</div>
</div>`;
                        addLog('night', `🌀 Amnesiac mengambil identitas ${targetName} dan menjadi ${player.role}.`);
                    }
                }
            } else if (currentRole === 'Guardian') {
                gameState.nightState.guardProtectTarget = targetName;
                gameState.nightState.guardProtectId = targetId;
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🛡️</div>
<div class="seer-result-text" style="color:var(--accent-green);">Perlindungan Aktif</div>
<div class="seer-result-detail">${targetName} dilindungi malam ini.</div>
</div>
`;
                addLog('night', `🛡️ Guardian melindungi ${targetName}.`);
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
<div class="seer-result-icon">🐺🐺</div>
<div class="seer-result-text" style="color:var(--accent-red);">Dua Target Dipilih</div>
<div class="seer-result-detail">${escapeHtml(gameState._wolfTemp.p1.name)} dan ${escapeHtml(gameState._wolfTemp.p2.name)} menjadi incaran serigala.</div>
</div>
`;
                    gameState.nightState.wolfKillTarget = gameState._wolfTemp.p1.name;
                    gameState.nightState.wolfKillId = gameState._wolfTemp.p1.id;
                    gameState.nightState.wolfKillTarget2 = gameState._wolfTemp.p2.name;
                    gameState.nightState.wolfKillId2 = gameState._wolfTemp.p2.id;
                    addLog('night', `🐺 ${currentRole} (Mengamuk) memilih ${escapeHtml(gameState._wolfTemp.p1.name)} dan ${escapeHtml(gameState._wolfTemp.p2.name)} sebagai korban.`);
                } else {
                    document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🐺</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dipilih</div>
<div class="seer-result-detail">${targetName} menjadi incaran serigala malam ini.</div>
</div>
`;
                    gameState.nightState.wolfKillTarget = targetName;
                    gameState.nightState.wolfKillId = targetId;
                    addLog('night', `🐺 ${currentRole} memilih ${targetName} sebagai korban.`);
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
<div class="seer-result-icon">🐺</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Rekrutmen Dieksekusi!</div>
<div class="seer-result-detail">${alphaTargetName} resmi bergabung tim serigala malam ini.</div>
</div>`;
                    addLog('night', `🐺 Alpha Wolf merekrut ${alphaTargetName} — bergabung tim serigala malam ini!`);

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
<div class="seer-result-icon">🔪</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dibunuh</div>
<div class="seer-result-detail">${alphaTargetName} menjadi korban Alpha Wolf malam ini. Kemampuan rekrut hangus selamanya.</div>
</div>`;
                        addLog('night', `👑 Alpha Wolf memilih BUNUH: ${alphaTargetName} menjadi incaran.`);
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
<div class="seer-result-icon">🐺</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Mode Rekrut Dipilih</div>
<div class="seer-result-detail">Malam berikutnya, Alpha Wolf akan memilih siapa yang direkrut. <strong>Kawanan serigala TIDAK membunuh malam ini.</strong></div>
</div>`;
                        addLog('night', `👑 Alpha Wolf memilih mode REKRUT — kawanan serigala tidak membunuh malam ini. Target rekrut dipilih malam berikutnya.`);
                    }
                }

            } else if (currentRole === 'Bodyguard') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">💂</div>
<div class="seer-result-text" style="color:var(--accent-green);">Bodyguard Siaga</div>
<div class="seer-result-detail">${targetName} dilindungi. Jika diserang, Bodyguard & penyerang mati.</div>
</div>
`;
                gameState.nightState.bodyguardProtectTarget = targetName;
                gameState.nightState.bodyguardProtectId = targetId;
                addLog('night', `💂 Bodyguard melindungi ${targetName}.`);
            } else if (currentRole === 'Serial Killer') {
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🔪</div>
<div class="seer-result-text" style="color:var(--accent-red);">Target Dipilih</div>
<div class="seer-result-detail">${targetName} akan dibunuh malam ini.</div>
</div>
`;
                gameState.nightState.skKillTarget = targetName;
                gameState.nightState.skKillId = targetId;
                addLog('night', `🔪 Serial Killer memilih ${targetName}.`);
            } else if (currentRole === 'Doppelganger') {
                if (!gameState.doppelgangerTarget && player) {
                    gameState.doppelgangerTarget = targetId;
                    document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">🎭</div>
<div class="seer-result-text" style="color:var(--accent-orange);">Target Salin Dipilih</div>
<div class="seer-result-detail">Doppelganger menunggu kematian ${targetName} untuk mewarisi role.</div>
</div>
`;
                    addLog('night', `🎭 Doppelganger mengincar ${targetName} untuk ditiru rolenya nanti.`);
                }
            } else if (currentRole === 'Wizard') {
                gameState.nightState.wizardSilenceTarget = targetId;
                document.getElementById('nightActionResult').innerHTML = `
<div class="seer-result">
<div class="seer-result-icon">✨</div>
<div class="seer-result-text" style="color:var(--accent-purple);">Bungkam Terkunci!</div>
<div class="seer-result-detail">Kemampuan ${targetName} disegel sepenuhnya malam ini.</div>
</div>`;
                addLog('night', `✨ Wizard membungkam ${targetName} malam ini!`);
                const wizard = gameState.players.find(p => p.role === 'Wizard' && p.alive);
                if (wizard) wizard._wizardUsedCount = (wizard._wizardUsedCount || 0) + 1;
            } else {
                addLog('night', `${ROLE_DEFINITIONS[currentRole].icon} ${currentRole} memilih ${targetName}.`);
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
            const activeRoles = NIGHT_ORDER.filter(role => {
                return gameState.players.some(p => p.role === role && p.alive);
            });

            if (gameState.nightPhase >= activeRoles.length) return;

            const currentRole = activeRoles[gameState.nightPhase];

            // Doppelganger malam pertama WAJIB memilih — tidak bisa skip
            if (currentRole === 'Doppelganger' && gameState.day === 1) {
                return showToast('Doppelganger WAJIB memilih target di malam pertama!', 'error');
            }

            // LOGIC-05 FIX: Role kritis (pembunuh) memerlukan konfirmasi sebelum skip,
            // agar moderator tidak tidak sengaja melewatkan aksi yang mengubah jalannya game.
            const criticalKillerRoles = ['Werewolf', 'Alpha Wolf', 'Serial Killer'];
            if (criticalKillerRoles.includes(currentRole)) {
                showConfirm(
                    `Skip Aksi ${currentRole}?`,
                    `${currentRole} tidak akan membunuh siapapun malam ini. Ini valid jika memang sengaja (pilihan tidak membunuh). Yakin ingin melewatkan?`,
                    'Ya, Skip',
                    true,
                    () => {
                        addLog('night', `${ROLE_DEFINITIONS[currentRole].icon} ${currentRole} melewatkan aksi — tidak ada korban malam ini dari ${currentRole}.`);
                        gameState.nightPhase++;
                        renderNightSequence();
                        renderNightAction();
                    }
                );
                return;
            }

            addLog('night', `${ROLE_DEFINITIONS[currentRole].icon} ${currentRole} melewatkan aksi.`);

            gameState.nightPhase++;
            renderNightSequence();
            renderNightAction();
        }

        function endNightPhase() {
            if (!gameState.started || gameState.phase !== 'night') return;
            processNightDeaths();

            if (gameState._pendingWolfSacrifice) {
                return openWolfSacrificeModal();
            }

            nextPhase();
        }

        function processNightDeaths() {
            gameState._pendingWolfSacrifice = false; // Reset state tumbal tiap awal pemrosesan malam
            let deaths = [];
            let kills = [];
            const ns = gameState.nightState;

            // Wolf Cub Double Kill Check
            if (gameState.wolfCubKilledThisDay) {
                gameState.wolfCubDoubleKillActive = true;
                gameState.wolfCubKilledThisDay = false;
                addLog('night', `🐺 Kawanan Werewolf mengamuk karena Wolf Cub telah dibunuh! Mereka bisa membunuh 2 orang malam ini.`);
            }

            // Drunk Poisoned Check
            if (gameState.drunkPoisonedWolf) {
                ns.wolfKillId = null;
                ns.wolfKillTarget = null;
                ns.wolfKillId2 = null;
                ns.wolfKillTarget2 = null;
                gameState.drunkPoisonedWolf = false;
                addLog('night', `🍺 Werewolf masih keracunan akibat Pemabuk kemarin! Serangan dibatalkan malam ini.`);
            }

            // Evaluasi Sihir Bungkam Wizard (Roleblock parameter)
            if (ns.wizardSilenceTarget) {
                const blockedPlayer = gameState.players.find(p => p.id == ns.wizardSilenceTarget);
                if (blockedPlayer) {
                    const r = blockedPlayer.role;
                    const rDef = ROLE_DEFINITIONS[r];
                    if (r === 'Serial Killer' && ns.skKillId) {
                        ns.skKillId = null;
                        addLog('night', `✨ Sihir Wizard berhasil memblokir aksi Serial Killer malam ini!`);
                    }
                    if (r === 'Witch') {
                        if (ns.witchPoisonTarget) {
                            ns.witchPoisonTarget = null;
                            addLog('night', `✨ Sihir Wizard menggagalkan racun Witch!`);
                        }
                        if (ns.witchHealTarget) {
                            ns.witchHealTarget = null;
                            addLog('night', `✨ Sihir Wizard menggagalkan penyembuhan Witch!`);
                        }
                    }
                    if (r === 'Alpha Wolf') {
                        if (ns.alphaKillId) {
                            ns.alphaKillId = null;
                            addLog('night', `✨ Sihir Wizard berhasil memblokir serangan Alpha Wolf!`);
                        }
                        if (ns.alphaRecruitId) {
                            ns.alphaRecruitId = null;
                            addLog('night', `✨ Sihir Wizard menggagalkan upaya rekrutmen Alpha Wolf!`);
                        }
                    }
                    if (rDef && rDef.team === 'Werewolf') {
                        if (ns.wolfKillId || ns.wolfKillId2) {
                            ns.wolfKillId = null;
                            ns.wolfKillId2 = null;
                            addLog('night', `✨ Sihir Wizard membungkam Werewolf (${blockedPlayer.name}), sehingga seluruh kawanan batal menyerang!`);
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
                    addLog('night', `🍻 Tavern Keeper memblokir aksi ${blockedPlayer.name} malam ini.`);
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
                addLog('night', `👑 [Guard] Alpha Wolf memilih Rekrut — wolfKill dibatalkan secara otomatis.`);
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
                    addLog('night', `🦠 Infector menginfeksi ${infectorTarget.name}! Kini menjadi Werewolf baru.`);
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
                    addLog('night', `🐺 Konversi Selesai! ${targetPlayer.name} kini resmi berubah menjadi Werewolf!`);
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
                    addLog('night', `🐺 Target serangan Serigala ternyata adalah Serigala Liar (Lone Wolf)! ${wolfTarget.name} batal mati dan seketika menyatu memeluk insting Serigalanya.`);
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
                    addLog('night', `🐺 Target serangan Serigala ke-2 ternyata adalah Serigala Liar (Lone Wolf)! ${wolfTarget2.name} batal mati dan seketika menyatu memeluk insting Serigalanya.`);
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
                    addLog('night', `👑 Serangan maut Alpha Wolf mencabik Serigala Liar (Lone Wolf)! Darah Alpha membangkitkan ${alphaTarget.name} menjadi Werewolf seutuhnya.`);
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
            if (ns.skKillId) kills.push({ attacker: 'sk', target: ns.skKillId });
            if (ns.witchPoisonTarget) kills.push({ attacker: 'witch', target: ns.witchPoisonTarget });

            // Tough Guy pending death execution
            if (gameState.toughGuyPendingDeath) {
                const tg = gameState.players.find(p => p.id == gameState.toughGuyPendingDeath);
                if (tg && tg.alive) {
                    deaths.push(tg.id);
                    addLog('night', `💀 ${tg.name} (Tough Guy) akhirnya menyerah dari luka kemarin.`);
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
                    addLog('night', `🔪 Serial Killer diserang oleh serigala, namun ia kebal!`);
                }

                // Tough Guy - Deferred Death
                if (targetPlayer.role === 'Tough Guy' && (k.attacker === 'wolf' || k.attacker === 'alpha') && !gameState.toughGuyPendingDeath) {
                    gameState.toughGuyPendingDeath = targetPlayer.id;
                    addLog('night', `💪 ${targetPlayer.name} (Tough Guy) terkena serangan, namun ia bertahan seharian! Akan mati malam berikutnya.`);
                    blocked = true; // Tidak mati malam ini
                }

                // Cursed - Converts to Wolf
                if (targetPlayer.role === 'Cursed' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
                    targetPlayer.role = 'Werewolf';
                    if (!gameState.wolfTeam.includes(targetPlayer.name)) {
                        gameState.wolfTeam.push(targetPlayer.name);
                    }
                    addLog('night', `😈 ${targetPlayer.name} (Terkutuk) diserang wolf! Ia tidak mati melainkan berubah menjadi Werewolf!`);
                    blocked = true; // Tidak mati
                }

                // Drunk - Poisons the Wolf for next night
                if (targetPlayer.role === 'Drunk' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
                    gameState.drunkPoisonedWolf = true; // Wolf skip kill malam depan
                    addLog('night', `🍺 ${targetPlayer.name} (Pemabuk) digigit! Werewolf keracunan dan tidak bisa membunuh malam depan.`);
                    // Pemabuk tetap mati (tidak di-blocked)
                }

                // Survivor - Rompi Pelindung
                if (ns.survivorVestActivated && targetPlayer.role === 'Survivor' && !gameState.survivorVestUsed) {
                    gameState.survivorVestUsed = true;
                    blocked = true;
                    addLog('night', `🛡️ Survivor menggunakan rompi pelindung! Selamat dari serangan.`);
                }

                // Veteran Alert Check
                if (ns.veteranIsAlert && targetPlayer.role === 'Veteran') {
                    if (k.attacker === 'witch') {
                        addLog('night', `💥 Penyihir melempar ramuan mematikan ke Veteran yang sedang siaga! Veteran berhasil menembak mati sang Penyihir, namun tak selamat dari racunnya (Keduanya tewas).`);
                        deaths.push(targetPlayer.id); // Veteran mati karena racun
                        const witch = gameState.players.find(p => p.role === 'Witch' && p.alive);
                        if (witch) deaths.push(witch.id);
                        blocked = true; // Set true agar Guardian/Bodyguard tidak mencoba melindungi Veteran yang sudah diracun
                    } else {
                        blocked = true;
                        let attackerName = k.attacker === 'wolf' ? 'Serigala' :
                            k.attacker === 'alpha' ? 'Alpha Wolf' :
                                k.attacker === 'whitewolf' ? 'White Wolf' :
                                    k.attacker === 'vampire' ? 'Vampir' :
                                        k.attacker === 'sk' ? 'Serial Killer' : 'Seseorang';
                        addLog('night', `💥 ${attackerName} mencoba menyerang Veteran yang sedang siaga! Penyerang mati ditembak sebelum berhasil menyentuh Veteran.`);

                        if (k.attacker === 'wolf') {
                            const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role]?.team === 'Werewolf' && p.alive && !deaths.includes(p.id));
                            if (wolves.length === 1) {
                                deaths.push(wolves[0].id);
                                addLog('night', `🐺 Serigala terakhir (${wolves[0].name}) terbunuh peluru Veteran!`);
                            } else if (wolves.length > 1) {
                                gameState._pendingWolfSacrifice = true;
                                gameState._pendingWolfSacrificeReason = 'Veteran';
                            }
                        } else if (k.attacker === 'alpha') {
                            const alpha = gameState.players.find(p => p.role === 'Alpha Wolf' && p.alive);
                            if (alpha) deaths.push(alpha.id);
                        } else if (k.attacker === 'sk') {
                            const sk = gameState.players.find(p => p.role === 'Serial Killer' && p.alive);
                            if (sk) deaths.push(sk.id);
                        } else if (k.attacker === 'whitewolf') {
                            const ww = gameState.players.find(p => p.role === 'White Wolf' && p.alive);
                            if (ww) deaths.push(ww.id);
                        } else if (k.attacker === 'vampire') {
                            const vamp = gameState.players.find(p => p.role === 'Vampire' && p.alive);
                            if (vamp) deaths.push(vamp.id);
                        }
                    }
                }

                // Alpha Wolf kill diperlakukan sama seperti kill werewolf biasa
                // (bisa diblokir Guardian, Bodyguard, Witch Heal, dan Veteran)
                if (!blocked) {
                    // Little Girl tidak bisa dilindungi dari serangan wolf/alpha
                    if (targetPlayer.role === 'Little Girl' && (k.attacker === 'wolf' || k.attacker === 'alpha')) {
                        addLog('night', `👧 Little Girl diserang serigala! Tidak dapat dilindungi.`);
                    } else {
                        // Guardian
                        if (k.target === ns.guardProtectId) {
                            blocked = true;
                            addLog('night', `🛡️ Serangan terhadap ${targetPlayer.name} diblokir oleh Guardian.`);
                        }
                        // Bodyguard
                        if (k.target === ns.bodyguardProtectId) {
                            blocked = true;
                            ns.bodyguardProtectId = null; // Bodyguard hanya bisa menahan 1 kali serangan
                            addLog('night', `💂 Bodyguard melindungi ${targetPlayer.name} dari serangan!`);
                            const bg = gameState.players.find(p => p.role === 'Bodyguard' && p.alive);
                            if (bg) deaths.push(bg.id);
                            // Penyerang juga mati
                            if (k.attacker === 'wolf' || k.attacker === 'alpha' || k.attacker === 'whitewolf') {
                                const wolves = gameState.players.filter(p => ROLE_DEFINITIONS[p.role]?.team === 'Werewolf' && p.alive && !deaths.includes(p.id));
                                if (wolves.length === 1) {
                                    deaths.push(wolves[0].id);
                                    addLog('night', `🐺 Serigala ${wolves[0].name} terbunuh melawan Bodyguard!`);
                                } else if (wolves.length > 1) {
                                    gameState._pendingWolfSacrifice = true;
                                    gameState._pendingWolfSacrificeReason = 'Bodyguard';
                                }
                            } else if (k.attacker === 'sk') {
                                const sk = gameState.players.find(p => p.role === 'Serial Killer' && p.alive);
                                if (sk) deaths.push(sk.id);
                            } else if (k.attacker === 'vampire') {
                                const vamp = gameState.players.find(p => p.role === 'Vampire' && p.alive);
                                if (vamp) deaths.push(vamp.id);
                            }
                        }
                        // Witch Heal
                        if (k.target === ns.witchHealTarget) {
                            blocked = true;
                            addLog('night', `🧪 Witch menyembuhkan ${targetPlayer.name}.`);
                        }
                    }
                }

                if (!blocked) {
                    deaths.push(targetPlayer.id);
                }
            }

            // Tracker Result Logging
            if (ns.trackerTargetId) {
                const trackerTarget = gameState.players.find(p => p.id == ns.trackerTargetId);
                const visitors = evaluateVisitors(ns.trackerTargetId);
                addLog('night', `🔍 Tracker melacak ${trackerTarget?.name}: dikunjungi oleh ${visitors.join(', ') || 'tidak ada'}.`);
            }
            // Cult Leader Recruitment Execution
            if (ns.cultLeaderRecruitId) {
                const newMember = gameState.players.find(p => p.id == ns.cultLeaderRecruitId);
                if (newMember && newMember.alive && !gameState.cultMembers.includes(String(newMember.id))) {
                    gameState.cultMembers.push(String(newMember.id));
                    addLog('night', `🌑 Cult Leader merekrut ${newMember.name} ke dalam sektenya.`);
                }
            }

            gameState.nightKills = [...new Set(deaths)]; // Unique IDs
            gameState.guardLastProtect = ns.guardProtectId || null;
            gameState.wolfCubDoubleKillActive = false; // Turn off after processing
            addLog('night', '🌙 Fase memproses serangan malam selesai.');
        }

        function evaluateVisitors(targetId) {
            const ns = gameState.nightState;
            const visitors = [];
            if (ns.wolfKillId == targetId) visitors.push('Serigala');
            if (ns.alphaKillId == targetId) visitors.push('Serigala');
            if (ns.alphaRecruitId == targetId) visitors.push('Serigala');
            if (ns.skKillId == targetId) visitors.push('Serial Killer');
            if (ns.vampireKillId == targetId) visitors.push('Vampir');
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
            const targetId = document.getElementById('selectWolfSacrifice').value;
            if (!targetId) return showToast('Pilih serigala yang mati!', 'warning');

            const wolf = gameState.players.find(p => p.id == targetId);
            if (wolf) {
                gameState.nightKills.push(wolf.id);
                addLog('night', `🐺 Serigala ${wolf.name} terbunuh karena menyerang ${gameState._pendingWolfSacrificeReason === 'Veteran' ? 'Veteran' : 'target yang dilindungi Bodyguard'}!`);
            }

            gameState._pendingWolfSacrifice = false;
            closeModal('modalWolfSacrifice');
            nextPhase();
        }

        function cancelWolfSacrifice() {
            gameState._pendingWolfSacrifice = false;
            closeModal('modalWolfSacrifice');
            addLog('night', '👑 Moderator membatalkan pengorbanan Serigala (Aksi Override).');
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
            <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-gold);">⭐ Aksi Sheriff (${escapeHtml(sheriff.name)})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Bisa menembak 1 pemain siang ini. Jika korban BUKAN serigala, Sheriff akan ikut mati! (1x pakai)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
               <select id="sheriffTarget" class="form-select" style="max-width: 200px;">
                  <option value="">-- Pilih Target --</option>
                  ${alivePlayers.filter(p => p.id !== sheriff.id).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
               </select>
               <button class="btn btn-danger btn-sm" onclick="useSheriffAction('${sheriff.id}')">🔫 Tembak</button>
            </div>
        </div>
        `;
            }

            // Priest
            const priest = gameState.players.find(p => p.role === 'Priest' && p.alive && !p._priestUsed);
            if (priest) {
                html += `
        <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-cyan); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-cyan);">
            <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-cyan);">⛪ Perjudian Priest (${escapeHtml(priest.name)})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Menyiram air suci. Jika target Serigala, Serigala mati. Jika baik, Priest yang mati! (1x pakai)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
               <select id="priestTarget" class="form-select" style="max-width: 200px;">
                  <option value="">-- Pilih Target --</option>
                  ${alivePlayers.filter(p => p.id !== priest.id).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
               </select>
               <button class="btn btn-primary btn-sm" onclick="usePriestAction('${priest.id}')">💧 Siram Air Suci</button>
            </div>
        </div>
        `;
            }

            // Mayor
            const mayor = gameState.players.find(p => p.role === 'Mayor' && p.alive && !p._mayorRevealed);
            if (mayor) {
                html += `
        <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-purple); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-purple);">
            <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--accent-purple-light);">🏛️ Deklarasi Mayor (${escapeHtml(mayor.name)})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Buka identitas. Setelah mengungkap diri, saat di-vote ia akan mendapatkan perlakuan khusus, dan moderator menambah 2 suara di tally-nya jika ia vote orang lain.</div>
            <button class="btn btn-gold btn-sm" onclick="useMayorAction('${mayor.id}')">🏛️ Ungkap Identitas</button>
        </div>
        `;
            }

            // Survivor
            const survivor = gameState.players.find(p => p.role === 'Survivor' && p.alive && !gameState.survivorVestUsed && !gameState.nightState.survivorVestActivated);
            if (survivor) {
                html += `
        <div class="card" style="background:rgba(255,255,255,0.03); border-color:var(--accent-green); margin-bottom: 12px; padding: 16px; border: 1px dashed var(--accent-green);">
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent-green);">🛡️ Rompi Pelindung (${escapeHtml(survivor.name)})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Survivor mengaktifkan rompi agar kebal dari semua pembunuhan untuk malam hari berikutnya (1x pakai seumur hidup).</div>
            <button class="btn btn-primary btn-sm" onclick="activateSurvivorVest()">🛡️ Aktifkan Rompi</button>
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
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent-gold);">🎯 Target Bounty Hunter (${escapeHtml(bountyHunter.name)})</div>
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
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent-purple-light);">✝️ Pengorbanan Martyr (${escapeHtml(martyr.name)})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);">Martyr dapat mengorbankan dirinya menggantikan pemain yang dieksekusi siang hari. (Tombol akan otomatis muncul saat eksekusi).</div>
        </div>
        `;
            }

            panel.innerHTML = html;
        }

        function useSheriffAction(sheriffId) {
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
                    addLog('day', `⭐ Sheriff ${sheriff.name} menembak mati ${target.name}. Ternyata dia adalah Serigala!`);
                    showToast('Tembakan tepat mematikan Serigala!', 'success');
                    checkCouplesDeath(target.name);
                    checkDoppelgangerInheritance(target);
                } else {
                    target.alive = false;
                    target.eliminated = true;
                    sheriff.alive = false;
                    sheriff.eliminated = true;
                    addLog('day', `⭐ Sheriff ${sheriff.name} menembak mati ${target.name} (Bukan serigala). Karena menyadari kesalahannya, Sheriff bunuh diri!`);
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
                    addLog('day', `⛪ Priest ${priest.name} menyiramkan Air Suci ke ${target.name}. Berhasil! Dia adalah Serigala!`);
                    showToast('Air Suci membakar serigala!', 'success');
                    checkCouplesDeath(target.name);
                    checkDoppelgangerInheritance(target);
                } else {
                    priest.alive = false;
                    priest.eliminated = true;
                    addLog('day', `⛪ Priest ${priest.name} menyiram ${target.name}. Ternyata dia bukan serigala! Dewa menghukum Priest dengan kematian.`);
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
            const mayor = gameState.players.find(p => p.id == mayorId);
            showConfirm('Identitas Mayor', 'Yakin ingin mengungkap identitas Mayor?', 'Ungkap', true, () => {
                mayor._mayorRevealed = true;
                addLog('day', `🏛️ Mayor ${mayor.name} mendeklarasikan posisinya! Ucapannya kini bernilai dua suara.`);
                showToast(`Mayor ${mayor.name} mengungkap identitas!`, 'info');
                renderDayActions();
            });
        }

        function activateSurvivorVest() {
            showConfirm('Aktifkan Rompi', 'Survivor yakin ingin mengaktifkan rompi pelindung malam ini? (1x pakai seumur hidup)', 'Aktifkan', true, () => {
                gameState.nightState.survivorVestActivated = true;
                addLog('day', `🛡️ Survivor telah mengaktifkan rompi pelindung untuk malam ini.`);
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
        }

        function announceDeaths() {
            const allKills = gameState.nightKills || [];
            const announcement = document.getElementById('dayAnnouncementText');
            const title = document.getElementById('dayAnnouncementTitle');

            if (allKills.length > 0) {
                title.textContent = '📢 Pengumuman Kematian';
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
            <strong style="color:var(--accent-red);">Malam ini, ${killNames.join(' dan ')} ditemukan meninggal.</strong>
            <div style="margin-top:8px;font-size:0.82rem;">
            ${killNames.map(name => `💀 ${name}`).join('<br>')}
            </div>
            `;
                    addLog('day', `📢 ${killNames.join(', ')} ditemukan meninggal malam ini.`);

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
                                addLog('day', `🏹 Hunter ${h.name} terbunuh malam ini! Dia sempat menembak sebelum mati.`);
                                openHunterModal(h);
                            }, delay);
                            delay += 200; // jeda antar modal jika ada beberapa hunter
                        });
                    }
                }
            } else {
                title.textContent = '📢 Pengumuman Pagi';
                announcement.innerHTML = '<strong style="color:var(--accent-green);">Semua orang selamat malam ini! Tidak ada yang mati.</strong>';
                addLog('day', '📢 Semua orang selamat malam ini.');
            }

            updateStats();
            renderPlayers();
            renderVoteGrid();
            checkWinCondition();

            gameState.nightKills = []; // Reset nightKills agar tidak diproses ganda
        }

        function checkDoppelgangerInheritance(deadPlayer) {
            // Passive: Wolf Cub (Jika mati di siang hari, serigala double kill malam harinya)
            if (deadPlayer.role === 'Wolf Cub' && gameState.phase === 'day') {
                gameState.wolfCubKilledThisDay = true;
                addLog('day', "🐺 Wolf Cub telah terbunuh siang ini! Kawanan Werewolf akan mengamuk dan membunuh 2 kali malam nanti.");
                showToast("Wolf Cub Terbunuh! Werewolf Mengamuk!", "warning");
            }

            // Passive: Hunters Apprentice (Mewarisi peran Hunter)
            if (deadPlayer.role === 'Hunter') {
                const apprentice = gameState.players.find(p => p.role === 'Hunters Apprentice' && p.alive);
                if (apprentice) {
                    apprentice.role = 'Hunter';
                    apprentice._hunterUsed = false;
                    addLog('day', `🏹 Hunters Apprentice memungut senjata Hunter yang gugur dan kini resmi menjadi Hunter!`);
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
                    //  sehingga tampilan sudah benar, ini hanya memperbaiki array tracking.)
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
                    addLog('day', `🎭 Doppelganger (${dopp.name}) resmi mewarisi role ${deadPlayer.role} dari ${deadPlayer.name}!`);
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
                addLog('day', `🏹 Hunter ${hunter ? hunter.name : ''} menembak mati ${targetPlayer.name} sebelum menghembuskan napas terakhir!`);
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
            addLog('day', `🏹 Hunter ${hunter ? hunter.name : ''} menolak melepas tembakan dan mati dengan tenang.`);
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
            const alivePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);

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
                return `
<div style="display:flex;align-items:center;justify-content:center;">
<button class="vote-btn${voteCount > 0 ? ' selected' : ''}" 
  onclick="tapVote('${p.id}', '${escapeJsString(p.name)}')" 
  oncontextmenu="untapVote(event,'${escapeJsString(p.name)}')" 
  data-id="${p.id}" 
  style="width:100%;position:relative;${p.role === 'Mayor' && p._mayorRevealed ? 'border-color:var(--accent-gold);' : ''}${isLeading && voteCount > 0 ? 'border-color:var(--accent-red);box-shadow:0 0 10px rgba(239,68,68,0.4);' : ''}">
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
                    `<span style="margin-right:8px">💀 <strong>${escapeHtml(name)}</strong>: ${count} suara</span>`
                ).join('');
                grid.innerHTML += `
<div style="grid-column:1/-1;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.08);border:1px dashed rgba(239,68,68,0.4);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--accent-red);">
  ⚠️ <strong>Suara tidak sah</strong> — diberikan ke pemain yang sudah mati (abaikan):
  <div style="margin-top:4px;color:var(--text-secondary);">${deadVoteHtml}</div>
</div>`;
            }
        }


        function tapVote(id, name) {
            if (!gameState.votes[name]) gameState.votes[name] = 0;
            gameState.votes[name]++;
            renderVoteGrid();
            renderVoteResults();
        }

        function untapVote(event, name) {
            event.preventDefault();
            if (!gameState.votes[name] || gameState.votes[name] <= 0) return;
            gameState.votes[name]--;
            if (gameState.votes[name] <= 0) delete gameState.votes[name];
            renderVoteGrid();
            renderVoteResults();
        }


        function renderVoteResults() {
            const container = document.getElementById('voteResults');
            // UI-01 FIX: Filter hanya vote untuk pemain yang masih hidup dan berhak divote.
            // Mencegah nama pemain mati (misal korban Sheriff) muncul di panel hasil vote.
            const eligiblePlayers = gameState.players.filter(p => p.alive && !p._idiotRevealed);
            const entries = Object.entries(gameState.votes)
                .filter(([name, count]) => count > 0 && eligiblePlayers.some(p => p.name === name))
                .sort((a, b) => b[1] - a[1]);

            if (entries.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = entries.map(([name, count]) => `
<div class="vote-result-item">
<span>${name}</span>
<span class="vote-result-count">${count} vote${count > 1 ? 's' : ''}</span>
</div>
`).join('');
        }

        function resetVotes() {
            gameState.votes = {};
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('selected'));
            renderVoteResults();
            showToast('Vote direset.', 'info');
        }

        function eliminatePlayer() {
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

            // Jester tidak perlu shortcut endGame di sini. 
            // Ia akan dieksekusi normal dan terdeteksi menang lewat checkWinCondition().

            // Check Idiot
            if (player.role === 'Idiot' && !player._idiotRevealed) {
                player._idiotRevealed = true;
                showToast(`${player.name} adalah Idiot! Dia batal dieksekusi dan kehilangan hak vote-nya selamanya.`, 'info');
                addLog('day', `🃏 ${player.name} adalah Idiot! Dieksekusi tapi selamat. Dia kehilangan hak suaranya dalam rapat.`);
                resetVotes(); // <-- Fix Zombie Votes
                renderVoteGrid();
                return;
            }

            // Check Prince (first time only)
            if (player.role === 'Prince' && !player._princeUsed) {
                player._princeUsed = true;
                showToast(`${player.name} adalah Prince! Tidak mati, tapi role terungkap.`, 'info');
                addLog('day', `🤴 ${player.name} divote mati tapi karena dia adalah Prince, maka dia tidak mati. Role terungkap.`);
                resetVotes(); // <-- Fix Zombie Votes
                renderVoteGrid();
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
                        addLog('day', `✝️ Martyr ${martyr.name} mengorbankan diri di tiang gantungan untuk menyelamatkan ${player.name}!`);
                        resetVotes();
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
                    addLog('day', `🏹 Hunter ${executionTarget.name} mulai diusir... namun dia menarik pelatuknya sebelum digantung!`);
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
            addLog('day', `💀 ${player.name} (${player.role || '???'}) diusir dan mati di tiang gantungan.`);

            finalizeElimination(player);
        }

        function finalizeElimination(player) {
            checkCouplesDeath(player.name);
            checkDoppelgangerInheritance(player);

            updateStats();
            renderPlayers();
            renderVoteGrid();
            resetVotes();
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
                endGame('🃏 JESTER MENANG!', `${jester.name} berhasil diusir lewat voting dan memenangkan permainan!`);
                return;
            }

            // Check Bounty Hunter Win
            const bountyHunter = alivePlayers.find(p => p.role === 'Bounty Hunter');
            if (bountyHunter && gameState.bountyHunterTarget) {
                const bhTarget = gameState.players.find(p => p.id === gameState.bountyHunterTarget);
                if (bhTarget && !bhTarget.alive && bhTarget.killedByVote) {
                    endGame('💰 BOUNTY HUNTER MENANG!', `Bounty Hunter ${bountyHunter.name} berhasil memprovokasi desa untuk mengeksekusi target utamanya!`);
                    return;
                }
            }

            // Check Draw (Semua mati karena serangan silang/bodyguard/veteran)
            if (alivePlayers.length === 0) {
                endGame('👻 SEMUA MATI (DRAW)', 'Tidak ada seorang pun yang selamat di desa ini...');
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

                const allAliveAreLovers = alivePlayers.every(p => loversFactionIds.has(String(p.id)));
                if (allAliveAreLovers) {
                    let text = `Kekuatan abadi cinta mengalahkan segalanya! Cupid beserta pasangannya sukses bertahan hingga akhir.`;
                    const survivor = alivePlayers.find(p => p.role === 'Survivor');
                    if (survivor) text += ` Survivor (${survivor.name}) juga ikut memenangkan pertandingan.`;
                    endGame('💕 FAKSI LOVERS MENANG!', text);
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
                    endGame('🌑 CULT LEADER MENANG!', text);
                    return;
                }
            }

            // Check Serial Killer win
            const aliveSK = alivePlayers.filter(p => p.role === 'Serial Killer');
            if (aliveSK.length > 0 && alivePlayers.length <= aliveSK.length + 1 && aliveWolves.length === 0 && aliveVampire.length === 0) {
                let text = `Tinggal tersisa dengan 1 orang (atau sendirian), Serial Killer tidak dapat dihentikan lagi!`;
                const survivor = alivePlayers.find(p => p.role === 'Survivor');
                if (survivor) text += ` Survivor (${survivor.name}) berhasil hidup hingga akhir dan ikut memenangkan permainan.`;
                endGame('🔪 SERIAL KILLER MENANG!', text);
                return;
            }

            // Check Vampire Win
            const aliveVampire = alivePlayers.filter(p => p.role === 'Vampire');
            if (aliveVampire.length > 0 && alivePlayers.length <= aliveVampire.length + 1 && aliveWolves.length === 0 && aliveSK.length === 0) {
                let text = `Vampir telah menguasai dan menghisap habis seluruh penduduk desa!`;
                const survivor = alivePlayers.find(p => p.role === 'Survivor');
                if (survivor) text += ` Survivor (${survivor.name}) ikut memenangkan pertandingan berdampingan dengan Vampir.`;
                endGame('🧛 VAMPIRE MENANG!', text);
                return;
            }

            // Wolf win: wolves >= non-wolves
            if (aliveWolves.length > 0 && aliveWolves.length >= alivePlayers.length - aliveWolves.length) {
                let text = `Tim serigala (${aliveWolves.map(p => p.name).join(', ')}) mendominasi!`;
                const survivor = alivePlayers.find(p => p.role === 'Survivor');
                if (survivor) text += ` Survivor (${survivor.name}) membuktikan insting bertahannya dan ikut menang.`;
                endGame('🐺 WEREWOLF MENANG!', text);
                return;
            }

            // Villager win: all wolves dead AND all SKs dead AND all Vampires dead AND Cult Leader dead AND at least one villager alive
            const aliveCultLeader = alivePlayers.filter(p => p.role === 'Cult Leader');
            if (aliveWolves.length === 0 && aliveSK.length === 0 && aliveVampire.length === 0 && aliveCultLeader.length === 0 && aliveVillagers.length > 0) {
                // Pastikan Cult Leader tidak sendirian menguasai kota, dicek oleh kondisi sebelumnya
                let text = `Semua ancaman telah dikalahkan! Desa kini damai dan Warga berhasil menang.`;
                const survivor = alivePlayers.find(p => p.role === 'Survivor');
                if (survivor) text += ` Survivor (${survivor.name}) merayakan kemenangan bersama warga.`;
                endGame('🏛️ VILLAGER MENANG!', text);
                return;
            }

            // Cupid lone survivor but lovers are dead (or no lovers made) -> Cupid loses, game Over (Draw)
            const aliveCupid = alivePlayers.filter(p => p.role === 'Cupid');
            if (aliveWolves.length === 0 && aliveSK.length === 0 && aliveVampire.length === 0 && aliveVillagers.length === 0 && aliveCupid.length > 0) {
                endGame('💔 GAME OVER (CUPID KALAH)', `Semua pemain telah mati kecuali Cupid! Namun karena pasangannya juga telah tiada, kisah cinta ini berakhir tragis tanpa pemenang.`);
                return;
            }
        }

        function endGame(title, subtitle) {
            gameState.winner = title;
            document.getElementById('gameOverSection').style.display = 'block';
            document.getElementById('gameOverIcon').textContent = '🏆';
            document.getElementById('gameOverTitle').textContent = title;
            document.getElementById('gameOverSubtitle').textContent = subtitle;

            addLog('day', `🏆 ${title} - ${subtitle}`);
            showToast(title, 'success');
        }

        // ==================== LOG ====================
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
