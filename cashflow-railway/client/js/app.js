/**
 * App Bootstrap - auth, lobby, room management
 * Socket events: room:join, room:ready, game:start
 */
(function () {
  'use strict';

  let UI = window.ui || window.UI || null;
  let CF_API = window.CF_API || null;

  const resolveAuthGlobals = () => {
    UI = window.ui || window.UI || UI;
    if (!UI) UI = window.ui = window.UI = window.UI || window.ui || null;

    const ensureUIHelpers = () => {
      if (!UI) return;
      if (typeof UI.getInputValue !== 'function') UI.getInputValue = (id) => document.getElementById(id)?.value || '';
      if (typeof UI.setText !== 'function') UI.setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '';
      };
      if (typeof UI.setLoading !== 'function') UI.setLoading = (btn, loading) => {
        if (!btn) return;
        btn.disabled = loading;
        btn._origText = btn._origText || btn.textContent;
        btn.textContent = loading ? '...' : btn._origText;
      };
      if (typeof UI.showScreen !== 'function') UI.showScreen = (name) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(`screen-${name}`);
        if (screen) screen.classList.add('active');
      };
      if (typeof UI.renderWaitingPlayers !== 'function') UI.renderWaitingPlayers = (players, hostId) => {
        const list = document.getElementById('waiting-players-list');
        const badge = document.getElementById('player-count-badge');
        if (badge) badge.textContent = `${players?.length || 0}/6`;
        if (!list) return;
        list.innerHTML = (players || []).map(p => {
          const isHost = p.userId?.toString() === hostId?.toString();
          return `
            <li class="waiting-player-item">
              <span class="wp-name">${p.username}</span>
              <div style="display:flex;gap:6px;align-items:center">
                ${isHost ? '<span class="wp-host-badge">HOST</span>' : ''}
                <span class="wp-status ${p.isReady ? 'ready' : ''}">${p.isReady ? '✓ Ready' : 'Not ready'}</span>
              </div>
            </li>`;
        }).join('');
      };
      if (typeof UI.renderPlayersList !== 'function') UI.renderPlayersList = (playerStates, currentTurnUserId, myUserId) => {
        const list = document.getElementById('all-players-list');
        if (!list || !playerStates) return;
        list.innerHTML = playerStates.map((ps, idx) => {
          const isActive = ps.userId?.toString() === currentTurnUserId?.toString();
          const color = ['#00e676','#448aff','#ff4d6d','#ffd600','#7c4dff','#00bcd4'][idx % 6];
          return `
            <li class="player-list-item ${isActive ? 'active-turn' : ''}">
              <div class="player-avatar" style="background:${color}">${ps.username?.charAt(0)?.toUpperCase() || '?'}</div>
              <div class="player-info">
                <div class="player-name">${ps.username}</div>
                <div class="player-balance">${ps.balance != null ? '$' + Math.round(ps.balance).toLocaleString() : '$0'} · Space ${ps.position ?? 0}</div>
              </div>
            </li>`;
        }).join('');
      };
      if (typeof UI.updateStatPanel !== 'function') UI.updateStatPanel = (playerState) => {
        if (!playerState) return;
        UI.setText('my-username-display', playerState.username || 'You');
        UI.setText('my-balance', `$${Math.round(playerState.balance || 0).toLocaleString()}`);
        UI.setText('my-salary', `$${Math.round(playerState.salary || 0).toLocaleString()}`);
        UI.setText('my-passive', `$${Math.round(playerState.passiveIncome || 0).toLocaleString()}`);
        UI.setText('my-expenses', `$${Math.round(playerState.expenses || 0).toLocaleString()}`);
      };
      if (typeof UI.showModal !== 'function') UI.showModal = (id) => { const modal = document.getElementById(id); if (modal) modal.classList.remove('hidden'); };
      if (typeof UI.hideModal !== 'function') UI.hideModal = (id) => { const modal = document.getElementById(id); if (modal) modal.classList.add('hidden'); };
      if (typeof UI.hideAllModals !== 'function') UI.hideAllModals = () => document.querySelectorAll('.modal-overlay, .modal').forEach(el => el.classList.add('hidden'));
      if (typeof UI.appendChatMessage !== 'function') UI.appendChatMessage = (username, message, system = false) => {
        const list = document.getElementById('chat-list') || document.getElementById('game-chat-list') || document.getElementById('chat-log');
        if (!list) return;
        const li = document.createElement('li');
        li.className = `chat-message ${system ? 'system' : ''}`;
        li.textContent = system ? message : `${username}: ${message}`;
        list.appendChild(li);
        list.scrollTop = list.scrollHeight;
      };
      if (typeof UI.showEventCard !== 'function') UI.showEventCard = (event) => {
        const notif = document.getElementById('event-notification');
        const icon = document.getElementById('event-icon');
        if (!notif) return;
        icon.textContent = event?.type ? (event.type === 'payday' ? '💰' : event.type === 'deal' ? '🤝' : '📌') : '📌';
        document.getElementById('event-title').textContent = event?.title || 'Event';
        document.getElementById('event-message').textContent = event?.message || '';
        notif.classList.remove('hidden');
      };
      if (typeof UI.hideEventCard !== 'function') UI.hideEventCard = () => { const notif = document.getElementById('event-notification'); if (notif) notif.classList.add('hidden'); };
      if (typeof UI.showDiceRoll !== 'function') UI.showDiceRoll = (dice) => {
        const die1 = document.getElementById('die-1');
        const die2 = document.getElementById('die-2');
        if (die1) die1.textContent = dice?.[0] ?? '?';
        if (die2) die2.textContent = dice?.[1] ?? '';
      };
      if (typeof UI.showGameOver !== 'function') UI.showGameOver = (data) => {
        const title = document.getElementById('win-title');
        if (title) title.textContent = data?.message || 'Game Over';
        const modal = document.getElementById('modal-win');
        if (modal) modal.classList.remove('hidden');
      };
    };

    ensureUIHelpers();

    if (!CF_API && window.api) {
      CF_API = {
        Auth: {
          login: async (email, password) => {
            const res = await window.api.login(email, password);
            window.api.setToken(res.data.token);
            window.api.setUser(res.data.user);
            return res;
          },
          register: async (username, email, password) => {
            const res = await window.api.register(username, email, password);
            window.api.setToken(res.data.token);
            window.api.setUser(res.data.user);
            return res;
          },
          getMe: async () => {
            const res = await window.api.getMe();
            if (res?.data?.user) window.api.setUser(res.data.user);
            return res;
          },
          logout: () => window.api.logout(),
          isLoggedIn: () => !!window.api.getToken(),
          getCurrentUser: () => window.api.getUser()
        },
        Rooms: {
          create: async (maxPlayers) => {
            const res = await window.api.createRoom(maxPlayers);
            return res?.data?.room || null;
          },
          list: async () => {
            const res = await window.api.listRooms();
            return res?.data?.rooms || [];
          },
          get: async (roomId) => {
            const res = await window.api.getRoom(roomId);
            return res?.data?.room || null;
          },
          getState: async (roomId) => {
            const res = await window.api.getRoomState(roomId);
            return res?.data || null;
          }
        },
        getToken: () => window.api.getToken()
      };
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    resolveAuthGlobals();
    if (!UI || typeof UI.showScreen !== 'function') {
      console.error('UI module is not available', UI);
      return;
    }
    if (!CF_API || !CF_API.Auth) {
      console.error('CF_API module is not available', CF_API);
      return;
    }
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
    document.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
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

    document.getElementById('btn-join-code')?.addEventListener('click', () => joinByCode());
    document.getElementById('join-room-code')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinByCode(); });
    document.getElementById('btn-refresh-rooms')?.addEventListener('click', refreshRooms);

    document.getElementById('rooms-list')?.addEventListener('click', async (e) => {
      const joinBtn = e.target.closest('.join-room-btn');
      if (joinBtn) { await joinRoomById(joinBtn.dataset.roomId); return; }
      const delBtn = e.target.closest('.delete-room-btn');
      if (delBtn) { await deleteRoomById(delBtn.dataset.roomId); }
    });
  }

  async function joinByCode() {
    const roomId = UI.getInputValue('join-room-code').toUpperCase();
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

  async function deleteRoomById(roomId) {
    if (!confirm("Bu xonani o'chirasizmi?")) return;
    try {
      await CF_API.Rooms.delete(roomId);
      UI.toast(`Xona o'chirildi.`, 'success');
      await refreshRooms();
    } catch (err) { UI.toast(err.message || `Xona o'chirib bo'lmadi.`, 'error'); }
  }

  async function refreshRooms() {
    try {
      const rooms = await CF_API.Rooms.list();
      const currentUser = CF_API.Auth.getCurrentUser();
      const currentUserId = currentUser?.id || currentUser?._id;
      UI.renderRoomsList(rooms, currentUserId);
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

    document.getElementById('btn-leave-waiting')?.addEventListener('click', () => {
      const roomId = Game.getCurrentRoomId();
      if (roomId) SocketManager.send('room:leave', { roomId });
      Game.resetState();
      UI.showScreen('lobby');
    });

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      const code = document.getElementById('waiting-room-code')?.textContent;
      if (code) navigator.clipboard?.writeText(code).then(() => UI.toast('Kod nusxalandi!', 'success', 2000));
    });

    // Waiting room chat (only enabled when all players ready)
    document.getElementById('btn-waiting-send-chat')?.addEventListener('click', sendWaitingChat);
    document.getElementById('waiting-chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendWaitingChat();
    });

    // Listen for chat messages in waiting room
    SocketManager.on('room:chat_message', ({ username, message }) => {
      const list = document.getElementById('waiting-chat-list');
      if (!list) return;
      const li = document.createElement('li');
      li.className = 'chat-message';
      li.textContent = `${username}: ${message}`;
      list.appendChild(li);
      list.scrollTop = list.scrollHeight;
    });

    // If room is deleted by host, kick to lobby
    SocketManager.on('room:deleted', ({ message }) => {
      UI.toast(message || "Xona o'chirildi.", 'warning', 4000);
      Game.resetState();
      UI.showScreen('lobby');
      refreshRooms();
    });

    // Unlock chat when all players are ready
    SocketManager.on('room:all_ready', () => {
      document.getElementById('chat-locked-msg')?.classList.add('hidden');
      document.getElementById('waiting-chat-area')?.classList.remove('hidden');
      UI.toast('Hamma tayyor! Chat ochildi 💬', 'success', 3000);
    });
  }

  function sendWaitingChat() {
    const input = document.getElementById('waiting-chat-input');
    const message = input?.value?.trim();
    if (!message) return;
    const roomId = Game.getCurrentRoomId();
    if (!roomId) return;
    SocketManager.send('room:chat', { roomId, message });
    input.value = '';
  }

  window.app = {
    joinRoom: joinRoomById,
    joinByCode: joinByCode,
    refreshRooms: refreshRooms
  };
})();
