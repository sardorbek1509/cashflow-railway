/**
 * Game Board Configuration
 * Defines the 24-space board layout and event card decks
 */

// Board space types
const BOARD_SPACES = [
  { id: 0, type: 'payday', label: 'PAYDAY' },
  { id: 1, type: 'deal', label: 'DEAL' },
  { id: 2, type: 'expense', label: 'DOODAD' },
  { id: 3, type: 'deal', label: 'DEAL' },
  { id: 4, type: 'market', label: 'MARKET' },
  { id: 5, type: 'charity', label: 'CHARITY' },
  { id: 6, type: 'deal', label: 'DEAL' },
  { id: 7, type: 'expense', label: 'DOODAD' },
  { id: 8, type: 'deal', label: 'DEAL' },
  { id: 9, type: 'market', label: 'MARKET' },
  { id: 10, type: 'payday', label: 'PAYDAY' },
  { id: 11, type: 'deal', label: 'DEAL' },
  { id: 12, type: 'baby', label: 'BABY' },
  { id: 13, type: 'deal', label: 'DEAL' },
  { id: 14, type: 'market', label: 'MARKET' },
  { id: 15, type: 'expense', label: 'DOODAD' },
  { id: 16, type: 'deal', label: 'DEAL' },
  { id: 17, type: 'charity', label: 'CHARITY' },
  { id: 18, type: 'deal', label: 'DEAL' },
  { id: 19, type: 'market', label: 'MARKET' },
  { id: 20, type: 'payday', label: 'PAYDAY' },
  { id: 21, type: 'deal', label: 'DEAL' },
  { id: 22, type: 'expense', label: 'DOODAD' },
  { id: 23, type: 'deal', label: 'DEAL' }
];

// Small deal cards (affordable assets)
const SMALL_DEALS = [
  {
    id: 'sd_1',
    title: 'Rental House - 3BR/2BA',
    type: 'real_estate',
    cost: 45000,
    downPayment: 5000,
    passiveIncome: 500,
    monthlyLiability: 380,
    description: 'Purchase a 3-bed rental house. Tenant pays $880/mo, mortgage is $380/mo.'
  },
  {
    id: 'sd_2',
    title: '2-Bedroom Condo',
    type: 'real_estate',
    cost: 60000,
    downPayment: 6000,
    passiveIncome: 400,
    monthlyLiability: 450,
    description: 'Condo in growing neighborhood. Rent covers most of the mortgage.'
  },
  {
    id: 'sd_3',
    title: 'CD Investment',
    type: 'stock',
    cost: 10000,
    downPayment: 10000,
    passiveIncome: 200,
    monthlyLiability: 0,
    description: 'Certificate of Deposit paying 2.4% annually.'
  },
  {
    id: 'sd_4',
    title: 'Laundromat Business',
    type: 'business',
    cost: 25000,
    downPayment: 5000,
    passiveIncome: 800,
    monthlyLiability: 300,
    description: 'Automated laundromat. Minimal time needed. High cash flow.'
  },
  {
    id: 'sd_5',
    title: 'Gold Coins (50 oz)',
    type: 'commodity',
    cost: 9000,
    downPayment: 9000,
    passiveIncome: 0,
    monthlyLiability: 0,
    description: 'Buy 50 oz of gold at $180/oz. Value may increase.'
  },
  {
    id: 'sd_6',
    title: 'Apartment Complex (8 units)',
    type: 'real_estate',
    cost: 200000,
    downPayment: 20000,
    passiveIncome: 1600,
    monthlyLiability: 1400,
    description: '8-unit apartment complex. Strong passive income potential.'
  },
  {
    id: 'sd_7',
    title: 'Dividend Stock Portfolio',
    type: 'stock',
    cost: 15000,
    downPayment: 15000,
    passiveIncome: 300,
    monthlyLiability: 0,
    description: 'Diversified dividend stock portfolio paying 2.4% monthly.'
  },
  {
    id: 'sd_8',
    title: 'Vending Machine Route',
    type: 'business',
    cost: 12000,
    downPayment: 3000,
    passiveIncome: 600,
    monthlyLiability: 200,
    description: '10 vending machines in offices. Restocking takes 2 hours/month.'
  }
];

