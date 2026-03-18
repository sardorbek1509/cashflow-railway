/**
 * Socket Module - Socket.io client wrapper
 */
const SocketManager = (() => {
  let socket = null;
  const listeners = {};

  function connect() {
    const token = CF_API.getToken();
    if (!token) throw new Error('Token topilmadi');

    socket = io({ auth: { token }, reconnectionAttempts: 5, reconnectionDelay: 1500 });

    socket.on('connect', () => { console.log('[Socket] Ulandi:', socket.id); emit('socket_connected'); });
    socket.on('disconnect', (reason) => { console.warn('[Socket] Uzildi:', reason); emit('socket_disconnected', { reason }); });
    socket.on('connect_error', (err) => { console.error('[Socket] Xato:', err.message); emit('socket_error', { message: err.message }); });
    socket.on('error', (data) => { emit('game_error', data); });

    // All game events to forward
    const events = [
      'game:state_update', 'game:started', 'game:dice_rolled',
      'game:event', 'game:deal_decision', 'game:deal_purchased',
      'game:deal_passed', 'game:turn_changed', 'game:loan_taken',
      'game:player_won', 'room:player_joined', 'room:player_left',
      'room:player_ready', 'chat_message'
    ];

    events.forEach(ev => socket.on(ev, (data) => emit(ev, data)));
    return socket;
  }

  function disconnect() { if (socket) { socket.disconnect(); socket = null; } }

  function send(event, data = {}) {
    if (!socket?.connected) { console.warn('[Socket] Ulanmagan:', event); return; }
    socket.emit(event, data);
  }

  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(h => h !== handler);
  }

  function emit(event, data) { (listeners[event] || []).forEach(fn => fn(data)); }
  function isConnected() { return socket?.connected || false; }

  return { connect, disconnect, send, on, off, isConnected };
})();
window.SocketManager = SocketManager;
