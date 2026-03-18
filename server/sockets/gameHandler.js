/**
 * Socket.io Game Handler
 * Manages all real-time multiplayer events: join, leave, dice, turns, deals
 */

const jwt = require('jsonwebtoken');
const GameRoom = require('../models/GameRoom');
const PlayerState = require('../models/PlayerState');
const User = require('../models/User');
const gameService = require('../services/gameService');
const logger = require('../utils/logger');

/**
 * Authenticate socket connection via JWT in handshake
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user || !user.isActive) return next(new Error('User not found'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
};

/**
 * Broadcast full game state to all players in a room
 */
const broadcastGameState = async (io, roomId) => {
  const [room, playerStates] = await Promise.all([
    GameRoom.findOne({ roomId }),
    PlayerState.find({ roomId })
  ]);

  if (!room) return;

  io.to(roomId).emit('game:state_update', {
    room,
    playerStates,
    timestamp: Date.now()
  });
};

/**
 * Register all socket event handlers
 */
const registerGameHandlers = (io, socket) => {
  const userId = socket.user._id.toString();
  const username = socket.user.username;

  // ─── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on('room:join', async ({ roomId }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found.' });
      if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already in progress.' });
      if (room.players.length >= room.maxPlayers) return socket.emit('error', { message: 'Room is full.' });

      // Check if player is already in the room
      const alreadyInRoom = room.players.some(p => p.userId.toString() === userId);

      if (!alreadyInRoom) {
        room.players.push({ userId, username, socketId: socket.id, isReady: false, isConnected: true });
        await room.save();
      } else {
        // Update their socket ID and connected status
        const player = room.players.find(p => p.userId.toString() === userId);
        if (player) {
          player.socketId = socket.id;
          player.isConnected = true;
          await room.save();
        }
      }

      socket.join(roomId);
      socket.currentRoom = roomId;

      // Notify room of new player
      io.to(roomId).emit('room:player_joined', {
        userId,
        username,
        players: room.players
      });

      await gameService.logEvent(roomId, 'player_joined', userId, username);

      // Send current state to the joining player
      await broadcastGameState(io, roomId);

      logger.info('Player joined room', { userId, username, roomId });
    } catch (err) {
      logger.error('room:join error', { error: err.message, userId });
      socket.emit('error', { message: 'Failed to join room.' });
    }
  });

  // ─── LEAVE ROOM ───────────────────────────────────────────────────────────
  socket.on('room:leave', async ({ roomId }) => {
    await handlePlayerLeave(io, socket, roomId);
  });

  // ─── PLAYER READY ─────────────────────────────────────────────────────────
  socket.on('room:ready', async ({ roomId }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found.' });

      const player = room.players.find(p => p.userId.toString() === userId);
      if (player) {
        player.isReady = !player.isReady; // Toggle ready
        await room.save();
      }

      io.to(roomId).emit('room:player_ready', {
        userId,
        username,
        isReady: player?.isReady,
        players: room.players
      });
    } catch (err) {
      logger.error('room:ready error', { error: err.message });
      socket.emit('error', { message: 'Failed to update ready state.' });
    }
  });

  // ─── START GAME ───────────────────────────────────────────────────────────
  socket.on('game:start', async ({ roomId }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found.' });
      if (room.hostId.toString() !== userId) return socket.emit('error', { message: 'Only the host can start the game.' });
      if (room.players.length < 2) return socket.emit('error', { message: 'Need at least 2 players to start.' });
      if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started.' });

      // Initialize player states
      await gameService.initializePlayerStates(room);

      room.status = 'in_progress';
      room.currentTurn = 0;
      room.turnCount = 0;
      await room.save();

      await gameService.logEvent(roomId, 'game_started', userId, username, {
        playerCount: room.players.length
      });

      const playerStates = await PlayerState.find({ roomId });
      const currentPlayer = room.players[0];

      io.to(roomId).emit('game:started', {
        room,
        playerStates,
        currentTurn: {
          userId: currentPlayer.userId,
          username: currentPlayer.username,
          turnIndex: 0
        }
      });

      logger.info('Game started', { roomId, players: room.players.length });
    } catch (err) {
      logger.error('game:start error', { error: err.message, roomId });
      socket.emit('error', { message: 'Failed to start game.' });
    }
  });

  // ─── ROLL DICE ────────────────────────────────────────────────────────────
  socket.on('game:roll_dice', async ({ roomId }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found.' });
      if (room.status !== 'in_progress') return socket.emit('error', { message: 'Game is not active.' });

      const currentPlayer = room.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.userId.toString() !== userId) {
        return socket.emit('error', { message: 'Not your turn.' });
      }

      const playerState = await PlayerState.findOne({ userId, roomId });
      if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

      // Roll dice
      const diceResult = gameService.rollDice();
      const oldPosition = playerState.position;
      const newPosition = (oldPosition + diceResult.total) % 24;

      // Check if passed payday (position wrapped around)
      const passedPayday = newPosition < oldPosition || diceResult.total > (23 - oldPosition);

      playerState.position = newPosition;
      await playerState.save();

      // Broadcast dice roll to all players
      io.to(roomId).emit('game:dice_rolled', {
        userId,
        username,
        dice: diceResult.dice,
        total: diceResult.total,
        oldPosition,
        newPosition,
        passedPayday
      });

      await gameService.logEvent(roomId, 'dice_rolled', userId, username, {
        dice: diceResult.dice,
        total: diceResult.total,
        newPosition
      });

      // Process payday if passed the start
      if (passedPayday && newPosition !== 0) {
        const paydayResult = await gameService.processLanding(
          await PlayerState.findOne({ userId, roomId }),
          0
        );
        io.to(roomId).emit('game:event', { userId, username, event: paydayResult });
      }

      // Process the space they landed on
      const freshState = await PlayerState.findOne({ userId, roomId });
      const landingResult = await gameService.processLanding(freshState, newPosition);

      // Emit the landing event
      io.to(roomId).emit('game:event', {
        userId,
        username,
        event: landingResult,
        position: newPosition
      });

      // Log the move
      await gameService.logEvent(roomId, 'player_moved', userId, username, {
        from: oldPosition,
        to: newPosition,
        event: landingResult.type
      });

      // Check win condition
      const updatedState = await PlayerState.findOne({ userId, roomId });
      if (gameService.checkWinCondition(updatedState)) {
        await handlePlayerWin(io, socket, room, updatedState);
        return;
      }

      // If the event is a deal, wait for player response before advancing turn
      // For all other events, auto-advance turn after a short delay
      if (landingResult.type !== 'deal') {
        await advanceTurn(io, room);
      } else {
        // Emit deal to the specific player only (they decide to buy or pass)
        socket.emit('game:deal_decision', {
          deal: landingResult.deal,
          canAfford: updatedState.balance >= landingResult.deal?.downPayment
        });
      }

      // Update all clients with new state
      await broadcastGameState(io, roomId);
    } catch (err) {
      logger.error('game:roll_dice error', { error: err.message, userId, roomId });
      socket.emit('error', { message: 'Failed to roll dice.' });
    }
  });

  // ─── PURCHASE DEAL ────────────────────────────────────────────────────────
  socket.on('game:buy_deal', async ({ roomId, dealId, dealType }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room || room.status !== 'in_progress') return socket.emit('error', { message: 'Game not active.' });

      const currentPlayer = room.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.userId.toString() !== userId) {
        return socket.emit('error', { message: 'Not your turn.' });
      }

      const playerState = await PlayerState.findOne({ userId, roomId });
      if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

      // Find the deal from our data
      const allDeals = require('../config/gameData');
      const deal = [...allDeals.SMALL_DEALS, ...allDeals.BIG_DEALS].find(d => d.id === dealId);
      if (!deal) return socket.emit('error', { message: 'Deal not found.' });

      const result = await gameService.purchaseAsset(playerState, deal);

      if (!result.success) {
        return socket.emit('error', { message: result.message });
      }

      io.to(roomId).emit('game:deal_purchased', {
        userId,
        username,
        deal,
        passiveIncomeGained: result.passiveIncomeGained,
        newPassiveIncome: result.newPassiveIncome
      });

      await gameService.logEvent(roomId, 'asset_purchased', userId, username, {
        deal: deal.title,
        cost: deal.downPayment,
        passiveIncome: deal.passiveIncome
      });

      if (result.hasWon) {
        await handlePlayerWin(io, socket, room, result.playerState);
        return;
      }

      await advanceTurn(io, room);
      await broadcastGameState(io, roomId);
    } catch (err) {
      logger.error('game:buy_deal error', { error: err.message });
      socket.emit('error', { message: 'Failed to purchase deal.' });
    }
  });

  // ─── PASS DEAL ────────────────────────────────────────────────────────────
  socket.on('game:pass_deal', async ({ roomId }) => {
    try {
      const room = await GameRoom.findOne({ roomId });
      if (!room || room.status !== 'in_progress') return;

      const currentPlayer = room.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.userId.toString() !== userId) return;

      io.to(roomId).emit('game:deal_passed', { userId, username });

      await gameService.logEvent(roomId, 'deal_declined', userId, username);
      await advanceTurn(io, room);
      await broadcastGameState(io, roomId);
    } catch (err) {
      logger.error('game:pass_deal error', { error: err.message });
    }
  });

  // ─── TAKE LOAN ────────────────────────────────────────────────────────────
  socket.on('game:take_loan', async ({ roomId, amount }) => {
    try {
      if (!amount || amount < 1000 || amount > 100000) {
        return socket.emit('error', { message: 'Loan amount must be between $1,000 and $100,000.' });
      }

      const room = await GameRoom.findOne({ roomId });
      if (!room || room.status !== 'in_progress') return socket.emit('error', { message: 'Game not active.' });

      const playerState = await PlayerState.findOne({ userId, roomId });
      if (!playerState) return socket.emit('error', { message: 'Player state not found.' });

      const result = await gameService.takeLoan(playerState, amount);

      socket.emit('game:loan_taken', result);
      await gameService.logEvent(roomId, 'loan_taken', userId, username, { amount });
      await broadcastGameState(io, roomId);
    } catch (err) {
      logger.error('game:take_loan error', { error: err.message });
      socket.emit('error', { message: 'Failed to take loan.' });
    }
  });

  // ─── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      if (socket.currentRoom) {
        await handlePlayerLeave(io, socket, socket.currentRoom);
      }
      logger.info('Socket disconnected', { userId, username });
    } catch (err) {
      logger.error('disconnect error', { error: err.message });
    }
  });
};

