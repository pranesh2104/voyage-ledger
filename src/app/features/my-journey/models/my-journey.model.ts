import { Trip } from 'voyage-lib';

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

export type LocatedTrip = Trip & { latitude: number; longitude: number };

export interface PlaceGroup {
  latitude: number;
  longitude: number;
  /** Most active first (ongoing, planning, completed), then the most recent start date. */
  trips: LocatedTrip[];
}
