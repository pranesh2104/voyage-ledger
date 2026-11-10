import {
  ExpenseCategory,
  ExpenseDTO,
  ExpenseSplitInput,
  MyInviteDTO,
  Settlement,
  SettlementBalance,
  SettlementTransaction,
  SpentRangeOption,
  TripBalance,
  TripDTO,
  TripInviteDTO,
  TripMember,
} from 'voyage-lib';
import { DEMO_INVITE_DAYS, DEMO_MESSAGES, DEMO_PLACES, SAMPLE_ID_PREFIX } from '../demo.constant';
import { DemoExpense, DemoRequest, DemoResult, DemoState, DemoTrip } from '../demo.model';

/**
 * Answers API requests from the in-browser demo data instead of the backend. Each handler
 * follows the matching backend controller (response shape, validation, who may do what),
 * so the app can't tell the difference. Handlers change `state` in place; the caller saves it.
 */

/** A request the backend would reject; becomes an HttpErrorResponse with the same body shape. */
export class DemoApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Params = string[];
type Handler = (state: DemoState, params: Params, body: Record<string, any>, now: Date) => DemoResult;

const ok = (data: unknown, message?: string, status = 200): DemoResult => ({ status, data, message });
const fail = (status: number, message: string): never => {
  throw new DemoApiError(status, message);
};

export const isSampleId = (id: string | undefined | null): boolean => !!id?.startsWith(SAMPLE_ID_PREFIX);

