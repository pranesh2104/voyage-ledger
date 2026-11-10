import { ExpenseDTO, Settlement, TripBalance, TripDTO } from 'voyage-lib';
import { DemoApiError, handleDemoRequest } from './demo-api.util';
import { DEMO_MESSAGES } from '../demo.constant';
import { DemoRequest, DemoState } from '../demo.model';
import { buildDemoSeed, equalSplits } from './demo-seed.util';

// A Wednesday, so "this week" (from Monday) and "this month" are different ranges.
const NOW = new Date(2026, 10, 4, 18, 0);

const call = <T>(state: DemoState, method: string, path: string, body?: unknown): T =>
  handleDemoRequest(state, { method, path, body } satisfies DemoRequest, NOW).data as T;

const callError = (state: DemoState, method: string, path: string, body?: unknown): DemoApiError => {
  try {
    handleDemoRequest(state, { method, path, body }, NOW);
  } catch (error) {
    if (error instanceof DemoApiError) return error;
    throw error;
  }
  throw new Error(`${method} ${path} did not fail`);
};

describe('demo API', () => {
  let state: DemoState;

  beforeEach(() => {
    state = buildDemoSeed(NOW);
  });

  describe('sample data', () => {
    it('has an ongoing, a planned and completed trips, dated around today', () => {
      const trips = call<{ trips: TripDTO[] }>(state, 'GET', '/trips').trips;
      const byStatus = (status: TripDTO['status']) => trips.filter(t => t.status === status);
      expect(byStatus('ongoing').length).toBe(1);
      expect(byStatus('planning').length).toBe(1);
      expect(byStatus('completed').length).toBeGreaterThan(3);

      const today = '2026-11-04';
      const ongoing = byStatus('ongoing')[0];
      expect(ongoing.startDate <= today && today <= ongoing.endDate).toBe(true);
      for (const trip of byStatus('completed')) expect(trip.endDate < today).toBe(true);
      expect(byStatus('planning')[0].startDate > today).toBe(true);
    });

    it('gives every sample trip coordinates and computes spent from its expenses', () => {
      const trips = call<{ trips: TripDTO[] }>(state, 'GET', '/trips').trips;
      for (const trip of trips) {
        expect(trip.latitude).not.toBeNull();
        const expenses = call<ExpenseDTO[]>(state, 'GET', `/trips/${trip.id}/expenses`);
        expect(trip.spent).toBe(expenses.reduce((sum, e) => sum + e.amount, 0));
      }
    });

    it('has at least one trip over budget', () => {
      const trips = call<{ trips: TripDTO[] }>(state, 'GET', '/trips').trips;
      expect(trips.some(t => t.spent > t.budget)).toBe(true);
    });

    it('never dates an expense in the future', () => {
      for (const expense of state.expenses) expect(new Date(expense.date).getTime()).toBeLessThanOrEqual(NOW.getTime());
    });

    it('splits shared expenses so the shares add up exactly', () => {
      const splits = equalSplits(1000, ['a', 'b', 'c'], 'b');
      expect(splits.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1000, 10);
      expect(splits.find(s => s.userId === 'b')?.share).toBe(333.34);
    });
  });

  describe('trips', () => {
    it('creates a trip, locates a known destination and lets it be deleted', () => {
      const created = call<TripDTO>(state, 'POST', '/trips', {
        name: 'Hills', destination: 'Ooty', country: 'India', startDate: '2026-12-01', endDate: '2026-12-03',
        budget: 9000, spent: 500, status: 'planning', currency: 'INR',
      });
      expect(created.isCreator).toBe(true);
      expect(created.spent).toBe(0);
      expect(created.latitude).toBeCloseTo(11.41, 1);

      call(state, 'DELETE', `/trips/${created.id}`);
      expect(callError(state, 'GET', `/trips/${created.id}`).status).toBe(404);
    });

    it('leaves an unknown destination without coordinates', () => {
      const created = call<TripDTO>(state, 'POST', '/trips', {
        name: 'Somewhere', destination: 'Nowhereville', startDate: '2026-12-01', endDate: '2026-12-03',
      });
      expect(created.latitude).toBeNull();
    });

    it('edits a sample trip but refuses to delete it', () => {
      const id = 'sample-trip-jaipur';
      const updated = call<TripDTO>(state, 'PUT', `/trips/${id}`, { name: 'Pink City', destination: 'Udaipur' });
      expect(updated.name).toBe('Pink City');
      expect(updated.latitude).toBeCloseTo(24.59, 1);

      const error = callError(state, 'DELETE', `/trips/${id}`);
      expect(error.status).toBe(403);
      expect(error.message).toBe(DEMO_MESSAGES.sampleDelete);
    });

    it('rejects a trip without the required fields', () => {
      expect(callError(state, 'POST', '/trips', { name: 'x' }).status).toBe(400);
    });
  });

  describe('expenses', () => {
    const tripId = 'sample-trip-kerala';

    it('adds an expense, updates spent, and deletes it again', () => {
      const before = call<TripDTO>(state, 'GET', `/trips/${tripId}`).spent;
      const expense = call<ExpenseDTO>(state, 'POST', '/expenses', {
        tripId, category: 'food', amount: 300, description: 'Tea', date: NOW.toISOString(),
      });
      expect(expense.paidByYou).toBe(true);
      expect(expense.yourShare).toBe(300);
      expect(call<TripDTO>(state, 'GET', `/trips/${tripId}`).spent).toBe(before + 300);

      call(state, 'DELETE', '/expenses', { tripId, expenseId: expense.id });
      expect(call<TripDTO>(state, 'GET', `/trips/${tripId}`).spent).toBe(before);
    });

    it('refuses a split that does not add up', () => {
      const error = callError(state, 'POST', '/expenses', {
        tripId, category: 'food', amount: 300, date: NOW.toISOString(), splits: [{ userId: state.userId, share: 100 }],
      });
      expect(error.status).toBe(400);
    });

    it('edits a sample expense and keeps its split adding up', () => {
      const id = 'sample-expense-kerala-1';
      const updated = call<ExpenseDTO>(state, 'PUT', '/expenses', {
        tripId, expenseId: id, category: 'transport', amount: 9000, description: 'Flights', date: NOW.toISOString(),
      });
      expect(updated.amount).toBe(9000);
      const stored = state.expenses.find(e => e.id === id)!;
      expect(stored.splits.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(9000, 6);
    });

    it('refuses to delete a sample expense', () => {
      const error = callError(state, 'DELETE', '/expenses', { tripId, expenseId: 'sample-expense-kerala-1' });
      expect(error.status).toBe(403);
      expect(error.message).toBe(DEMO_MESSAGES.sampleDelete);
    });

    it("only lets the payer change someone's split", () => {
      const paidByArjun = state.expenses.find(e => e.tripId === tripId && e.paidBy !== state.userId)!;
      const error = callError(state, 'PUT', '/expenses', {
        tripId, expenseId: paidByArjun.id, amount: paidByArjun.amount, splits: paidByArjun.splits,
      });
      expect(error.status).toBe(403);
    });

    it('sums only what the demo user paid, per range', () => {
      const summary = call<Record<string, number>>(state, 'GET', '/expenses/summary');
      const mine = (from: Date) => state.expenses
        .filter(e => e.paidBy === state.userId && new Date(e.date) >= from && new Date(e.date) <= NOW)
        .reduce((sum, e) => sum + e.amount, 0);
      expect(summary['today']).toBe(mine(new Date(2026, 10, 4)));
      expect(summary['week']).toBe(mine(new Date(2026, 10, 2)));
      expect(summary['month']).toBe(mine(new Date(2026, 10, 1)));
      expect(summary['today']).toBeGreaterThan(0);
    });

    it('shows different Week and Month totals on any day the two ranges differ', () => {
      for (let day = 0; day < 366; day++) {
        const now = new Date(2026, 0, 1 + day, 18, 0);
        const seeded = buildDemoSeed(now);
        const summary = handleDemoRequest(seeded, { method: 'GET', path: '/expenses/summary', body: null }, now)
          .data as Record<string, number>;
        // Same days in both ranges only when the 1st is this week's Monday.
        const sameRange = now.getDate() - 1 === (now.getDay() + 6) % 7;
        if (!sameRange) expect(summary['week'], now.toDateString()).not.toBe(summary['month']);
      }
    });
  });

  describe('settle up', () => {
    it('balances a shared trip to zero and settles it with transactions', () => {
      const { balances, transactions } = call<Settlement>(state, 'GET', '/trips/sample-trip-kerala/settlement');
      expect(balances.length).toBe(3);
      expect(balances.reduce((sum, b) => sum + b.net, 0)).toBeCloseTo(0, 6);
      const owed = balances.filter(b => b.net > 0).reduce((sum, b) => sum + b.net, 0);
      expect(transactions.reduce((sum, t) => sum + t.amount, 0)).toBeCloseTo(owed, 1);
    });

    it("reports the demo user's net per trip", () => {
      const balances = call<TripBalance[]>(state, 'GET', '/trips/balances/mine');
      const kerala = call<Settlement>(state, 'GET', '/trips/sample-trip-kerala/settlement');
      expect(balances.find(b => b.tripId === 'sample-trip-kerala')?.net).toBe(kerala.balances.find(b => b.isYou)?.net);
      expect(balances.find(b => b.tripId === 'sample-trip-jaipur')?.net).toBe(0);
    });
  });

  describe('members and invites', () => {
    it('invites by email, refuses duplicates and members, and revokes', () => {
      const invite = call<{ id: string }>(state, 'POST', '/trips/sample-trip-kerala/invites', { email: 'New@Example.com' });
      expect(callError(state, 'POST', '/trips/sample-trip-kerala/invites', { email: 'new@example.com' }).status).toBe(400);
      expect(callError(state, 'POST', '/trips/sample-trip-kerala/invites', { email: 'arjun@example.com' }).status).toBe(400);

      call(state, 'DELETE', `/trips/sample-trip-kerala/invites/${invite.id}`);
      const invites = call<{ id: string; status: string }[]>(state, 'GET', '/trips/sample-trip-kerala/invites');
      expect(invites.find(i => i.id === invite.id)?.status).toBe('revoked');
    });

    it('refuses to remove a sample member', () => {
      expect(callError(state, 'DELETE', '/trips/sample-trip-kerala/members/sample-user-arjun').message)
        .toBe(DEMO_MESSAGES.sampleDelete);
    });

    it('adds the invited trip and its expenses on accept', () => {
      const [invite] = call<{ id: string; tripId: string }[]>(state, 'GET', '/invites');
      call(state, 'POST', `/invites/${invite.id}/accept`);

      expect(call<unknown[]>(state, 'GET', '/invites').length).toBe(0);
      const trip = call<TripDTO>(state, 'GET', `/trips/${invite.tripId}`);
      expect(trip.isCreator).toBe(false);
      expect(trip.spent).toBeGreaterThan(0);
    });
  });

  describe('account and routing', () => {
    it('returns the demo user and saves profile changes', () => {
      call(state, 'PUT', '/auth/profile', { display_name: 'Sam', username: 'sam' });
      expect(call<{ user: { display_name: string } }>(state, 'GET', '/auth/user').user.display_name).toBe('Sam');
    });

    it('turns off other account actions and answers unknown paths with 404', () => {
      expect(callError(state, 'PUT', '/auth/password', { password: 'x' }).message).toBe(DEMO_MESSAGES.notInDemo);
      expect(callError(state, 'GET', '/nope').status).toBe(404);
    });
  });
});
