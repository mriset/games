(() => {
 const params = new URLSearchParams(window.location.search);
 let savedPlayerSession = null;
 try {
 savedPlayerSession = JSON.parse(localStorage.getItem('werewolf_player_session') || 'null');
 } catch (e) {
 savedPlayerSession = null;
 }
 const savedModeratorRoom = localStorage.getItem('werewolf_online_room');
 window.WEREWOLF_BOOT_MODE = params.get('mode') || (params.has('room') || (savedPlayerSession?.roomCode && !savedModeratorRoom) ? 'join' : '');
 window.WEREWOLF_PLAYER_MODE = window.WEREWOLF_BOOT_MODE === 'join';
 })();

