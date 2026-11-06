import { ExpenseCategory, ExpenseSplitInput, Trip } from 'voyage-lib';
import { DEMO_INVITE_DAYS, DEMO_STATE_VERSION, SAMPLE_ID_PREFIX } from '../demo.constant';
import { DemoExpense, DemoState, DemoTrip, DemoUser } from '../demo.model';

const ME = `${SAMPLE_ID_PREFIX}user-me`;
const ARJUN = `${SAMPLE_ID_PREFIX}user-arjun`;
const MEERA = `${SAMPLE_ID_PREFIX}user-meera`;

const USERS: DemoUser[] = [
  { id: ME, email: 'demo@example.com', display_name: 'Demo Traveller', username: 'demo_traveller' },
  { id: ARJUN, email: 'arjun@example.com', display_name: 'Arjun Rao', username: 'arjun' },
  { id: MEERA, email: 'meera@example.com', display_name: 'Meera Iyer', username: 'meera' },
];

/**
 * [day, category, amount, description, paid by]. The day is days from today, or
 * EARLY_THIS_MONTH for a day that makes the dashboard's Today, Week and Month totals differ.
 */
const EARLY_THIS_MONTH = 'early-this-month';
type SeedDay = number | typeof EARLY_THIS_MONTH;
type SeedExpense = [day: SeedDay, category: ExpenseCategory, amount: number, description: string, paidBy?: string];

interface SeedTrip {
  key: string;
  name: string;
  destination: string;
  country: string;
  /** Days from today, so the demo always has an ongoing, a planned and past trips. */
  start: number;
  end: number;
  budget: number;
  status: Trip['status'];
  at: [lat: number, lng: number];
  creator?: string;
  members?: string[];
  expenses: SeedExpense[];
}

const TRIPS: SeedTrip[] = [
  {
    key: 'kerala', name: 'Kerala Backwaters', destination: 'Alleppey', country: 'India',
    start: -2, end: 3, budget: 45000, status: 'ongoing', at: [9.4981, 76.3388], members: [ME, ARJUN, MEERA],
    expenses: [
      [-2, 'transport', 8400, 'Flights to Kochi', ME],
      [-2, 'transport', 1800, 'Cab to Alleppey', ARJUN],
      [-2, 'accommodation', 12000, 'Houseboat, 1 night', ME],
      [-1, 'food', 2350, 'Karimeen lunch on the boat', MEERA],
      [-1, 'activities', 1500, 'Kayaking in the canals', ARJUN],
      [0, 'food', 960, 'Breakfast: appam and stew', ME],
      [0, 'souvenirs', 1200, 'Spices from the market', MEERA],
    ],
  },
  {
    key: 'ladakh', name: 'Ladakh Road Trip', destination: 'Leh', country: 'India',
    start: 32, end: 41, budget: 65000, status: 'planning', at: [34.1526, 77.5771],
    expenses: [
      [EARLY_THIS_MONTH, 'transport', 14200, 'Flights to Leh'],
      [-3, 'accommodation', 9800, 'Guesthouse deposit'],
    ],
  },
  {
    key: 'jaipur', name: 'Jaipur Heritage Walk', destination: 'Jaipur', country: 'India',
    start: -46, end: -42, budget: 25000, status: 'completed', at: [26.9124, 75.7873],
    expenses: [
      [-46, 'transport', 4200, 'Train to Jaipur'],
      [-46, 'accommodation', 7600, 'Haveli stay, 4 nights'],
      [-45, 'activities', 1800, 'Amber Fort and City Palace tickets'],
      [-44, 'food', 2400, 'Dal baati at Chokhi Dhani'],
      [-43, 'souvenirs', 3100, 'Block-print bedsheets'],
      [-42, 'transport', 1100, 'Auto rides'],
    ],
  },
  {
    // Over budget on purpose, to show the over-budget states.
    key: 'goa', name: 'Goa Monsoon Escape', destination: 'Goa', country: 'India',
    start: -128, end: -124, budget: 20000, status: 'completed', at: [15.4909, 73.8278], members: [ME, ARJUN],
    expenses: [
      [-128, 'accommodation', 9600, 'Beach shack stay', ME],
      [-128, 'transport', 5200, 'Scooter rental and fuel', ARJUN],
      [-127, 'food', 4800, 'Seafood dinners', ME],
      [-126, 'activities', 3500, 'Dudhsagar falls trip', ARJUN],
      [-125, 'other', 900, 'Rain ponchos', ME],
    ],
  },
  {
    key: 'rishikesh', name: 'Rishikesh Rafting', destination: 'Rishikesh', country: 'India',
    start: -215, end: -212, budget: 15000, status: 'completed', at: [30.0869, 78.2676],
    expenses: [
      [-215, 'transport', 3200, 'Bus from Delhi'],
      [-215, 'accommodation', 3600, 'Riverside camp, 3 nights'],
      [-214, 'activities', 2800, 'Rafting, 16 km'],
      [-213, 'food', 1400, 'Cafes on Laxman Jhula'],
    ],
  },
  {
    key: 'bangkok', name: 'Bangkok Street Food', destination: 'Bangkok', country: 'Thailand',
    start: -330, end: -325, budget: 55000, status: 'completed', at: [13.7563, 100.5018], members: [ME, MEERA],
    expenses: [
      [-330, 'transport', 21000, 'Return flights', ME],
      [-330, 'accommodation', 14500, 'Hotel in Silom', MEERA],
      [-329, 'food', 6200, 'Yaowarat night market', ME],
      [-328, 'activities', 3800, 'Floating market tour', MEERA],
      [-326, 'souvenirs', 2600, 'Chatuchak market finds', ME],
    ],
  },
  {
    key: 'manali', name: 'Manali Snow Trip', destination: 'Manali', country: 'India',
    start: -420, end: -414, budget: 30000, status: 'completed', at: [32.2432, 77.1892],
    expenses: [
      [-420, 'transport', 2800, 'Volvo bus from Delhi'],
      [-420, 'accommodation', 10500, 'Cottage in Old Manali'],
      [-418, 'activities', 4500, 'Skiing in Solang Valley'],
      [-417, 'food', 3900, 'Momos and thukpa'],
      [-416, 'other', 1500, 'Jacket rental'],
    ],
  },
  {
    key: 'pondicherry', name: 'Pondicherry Weekend', destination: 'Puducherry', country: 'India',
    start: -540, end: -538, budget: 12000, status: 'completed', at: [11.9416, 79.8083],
    expenses: [
      [-540, 'transport', 1600, 'Bus from Chennai'],
      [-540, 'accommodation', 5200, 'Heritage stay in White Town'],
      [-539, 'food', 2700, 'French bakeries and cafes'],
      [-539, 'activities', 1200, 'Auroville visit'],
    ],
  },
];

