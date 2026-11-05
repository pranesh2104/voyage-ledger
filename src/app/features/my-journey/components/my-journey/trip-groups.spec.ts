import { distanceInMeters, groupByPlace, isLocated, LocatedTrip } from './trip-groups';

const trip = (
  id: string,
  latitude: number,
  longitude: number,
  status: LocatedTrip['status'] = 'completed',
  startDate = '2026-01-01',
): LocatedTrip => ({
  id,
  name: `Trip ${id}`,
  destination: 'Goa',
  country: 'India',
  startDate: new Date(startDate),
  endDate: new Date(startDate),
  budget: 0,
  spent: 0,
  status,
  currency: 'INR',
  latitude,
  longitude,
});

describe('distanceInMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceInMeters({ latitude: 15.3, longitude: 74.1 }, { latitude: 15.3, longitude: 74.1 })).toBe(0);
  });

  it('matches a known distance (Paris to London is about 344 km)', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    expect(distanceInMeters(paris, london) / 1000).toBeCloseTo(344, 0);
  });
});

describe('isLocated', () => {
  it('needs both coordinates', () => {
    expect(isLocated(trip('a', 15.3, 74.1))).toBe(true);
    expect(isLocated({ ...trip('b', 0, 0), latitude: null })).toBe(false);
    expect(isLocated({ ...trip('c', 0, 0), longitude: undefined })).toBe(false);
  });
});

describe('groupByPlace', () => {
  it('puts trips with identical coordinates on one pin', () => {
    const groups = groupByPlace([trip('a', 15.3004, 74.0855), trip('b', 15.3004, 74.0855)]);
    expect(groups.length).toBe(1);
    expect(groups[0].trips.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('treats points within 100 m as the same place', () => {
    // 0.0005° of latitude is about 55 m
    const groups = groupByPlace([trip('a', 15.3004, 74.0855), trip('b', 15.3009, 74.0855)]);
    expect(groups.length).toBe(1);
  });

  it('keeps different places in the same country apart', () => {
    const goa = trip('goa', 15.3004, 74.0855);
    const ooty = trip('ooty', 11.4126, 76.703);
    expect(groupByPlace([goa, ooty]).length).toBe(2);
  });

  it('orders a group by status (ongoing, planning, completed), then newest first', () => {
    const groups = groupByPlace([
      trip('old-done', 15.3, 74.1, 'completed', '2024-01-01'),
      trip('new-done', 15.3, 74.1, 'completed', '2026-01-01'),
      trip('planned', 15.3, 74.1, 'planning'),
      trip('now', 15.3, 74.1, 'ongoing'),
    ]);
    expect(groups[0].trips.map((t) => t.id)).toEqual(['now', 'planned', 'new-done', 'old-done']);
  });

  it('returns no groups for no trips', () => {
    expect(groupByPlace([])).toEqual([]);
  });
});
