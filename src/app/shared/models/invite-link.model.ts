/** Why a link can't be used any more. Matches the backend's invite_link_status(). */
export type UnusableInviteLinkReason = 'revoked' | 'expired' | 'used_up';

/** The trip creator's view of the trip's invite link (GET/POST /trips/:tripId/invite-link). */
export interface InviteLink {
  token: string;
  /** Revoked links are never returned, so this is never 'revoked'. */
  status: 'valid' | Exclude<UnusableInviteLinkReason, 'revoked'>;
  expiresAt: string;
  /** null = no limit. */
  maxUses: number | null;
  useCount: number;
  createdAt: string;
}

export interface CreateInviteLinkOptions {
  expiresInDays: number;
  maxUses: number | null;
}

/** What the public /join page shows for a usable link (GET /invite-links/:token). */
export interface InviteLinkPreview {
  status: 'valid';
  tripName: string;
  destination: string;
  country: string | null;
  startDate: string;
  endDate: string;
  memberCount: number;
  /** First name only; null if the creator has no name set. */
  inviterName: string | null;
  expiresAt: string;
}

/** Body of the 410 response for a link that can't be used. */
export interface UnusableInviteLink {
  status: UnusableInviteLinkReason;
  inviterName: string | null;
}

export interface AcceptInviteLinkResult {
  tripId: string;
  alreadyMember: boolean;
}
