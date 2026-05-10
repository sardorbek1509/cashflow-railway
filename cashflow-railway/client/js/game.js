/**
 * Game Module - matches gameHandler.js event names exactly
 */
const Game = (() => {
  // UI ni window dan olamiz - ui.js dan keyin yuklanadi
  const getUI = () => window.UI || window.ui;

  let state = {
    room: null, playerStates: [], myPlayerState: null,
    myUserId: null, currentTurnUserId: null,
    isMyTurn: false, pendingDeal: null, currentRoomId: null
  };

  function init(userId) {
    state.myUserId = userId?.toString();
    bindSocketEvents();
    bindUIEvents();
  }

  function bindSocketEvents() {
    SocketManager.on('game:state_update', ({ room, playerStates }) => {
      state.room = room;
      state.playerStates = playerStates;
      state.myPlayerState = playerStates.find(ps => ps.userId?.toString() === state.myUserId);
      const currentPlayer = room.players[room.currentTurn % room.players.length];
      state.currentTurnUserId = currentPlayer?.userId?.toString();
      state.isMyTurn = state.currentTurnUserId === state.myUserId;
      refreshUI();
      BoardRenderer.draw(buildPlayerPositions());
    });

    SocketManager.on('room:player_joined', ({ players }) => {
      if (state.room) { state.room.players = players; getUI().renderWaitingPlayers(players, state.room.hostId); updateStartButton(); }
    });
    SocketManager.on('room:player_ready', ({ players }) => {
      if (state.room) { state.room.players = players; getUI().renderWaitingPlayers(players, state.room.hostId); }
    });
    SocketManager.on('room:player_left', ({ username, players }) => {
      if (state.room) { state.room.players = players; getUI().renderWaitingPlayers(players, state.room.hostId); }
      getUI().appendChatMessage('', `${username} xonani tark etdi.`, true);
    });

    SocketManager.on('game:started', ({ room, playerStates, currentTurn }) => {
      state.room = room; state.playerStates = playerStates;
      state.myPlayerState = playerStates.find(ps => ps.userId?.toString() === state.myUserId);
      state.currentTurnUserId = currentTurn.userId?.toString();
      state.isMyTurn = state.currentTurnUserId === state.myUserId;
      getUI().showScreen('game');
      BoardRenderer.init('game-board');
      BoardRenderer.draw(buildPlayerPositions());
      refreshUI();
      getUI().toast('O\'yin boshlandi!', 'info');
      if (state.isMyTurn) { toggleButtons(true, false); getUI().toast('Siz birinchisiz! Zar oting.', 'success', 3000); }
      else toggleButtons(false, false);
    });

    SocketManager.on('game:dice_rolled', ({ userId, username, dice, total, newPosition }) => {
      getUI().showDiceRoll(dice, total);
      const ps = state.playerStates.find(p => p.userId?.toString() === userId?.toString());
      if (ps) ps.position = newPosition;
      BoardRenderer.draw(buildPlayerPositions());
      if (userId?.toString() !== state.myUserId) getUI().toast(`${username} ${total} tashladi`, 'info', 2000);
    });

    SocketManager.on('game:event', ({ userId, username, event }) => {
      if (!event) return;
      if (userId?.toString() === state.myUserId) {
        getUI().showEventCard(event);
      } else if (event.type !== 'none') {
        getUI().appendChatMessage('', `${username}: ${event.title}`, true);
      }
    });

    SocketManager.on('game:deal_decision', ({ deal, canAfford }) => {
      state.pendingDeal = deal;
      getUI().showDealModal(deal, canAfford);
    });

    SocketManager.on('game:deal_purchased', ({ username, deal, passiveIncomeGained }) => {
      getUI().hideModal('modal-deal'); state.pendingDeal = null;
      getUI().toast(`${username} "${deal.title}" sotib oldi! +$${passiveIncomeGained}/oy`, 'success');
    });

    SocketManager.on('game:deal_passed', () => { getUI().hideModal('modal-deal'); state.pendingDeal = null; });

    SocketManager.on('game:turn_changed', ({ currentPlayer }) => {
      state.currentTurnUserId = currentPlayer.userId?.toString();
      state.isMyTurn = state.currentTurnUserId === state.myUserId;
      updateTurnIndicator(); refreshPlayersList();
      if (state.isMyTurn) { toggleButtons(true, false); getUI().toast('Sizning navbatingiz!', 'success', 3000); getUI().hideEventCard(); }
      else toggleButtons(false, false);
    });

    SocketManager.on('game:loan_taken', ({ loanAmount, monthlyPayment, newBalance }) => {
      getUI().hideModal('modal-loan');
      getUI().toast(`Kredit: $${loanAmount?.toLocaleString()}. Oylik: $${monthlyPayment?.toLocaleString()}`, 'warning');
      if (state.myPlayerState) { state.myPlayerState.balance = newBalance; getUI().updateStatPanel(state.myPlayerState); }
    });

    SocketManager.on('game:player_won', (w) => {
      getUI().hideAllModals();
      getUI().showGameOver({ ...w, message: `Passiv daromad ($${w.passiveIncome?.toLocaleString()}/oy) xarajatlardan oshdi!` });
    });

    SocketManager.on('chat_message', ({ username, message }) => getUI().appendChatMessage(username, message));
    SocketManager.on('game_error', ({ message }) => getUI().toast(`⚠️ ${message}`, 'error'));
  }

  function bindUIEvents() {
    document.getElementById('btn-roll-dice')?.addEventListener('click', () => {
      if (!state.isMyTurn || !state.currentRoomId) return;
      SocketManager.send('game:roll_dice', { roomId: state.currentRoomId });
      toggleButtons(false, false);
    });

    document.getElementById('btn-deal-buy')?.addEventListener('click', () => {
      if (!state.pendingDeal || !state.currentRoomId) return;
      SocketManager.send('game:buy_deal', { roomId: state.currentRoomId, dealId: state.pendingDeal.id });
      getUI().hideModal('modal-deal');
    });

    document.getElementById('btn-deal-pass')?.addEventListener('click', () => {
      if (!state.currentRoomId) return;
      SocketManager.send('game:pass_deal', { roomId: state.currentRoomId });
      getUI().hideModal('modal-deal'); state.pendingDeal = null;
    });

    document.getElementById('btn-take-loan')?.addEventListener('click', () => getUI().showModal('modal-loan'));

    document.getElementById('loan-amount')?.addEventListener('input', (e) => {
      const a = parseInt(e.target.value) || 0;
      getUI().setText('loan-preview', a > 0 ? `Oylik to'lov: $${Math.ceil(a*0.1).toLocaleString()} | Balansga: +$${a.toLocaleString()}` : '');
    });

    document.getElementById('btn-loan-confirm')?.addEventListener('click', () => {
      const amount = parseInt(getUI().getInputValue('loan-amount'));
      if (!amount || amount < 1000 || amount > 100000) { getUI().toast('$1,000 - $100,000 orasida kiriting.', 'error'); return; }
      SocketManager.send('game:take_loan', { roomId: state.currentRoomId, amount });
    });

    document.getElementById('btn-loan-cancel')?.addEventListener('click', () => getUI().hideModal('modal-loan'));
    document.getElementById('btn-return-lobby')?.addEventListener('click', () => { getUI().hideAllModals(); resetState(); getUI().showScreen('lobby'); });
    document.getElementById('btn-show-transactions')?.addEventListener('click', () => getUI().showModal('modal-transactions'));
    document.getElementById('btn-close-transactions')?.addEventListener('click', () => getUI().hideModal('modal-transactions'));
    document.getElementById('btn-send-chat')?.addEventListener('click', sendChat);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  }

  function sendChat() {
    const message = getUI().getInputValue('chat-input');
    if (!message || !state.currentRoomId) return;
    SocketManager.send('chat_message', { roomId: state.currentRoomId, message });
    getUI().setInputValue('chat-input', '');
  }

  function joinRoom(roomId) { state.currentRoomId = roomId; SocketManager.send('room:join', { roomId }); }

  function enterWaitingRoom(room) {
    state.room = room; state.currentRoomId = room.roomId;
    if (typeof getUI().setText === 'function') {
      getUI().setText('waiting-room-code', room.roomId);
    } else {
      const el = document.getElementById('waiting-room-code');
      if (el) el.textContent = room.roomId || '';
    }
    getUI().renderWaitingPlayers(room.players, room.hostId);
    getUI().showScreen('waiting');
    updateStartButton();
  }

  function refreshUI() {
    getUI().updateStatPanel(state.myPlayerState);
    refreshPlayersList(); updateTurnIndicator();
    if (state.isMyTurn) toggleButtons(true, false); else toggleButtons(false, false);
  }

  function refreshPlayersList() {
    getUI().renderPlayersList(state.playerStates, state.currentTurnUserId, state.myUserId);
  }

  function updateTurnIndicator() {
    const ps = state.playerStates.find(p => p.userId?.toString() === state.currentTurnUserId);
    const isMe = state.currentTurnUserId === state.myUserId;
    const el = document.getElementById('turn-indicator-text');
    if (el) el.innerHTML = isMe ? `<strong>Sizning navbat</strong>` : `<strong>${ps?.username || '...'}</strong> navbati`;
  }

  function updateStartButton() {
    const btn = document.getElementById('btn-start-game');
    if (!btn || !state.room) return;
    const isHost = state.room.hostId?.toString() === state.myUserId;
    const canStart = state.room.players.length >= 2;
    btn.classList.toggle('hidden', !isHost);
    if (isHost) { btn.disabled = !canStart; btn.textContent = canStart ? "O'yinni Boshlash" : `Yana ${2 - state.room.players.length} o'yinchi kerak`; }
  }

  function toggleButtons(showRoll, showEndTurn) {
    const r = document.getElementById('btn-roll-dice');
    const e = document.getElementById('btn-end-turn');
    if (r) r.disabled = !showRoll;
    if (e) e.classList.toggle('hidden', !showEndTurn);
  }

  function buildPlayerPositions() {
    return state.playerStates.map((ps, i) => ({ username: ps.username, position: ps.position || 0, colorIndex: i }));
  }

  function resetState() {
    state = { room: null, playerStates: [], myPlayerState: null, myUserId: state.myUserId,
      currentTurnUserId: null, isMyTurn: false, pendingDeal: null, currentRoomId: null };
  }

  function getCurrentRoomId() { return state.currentRoomId; }

  return { init, joinRoom, enterWaitingRoom, resetState, getCurrentRoomId };
})();
window.Game = Game;