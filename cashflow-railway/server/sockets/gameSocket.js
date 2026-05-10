/**
 * Socket.io Game Handler
 * Manages all real-time game events: joining, turns, dice rolls, purchases, wins
 */

const GameRoom = require('../models/GameRoom');
const PlayerState = require('../models/PlayerState');
const logger = require('../utils/logger');
const {
  rollDice,
  logEvent,
  initializePlayerStates,
  processLanding,
  purchaseAsset,
  checkWinCondition,
  takeLoan
} = require('../services/gameService');
const { BOARD_SIZE } = require('../config/gameData');

// Track active socket connections per room for fast lookups
const roomSockets = new Map(); // roomId -> Set<socketId>

const initGameSockets = (io) => {

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info('Socket connected', { socketId: socket.id, userId: user._id, username: user.username });

    // ─── JOIN ROOM ───────────────────────────────────────────────
    socket.on('join_room', async ({ roomId }) => {
      try {
        const room = await GameRoom.findOne({ roomId });

        if (!room) {
          return socket.emit('error', { message: 'Room not found.' });
        }

        if (room.status === 'finished') {
          return socket.emit('error', { message: 'This game has already ended.' });
        }

        if (room.status === 'in_progress') {
          // Allow reconnecting players to rejoin
          const existingPlayer = room.players.find(p => p.userId.toString() === user._id.toString());
          if (!existingPlayer) {
            return socket.emit('error', { message: 'Game is already in progress.' });
          }
          existingPlayer.socketId = socket.id;
          existingPlayer.isConnected = true;
          await room.save();

          socket.join(roomId);
          trackSocket(roomId, socket.id);

          // Send current game state to reconnecting player
          const playerStates = await PlayerState.find({ roomId });
          socket.emit('game_rejoined', { room, playerStates });
          io.to(roomId).emit('player_reconnected', { username: user.username });
          return;
        }

        // Add player to room if not already in it
        const alreadyIn = room.players.find(p => p.userId.toString() === user._id.toString());
        if (!alreadyIn) {
          if (room.players.length >= room.maxPlayers) {
            return socket.emit('error', { message: 'Room is full.' });
          }
          room.players.push({
            userId: user._id,
            username: user.username,
            socketId: socket.id,
            isReady: false,
            isConnected: true
          });
        } else {
          alreadyIn.socketId = socket.id;
          alreadyIn.isConnected = true;
        }

        await room.save();
        socket.join(roomId);
        trackSocket(roomId, socket.id);

        await logEvent(roomId, 'player_joined', user._id, user.username, { username: user.username });

        // Notify room
        io.to(roomId).emit('player_joined', {
          room,
          username: user.username,
          playerCount: room.players.length
        });

        logger.info('Player joined room', { username: user.username, roomId });
      } catch (err) {
        logger.error('join_room error', { error: err.message });
        socket.emit('error', { message: 'Failed to join room.' });
      }
    });

    // ─── PLAYER READY ────────────────────────────────────────────
    socket.on('player_ready', async ({ roomId }) => {
      try {
        const room = await GameRoom.findOne({ roomId });
        if (!room || room.status !== 'waiting') return;

        const player = room.players.find(p => p.userId.toString() === user._id.toString());
        if (player) {
          player.isReady = !player.isReady; // Toggle
          await room.save();
          io.to(roomId).emit('player_ready_update', { room });
        }
      } catch (err) {
        logger.error('player_ready error', { error: err.message });
      }
    });

    // ─── START GAME ──────────────────────────────────────────────
    socket.on('start_game', async ({ roomId }) => {
      try {
        const room = await GameRoom.findOne({ roomId });

        if (!room) return socket.emit('error', { message: 'Room not found.' });
        if (room.hostId.toString() !== user._id.toString()) {
          return socket.emit('error', { message: 'Only the host can start the game.' });
        }
        if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started.' });
        if (room.players.length < 2) {
          return socket.emit('error', { message: 'Need at least 2 players to start.' });
        }

        room.status = 'in_progress';
        room.currentTurn = 0;
        room.turnCount = 0;
        await room.save();

        // Initialize all player states
        const playerStates = await initializePlayerStates(room);

        await logEvent(roomId, 'game_started', user._id, user.username, {
          playerCount: room.players.length,
          players: room.players.map(p => p.username)
        });

        io.to(roomId).emit('game_started', {
          room,
          playerStates,
          currentPlayer: room.players[0]
        });

        logger.info('Game started', { roomId, playerCount: room.players.length });
      } catch (err) {
        logger.error('start_game error', { error: err.message });
        socket.emit('error', { message: 'Failed to start game.' });
      }
    });

    // ─── ROLL DICE ───────────────────────────────────────────────
    socket.on('roll_dice', async ({ roomId, useDoubleDice = false }) => {
      try {
        const room = await GameRoom.findOne({ roomId });
        if (!room || room.status !== 'in_progress') return;

        // Validate it's this player's turn
        const currentPlayer = room.players[room.currentTurn % room.players.length];
        if (currentPlayer.userId.toString() !== user._id.toString()) {
          return socket.emit('error', { message: "It's not your turn." });
        }

        const playerState = await PlayerState.findOne({ userId: user._id, roomId });
        if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

        // Roll dice
        const rollResult = rollDice(useDoubleDice);
        const newPosition = (playerState.position + rollResult.total) % BOARD_SIZE;

        // Did player pass or land on Payday (pos 0)?
        const passedPayday = newPosition < playerState.position || newPosition === 0;

        playerState.position = newPosition;
        await playerState.save();

        await logEvent(roomId, 'dice_rolled', user._id, user.username, {
          dice: rollResult.dice,
          total: rollResult.total,
          newPosition
        });

        // Broadcast dice result to all players
        io.to(roomId).emit('dice_rolled', {
          playerId: user._id.toString(),
          username: user.username,
          dice: rollResult.dice,
          total: rollResult.total,
          newPosition,
          passedPayday
        });

        // Process landing event
        const landingEvent = await processLanding(playerState, newPosition);

        await logEvent(roomId, 'player_moved', user._id, user.username, {
          position: newPosition,
          event: landingEvent
        });

        // Send landing event to all players
        io.to(roomId).emit('landing_event', {
          playerId: user._id.toString(),
          username: user.username,
          position: newPosition,
          event: landingEvent,
          playerState
        });

        // If it's a deal, also send it to the player specifically for the decision UI
        if (landingEvent.type === 'deal') {
          socket.emit('deal_offered', {
            deal: landingEvent.deal,
            canAfford: landingEvent.canAfford
          });
        }

        // Check win condition after processing
        const refreshedState = await PlayerState.findOne({ userId: user._id, roomId });
        if (checkWinCondition(refreshedState)) {
          await handlePlayerWin(io, room, refreshedState);
          return;
        }

        logger.info('Dice rolled', { username: user.username, total: rollResult.total, position: newPosition });
      } catch (err) {
        logger.error('roll_dice error', { error: err.message });
        socket.emit('error', { message: 'Failed to process dice roll.' });
      }
    });

    // ─── END TURN ────────────────────────────────────────────────
    socket.on('end_turn', async ({ roomId }) => {
      try {
        const room = await GameRoom.findOne({ roomId });
        if (!room || room.status !== 'in_progress') return;

        const currentPlayer = room.players[room.currentTurn % room.players.length];
        if (currentPlayer.userId.toString() !== user._id.toString()) {
          return socket.emit('error', { message: "It's not your turn." });
        }

        room.advanceTurn();
        await room.save();

        const nextPlayer = room.players[room.currentTurn % room.players.length];

        await logEvent(roomId, 'turn_changed', user._id, user.username, {
          nextPlayer: nextPlayer.username
        });

        io.to(roomId).emit('turn_changed', {
          previousPlayer: user.username,
          currentPlayer: nextPlayer,
          turnCount: room.turnCount
        });

        logger.info('Turn ended', { from: user.username, to: nextPlayer.username, roomId });
      } catch (err) {
        logger.error('end_turn error', { error: err.message });
        socket.emit('error', { message: 'Failed to end turn.' });
      }
    });

    // ─── ACCEPT DEAL ─────────────────────────────────────────────
    socket.on('accept_deal', async ({ roomId, deal }) => {
      try {
        const playerState = await PlayerState.findOne({ userId: user._id, roomId });
        if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

        const result = await purchaseAsset(playerState, deal);

        if (!result.success) {
          return socket.emit('deal_result', { success: false, message: result.message });
        }

        await logEvent(roomId, 'asset_purchased', user._id, user.username, {
          assetName: deal.title,
          cost: deal.downPayment,
          passiveIncome: deal.passiveIncome
        });

        socket.emit('deal_result', {
          success: true,
          message: result.message,
          passiveIncomeGained: result.passiveIncomeGained,
          playerState: result.playerState
        });

        // Broadcast updated player state to all
        io.to(roomId).emit('player_state_updated', {
          playerId: user._id.toString(),
          username: user.username,
          playerState: result.playerState
        });

        if (result.hasWon) {
          const room = await GameRoom.findOne({ roomId });
          await handlePlayerWin(io, room, result.playerState);
        }
      } catch (err) {
        logger.error('accept_deal error', { error: err.message });
        socket.emit('error', { message: 'Failed to process deal.' });
      }
    });

    // ─── DECLINE DEAL ────────────────────────────────────────────
    socket.on('decline_deal', async ({ roomId }) => {
      await logEvent(roomId, 'deal_declined', user._id, user.username, {});
      socket.emit('deal_result', { success: false, message: 'Deal declined.' });
    });

    // ─── TAKE LOAN ───────────────────────────────────────────────
    socket.on('take_loan', async ({ roomId, amount }) => {
      try {
        if (!amount || amount <= 0 || amount > 100000) {
          return socket.emit('error', { message: 'Invalid loan amount.' });
        }

        const playerState = await PlayerState.findOne({ userId: user._id, roomId });
        if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

        const result = await takeLoan(playerState, amount);

        await logEvent(roomId, 'loan_taken', user._id, user.username, { amount });

        socket.emit('loan_result', result);

        io.to(roomId).emit('player_state_updated', {
          playerId: user._id.toString(),
          username: user.username,
          playerState: result.playerState || playerState
        });
      } catch (err) {
        logger.error('take_loan error', { error: err.message });
        socket.emit('error', { message: 'Failed to process loan.' });
      }
    });

    // ─── CHAT MESSAGE ─────────────────────────────────────────────
    socket.on('chat_message', ({ roomId, message }) => {
      if (!message || message.trim().length === 0) return;
      const sanitized = message.trim().substring(0, 200);
      io.to(roomId).emit('chat_message', {
        username: user.username,
        message: sanitized,
        timestamp: new Date()
      });
    });

    // ─── DISCONNECT ──────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info('Socket disconnected', { socketId: socket.id, username: user.username });

      // Find rooms this socket was in and update player connection status
      for (const [roomId, sockets] of roomSockets) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);

          try {
            const room = await GameRoom.findOne({ roomId });
            if (room) {
              const player = room.players.find(p => p.socketId === socket.id);
              if (player) {
                player.isConnected = false;
                await room.save();

                io.to(roomId).emit('player_disconnected', {
                  username: user.username,
                  message: `${user.username} disconnected.`
                });
              }
            }
          } catch (err) {
            logger.error('Disconnect cleanup error', { error: err.message });
          }
        }
      }
    });
  });
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const trackSocket = (roomId, socketId) => {
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(socketId);
};

const handlePlayerWin = async (io, room, playerState) => {
  room.status = 'finished';
  room.winnerId = playerState.userId;
  room.winnerUsername = playerState.username;
  await room.save();

  await logEvent(room.roomId, 'player_won', playerState.userId, playerState.username, {
    passiveIncome: playerState.passiveIncome,
    expenses: playerState.expenses
  });

  io.to(room.roomId).emit('game_over', {
    winner: {
      userId: playerState.userId,
      username: playerState.username,
      passiveIncome: playerState.passiveIncome,
      expenses: playerState.expenses,
      balance: playerState.balance
    },
    message: `🏆 ${playerState.username} achieved Financial Freedom! Passive income ($${playerState.passiveIncome}/mo) now exceeds expenses ($${playerState.expenses}/mo)!`
  });

  logger.info('Game over - player won', {
    roomId: room.roomId,
    winner: playerState.username,
    passiveIncome: playerState.passiveIncome,
    expenses: playerState.expenses
  });
};

module.exports = { initGameSockets };
