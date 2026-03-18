/**
 * UI Module - DOM manipulation, board rendering, notifications
 */
const BOARD_SPACES = [
  {id:0,type:'payday',label:'PAYDAY',icon:'💰'},
  {id:1,type:'deal',label:'DEAL',icon:'🤝'},
  {id:2,type:'expense',label:'DOODAD',icon:'💸'},
  {id:3,type:'deal',label:'DEAL',icon:'🤝'},
  {id:4,type:'market',label:'MARKET',icon:'📈'},
  {id:5,type:'charity',label:'CHARITY',icon:'🫶'},
  {id:6,type:'deal',label:'DEAL',icon:'🤝'},
  {id:7,type:'expense',label:'DOODAD',icon:'💸'},
  {id:8,type:'deal',label:'DEAL',icon:'🤝'},
  {id:9,type:'market',label:'MARKET',icon:'📈'},
  {id:10,type:'payday',label:'PAYDAY',icon:'💰'},
  {id:11,type:'deal',label:'DEAL',icon:'🤝'},
  {id:12,type:'baby',label:'BABY',icon:'👶'},
  {id:13,type:'deal',label:'DEAL',icon:'🤝'},
  {id:14,type:'market',label:'MARKET',icon:'📈'},
  {id:15,type:'expense',label:'DOODAD',icon:'💸'},
  {id:16,type:'deal',label:'DEAL',icon:'🤝'},
  {id:17,type:'charity',label:'CHARITY',icon:'🫶'},
  {id:18,type:'deal',label:'DEAL',icon:'🤝'},
  {id:19,type:'market',label:'MARKET',icon:'📈'},
  {id:20,type:'payday',label:'PAYDAY',icon:'💰'},
  {id:21,type:'deal',label:'DEAL',icon:'🤝'},
  {id:22,type:'expense',label:'DOODAD',icon:'💸'},
  {id:23,type:'deal',label:'DEAL',icon:'🤝'}
];

const PLAYER_COLORS = ['#00e676','#448aff','#ff4d6d','#ffd600','#7c4dff','#00bcd4'];

