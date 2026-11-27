import { Expense, ExpenseCategory } from 'voyage-lib';
import { DAY_MS, SAME_SPOT_METERS } from '../constants/my-journey.constant';
import { LocatedExpense, SpendingDay, SpendingSpot } from '../models/my-journey.model';
import { distanceInMeters } from './trip-groups.util';

export const isExpenseLocated = (expense: Expense): expense is LocatedExpense =>
  typeof expense.latitude === 'number' && typeof expense.longitude === 'number';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Calendar day as "2026-12-21" in UTC: expense dates are plain days, stored as UTC midnight. */
export const dayKey = (date: Date): string => new Date(date).toISOString().slice(0, 10);

/**
 * The order expenses happened in: by date, and within a day in the order they were added
 * (the API's order), since expenses have no time of day.
 */
export function chronological(expenses: Expense[]): Expense[] {
  return expenses
    .map((expense, index) => ({ expense, index }))
    .sort((a, b) => a.expense.date.getTime() - b.expense.date.getTime() || a.index - b.index)
    .map(({ expense }) => expense);
}

/** The category with the most spent; the earliest one wins a tie. */
function topCategory(expenses: Expense[]): ExpenseCategory {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  let best = expenses[0].category;
  for (const [category, total] of totals) if (total > (totals.get(best) ?? 0)) best = category;
  return best;
}

/**
 * The places money was spent, numbered by first visit. An expense joins the first spot whose
 * position (its first expense's) is within SAME_SPOT_METERS. Expenses without a location are left out.
 */
export function buildSpendingSpots(expenses: Expense[]): SpendingSpot[] {
  const spots: SpendingSpot[] = [];
  for (const expense of chronological(expenses)) {
    if (!isExpenseLocated(expense)) continue;
    const spot = spots.find((candidate) => distanceInMeters(candidate, expense) <= SAME_SPOT_METERS);
    if (spot) {
      spot.expenses.push(expense);
      spot.total = round2(spot.total + expense.amount);
      spot.placeName ??= expense.placeName ?? null;
    } else {
      spots.push({
        order: spots.length + 1,
        latitude: expense.latitude,
        longitude: expense.longitude,
        placeName: expense.placeName ?? null,
        expenses: [expense],
        total: round2(expense.amount),
        category: expense.category,
      });
    }
  }
  for (const spot of spots) spot.category = topCategory(spot.expenses);
  return spots;
}

/**
 * The journey path as [longitude, latitude] points: spots in the order they were visited,
 * returns included (hotel, beach, hotel), with consecutive repeats dropped. Empty when fewer
 * than two places, since a path needs two ends.
 */
export function buildJourneyPath(expenses: Expense[], spots: SpendingSpot[]): [number, number][] {
  const spotOf = new Map<Expense, SpendingSpot>();
  for (const spot of spots) for (const expense of spot.expenses) spotOf.set(expense, spot);

  const path: [number, number][] = [];
  let previous: SpendingSpot | undefined;
  for (const expense of chronological(expenses)) {
    const spot = spotOf.get(expense);
    if (!spot || spot === previous) continue;
    path.push([spot.longitude, spot.latitude]);
    previous = spot;
  }
  return path.length >= 2 ? path : [];
}

/** Expenses per calendar day, in order, numbered from the trip's first day. */
export function groupByDay(expenses: Expense[], tripStart: Date): SpendingDay[] {
  const startTime = Date.parse(dayKey(tripStart));
  const days = new Map<string, SpendingDay>();
  for (const expense of chronological(expenses)) {
    const key = dayKey(expense.date);
    let day = days.get(key);
    if (!day) {
      day = { key, dayNumber: Math.round((Date.parse(key) - startTime) / DAY_MS) + 1, expenses: [], total: 0 };
      days.set(key, day);
    }
    day.expenses.push(expense);
    day.total = round2(day.total + expense.amount);
  }
  return [...days.values()];
}
