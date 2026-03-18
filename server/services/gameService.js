/**
 * Game Service
 * Core game logic: dice, movement, events, transactions, win detection
 */

const GameRoom = require('../models/GameRoom');
const PlayerState = require('../models/PlayerState');
const Transaction = require('../models/Transaction');
const GameEvent = require('../models/GameEvent');
const logger = require('../utils/logger');
const {
  BOARD_SPACES,
  SMALL_DEALS,
  BIG_DEALS,
  EXPENSE_EVENTS,
  MARKET_EVENTS,
  BOARD_SIZE,
  CHARITY_PERCENT,
  CHARITY_BONUS_TURNS,
  BABY_EXPENSE
} = require('../config/gameData');

/**
 * Roll one or two dice and return result
 */
const rollDice = (doubleDice = false) => {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  if (doubleDice) {
    return { dice: [d1, d2], total: d1 + d2, isDouble: d1 === d2 };
  }
  return { dice: [d1], total: d1, isDouble: false };
};

/**
 * Select a random card from a deck
 */
const drawCard = (deck) => {
  return deck[Math.floor(Math.random() * deck.length)];
};

/**
 * Log a game event to the database
 */
const logEvent = async (roomId, eventType, actorId, actorUsername, payload = {}) => {
  try {
    await GameEvent.create({
      roomId,
      eventType,
      actorId,
      actorUsername,
      payload
    });
  } catch (err) {
    logger.error('Failed to log game event', { error: err.message, roomId, eventType });
  }
};

/**
 * Record a financial transaction
 */
const recordTransaction = async (playerId, roomId, type, amount, description, balanceBefore, balanceAfter) => {
  try {
    await Transaction.create({
      playerId,
      roomId,
      type,
      amount,
      description,
      balanceBefore,
      balanceAfter
    });
  } catch (err) {
    logger.error('Failed to record transaction', { error: err.message });
  }
};

/**
 * Initialize player states when a game starts
 */
const initializePlayerStates = async (room) => {
  const playerStatePromises = room.players.map(async (player) => {
    // Check if state already exists
    const existing = await PlayerState.findOne({ userId: player.userId, roomId: room.roomId });
    if (existing) return existing;

    const salary = 3000 + Math.floor(Math.random() * 3000); // 3k-6k starting salary
    const baseExpenses = Math.floor(salary * 0.5); // 50% of salary goes to base expenses

    const state = new PlayerState({
      userId: player.userId,
      roomId: room.roomId,
      username: player.username,
      position: 0,
      balance: parseInt(process.env.STARTING_BALANCE) || 3000,
      salary,
      expenses: baseExpenses,
      passiveIncome: 0,
      assets: [],
      liabilities: []
    });

    return state.save();
  });

  return Promise.all(playerStatePromises);
};

/**
 * Process landing on a board space
 * Returns an event object describing what happened
 */
const processLanding = async (playerState, spaceId) => {
  const space = BOARD_SPACES[spaceId];
  if (!space) return { type: 'none', message: 'Nothing happened.' };

  switch (space.type) {
    case 'payday':
      return processPayday(playerState);

    case 'deal':
      return processDeal(playerState, spaceId);

    case 'expense':
      return processExpenseEvent(playerState);

    case 'market':
      return processMarketEvent(playerState);

    case 'charity':
      return processCharity(playerState);

    case 'baby':
      return processBaby(playerState);

    default:
      return { type: 'none', message: 'Nothing happened.' };
  }
};

/**
 * Process a payday landing
 */
const processPayday = async (playerState) => {
  const cashflow = playerState.salary + playerState.passiveIncome - playerState.expenses;
  const balanceBefore = playerState.balance;

  playerState.balance += cashflow;
  playerState.lapsCompleted += 1;

  if (playerState.balance < 0) playerState.balance = 0;

  await playerState.save();
  await recordTransaction(
    playerState.userId, playerState.roomId, 'salary', cashflow,
    `Payday! Salary: $${playerState.salary}, Passive: $${playerState.passiveIncome}, Expenses: -$${playerState.expenses}`,
    balanceBefore, playerState.balance
  );

  return {
    type: 'payday',
    title: '💰 Payday!',
    message: `You received your monthly cashflow of $${cashflow.toLocaleString()}.`,
    amount: cashflow,
    breakdown: {
      salary: playerState.salary,
      passiveIncome: playerState.passiveIncome,
      expenses: playerState.expenses
    }
  };
};

/**
 * Process a deal space landing
 */
const processDeal = (playerState, spaceId) => {
  // Alternate between small and big deals based on position
  const isSmall = spaceId % 4 !== 0;
  const deals = isSmall ? SMALL_DEALS : BIG_DEALS;
  const deal = drawCard(deals);

  return {
    type: 'deal',
    title: '🤝 Deal Available!',
    message: `A ${isSmall ? 'small' : 'big'} deal has appeared: ${deal.title}`,
    deal,
    canAfford: playerState.balance >= deal.downPayment
  };
};

/**
 * Process an expense (doodad) space
 */
const processExpenseEvent = async (playerState) => {
  const event = drawCard(EXPENSE_EVENTS);
  const balanceBefore = playerState.balance;

  // Can't go below 0 (player would need a loan in a full implementation)
  const actualAmount = Math.min(event.amount, playerState.balance);
  playerState.balance -= actualAmount;

  await playerState.save();
  await recordTransaction(
    playerState.userId, playerState.roomId, 'expense', -actualAmount,
    event.title, balanceBefore, playerState.balance
  );

  return {
    type: 'expense',
    title: `💸 ${event.title}`,
    message: event.description,
    amount: actualAmount
  };
};

