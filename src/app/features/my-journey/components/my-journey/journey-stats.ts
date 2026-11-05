import { Trip } from 'voyage-lib';
import { DAY_MS } from '../../constants/my-journey.constant';

export interface YearCount {
  year: number;
  trips: number;
}

export interface JourneyStats {
  /** Trips that have started: completed or ongoing. Planned trips aren't history yet. */
  tripsTaken: number;
  /** Calendar days spent travelling. Overlapping trips count each day once. */
  daysTravelled: number;
  longestTrip: { trip: Trip; days: number } | null;
  placeCount: number;
  countryCount: number;
  /** Year of the first trip taken, or null before any trip has started. */
  firstYear: number | null;
  /** Every year from the first trip to the latest, including years with no trips (0). */
  tripsPerYear: YearCount[];
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

  const perYear = new Map<number, number>();
  for (const { start } of ranges) {
    const year = new Date(start * DAY_MS).getUTCFullYear();
    perYear.set(year, (perYear.get(year) ?? 0) + 1);
  }
  const years = [...perYear.keys()];
  const firstYear = years.length ? Math.min(...years) : null;
  const tripsPerYear: YearCount[] = [];
  if (firstYear !== null) {
    for (let year = firstYear; year <= Math.max(...years); year++) {
      tripsPerYear.push({ year, trips: perYear.get(year) ?? 0 });
    }
  }

  return {
    tripsTaken: taken.length,
    daysTravelled: countUnionDays(ranges),
    longestTrip,
    placeCount: places.size,
    countryCount: countries.size,
    firstYear,
    tripsPerYear,
  };
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
