import { Expense } from 'voyage-lib';
import {
  buildJourneyPath,
  buildSpendingSpots,
  chronological,
  dayKey,
  groupByDay,
  isExpenseLocated,
} from './trip-spending.util';

const HOTEL = { latitude: 15.5439, longitude: 73.7553, placeName: 'Calangute Beach, Calangute' };
const NEXT_DOOR = { latitude: 15.5441, longitude: 73.7554, placeName: 'Shack next door, Calangute' }; // ~25 m away
const BAGA = { latitude: 15.5559, longitude: 73.7517, placeName: 'Baga Road, Baga' };
const FALLS = { latitude: 15.3144, longitude: 74.3143, placeName: 'Dudhsagar Falls, Sonaulim' };

let nextId = 0;
const expense = (
  date: string,
  amount: number,
  where?: { latitude: number; longitude: number; placeName: string | null },
  category: Expense['category'] = 'food',
): Expense => ({
  id: `e${++nextId}`,
  tripId: 't1',
  category,
  amount,
  description: `Expense ${nextId}`,
  date: new Date(date),
  latitude: where?.latitude ?? null,
  longitude: where?.longitude ?? null,
  placeName: where?.placeName ?? null,
});

describe('isExpenseLocated', () => {
  it('needs both coordinates as numbers', () => {
    expect(isExpenseLocated(expense('2026-12-20', 1, HOTEL))).toBe(true);
    expect(isExpenseLocated(expense('2026-12-20', 1))).toBe(false);
    expect(isExpenseLocated({ ...expense('2026-12-20', 1), latitude: 15 })).toBe(false);
  });
});

describe('chronological', () => {
  it('sorts by date and keeps the given order within a day', () => {
    const a = expense('2026-12-21', 1);
    const b = expense('2026-12-20', 2);
    const c = expense('2026-12-21', 3);
    expect(chronological([a, b, c])).toEqual([b, a, c]);
  });
});

describe('buildSpendingSpots', () => {
  it('merges expenses within ~40 m into one spot, numbered by first visit', () => {
    const stay = expense('2026-12-20', 9600, HOTEL, 'accommodation');
    const scooter = expense('2026-12-20', 5200, BAGA, 'transport');
    const lunch = expense('2026-12-21', 800, NEXT_DOOR);
    const dinner = expense('2026-12-21', 4800, BAGA);
    const ponchos = expense('2026-12-22', 900); // no location

    // Days out of order; within a day, the order given (the API's) is the order they happened.
    const spots = buildSpendingSpots([dinner, ponchos, lunch, stay, scooter]);

    expect(spots.map((s) => [s.order, s.placeName, s.total, s.expenses.length])).toEqual([
      [1, 'Calangute Beach, Calangute', 10400, 2],
      [2, 'Baga Road, Baga', 10000, 2],
    ]);
    expect(spots[0].expenses).toEqual([stay, lunch]);
  });

  it('colours a spot by the category with the most spent there', () => {
    const [spot] = buildSpendingSpots([
      expense('2026-12-20', 300, BAGA, 'food'),
      expense('2026-12-20', 400, BAGA, 'souvenirs'),
      expense('2026-12-21', 200, BAGA, 'food'),
    ]);
    expect(spot.category).toBe('food'); // 500 food vs 400 souvenirs
  });

  it('takes the first place name when the first expense is an unnamed GPS pin', () => {
    const [spot] = buildSpendingSpots([
      expense('2026-12-20', 100, { ...HOTEL, placeName: null }),
      expense('2026-12-21', 100, HOTEL),
    ]);
    expect(spot.placeName).toBe('Calangute Beach, Calangute');
  });

  it('returns nothing when no expense has a location', () => {
    expect(buildSpendingSpots([expense('2026-12-20', 100)])).toEqual([]);
  });
});

describe('buildJourneyPath', () => {
  it('follows the visits in order, returns included, without repeating a place twice in a row', () => {
    const expenses = [
      expense('2026-12-20', 1, HOTEL),
      expense('2026-12-20', 1, NEXT_DOOR), // same spot as the hotel
      expense('2026-12-21', 1, FALLS),
      expense('2026-12-21', 1), // no location: skipped
      expense('2026-12-22', 1, HOTEL),
      expense('2026-12-22', 1, BAGA),
    ];
    const path = buildJourneyPath(expenses, buildSpendingSpots(expenses));
    expect(path).toEqual([
      [HOTEL.longitude, HOTEL.latitude],
      [FALLS.longitude, FALLS.latitude],
      [HOTEL.longitude, HOTEL.latitude],
      [BAGA.longitude, BAGA.latitude],
    ]);
  });

  it('is empty with fewer than two places', () => {
    const expenses = [expense('2026-12-20', 1, HOTEL), expense('2026-12-21', 1, NEXT_DOOR)];
    expect(buildJourneyPath(expenses, buildSpendingSpots(expenses))).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('groups by calendar day with totals, numbered from the trip start', () => {
    const days = groupByDay(
      [
        expense('2026-12-21', 4800),
        expense('2026-12-18', 2000), // booked before the trip
        expense('2026-12-20', 9600),
        expense('2026-12-20', 5200.5),
      ],
      new Date('2026-12-20'),
    );
    expect(days.map((d) => [d.key, d.dayNumber, d.expenses.length, d.total])).toEqual([
      ['2026-12-18', -1, 1, 2000],
      ['2026-12-20', 1, 2, 14800.5],
      ['2026-12-21', 2, 1, 4800],
    ]);
  });

  it('uses the UTC calendar day, like the expense pages', () => {
    expect(dayKey(new Date('2026-12-20T23:30:00Z'))).toBe('2026-12-20');
  });
});
