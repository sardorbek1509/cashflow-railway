/**
 * Game Module - matches gameHandler.js event names exactly
 */
const Game = (() => {
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
      if (state.room) { state.room.players = players; UI.renderWaitingPlayers(players, state.room.hostId); updateStartButton(); }
    });
    SocketManager.on('room:player_ready', ({ players }) => {
      if (state.room) { state.room.players = players; UI.renderWaitingPlayers(players, state.room.hostId); }
    });
    SocketManager.on('room:player_left', ({ username, players }) => {
      if (state.room) { state.room.players = players; UI.renderWaitingPlayers(players, state.room.hostId); }
      UI.appendChatMessage('', `${username} xonani tark etdi.`, true);
    });

    SocketManager.on('game:started', ({ room, playerStates, currentTurn }) => {
      state.room = room; state.playerStates = playerStates;
      state.myPlayerState = playerStates.find(ps => ps.userId?.toString() === state.myUserId);
      state.currentTurnUserId = currentTurn.userId?.toString();
      state.isMyTurn = state.currentTurnUserId === state.myUserId;
      UI.showScreen('game');
      BoardRenderer.init('game-board');
      BoardRenderer.draw(buildPlayerPositions());
      refreshUI();
      UI.toast('O\'yin boshlandi!', 'info');
      if (state.isMyTurn) { toggleButtons(true, false); UI.toast('Siz birinchisiz! Zar oting.', 'success', 3000); }
      else toggleButtons(false, false);
    });

    SocketManager.on('game:dice_rolled', ({ userId, username, dice, total, newPosition }) => {
      UI.showDiceRoll(dice, total);
      const ps = state.playerStates.find(p => p.userId?.toString() === userId?.toString());
      if (ps) ps.position = newPosition;
      BoardRenderer.draw(buildPlayerPositions());
      if (userId?.toString() !== state.myUserId) UI.toast(`${username} ${total} tashladi`, 'info', 2000);
    });

    SocketManager.on('game:event', ({ userId, username, event }) => {
      if (!event) return;
      if (userId?.toString() === state.myUserId) {
        UI.showEventCard(event);
      } else if (event.type !== 'none') {
        UI.appendChatMessage('', `${username}: ${event.title}`, true);
      }
    });

    SocketManager.on('game:deal_decision', ({ deal, canAfford }) => {
      state.pendingDeal = deal;
      UI.showDealModal(deal, canAfford);
    });

    SocketManager.on('game:deal_purchased', ({ username, deal, passiveIncomeGained }) => {
      UI.hideModal('modal-deal'); state.pendingDeal = null;
      UI.toast(`${username} "${deal.title}" sotib oldi! +$${passiveIncomeGained}/oy`, 'success');
    });

    SocketManager.on('game:deal_passed', () => { UI.hideModal('modal-deal'); state.pendingDeal = null; });

    SocketManager.on('game:turn_changed', ({ currentPlayer }) => {
      state.currentTurnUserId = currentPlayer.userId?.toString();
      state.isMyTurn = state.currentTurnUserId === state.myUserId;
      updateTurnIndicator(); refreshPlayersList();
      if (state.isMyTurn) { toggleButtons(true, false); UI.toast('Sizning navbatingiz!', 'success', 3000); UI.hideEventCard(); }
      else toggleButtons(false, false);
    });

    SocketManager.on('game:loan_taken', ({ loanAmount, monthlyPayment, newBalance }) => {
      UI.hideModal('modal-loan');
      UI.toast(`Kredit: $${loanAmount?.toLocaleString()}. Oylik: $${monthlyPayment?.toLocaleString()}`, 'warning');
      if (state.myPlayerState) { state.myPlayerState.balance = newBalance; UI.updateStatPanel(state.myPlayerState); }
    });

    SocketManager.on('game:player_won', (w) => {
      UI.hideAllModals();
      UI.showGameOver({ ...w, message: `Passiv daromad ($${w.passiveIncome?.toLocaleString()}/oy) xarajatlardan oshdi!` });
    });

    SocketManager.on('chat_message', ({ username, message }) => UI.appendChatMessage(username, message));
    SocketManager.on('game_error', ({ message }) => UI.toast(`⚠️ ${message}`, 'error'));
  }

  function bindUIEvents() {
    document.getElementById('btn-roll-dice')?.addEventListener('click', () => {
      if (!state.isMyTurn || !state.currentRoomId) return;
      SocketManager.send('game:roll_dice', { roomId: state.currentRoomId });
      toggleButtons(false, false);
    });

    document.getElementById('btn-deal-accept')?.addEventListener('click', () => {
      if (!state.pendingDeal || !state.currentRoomId) return;
      SocketManager.send('game:buy_deal', { roomId: state.currentRoomId, dealId: state.pendingDeal.id });
      UI.hideModal('modal-deal');
    });

    document.getElementById('btn-deal-decline')?.addEventListener('click', () => {
      if (!state.currentRoomId) return;
      SocketManager.send('game:pass_deal', { roomId: state.currentRoomId });
      UI.hideModal('modal-deal'); state.pendingDeal = null;
    });

    document.getElementById('btn-take-loan')?.addEventListener('click', () => UI.showModal('modal-loan'));

    document.getElementById('loan-amount')?.addEventListener('input', (e) => {
      const a = parseInt(e.target.value) || 0;
      UI.setText('loan-preview', a > 0 ? `Oylik to'lov: $${Math.ceil(a*0.1).toLocaleString()} | Balansga: +$${a.toLocaleString()}` : '');
    });

    document.getElementById('btn-loan-confirm')?.addEventListener('click', () => {
      const amount = parseInt(UI.getInputValue('loan-amount'));
      if (!amount || amount < 1000 || amount > 100000) { UI.toast('$1,000 - $100,000 orasida kiriting.', 'error'); return; }
      SocketManager.send('game:take_loan', { roomId: state.currentRoomId, amount });
    });

    document.getElementById('btn-loan-cancel')?.addEventListener('click', () => UI.hideModal('modal-loan'));
    document.getElementById('btn-return-lobby')?.addEventListener('click', () => { UI.hideAllModals(); resetState(); UI.showScreen('lobby'); });
    document.getElementById('btn-show-transactions')?.addEventListener('click', () => UI.showModal('modal-transactions'));
    document.getElementById('btn-close-transactions')?.addEventListener('click', () => UI.hideModal('modal-transactions'));
    document.getElementById('btn-send-chat')?.addEventListener('click', sendChat);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  }

  function sendChat() {
    const message = UI.getInputValue('chat-input');
    if (!message || !state.currentRoomId) return;
    SocketManager.send('chat_message', { roomId: state.currentRoomId, message });
    UI.setInputValue('chat-input', '');
  }

  function joinRoom(roomId) { state.currentRoomId = roomId; SocketManager.send('room:join', { roomId }); }

  function enterWaitingRoom(room) {
    state.room = room; state.currentRoomId = room.roomId;
    UI.setText('waiting-room-id', room.roomId);
    UI.renderWaitingPlayers(room.players, room.hostId);
    UI.showScreen('waiting');
    updateStartButton();
  }

  function refreshUI() {
    UI.updateStatPanel(state.myPlayerState);
    refreshPlayersList(); updateTurnIndicator();
    if (state.isMyTurn) toggleButtons(true, false); else toggleButtons(false, false);
  }

  function refreshPlayersList() {
    UI.renderPlayersList(state.playerStates, state.currentTurnUserId, state.myUserId);
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
