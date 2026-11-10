/** "Expires in" choices for a new invite link (the API allows 1–30 days). */
export const INVITE_LINK_EXPIRY_OPTIONS = [
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
] as const;

/** "Max uses" choices for a new invite link (the API allows no limit, or 1–100). */
export const INVITE_LINK_MAX_USES_OPTIONS: readonly { label: string; value: number | null }[] = [
  { label: 'No limit', value: null },
  { label: '5 people', value: 5 },
  { label: '10 people', value: 10 },
  { label: '25 people', value: 25 },
];

export const INVITE_LINK_DEFAULT_EXPIRY_DAYS = 7;

/** How long the Copy button says "Copied". */
export const COPIED_FEEDBACK_MS = 2000;
