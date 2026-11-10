import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { InviteLinkPreview } from '@shared/models/invite-link.model';
import {
  formatTripDates,
  httpStatusFor,
  joinPageMeta,
  joinStateFromError,
  joinStateFromPreview,
} from './join-page.util';

const preview: InviteLinkPreview = {
  status: 'valid',
  tripName: 'Goa Trip',
  destination: 'Goa',
  country: 'India',
  startDate: '2026-12-12',
  endDate: '2026-12-16',
  memberCount: 4,
  inviterName: 'Pranesh',
  expiresAt: '2026-12-01T00:00:00Z',
};

const httpError = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('joinStateFromError', () => {
  it('maps 404 to not_found', () => {
    expect(joinStateFromError('t', httpError(404))).toEqual({ kind: 'not_found', token: 't' });
  });

  it('maps 410 to unusable, with the reason and inviter from the body', () => {
    const error = httpError(410, { data: { status: 'expired', inviterName: 'Pranesh' } });
    expect(joinStateFromError('t', error)).toEqual({ kind: 'unusable', token: 't', reason: 'expired', inviterName: 'Pranesh' });
  });

  it('treats a 410 without a usable body as an error', () => {
    expect(joinStateFromError('t', httpError(410, 'Gone')).kind).toBe('error');
  });

  it('maps server and network failures to error', () => {
    expect(joinStateFromError('t', httpError(500)).kind).toBe('error');
    expect(joinStateFromError('t', httpError(0)).kind).toBe('error');
  });

  // Regression: a timed-out request used to be shown as a valid invite (HTTP 200).
  it('maps an RxJS timeout to error, never to a valid invite', () => {
    expect(joinStateFromError('t', new TimeoutError())).toEqual({ kind: 'error', token: 't' });
  });
});

describe('httpStatusFor', () => {
  it('gives each state its own status code', () => {
    expect(httpStatusFor(joinStateFromPreview('t', preview))).toBe(200);
    expect(httpStatusFor({ kind: 'unusable', token: 't', reason: 'revoked', inviterName: null })).toBe(410);
    expect(httpStatusFor({ kind: 'not_found', token: 't' })).toBe(404);
    expect(httpStatusFor({ kind: 'error', token: 't' })).toBe(503);
  });
});

describe('formatTripDates', () => {
  it('shortens a range inside one month', () => {
    expect(formatTripDates('2026-12-12', '2026-12-16')).toBe('12–16 Dec 2026');
  });

  it('shows both months inside one year', () => {
    expect(formatTripDates('2026-11-28', '2026-12-02')).toBe('28 Nov – 2 Dec 2026');
  });

  it('shows both years across New Year', () => {
    expect(formatTripDates('2026-12-28', '2027-01-02')).toBe('28 Dec 2026 – 2 Jan 2027');
  });

  it('shows a single date for a one-day trip', () => {
    expect(formatTripDates('2026-12-12', '2026-12-12')).toBe('12 Dec 2026');
  });

  it('returns an empty string for bad dates', () => {
    expect(formatTripDates('nope', '2026-12-12')).toBe('');
  });
});

describe('joinPageMeta', () => {
  it('names the inviter, place, dates and members for a valid link', () => {
    expect(joinPageMeta(joinStateFromPreview('t', preview))).toEqual({
      title: 'Join Goa Trip',
      description:
        'Pranesh invited you to Goa Trip · Goa, India · 12–16 Dec 2026 · 4 members. Split trip expenses together on Voyage Ledger.',
    });
  });

  it('copes with no inviter name, no country and a single member', () => {
    const meta = joinPageMeta(
      joinStateFromPreview('t', { ...preview, inviterName: null, country: null, memberCount: 1 }),
    );
    expect(meta.description).toBe(
      "You're invited to Goa Trip · Goa · 12–16 Dec 2026 · 1 member. Split trip expenses together on Voyage Ledger.",
    );
  });

  it('reveals nothing about the trip for an unusable link', () => {
    const meta = joinPageMeta({ kind: 'unusable', token: 't', reason: 'revoked', inviterName: null });
    expect(meta).toEqual({
      title: 'This invite link was turned off',
      description: 'Ask the trip organiser for a new invite link.',
    });
  });
});