/** A trip Meera invited the demo user to; accepting the invite adds it to their trips. */
const INVITED_TRIP: SeedTrip = {
  key: 'hampi', name: 'Hampi Ruins Trip', destination: 'Hampi', country: 'India',
  start: 60, end: 63, budget: 18000, status: 'planning', at: [15.335, 76.46], creator: MEERA, members: [MEERA, ARJUN],
  expenses: [[-2, 'accommodation', 6000, 'Homestay booking', MEERA]],
};

/** Local calendar day as YYYY-MM-DD, the format the API uses for trip dates. */
function isoDay(today: Date, offset: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Days from today to a day that falls in exactly one of "this week" and "this month", so the
 * dashboard's Week and Month totals differ: the 1st when it comes before this week's Monday,
 * otherwise Monday (then in last month, so it counts for the week only). Only when the 1st is
 * itself this week's Monday do the two ranges cover the same days, and nothing can tell them apart.
 */
export function earlyThisMonthOffset(today: Date): number {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const daysSinceFirst = today.getDate() - 1;
  return daysSinceFirst > daysSinceMonday ? -daysSinceFirst : -daysSinceMonday;
}

/** An expense time on the given day; never in the future, so "spent today" includes today's expenses. */
function expenseTime(today: Date, offset: number, index: number): string {
  const time = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 9 + ((index * 3) % 12));
  const latest = today.getTime() - 60_000;
  return new Date(Math.min(time.getTime(), latest)).toISOString();
}

/** Equal shares that add up to the amount exactly; the payer takes the rounding remainder. */
export function equalSplits(amount: number, memberIds: string[], payer: string): ExpenseSplitInput[] {
  const share = Math.floor((amount / memberIds.length) * 100) / 100;
  const remainder = Math.round((amount - share * memberIds.length) * 100) / 100;
  return memberIds.map(userId => ({
    userId,
    share: userId === payer ? Math.round((share + remainder) * 100) / 100 : share,
  }));
}

function buildTrip(seed: SeedTrip, today: Date): { trip: DemoTrip; expenses: DemoExpense[] } {
  const id = `${SAMPLE_ID_PREFIX}trip-${seed.key}`;
  const memberIds = seed.members ?? [ME];
  const trip: DemoTrip = {
    id,
    name: seed.name,
    destination: seed.destination,
    country: seed.country,
    startDate: isoDay(today, seed.start),
    endDate: isoDay(today, seed.end),
    budget: seed.budget,
    status: seed.status,
    currency: 'INR',
    latitude: seed.at[0],
    longitude: seed.at[1],
    creatorId: seed.creator ?? ME,
    memberIds,
  };
  const expenses = seed.expenses.map(([seedDay, category, amount, description, paidBy = ME], index): DemoExpense => {
    const day = seedDay === EARLY_THIS_MONTH ? earlyThisMonthOffset(today) : seedDay;
    return {
      id: `${SAMPLE_ID_PREFIX}expense-${seed.key}-${index + 1}`,
      tripId: id,
      category,
      amount,
      description,
      date: expenseTime(today, day, index),
      paidBy,
      splits: equalSplits(amount, memberIds, paidBy),
    };
  });
  return { trip, expenses };
}

/** Fresh sample data, with every date placed relative to `today`. */
export function buildDemoSeed(today = new Date()): DemoState {
  const built = TRIPS.map(seed => buildTrip(seed, today));
  const invited = buildTrip(INVITED_TRIP, today);
  const createdAt = new Date(today.getTime() - 86_400_000).toISOString();
  const expiresAt = new Date(today.getTime() + (DEMO_INVITE_DAYS - 1) * 86_400_000).toISOString();

  return {
    version: DEMO_STATE_VERSION,
    userId: ME,
    users: Object.fromEntries(USERS.map(user => [user.id, user])),
    trips: built.map(b => b.trip),
    expenses: built.flatMap(b => b.expenses),
    tripInvites: [
      {
        id: `${SAMPLE_ID_PREFIX}invite-ladakh`,
        tripId: `${SAMPLE_ID_PREFIX}trip-ladakh`,
        email: 'kabir@example.com',
        status: 'pending',
        createdAt,
        expiresAt,
      },
    ],
    receivedInvites: [
      { id: `${SAMPLE_ID_PREFIX}invite-hampi`, status: 'pending', expiresAt, trip: invited.trip, expenses: invited.expenses },
    ],
  };
}