/**
 * Process a market event
 */
const processMarketEvent = async (playerState) => {
  const event = drawCard(MARKET_EVENTS);
  let message = event.description;
  let impact = 0;

  if (event.effect === 'real_estate_boom') {
    // Increase passive income from real estate assets
    playerState.assets.forEach(asset => {
      if (asset.type === 'real_estate') {
        const bonus = Math.floor(asset.passiveIncome * (event.modifier - 1));
        asset.passiveIncome += bonus;
        impact += bonus;
      }
    });
    message += ` +$${impact}/month passive income added.`;
  } else if (event.effect === 'expense_increase') {
    const increase = Math.floor(playerState.expenses * (event.modifier - 1));
    playerState.expenses += increase;
    impact = -increase;
    message += ` Expenses up by $${increase}/month.`;
  } else if (event.effect === 'expense_decrease') {
    const decrease = Math.floor(playerState.expenses * (1 - event.modifier));
    playerState.expenses = Math.max(0, playerState.expenses - decrease);
    impact = decrease;
    message += ` Expenses down by $${decrease}/month.`;
  }

  playerState.recalculate();
  await playerState.save();

  return {
    type: 'market',
    title: `📈 ${event.title}`,
    message,
    impact
  };
};

/**
 * Process charity space - donate 10% of salary
 */
const processCharity = async (playerState) => {
  const donation = Math.floor(playerState.salary * CHARITY_PERCENT);
  const balanceBefore = playerState.balance;

  playerState.balance = Math.max(0, playerState.balance - donation);

  await playerState.save();
  await recordTransaction(
    playerState.userId, playerState.roomId, 'expense', -donation,
    'Charity donation (10% of salary)', balanceBefore, playerState.balance
  );

  return {
    type: 'charity',
    title: '🫶 Charity',
    message: `You donated $${donation} (10% of salary) to charity. You can now roll 2 dice for ${CHARITY_BONUS_TURNS} turns.`,
    amount: donation,
    bonusTurns: CHARITY_BONUS_TURNS
  };
};

/**
 * Process baby space - permanent expense increase
 */
const processBaby = async (playerState) => {
  playerState.expenses += BABY_EXPENSE;

  // Add as a liability for tracking
  playerState.liabilities.push({
    name: 'Child Expenses',
    amount: 0,
    monthlyPayment: BABY_EXPENSE
  });

  await playerState.save();

  return {
    type: 'baby',
    title: '👶 Baby!',
    message: `Congratulations! A new baby adds $${BABY_EXPENSE}/month to your expenses.`,
    amount: BABY_EXPENSE
  };
};

/**
 * Purchase an asset for a player
 */
const purchaseAsset = async (playerState, deal) => {
  if (playerState.balance < deal.downPayment) {
    return { success: false, message: 'Insufficient funds for down payment.' };
  }

  const balanceBefore = playerState.balance;
  playerState.balance -= deal.downPayment;

  // Add the asset
  playerState.assets.push({
    name: deal.title,
    cost: deal.cost,
    passiveIncome: deal.passiveIncome,
    type: deal.type
  });

  // Add liability if there's a monthly payment
  if (deal.monthlyLiability > 0) {
    playerState.liabilities.push({
      name: `${deal.title} Loan`,
      amount: deal.cost - deal.downPayment,
      monthlyPayment: deal.monthlyLiability
    });
  }

  playerState.recalculate();

  // Check win condition
  const hasWon = playerState.passiveIncome >= playerState.expenses;
  if (hasWon) {
    playerState.hasWon = true;
  }

  await playerState.save();

  await recordTransaction(
    playerState.userId, playerState.roomId, 'asset_purchase', -deal.downPayment,
    `Purchased: ${deal.title}`, balanceBefore, playerState.balance
  );

  return {
    success: true,
    message: `Successfully purchased ${deal.title}!`,
    passiveIncomeGained: deal.passiveIncome,
    newPassiveIncome: playerState.passiveIncome,
    newExpenses: playerState.expenses,
    hasWon,
    playerState
  };
};

/**
 * Check if a player has won (financial freedom)
 */
const checkWinCondition = (playerState) => {
  return playerState.passiveIncome >= playerState.expenses;
};

/**
 * Take a bank loan (emergency funds)
 */
const takeLoan = async (playerState, amount) => {
  const loanPayment = Math.ceil(amount * 0.1); // 10% monthly payment

  playerState.balance += amount;
  playerState.liabilities.push({
    name: 'Bank Loan',
    amount,
    monthlyPayment: loanPayment
  });

  playerState.recalculate();
  await playerState.save();

  await recordTransaction(
    playerState.userId, playerState.roomId, 'loan', amount,
    `Bank loan of $${amount}`, playerState.balance - amount, playerState.balance
  );

  return {
    success: true,
    loanAmount: amount,
    monthlyPayment: loanPayment,
    newBalance: playerState.balance,
    newExpenses: playerState.expenses
  };
};

module.exports = {
  rollDice,
  drawCard,
  logEvent,
  recordTransaction,
  initializePlayerStates,
  processLanding,
  purchaseAsset,
  checkWinCondition,
  takeLoan
};