// Board layout: spaces 0-23 arranged around the perimeter of a 6x4 grid
// Top row: 0-5 (left to right), Right col: 6-9 (top to bottom)
// Bottom row: 10-15 (right to left), Left col: 16-23 (bottom to top + wrapping center)
const BOARD_LAYOUT = [
  // [spaceId, gridCol (1-indexed), gridRow (1-indexed)]
  [0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[5,6,1],
  [6,6,2],[7,6,3],[8,6,4],
  [9,5,4],[10,4,4],[11,3,4],[12,2,4],[13,1,4],
  [14,1,3],[15,1,2],
  [16,2,2],[17,3,2],[18,4,2],[19,5,2],  // inner top not really but...
  [20,2,3],[21,3,3],[22,4,3],[23,5,3]
];

class UI {
  constructor() {
    this.currentScreen = 'auth';
    this.toastTimeout = null;
  }

  // ── SCREENS ────────────────────────────────────────────────────
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`screen-${name}`);
    if (screen) screen.classList.add('active');
    this.currentScreen = name;
  }

  // ── BOARD ──────────────────────────────────────────────────────
  buildBoard() {
    const board = document.getElementById('game-board');
    if (!board) return;
    board.innerHTML = '';

    // Create 6x4 grid: outer ring = board spaces, inner = center
    const gridCells = {};

    // Place board spaces around perimeter
    // Top row: spaces 0-5, cols 1-6, row 1
    const perimeter = [
      ...Array.from({length:6}, (_,i) => ({sid:i, col:i+1, row:1})),
      {sid:6,col:6,row:2},{sid:7,col:6,row:3},{sid:8,col:6,row:4},
      ...Array.from({length:6}, (_,i) => ({sid:9+i, col:5-i, row:4})),
      {sid:15,col:1,row:3},{sid:16,col:1,row:2},
      // remaining spaces go into center area for a 24-space board
    ];

    // For a 24-space board around 6x4, we put 6 top, 2 right (middle), 6 bottom, 2 left (middle), remaining in center:
    // Actually let's do a cleaner 24 space perimeter: top 6, right 2 inner rows, bottom 6, left 2 inner rows = 16... not enough
    // Use all perimeter: top row 6, right col rows 2-3 = 2, bottom row 6 reversed, left col rows 2-3 = 2 → 16 outer + 8 center blend
    // Simplest approach: lay all 24 spaces out as a circular path in the grid positions

    const spacePositions = [
      // Top row left to right: row=1, cols 1-6
      {col:1,row:1},{col:2,row:1},{col:3,row:1},{col:4,row:1},{col:5,row:1},{col:6,row:1},
      // Right col top to bottom: rows 2-4, col=6
      {col:6,row:2},{col:6,row:3},{col:6,row:4},
      // Bottom row right to left: row=4, cols 5-1
      {col:5,row:4},{col:4,row:4},{col:3,row:4},{col:2,row:4},{col:1,row:4},
      // Left col bottom to top: rows 3-1, col=1
      {col:1,row:3},{col:1,row:2},
      // Fill remaining 8 in inner grid (rows 2-3, cols 2-5)
      {col:2,row:2},{col:3,row:2},{col:4,row:2},{col:5,row:2},
      {col:2,row:3},{col:3,row:3},{col:4,row:3},{col:5,row:3}
    ];

    BOARD_SPACES.forEach((space, i) => {
      const pos = spacePositions[i];
      const el = document.createElement('div');
      el.className = `board-space space-${space.type}`;
      el.id = `space-${space.id}`;
      el.style.gridColumn = pos.col;
      el.style.gridRow = pos.row;
      el.title = space.label;
      el.innerHTML = `
        <div class="space-icon">${space.icon}</div>
        <div class="space-label">${space.label}</div>
        <div class="space-tokens" id="tokens-${space.id}"></div>
      `;
      board.appendChild(el);
    });

    // Center logo (spans inner area 2-5 cols, 2-3 rows)
    const center = document.createElement('div');
    center.className = 'board-center';
    center.style.cssText = 'grid-column:2/6;grid-row:2/4;';
    center.innerHTML = `
      <div class="board-center-logo">CASHFLOW</div>
      <div class="board-center-subtitle">Financial Freedom Game</div>
    `;
    // Don't add center since inner spaces are now board spaces
  }

  updatePlayerTokens(playerStates, myUserId) {
    // Clear all tokens
    document.querySelectorAll('.space-tokens').forEach(el => el.innerHTML = '');

    if (!playerStates) return;
    playerStates.forEach((ps, idx) => {
      const tokenContainer = document.getElementById(`tokens-${ps.position}`);
      if (!tokenContainer) return;
      const token = document.createElement('div');
      token.className = 'player-token';
      token.style.background = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      token.title = ps.username;
      tokenContainer.appendChild(token);
    });
  }

  // ── FINANCE CARD ───────────────────────────────────────────────
  updateMyFinances(ps) {
    if (!ps) return;
    const cashflow = ps.passiveIncome - ps.expenses;
    const pct = Math.min(100, ps.expenses > 0 ? Math.round((ps.passiveIncome / ps.expenses) * 100) : 0);

    document.getElementById('my-username-display').textContent = ps.username;
    document.getElementById('my-balance').textContent = this.formatMoney(ps.balance);
    document.getElementById('my-salary').textContent = this.formatMoney(ps.salary);
    document.getElementById('my-passive').textContent = this.formatMoney(ps.passiveIncome);
    document.getElementById('my-expenses').textContent = this.formatMoney(ps.expenses);

    const cfEl = document.getElementById('my-cashflow');
    cfEl.textContent = this.formatMoney(cashflow);
    cfEl.className = `fi-value ${cashflow >= 0 ? 'fi-green' : 'fi-red'}`;

    document.getElementById('freedom-pct').textContent = `${pct}%`;
    document.getElementById('freedom-bar-fill').style.width = `${pct}%`;

    // Assets
    const list = document.getElementById('my-assets-list');
    if (ps.assets && ps.assets.length > 0) {
      list.innerHTML = ps.assets.map(a => `
        <li class="asset-item">
          <span class="asset-name">${a.name}</span>
          <span class="asset-income">+${this.formatMoney(a.passiveIncome)}/mo</span>
        </li>
      `).join('');
    } else {
      list.innerHTML = '<li class="asset-empty">No assets yet</li>';
    }
  }

  updateAllPlayers(playerStates, room) {
    const list = document.getElementById('all-players-list');
    if (!list || !playerStates) return;
    const currentPlayerId = room?.players?.[room?.currentTurn % (room?.players?.length || 1)]?.userId?.toString();

    list.innerHTML = playerStates.map((ps, idx) => {
      const isActive = ps.userId?.toString() === currentPlayerId;
      const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      return `
        <li class="player-list-item ${isActive ? 'active-turn' : ''}">
          <div class="player-avatar" style="background:${color}">${ps.username.charAt(0).toUpperCase()}</div>
          <div class="player-info">
            <div class="player-name">${ps.username}${ps.hasWon ? ' 🏆' : ''}</div>
            <div class="player-balance">${this.formatMoney(ps.balance)} · Space ${ps.position}</div>
          </div>
        </li>
      `;
    }).join('');
  }

  updateWaitingPlayers(players, hostId) {
    const list = document.getElementById('waiting-players-list');
    const badge = document.getElementById('player-count-badge');
    if (!list) return;

    if (badge) badge.textContent = `${players.length}/6`;

    list.innerHTML = players.map(p => {
      const isHost = p.userId?.toString() === hostId?.toString();
      return `
        <li class="waiting-player-item">
          <span class="wp-name">${p.username}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${isHost ? '<span class="wp-host-badge">HOST</span>' : ''}
            <span class="wp-status ${p.isReady ? 'ready' : ''}">${p.isReady ? '✓ Ready' : 'Not ready'}</span>
          </div>
        </li>
      `;
    }).join('');
  }

  updateTurnIndicator(currentPlayer, myUserId) {
    const indicator = document.getElementById('turn-indicator');
    const label = document.getElementById('turn-label');
    const rollBtn = document.getElementById('btn-roll-dice');

    if (!currentPlayer) return;
    const isMyTurn = currentPlayer.userId?.toString() === myUserId?.toString();

    if (indicator) indicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : ''}`;
    if (label) label.textContent = isMyTurn ? 'Your Turn!' : `${currentPlayer.username}'s Turn`;
    if (rollBtn) rollBtn.disabled = !isMyTurn;
  }

  // ── DICE ───────────────────────────────────────────────────────
  animateDice(dice) {
    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');

    die1.className = 'die rolling';
    die2.className = 'die rolling';

    setTimeout(() => {
      die1.textContent = dice[0] || '?';
      die1.className = 'die landed';

      if (dice[1]) {
        die2.classList.remove('hidden');
        die2.textContent = dice[1];
        die2.className = 'die landed';
      } else {
        die2.classList.add('hidden');
      }
    }, 400);
  }

  // ── EVENT NOTIFICATION ─────────────────────────────────────────
  showEvent(event) {
    const notif = document.getElementById('event-notification');
    const icon = document.getElementById('event-icon');
    const title = document.getElementById('event-title');
    const msg = document.getElementById('event-message');
    const amount = document.getElementById('event-amount');

    if (!notif) return;

    const icons = { payday:'💰', deal:'🤝', expense:'💸', market:'📊', charity:'🫶', baby:'👶', none:'📌' };
    icon.textContent = icons[event.type] || '📌';
    title.textContent = event.title || 'Event';
    msg.textContent = event.message || '';

    if (event.amount) {
      const isPositive = event.amount > 0;
      amount.textContent = `${isPositive ? '+' : ''}${this.formatMoney(event.amount)}`;
      amount.className = `event-amount ${isPositive ? 'fi-green' : 'fi-red'}`;
    } else {
      amount.textContent = '';
    }

    notif.classList.remove('hidden');
    clearTimeout(this._eventTimeout);
    this._eventTimeout = setTimeout(() => notif.classList.add('hidden'), 6000);
  }

  // ── DEAL MODAL ─────────────────────────────────────────────────
  showDealModal(deal, canAfford) {
    document.getElementById('deal-title').textContent = deal.title;
    document.getElementById('deal-description').textContent = deal.description;
    document.getElementById('deal-type-tag').textContent = deal.type.replace('_', ' ').toUpperCase();
    document.getElementById('deal-cost').textContent = this.formatMoney(deal.cost);
    document.getElementById('deal-down').textContent = this.formatMoney(deal.downPayment);
    const cf = deal.passiveIncome - deal.monthlyLiability;
    document.getElementById('deal-cashflow').textContent = `${cf >= 0 ? '+' : ''}${this.formatMoney(cf)}`;
    document.getElementById('deal-cashflow').className = `deal-stat-value ${cf >= 0 ? 'fi-green' : 'fi-red'}`;
    document.getElementById('deal-liability').textContent = this.formatMoney(deal.monthlyLiability);

    const warning = document.getElementById('deal-afford-warning');
    const buyBtn = document.getElementById('btn-deal-buy');
    if (!canAfford) {
      warning.classList.remove('hidden');
      buyBtn.disabled = true;
    } else {
      warning.classList.add('hidden');
      buyBtn.disabled = false;
    }

    document.getElementById('modal-deal').classList.remove('hidden');
    this._currentDeal = deal;
  }

  hideDealModal() { document.getElementById('modal-deal').classList.add('hidden'); this._currentDeal = null; }

  // ── LOAN MODAL ─────────────────────────────────────────────────
  showLoanModal() { document.getElementById('modal-loan').classList.remove('hidden'); }
  hideLoanModal() { document.getElementById('modal-loan').classList.add('hidden'); }

  updateLoanPreview(amount) {
    const preview = document.getElementById('loan-preview');
    if (!amount || amount < 1000) { preview.textContent = ''; return; }
    const monthly = Math.ceil(amount * 0.1);
    preview.innerHTML = `Monthly payment: <strong style="color:var(--red)">${this.formatMoney(monthly)}/mo</strong> | New balance: check your finances`;
  }

  // ── WIN MODAL ──────────────────────────────────────────────────
  showWinModal(data, isMe) {
    document.getElementById('win-message').textContent = isMe
      ? `You achieved Financial Freedom! Your passive income of ${this.formatMoney(data.passiveIncome)} now exceeds your expenses.`
      : `${data.username} has achieved Financial Freedom and won the game!`;
    document.getElementById('win-passive').textContent = this.formatMoney(data.passiveIncome);
    document.getElementById('win-expenses').textContent = this.formatMoney(data.expenses);
    document.getElementById('modal-win').classList.remove('hidden');
  }

  // ── ROOMS LIST ─────────────────────────────────────────────────
  renderRooms(rooms) {
    const container = document.getElementById('rooms-list');
    if (!container) return;
    if (!rooms || rooms.length === 0) {
      container.innerHTML = '<div class="empty-state">No open rooms. Create one to get started!</div>';
      return;
    }
    container.innerHTML = rooms.map(r => `
      <div class="room-card" data-room-id="${r.roomId}">
        <div class="room-info">
          <div class="room-host">🎮 ${r.hostUsername}'s Room</div>
          <div class="room-meta">Code: <strong>${r.roomId}</strong></div>
        </div>
        <div class="room-players">${r.players.length}/${r.maxPlayers}</div>
        <button class="btn btn-secondary btn-sm" onclick="window.app.joinRoom('${r.roomId}')">Join</button>
      </div>
    `).join('');
  }

  // ── GAME LOG ───────────────────────────────────────────────────
  addLog(message, type = 'info') {
    const log = document.getElementById('game-log');
    if (!log) return;
    const li = document.createElement('li');
    li.className = 'log-entry';
    li.innerHTML = message;
    log.prepend(li);
    // Keep max 50 entries
    while (log.children.length > 50) log.removeChild(log.lastChild);
  }

  // ── TOAST ──────────────────────────────────────────────────────
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-text">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── HELPERS ────────────────────────────────────────────────────
  formatMoney(n) {
    if (n === undefined || n === null) return '$0';
    const abs = Math.abs(Math.round(n));
    const fmt = '$' + abs.toLocaleString();
    return n < 0 ? `-${fmt}` : fmt;
  }

  setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn._origText = btn._origText || btn.textContent;
    btn.textContent = loading ? '...' : btn._origText;
  }
}

window.ui = new UI();
