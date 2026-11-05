import { Trip } from 'voyage-lib';
import { computeJourneyStats } from './journey-stats';

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
    expect(stats.firstYear).toBeNull();
    expect(stats.tripsPerYear).toEqual([]);
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
    expect(stats.tripsPerYear).toEqual([{ year: 2026, trips: 1 }]);
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

  it('lists every year from the first trip, with 0 for gap years', () => {
    const stats = computeJourneyStats(
      [trip('a', '2023-05-01', '2023-05-02'), trip('b', '2026-01-01', '2026-01-02'), trip('c', '2026-03-01', '2026-03-02')],
      TODAY,
    );
    expect(stats.firstYear).toBe(2023);
    expect(stats.tripsPerYear).toEqual([
      { year: 2023, trips: 1 },
      { year: 2024, trips: 0 },
      { year: 2025, trips: 0 },
      { year: 2026, trips: 2 },
    ]);
  });
});