// Big deal cards (large investments)
const BIG_DEALS = [
  {
    id: 'bd_1',
    title: '20-Unit Apartment Building',
    type: 'real_estate',
    cost: 500000,
    downPayment: 50000,
    passiveIncome: 4000,
    monthlyLiability: 3200,
    description: 'Large apartment complex in prime location.'
  },
  {
    id: 'bd_2',
    title: 'Strip Mall',
    type: 'real_estate',
    cost: 1000000,
    downPayment: 100000,
    passiveIncome: 8000,
    monthlyLiability: 6000,
    description: 'Commercial strip mall with anchor tenant.'
  },
  {
    id: 'bd_3',
    title: 'Franchise Restaurant',
    type: 'business',
    cost: 250000,
    downPayment: 50000,
    passiveIncome: 3500,
    monthlyLiability: 2500,
    description: 'Profitable fast food franchise location.'
  },
  {
    id: 'bd_4',
    title: 'Tech Startup Investment',
    type: 'stock',
    cost: 100000,
    downPayment: 100000,
    passiveIncome: 2000,
    monthlyLiability: 0,
    description: 'Series A investment in promising tech company.'
  }
];

// Expense events (Doodads)
const EXPENSE_EVENTS = [
  { id: 'ex_1', title: 'New TV', amount: 2000, description: 'You bought a new 85-inch TV. Entertainment upgrade!' },
  { id: 'ex_2', title: 'Vacation', amount: 3000, description: 'You took a spontaneous vacation to the Caribbean.' },
  { id: 'ex_3', title: 'Car Repair', amount: 1500, description: 'Your car needed major repairs.' },
  { id: 'ex_4', title: 'Golf Clubs', amount: 500, description: 'New set of titanium golf clubs. Gotta look good!' },
  { id: 'ex_5', title: 'Home Renovation', amount: 5000, description: 'Kitchen remodel. Necessary but expensive.' },
  { id: 'ex_6', title: 'Designer Clothes', amount: 800, description: 'Shopping spree at the mall.' },
  { id: 'ex_7', title: 'Boat Purchase', amount: 4000, description: 'Down payment on a boat. Remember: BOAT = Bust Out Another Thousand.' },
  { id: 'ex_8', title: 'Medical Bill', amount: 2500, description: 'Unexpected medical expenses not covered by insurance.' }
];

// Market events
const MARKET_EVENTS = [
  {
    id: 'mk_1',
    title: 'Real Estate Boom!',
    description: 'Real estate prices surge. Your properties are worth 50% more!',
    effect: 'real_estate_boom',
    modifier: 1.5
  },
  {
    id: 'mk_2',
    title: 'Stock Market Crash',
    description: 'Markets plunge 30%. Stock portfolio value drops.',
    effect: 'stock_crash',
    modifier: 0.7
  },
  {
    id: 'mk_3',
    title: 'Inflation Rising',
    description: 'Inflation increases all expenses by 10% this round.',
    effect: 'expense_increase',
    modifier: 1.1
  },
  {
    id: 'mk_4',
    title: 'Interest Rate Cut',
    description: 'Lower rates! Refinance all loans, saving 5% on monthly payments.',
    effect: 'expense_decrease',
    modifier: 0.95
  }
];

// Charity spaces - donate 10% of salary to get 2-dice rolls for 3 turns
const CHARITY_BONUS_TURNS = 3;
const CHARITY_PERCENT = 0.1;

// Baby space - adds $500 to monthly expenses
const BABY_EXPENSE = 500;

const BOARD_SIZE = 24;

module.exports = {
  BOARD_SPACES,
  SMALL_DEALS,
  BIG_DEALS,
  EXPENSE_EVENTS,
  MARKET_EVENTS,
  CHARITY_BONUS_TURNS,
  CHARITY_PERCENT,
  BABY_EXPENSE,
  BOARD_SIZE
};
