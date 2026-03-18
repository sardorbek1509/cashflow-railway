/**
 * App Bootstrap - auth, lobby, room management
 * Socket events: room:join, room:ready, game:start
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    if (CF_API.Auth.isLoggedIn()) {
      try {
        await CF_API.Auth.getMe();
        await enterLobby();
      } catch {
        CF_API.Auth.logout();
        UI.showScreen('auth');
      }
    } else {
      UI.showScreen('auth');
    }
    bindAuthEvents();
    bindLobbyEvents();
    bindWaitingRoomEvents();
  });

  function bindAuthEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`form-${btn.dataset.tab}`)?.classList.add('active');
      });
    });

    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      const errEl = document.getElementById('login-error');
      errEl?.classList.add('hidden');
      UI.setLoading(btn, true);
      try {
        await CF_API.Auth.login(UI.getInputValue('login-email'), UI.getInputValue('login-password'));
        await enterLobby();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message || 'Kirish amalga oshmadi.'; errEl.classList.remove('hidden'); }
      } finally { UI.setLoading(btn, false); }
    });

    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      const errEl = document.getElementById('register-error');
      errEl?.classList.add('hidden');
      UI.setLoading(btn, true);
      try {
        await CF_API.Auth.register(
          UI.getInputValue('reg-username'),
          UI.getInputValue('reg-email'),
          UI.getInputValue('reg-password')
        );
        await enterLobby();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message || 'Ro\'yxatdan o\'tish amalga oshmadi.'; errEl.classList.remove('hidden'); }
      } finally { UI.setLoading(btn, false); }
    });
  }

  async function enterLobby() {
    const user = CF_API.Auth.getCurrentUser();
    if (!user) return;
    try { SocketManager.connect(); } catch (err) { console.error('Socket ulanmadi:', err); }
    Game.init(user.id || user._id);
    UI.setText('lobby-username', user.username);
    UI.showScreen('lobby');
    await refreshRooms();
  }

  function bindLobbyEvents() {
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      CF_API.Auth.logout(); SocketManager.disconnect(); UI.showScreen('auth');
    });

    document.getElementById('btn-create-room')?.addEventListener('click', async () => {
      try {
        const room = await CF_API.Rooms.create();
        Game.enterWaitingRoom(room);
        Game.joinRoom(room.roomId);
      } catch (err) { UI.toast(err.message || 'Xona yaratib bo\'lmadi.', 'error'); }
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => joinByCode());
    document.getElementById('join-room-id')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinByCode(); });
    document.getElementById('btn-refresh-rooms')?.addEventListener('click', refreshRooms);

    document.getElementById('rooms-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.join-room-btn');
      if (btn) await joinRoomById(btn.dataset.roomId);
    });
  }

  async function joinByCode() {
    const roomId = UI.getInputValue('join-room-id').toUpperCase();
    if (!roomId) { UI.toast('Xona kodini kiriting.', 'warning'); return; }
    await joinRoomById(roomId);
  }

  async function joinRoomById(roomId) {
    try {
      const room = await CF_API.Rooms.get(roomId);
      if (!room) { UI.toast('Xona topilmadi.', 'error'); return; }
      if (room.status === 'finished') { UI.toast('Bu o\'yin tugagan.', 'warning'); return; }
      Game.enterWaitingRoom(room);
      Game.joinRoom(roomId);
    } catch (err) { UI.toast(err.message || 'Xonaga kirish amalga oshmadi.', 'error'); }
  }

  async function refreshRooms() {
    try {
      const rooms = await CF_API.Rooms.list();
      UI.renderRoomsList(rooms);
    } catch (err) { console.error('Xonalar yuklanmadi:', err); }
  }

  function bindWaitingRoomEvents() {
    document.getElementById('btn-toggle-ready')?.addEventListener('click', () => {
      const roomId = Game.getCurrentRoomId();
      if (roomId) SocketManager.send('room:ready', { roomId });
    });

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      const roomId = Game.getCurrentRoomId();
      if (roomId) SocketManager.send('game:start', { roomId });
    });

    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      const roomId = Game.getCurrentRoomId();
      if (roomId) SocketManager.send('room:leave', { roomId });
      Game.resetState();
      UI.showScreen('lobby');
    });

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      const code = document.getElementById('waiting-room-id')?.textContent;
      if (code) navigator.clipboard?.writeText(code).then(() => UI.toast('Kod nusxalandi!', 'success', 2000));
    });
  }
})();