/**
 * Advance the turn to the next player
 */
const advanceTurn = async (io, room) => {
  room.advanceTurn();
  await room.save();

  const nextPlayer = room.getCurrentPlayer();

  io.to(room.roomId).emit('game:turn_changed', {
    turnIndex: room.currentTurn,
    turnCount: room.turnCount,
    currentPlayer: {
      userId: nextPlayer?.userId,
      username: nextPlayer?.username
    }
  });

  await gameService.logEvent(room.roomId, 'turn_changed', nextPlayer?.userId, nextPlayer?.username, {
    turnCount: room.turnCount
  });
};

/**
 * Handle a player winning the game
 */
const handlePlayerWin = async (io, socket, room, playerState) => {
  room.status = 'finished';
  room.winnerId = playerState.userId;
  room.winnerUsername = playerState.username;
  await room.save();

  // Update user stats
  await User.findByIdAndUpdate(playerState.userId, {
    $inc: { 'stats.gamesWon': 1 }
  });

  // Update all players' gamesPlayed
  for (const p of room.players) {
    await User.findByIdAndUpdate(p.userId, {
      $inc: { 'stats.gamesPlayed': 1 }
    });
  }

  await gameService.logEvent(room.roomId, 'player_won', playerState.userId, playerState.username, {
    passiveIncome: playerState.passiveIncome,
    expenses: playerState.expenses
  });

  io.to(room.roomId).emit('game:player_won', {
    userId: playerState.userId.toString(),
    username: playerState.username,
    passiveIncome: playerState.passiveIncome,
    expenses: playerState.expenses
  });

  logger.info('Player won game', {
    roomId: room.roomId,
    winnerId: playerState.userId,
    winner: playerState.username
  });
};

/**
 * Handle a player leaving or disconnecting
 */
const handlePlayerLeave = async (io, socket, roomId) => {
  try {
    const userId = socket.user._id.toString();
    const username = socket.user.username;

    const room = await GameRoom.findOne({ roomId });
    if (!room) return;

    const player = room.players.find(p => p.userId.toString() === userId);
    if (player) {
      player.isConnected = false;
      await room.save();
    }

    socket.leave(roomId);

    io.to(roomId).emit('room:player_left', { userId, username, players: room.players });
    await gameService.logEvent(roomId, 'player_left', userId, username);

    logger.info('Player left room', { userId, username, roomId });
  } catch (err) {
    logger.error('handlePlayerLeave error', { error: err.message });
  }
};

module.exports = { authenticateSocket, registerGameHandlers };
