import { Trip } from 'voyage-lib';
import { computeJourneyStats } from './journey-stats.util';

const trip = (
  id: string,
  startDate: string,
  endDate: string,
  status: Trip['status'] = 'completed',
  destination = 'Goa',
  country = 'India',
): Trip => ({
  id,
  name: `Trip ${id}`,
  destination,
  country,
  startDate: new Date(startDate),
  endDate: new Date(endDate),
  budget: 0,
  spent: 0,
  status,
  currency: 'INR',
});

const TODAY = new Date(2026, 10, 5); // 5 Nov 2026, local time

describe('computeJourneyStats', () => {
  it('is empty when there are no trips', () => {
    const stats = computeJourneyStats([], TODAY);
    expect(stats.tripsTaken).toBe(0);
    expect(stats.daysTravelled).toBe(0);
    expect(stats.longestTrip).toBeNull();
    expect(stats.mostExpensiveTrip).toBeNull();
  });

  it('counts both the first and last day of a trip', () => {
    expect(computeJourneyStats([trip('a', '2026-04-01', '2026-04-05')], TODAY).daysTravelled).toBe(5);
    expect(computeJourneyStats([trip('a', '2026-04-01', '2026-04-01')], TODAY).daysTravelled).toBe(1);
  });

  it('ignores planned trips', () => {
    const stats = computeJourneyStats(
      [trip('a', '2026-04-01', '2026-04-05'), trip('b', '2027-01-01', '2027-01-10', 'planning', 'Paris', 'France')],
      TODAY,
    );
    expect(stats.tripsTaken).toBe(1);
    expect(stats.daysTravelled).toBe(5);
    expect(stats.countryCount).toBe(1);
  });

  it('counts an ongoing trip only up to today', () => {
    const stats = computeJourneyStats([trip('a', '2026-11-01', '2026-11-20', 'ongoing')], TODAY);
    expect(stats.daysTravelled).toBe(5);
  });

  it('counts overlapping days once', () => {
    const stats = computeJourneyStats(
      [trip('a', '2026-04-01', '2026-04-05'), trip('b', '2026-04-04', '2026-04-08')],
      TODAY,
    );
    expect(stats.daysTravelled).toBe(8);
  });

  it('finds the longest trip', () => {
    const stats = computeJourneyStats(
      [trip('a', '2026-04-01', '2026-04-03'), trip('b', '2026-06-01', '2026-06-09'), trip('c', '2026-08-01', '2026-08-02')],
      TODAY,
    );
    expect(stats.longestTrip?.trip.id).toBe('b');
    expect(stats.longestTrip?.days).toBe(9);
  });

  it('counts places and countries case-insensitively', () => {
    const stats = computeJourneyStats(
      [
        trip('a', '2025-01-01', '2025-01-02', 'completed', 'Goa', 'India'),
        trip('b', '2025-02-01', '2025-02-02', 'completed', ' goa ', 'india'),
        trip('c', '2025-03-01', '2025-03-02', 'completed', 'Ooty', 'India'),
        trip('d', '2025-04-01', '2025-04-02', 'completed', 'Paris', 'France'),
      ],
      TODAY,
    );
    expect(stats.placeCount).toBe(3);
    expect(stats.countryCount).toBe(2);
  });

  describe('most expensive trip', () => {
    const spent = (base: Trip, amount: number, currency = 'INR', status: Trip['status'] = base.status): Trip =>
      ({ ...base, spent: amount, currency, status });

    it('picks the trip with the most spent, with its length', () => {
      const stats = computeJourneyStats(
        [
          spent(trip('a', '2026-04-01', '2026-04-03'), 12000),
          spent(trip('b', '2026-06-01', '2026-06-06'), 48000),
          spent(trip('c', '2026-08-01', '2026-08-02'), 9000),
        ],
        TODAY,
      );
      expect(stats.mostExpensiveTrip?.trip.id).toBe('b');
      expect(stats.mostExpensiveTrip?.days).toBe(6);
    });

    it('compares only trips in the most-used currency', () => {
      const stats = computeJourneyStats(
        [
          spent(trip('a', '2026-04-01', '2026-04-03'), 20000),
          spent(trip('b', '2026-05-01', '2026-05-03'), 30000),
          spent(trip('c', '2026-06-01', '2026-06-03'), 90000, 'JPY'),
        ],
        TODAY,
      );
      expect(stats.mostExpensiveTrip?.trip.id).toBe('b');
    });

    it('counts an ongoing trip with its spending so far, but never a planned one', () => {
      const stats = computeJourneyStats(
        [
          spent(trip('a', '2026-04-01', '2026-04-03'), 20000),
          spent(trip('b', '2026-11-01', '2026-11-20', 'ongoing'), 25000),
          spent(trip('c', '2027-01-01', '2027-01-05', 'planning'), 99000),
        ],
        TODAY,
      );
      expect(stats.mostExpensiveTrip?.trip.id).toBe('b');
      expect(stats.mostExpensiveTrip?.days).toBe(5);
    });

    it('is null while nothing has been spent', () => {
      expect(computeJourneyStats([trip('a', '2026-04-01', '2026-04-03')], TODAY).mostExpensiveTrip).toBeNull();
    });
  });
});
