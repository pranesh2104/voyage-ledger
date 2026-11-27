import { Expense, ExpenseCategory, Trip } from 'voyage-lib';

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

export type LocatedExpense = Expense & { latitude: number; longitude: number };

/** Expenses at one place on a trip (the same hotel paid twice is one spot), shown as one pin. */
export interface SpendingSpot {
  /** 1-based order of the first visit, matching the journey path and the number on the pin. */
  order: number;
  latitude: number;
  longitude: number;
  /** The first place name among its expenses; null when all are unnamed GPS pins. */
  placeName: string | null;
  /** In the order they happened. */
  expenses: LocatedExpense[];
  total: number;
  /** The category with the most spent here, for the pin's icon and colour. */
  category: ExpenseCategory;
}

/** One day of a trip's expenses, for the list beside the map. */
export interface SpendingDay {
  /** Calendar day as "2026-12-21", in UTC like the expense pages group them. */
  key: string;
  /** Day N of the trip; 0 or less for bookings paid before it started. */
  dayNumber: number;
  expenses: Expense[];
  total: number;
}
