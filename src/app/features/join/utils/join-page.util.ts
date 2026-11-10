import { HttpErrorResponse } from '@angular/common/http';
import { InviteLinkPreview, UnusableInviteLink } from '@shared/models/invite-link.model';
import { JoinPageMeta, JoinPageState } from '../models/join-page.model';

/** Page state for a successful preview request. */
export function joinStateFromPreview(token: string, preview: InviteLinkPreview): JoinPageState {
  return { kind: 'valid', token, preview };
}

/**
 * Page state for a failed preview (or accept) request. Only a 404 or a 410 says something
 * about the link; anything else (5xx, network failure, RxJS TimeoutError) is 'error'.
 */
export function joinStateFromError(token: string, error: unknown): JoinPageState {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404) return { kind: 'not_found', token };
    if (error.status === 410) {
      const body = (error.error as { data?: UnusableInviteLink } | null)?.data;
      if (body?.status) return { kind: 'unusable', token, reason: body.status, inviterName: body.inviterName ?? null };
    }
  }
  return { kind: 'error', token };
}

/**
 * The HTTP status the SSR server answers with. A real status (not "200 with an error message")
 * means crawlers, link-preview bots and monitoring all see what actually happened.
 */
export function httpStatusFor(state: JoinPageState): number {
  switch (state.kind) {
    case 'valid':
      return 200;
    case 'unusable':
      return 410; // Gone: it existed, and won't work again
    case 'not_found':
      return 404;
    case 'error':
      return 503; // the API is down; try again later
  }
}

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * "12–16 Dec 2026", "28 Dec 2026 – 2 Jan 2027", or "12 Dec 2026" for a one-day trip.
 * Dates are calendar dates (YYYY-MM-DD), so they're formatted in UTC: that way the server
 * and the browser print the same day whatever their time zone.
 */
export function formatTripDates(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  if (startDate.slice(0, 10) === endDate.slice(0, 10)) return DAY_MONTH_YEAR.format(start);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) return `${start.getUTCDate()}–${DAY_MONTH_YEAR.format(end)}`;
  if (sameYear) return `${DAY_MONTH.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
  return `${DAY_MONTH_YEAR.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
}

const DAY_MONTH_ONLY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });

/**
 * One end of the trip for the ticket's Starts / Ends row: { day: "12 Dec", detail: "Sat, 2026" }.
 * UTC for the same reason as formatTripDates. Null for a date that can't be parsed.
 */
export function formatTripEndpoint(date: string): { day: string; detail: string } | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return { day: DAY_MONTH_ONLY.format(d), detail: `${WEEKDAY.format(d)}, ${d.getUTCFullYear()}` };
}

export function formatPlace(destination: string, country: string | null): string {
  return country ? `${destination}, ${country}` : destination;
}

const UNUSABLE_TITLES = {
  revoked: 'This invite link was turned off',
  expired: 'This invite link has expired',
  used_up: 'This invite link is full',
} as const;

/** Page title and description, also used for the WhatsApp / Slack / Twitter preview card. */
export function joinPageMeta(state: JoinPageState): JoinPageMeta {
  switch (state.kind) {
    case 'valid': {
      const p = state.preview;
      const who = p.inviterName ? `${p.inviterName} invited you to` : "You're invited to";
      const members = p.memberCount === 1 ? '1 member' : `${p.memberCount} members`;
      return {
        title: `Join ${p.tripName}`,
        description: `${who} ${p.tripName} · ${formatPlace(p.destination, p.country)} · ${formatTripDates(p.startDate, p.endDate)} · ${members}. Split trip expenses together on Voyage Ledger.`,
      };
    }
    case 'unusable':
      return {
        title: UNUSABLE_TITLES[state.reason],
        description: `Ask ${state.inviterName ?? 'the trip organiser'} for a new invite link.`,
      };
    case 'not_found':
      return { title: 'Invite link not found', description: 'This invite link does not exist. Check that it was copied in full.' };
    case 'error':
      return { title: 'Trip invitation', description: "You've been invited to a trip on Voyage Ledger." };
  }
}

export function unusableTitle(reason: keyof typeof UNUSABLE_TITLES): string {
  return UNUSABLE_TITLES[reason];
}