const newId = (kind: string) => `demo-${kind}-${crypto.randomUUID()}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Lookups ───────────────────────────────────────────────────────────────────

function findTrip(state: DemoState, id: string): DemoTrip {
  const trip = state.trips.find(t => t.id === id && t.memberIds.includes(state.userId));
  return trip ?? fail(404, 'Trip not found');
}

function findExpense(state: DemoState, tripId: string, expenseId: string): DemoExpense {
  const expense = state.expenses.find(e => e.id === expenseId && e.tripId === tripId);
  return expense ?? fail(404, 'Expense not found');
}

function userName(state: DemoState, userId: string): string | undefined {
  const user = state.users[userId];
  return user ? user.display_name || user.email : undefined;
}

function locate(destination: string): [number, number] | null {
  return DEMO_PLACES[destination.trim().toLowerCase()] ?? null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

function tripSpent(state: DemoState, tripId: string): number {
  return round2(state.expenses.filter(e => e.tripId === tripId).reduce((sum, e) => sum + e.amount, 0));
}

function tripDto(state: DemoState, trip: DemoTrip): TripDTO {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    budget: trip.budget,
    spent: tripSpent(state, trip.id),
    status: trip.status,
    currency: trip.currency,
    latitude: trip.latitude,
    longitude: trip.longitude,
    isCreator: trip.creatorId === state.userId,
  };
}

function expenseDto(state: DemoState, expense: DemoExpense): ExpenseDTO {
  const paidByYou = expense.paidBy === state.userId;
  return {
    id: expense.id,
    tripId: expense.tripId,
    category: expense.category,
    amount: expense.amount,
    description: expense.description,
    date: expense.date,
    paidBy: expense.paidBy,
    paidByName: userName(state, expense.paidBy),
    paidByAvatarUrl: state.users[expense.paidBy]?.avatar_url,
    paidByYou,
    yourShare: expense.splits.find(s => s.userId === state.userId)?.share,
    owedToYou: paidByYou ? expense.splits.filter(s => s.userId !== state.userId) : undefined,
  };
}

function memberDto(state: DemoState, userId: string): TripMember {
  const user = state.users[userId];
  return { userId, email: user?.email ?? '', displayName: user?.display_name ?? '', avatarUrl: user?.avatar_url };
}

// ── Settlement (same greedy matching as the backend) ─────────────────────────

function settlementBalances(state: DemoState, trip: DemoTrip): SettlementBalance[] {
  const expenses = state.expenses.filter(e => e.tripId === trip.id);
  return trip.memberIds.map(userId => {
    const paid = expenses.filter(e => e.paidBy === userId).reduce((sum, e) => sum + e.amount, 0);
    const owes = expenses.reduce((sum, e) => sum + (e.splits.find(s => s.userId === userId)?.share ?? 0), 0);
    const member = memberDto(state, userId);
    return {
      userId,
      email: member.email,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      paid: round2(paid),
      owes: round2(owes),
      net: round2(paid - owes),
      isYou: userId === state.userId,
    };
  });
}

export function computeTransactions(balances: SettlementBalance[]): SettlementTransaction[] {
  const creditors = balances.filter(b => b.net > 0.01).map(b => ({ userId: b.userId, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);
  const debtors = balances.filter(b => b.net < -0.01).map(b => ({ userId: b.userId, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    transactions.push({ from: debtors[i].userId, to: creditors[j].userId, amount: round2(amount) });
    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;
    if (debtors[i].remaining < 0.01) i++;
    if (creditors[j].remaining < 0.01) j++;
  }
  return transactions;
}

// ── Validation ────────────────────────────────────────────────────────────────

const CATEGORIES: ExpenseCategory[] = ['food', 'accommodation', 'transport', 'activities', 'souvenirs', 'other'];

function readSplits(body: Record<string, any>, amount: number): ExpenseSplitInput[] | null {
  const splits = body['splits'];
  if (!Array.isArray(splits) || splits.length === 0) return null;
  const clean = splits.map(s => ({ userId: String(s.userId), share: Number(s.share) }));
  const total = clean.reduce((sum, s) => sum + s.share, 0);
  if (Math.abs(total - amount) > 0.01) fail(400, DEMO_MESSAGES.splitTotal);
  return clean;
}

function readTripFields(body: Record<string, any>, trip: Partial<DemoTrip>): void {
  if (body['name'] !== undefined) trip.name = String(body['name']);
  if (body['destination'] !== undefined) trip.destination = String(body['destination']);
  if (body['country'] !== undefined) trip.country = String(body['country']);
  if (body['startDate'] !== undefined) trip.startDate = String(body['startDate']);
  if (body['endDate'] !== undefined) trip.endDate = String(body['endDate']);
  if (body['budget'] !== undefined) trip.budget = Number(body['budget']) || 0;
  if (body['status'] !== undefined) trip.status = body['status'];
  if (body['currency'] !== undefined) trip.currency = String(body['currency']);
  // `spent` is ignored: it's always the sum of the trip's expenses.
}

// ── Handlers ──────────────────────────────────────────────────────────────────

const getUser: Handler = state => ok({ user: state.users[state.userId] }, 'User retrieved successfully');

const updateProfile: Handler = (state, _p, body) => {
  const user = state.users[state.userId];
  if (body['display_name'] !== undefined) user.display_name = String(body['display_name']);
  if (body['username'] !== undefined) user.username = String(body['username']);
  return ok({ user }, 'Profile updated successfully');
};

const listTrips: Handler = state =>
  ok({ trips: state.trips.filter(t => t.memberIds.includes(state.userId)).map(t => tripDto(state, t)) }, 'Trips fetched successfully');

const getTrip: Handler = (state, [id]) => ok(tripDto(state, findTrip(state, id)), 'Trip fetched successfully');

const createTrip: Handler = (state, _p, body) => {
  if (!body['name'] || !body['destination'] || !body['startDate'] || !body['endDate']) fail(400, DEMO_MESSAGES.missingTripFields);
  const trip: DemoTrip = {
    id: newId('trip'),
    name: '',
    destination: '',
    country: '',
    startDate: '',
    endDate: '',
    budget: 0,
    status: 'planning',
    currency: 'USD',
    latitude: null,
    longitude: null,
    creatorId: state.userId,
    memberIds: [state.userId],
  };
  readTripFields(body, trip);
  [trip.latitude, trip.longitude] = locate(trip.destination) ?? [null, null];
  state.trips.push(trip);
  return ok(tripDto(state, trip), 'Trip created successfully', 201);
};

const updateTrip: Handler = (state, [id], body) => {
  const trip = findTrip(state, id);
  const oldDestination = trip.destination;
  readTripFields(body, trip);
  if (trip.destination !== oldDestination) [trip.latitude, trip.longitude] = locate(trip.destination) ?? [null, null];
  return ok(tripDto(state, trip), 'Trip updated successfully');
};

const locateTrips: Handler = state => {
  const trips = state.trips.filter(t => t.memberIds.includes(state.userId));
  return ok({ trips: trips.map(t => tripDto(state, t)), remaining: 0 }, 'Trips located successfully');
};

const deleteTrip: Handler = (state, [id]) => {
  const trip = findTrip(state, id);
  if (trip.creatorId !== state.userId) fail(404, 'Trip not found');
  if (isSampleId(trip.id)) fail(403, DEMO_MESSAGES.sampleDelete);
  state.trips = state.trips.filter(t => t.id !== id);
  state.expenses = state.expenses.filter(e => e.tripId !== id);
  state.tripInvites = state.tripInvites.filter(i => i.tripId !== id);
  return ok(null, 'Trip deleted successfully');
};

const listExpenses: Handler = (state, [tripId]) => {
  findTrip(state, tripId);
  const expenses = state.expenses
    .filter(e => e.tripId === tripId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => expenseDto(state, e));
  return ok(expenses, 'Expenses fetched successfully');
};

const createExpense: Handler = (state, _p, body) => {
  const { tripId, category, amount, date } = body;
  if (!tripId || !category || amount === undefined || !date) fail(400, DEMO_MESSAGES.missingExpenseFields);
  const trip = findTrip(state, tripId);
  const total = Number(amount);
  const paidBy = body['paidBy'] && trip.memberIds.includes(body['paidBy']) ? String(body['paidBy']) : state.userId;
  const expense: DemoExpense = {
    id: newId('expense'),
    tripId,
    category: CATEGORIES.includes(category) ? category : 'other',
    amount: total,
    description: String(body['description'] ?? ''),
    date: String(date),
    paidBy,
    // Without a split the payer carries the whole amount, so nobody owes anything for it.
    splits: readSplits(body, total) ?? [{ userId: paidBy, share: total }],
  };
  state.expenses.push(expense);
  return ok(expenseDto(state, expense), 'Expense created successfully', 201);
};

const updateExpense: Handler = (state, _p, body) => {
  const { tripId, expenseId } = body;
  findTrip(state, tripId);
  const expense = findExpense(state, tripId, expenseId);
  const total = body['amount'] !== undefined ? Number(body['amount']) : expense.amount;
  const splits = readSplits(body, total);
  if (splits && expense.paidBy !== state.userId) fail(403, DEMO_MESSAGES.splitPayerOnly);

  if (body['category'] !== undefined) expense.category = CATEGORIES.includes(body['category']) ? body['category'] : 'other';
  expense.amount = total;
  expense.description = String(body['description'] ?? '');
  if (body['date'] !== undefined) expense.date = String(body['date']);
  if (splits) {
    expense.splits = splits;
  } else if (Math.abs(expense.splits.reduce((sum, s) => sum + s.share, 0) - total) > 0.01) {
    // The amount changed without a new split: scale the old shares so they still add up.
    const oldTotal = expense.splits.reduce((sum, s) => sum + s.share, 0) || 1;
    expense.splits = expense.splits.map(s => ({ ...s, share: round2((s.share / oldTotal) * total) }));
    const drift = round2(total - expense.splits.reduce((sum, s) => sum + s.share, 0));
    const payerShare = expense.splits.find(s => s.userId === expense.paidBy) ?? expense.splits[0];
    if (payerShare) payerShare.share = round2(payerShare.share + drift);
  }
  return ok(expenseDto(state, expense), 'Expense updated successfully');
};

const deleteExpense: Handler = (state, _p, body) => {
  const { tripId, expenseId } = body;
  findTrip(state, tripId);
  findExpense(state, tripId, expenseId);
  if (isSampleId(expenseId)) fail(403, DEMO_MESSAGES.sampleDelete);
  state.expenses = state.expenses.filter(e => e.id !== expenseId);
  return ok(null, 'Expense deleted successfully');
};

/** Same ranges as the backend's RANGE_START: today, this week from Monday, this calendar month. */
function rangeStart(range: SpentRangeOption, now: Date): Date {
  const start = new Date(now);
  if (range === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (range === 'month') start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

const spentSummary: Handler = (state, _p, _b, now) => {
  const ranges: SpentRangeOption[] = ['today', 'week', 'month'];
  const summary = Object.fromEntries(ranges.map(r => [r, 0])) as Record<SpentRangeOption, number>;
  for (const expense of state.expenses) {
    if (expense.paidBy !== state.userId) continue;
    const date = new Date(expense.date);
    if (date > now) continue;
    for (const range of ranges) if (date >= rangeStart(range, now)) summary[range] += expense.amount;
  }
  return ok(summary, 'Expense summary fetched successfully');
};

const settlement: Handler = (state, [tripId]) => {
  const balances = settlementBalances(state, findTrip(state, tripId));
  const data: Settlement = { balances, transactions: computeTransactions(balances) };
  return ok(data, 'Settlement fetched successfully');
};

const myBalances: Handler = state => {
  const balances: TripBalance[] = state.trips
    .filter(t => t.memberIds.includes(state.userId))
    .map(trip => ({ tripId: trip.id, net: settlementBalances(state, trip).find(b => b.isYou)?.net ?? 0 }));
  return ok(balances, 'Balances fetched successfully');
};

const listMembers: Handler = (state, [tripId]) =>
  ok(findTrip(state, tripId).memberIds.map(id => memberDto(state, id)), 'Members fetched successfully');

const removeMember: Handler = (state, [tripId, userId]) => {
  const trip = findTrip(state, tripId);
  if (trip.creatorId !== state.userId) fail(403, DEMO_MESSAGES.creatorOnly);
  if (userId === trip.creatorId || !trip.memberIds.includes(userId)) fail(404, 'Member not found');
  if (isSampleId(userId)) fail(403, DEMO_MESSAGES.sampleDelete);
  trip.memberIds = trip.memberIds.filter(id => id !== userId);
  return ok(null, 'Member removed successfully');
};

const inviteDto = (invite: DemoState['tripInvites'][number]): TripInviteDTO => ({ ...invite });

const listInvites: Handler = (state, [tripId]) => {
  findTrip(state, tripId);
  return ok(state.tripInvites.filter(i => i.tripId === tripId).map(inviteDto), 'Invites fetched successfully');
};

const createInvite: Handler = (state, [tripId], body, now) => {
  const trip = findTrip(state, tripId);
  if (trip.creatorId !== state.userId) fail(403, DEMO_MESSAGES.creatorOnly);
  const email = String(body['email'] ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, DEMO_MESSAGES.invalidEmail);
  if (trip.memberIds.some(id => state.users[id]?.email.toLowerCase() === email)) fail(400, DEMO_MESSAGES.alreadyMember);
  if (state.tripInvites.some(i => i.tripId === tripId && i.status === 'pending' && i.email === email)) {
    fail(400, DEMO_MESSAGES.alreadyInvited);
  }
  // Nothing is emailed: the invite only exists in this tab.
  const invite = {
    id: newId('invite'),
    tripId,
    email,
    status: 'pending' as const,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEMO_INVITE_DAYS * 86_400_000).toISOString(),
  };
  state.tripInvites.push(invite);
  return ok(inviteDto(invite), 'Invite sent successfully', 201);
};

const revokeInvite: Handler = (state, [tripId, inviteId]) => {
  const trip = findTrip(state, tripId);
  if (trip.creatorId !== state.userId) fail(403, DEMO_MESSAGES.creatorOnly);
  const invite = state.tripInvites.find(i => i.id === inviteId && i.tripId === tripId) ?? fail(404, 'Invite not found');
  invite.status = 'revoked';
  return ok(null, 'Invite revoked successfully');
};

const listMyInvites: Handler = state => {
  const invites: MyInviteDTO[] = state.receivedInvites
    .filter(i => i.status === 'pending')
    .map(i => ({
      id: i.id,
      tripId: i.trip.id,
      tripName: i.trip.name,
      destination: i.trip.destination,
      country: i.trip.country,
      startDate: i.trip.startDate,
      endDate: i.trip.endDate,
      status: i.status,
      expiresAt: i.expiresAt,
    }));
  return ok(invites, 'Invites fetched successfully');
};

function findReceivedInvite(state: DemoState, inviteId: string) {
  const invite = state.receivedInvites.find(i => i.id === inviteId && i.status === 'pending');
  return invite ?? fail(404, 'Invite not found');
}

const acceptInvite: Handler = (state, [inviteId]) => {
  const invite = findReceivedInvite(state, inviteId);
  invite.status = 'accepted';
  state.trips.push({ ...invite.trip, memberIds: [...invite.trip.memberIds, state.userId] });
  state.expenses.push(...invite.expenses);
  return ok(null, 'Invite accepted');
};

const declineInvite: Handler = (state, [inviteId]) => {
  findReceivedInvite(state, inviteId).status = 'declined';
  return ok(null, 'Invite declined');
};

const notInDemo: Handler = () => fail(403, DEMO_MESSAGES.notInDemo);

// ── Routing ───────────────────────────────────────────────────────────────────

/** Static segments must come before `:param` routes that could match them (e.g. /trips/locate). */
const ROUTES: [method: string, pattern: string, handler: Handler][] = [
  ['GET', '/auth/user', getUser],
  ['PUT', '/auth/profile', updateProfile],
  ['GET', '/trips', listTrips],
  ['POST', '/trips', createTrip],
  ['GET', '/trips/balances/mine', myBalances],
  ['POST', '/trips/locate', locateTrips],
  ['GET', '/trips/:id', getTrip],
  ['PUT', '/trips/:id', updateTrip],
  ['DELETE', '/trips/:id', deleteTrip],
  ['GET', '/trips/:id/expenses', listExpenses],
  ['GET', '/trips/:id/settlement', settlement],
  ['GET', '/trips/:id/members', listMembers],
  ['DELETE', '/trips/:id/members/:userId', removeMember],
  ['GET', '/trips/:id/invites', listInvites],
  ['POST', '/trips/:id/invites', createInvite],
  ['DELETE', '/trips/:id/invites/:inviteId', revokeInvite],
  ['GET', '/invites', listMyInvites],
  ['POST', '/invites/:id/accept', acceptInvite],
  ['POST', '/invites/:id/decline', declineInvite],
  ['GET', '/expenses/summary', spentSummary],
  ['POST', '/expenses', createExpense],
  ['PUT', '/expenses', updateExpense],
  ['DELETE', '/expenses', deleteExpense],
];

function match(pattern: string, path: string): Params | null {
  const want = pattern.split('/');
  const got = path.split('/');
  if (want.length !== got.length) return null;
  const params: Params = [];
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) params.push(decodeURIComponent(got[i]));
    else if (want[i] !== got[i]) return null;
  }
  return params;
}

export function handleDemoRequest(state: DemoState, request: DemoRequest, now = new Date()): DemoResult {
  const path = request.path.replace(/\/+$/, '') || '/';
  const body = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, any>;
  for (const [method, pattern, handler] of ROUTES) {
    if (method !== request.method) continue;
    const params = match(pattern, path);
    if (params) return handler(state, params, body, now);
  }
  // Sign-up, password, email and avatar changes, and anything else without a demo version.
  return path.startsWith('/auth/') ? notInDemo(state, [], body, now) : fail(404, DEMO_MESSAGES.notFound);
}
