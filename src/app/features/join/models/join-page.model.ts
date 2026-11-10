import { InviteLinkPreview, UnusableInviteLinkReason } from '@shared/models/invite-link.model';

/**
 * Everything the /join/:token page can show. Worked out once by the route resolver, on the
 * server during SSR, so the HTML, the HTTP status and the link-preview tags all agree.
 */
export type JoinPageState =
  | { kind: 'valid'; token: string; preview: InviteLinkPreview }
  | { kind: 'unusable'; token: string; reason: UnusableInviteLinkReason; inviterName: string | null }
  | { kind: 'not_found'; token: string }
  /** The API couldn't be reached or failed. Worth a retry, unlike the others. */
  | { kind: 'error'; token: string };

/** Whether the visitor is signed in. Only known in the browser (the SSR server sends no cookies). */
export type JoinAuthState = 'unknown' | 'signed_out' | 'signed_in';

/** The <title>, description and Open Graph text for a state. */
export interface JoinPageMeta {
  title: string;
  description: string;
}
