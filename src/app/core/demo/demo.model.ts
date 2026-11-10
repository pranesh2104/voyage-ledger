import { ExpenseCategory, ExpenseSplitInput, InviteStatus, Trip } from 'voyage-lib';

export interface DemoUser {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string;
}

export interface DemoTrip {
  id: string;
  name: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: Trip['status'];
  currency: string;
  latitude: number | null;
  longitude: number | null;
  creatorId: string;
  memberIds: string[];
}

export interface DemoExpense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  paidBy: string;
  splits: ExpenseSplitInput[];
}

/** An invite the demo user sent for one of their trips. */
export interface DemoTripInvite {
  id: string;
  tripId: string;
  email: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** An invite the demo user received. Accepting it adds the trip and its expenses. */
export interface DemoReceivedInvite {
  id: string;
  status: InviteStatus;
  expiresAt: string;
  trip: DemoTrip;
  expenses: DemoExpense[];
}

/** Everything the demo shows. Kept in sessionStorage, so it lasts until the tab is closed. */
export interface DemoState {
  version: number;
  userId: string;
  users: Record<string, DemoUser>;
  trips: DemoTrip[];
  expenses: DemoExpense[];
  tripInvites: DemoTripInvite[];
  receivedInvites: DemoReceivedInvite[];
}

export interface DemoRequest {
  method: string;
  /** Path without the query string, e.g. "/trips/sample-trip-goa/expenses". */
  path: string;
  body: unknown;
}

export interface DemoResult {
  status: number;
  data: unknown;
  message?: string;
}
