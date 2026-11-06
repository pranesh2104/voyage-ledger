import { Trip } from 'voyage-lib';
import { SAME_PLACE_METERS, STATUS_PRIORITY } from '../constants/my-journey.constant';
import { LocatedTrip, PlaceGroup } from '../models/my-journey.model';

export const isLocated = (trip: Trip): trip is LocatedTrip =>
  typeof trip.latitude === 'number' && typeof trip.longitude === 'number';

/** Distance between two points on Earth in metres (haversine formula). */
export function distanceInMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const EARTH_RADIUS_METERS = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

const byActivity = (a: Trip, b: Trip) =>
  STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
  new Date(b.startDate).getTime() - new Date(a.startDate).getTime();

/**
 * Puts trips at the same place into one group, so they share a pin instead of
 * stacking invisibly on top of each other. A trip joins the first group whose
 * position (its first trip's) is within SAME_PLACE_METERS.
 */
export function groupByPlace(trips: LocatedTrip[]): PlaceGroup[] {
  const groups: PlaceGroup[] = [];
  for (const trip of trips) {
    const group = groups.find((candidate) => distanceInMeters(candidate, trip) <= SAME_PLACE_METERS);
    if (group) {
      group.trips.push(trip);
    } else {
      groups.push({ latitude: trip.latitude, longitude: trip.longitude, trips: [trip] });
    }
  }
  groups.forEach((group) => group.trips.sort(byActivity));
  return groups;
}
