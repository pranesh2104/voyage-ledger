import { Trip } from 'voyage-lib';
import { DAY_MS } from '../../constants/my-journey.constant';

export interface JourneyStats {
  /** Trips that have started: completed or ongoing. Planned trips aren't history yet. */
  tripsTaken: number;
  /** Calendar days spent travelling. Overlapping trips count each day once. */
  daysTravelled: number;
  longestTrip: { trip: Trip; days: number } | null;
  placeCount: number;
  countryCount: number;
  /**
   * The trip with the most spent, among trips in the most-used currency (amounts in
   * different currencies can't be compared). Null when nothing has been spent yet.
   */
  mostExpensiveTrip: { trip: Trip; days: number } | null;
}

/**
 * Trip dates arrive as date-only strings ("2025-04-01"), which `new Date()` reads as
 * UTC midnight, so days are counted in UTC to avoid time-zone shifts.
 */
const dayNumber = (date: Date) => Math.floor(new Date(date).getTime() / DAY_MS);

/** Today's local calendar date, on the same UTC day scale as the trip dates. */
const todayNumber = (today: Date) =>
  Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS;

const normalize = (text: string | undefined) => text?.trim().toLowerCase() ?? '';

/**
 * Lifetime travel stats for My Journey. Only trips that have started count:
 * completed trips in full, ongoing trips up to today.
 */
export function computeJourneyStats(trips: Trip[], today = new Date()): JourneyStats {
  const taken = trips.filter((trip) => trip.status !== 'planning');
  const todayDay = todayNumber(today);

  // Inclusive day ranges [start, end]; an ongoing trip stops at today.
  const ranges = taken
    .map((trip) => {
      const start = dayNumber(trip.startDate);
      let end = dayNumber(trip.endDate);
      if (trip.status === 'ongoing') end = Math.min(end, todayDay);
      return { trip, start, end };
    })
    .filter((range) => !Number.isNaN(range.start) && !Number.isNaN(range.end) && range.end >= range.start);

  let longestTrip: JourneyStats['longestTrip'] = null;
  for (const { trip, start, end } of ranges) {
    const days = end - start + 1;
    if (!longestTrip || days > longestTrip.days) longestTrip = { trip, days };
  }

  const places = new Set(
    taken.map((trip) => `${normalize(trip.destination)}|${normalize(trip.country)}`),
  );
  const countries = new Set(taken.map((trip) => normalize(trip.country)).filter(Boolean));

  return {
    tripsTaken: taken.length,
    daysTravelled: countUnionDays(ranges),
    longestTrip,
    placeCount: places.size,
    countryCount: countries.size,
    mostExpensiveTrip: findMostExpensive(ranges),
  };
}

/**
 * Highest spend among trips in the currency used by the most trips. An ongoing trip counts
 * with what it has spent so far. Its day count is the trip's days so far, like longestTrip.
 */
function findMostExpensive(ranges: { trip: Trip; start: number; end: number }[]): JourneyStats['mostExpensiveTrip'] {
  const spending = ranges.filter(({ trip }) => trip.spent > 0);
  const tripsPerCurrency = new Map<string, number>();
  for (const { trip } of spending) tripsPerCurrency.set(trip.currency, (tripsPerCurrency.get(trip.currency) ?? 0) + 1);

  let mainCurrency: string | null = null;
  for (const [currency, count] of tripsPerCurrency) {
    if (mainCurrency === null || count > tripsPerCurrency.get(mainCurrency)!) mainCurrency = currency;
  }

  let most: JourneyStats['mostExpensiveTrip'] = null;
  for (const { trip, start, end } of spending) {
    if (trip.currency !== mainCurrency) continue;
    if (!most || trip.spent > most.trip.spent) most = { trip, days: end - start + 1 };
  }
  return most;
}

/** Days covered by at least one range, so two overlapping trips don't double-count. */
function countUnionDays(ranges: { start: number; end: number }[]): number {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let total = 0;
  let current: { start: number; end: number } | null = null;
  for (const range of sorted) {
    if (current && range.start <= current.end + 1) {
      current.end = Math.max(current.end, range.end);
    } else {
      if (current) total += current.end - current.start + 1;
      current = { ...range };
    }
  }
  if (current) total += current.end - current.start + 1;
  return total;
}
