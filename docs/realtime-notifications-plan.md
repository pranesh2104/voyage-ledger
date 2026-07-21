# Real-time notifications + live data sync (Socket.IO)

## Context

Right now the app is fully request/response: if someone else accepts/declines your trip invite, adds an expense you owe on, or edits/deletes a trip you're both on, you only find out on your next manual reload. This plan covers two related things:

1. A **notification bell** in the shell showing: new invites received, responses to invites you sent, and "you owe money" when someone adds an expense that splits to you.
2. **Live data sync**: expense create/update/delete and trip update/delete reflected instantly in open views (dashboard, trip detail) for other affected members, no reload.

`socket.io` is already a resolved dependency in `voyage-ledger-service`'s `package.json`/lockfile but is never instantiated — this build wires it up for the first time. No `socket.io-client` exists yet in any frontend repo.

Two decisions already confirmed with the user:
- New-invite notifications should also be live (not just visible next time "My Invites" loads), which requires resolving the invitee's email to an existing account id.
- Schema changes are handed over as a SQL script for the user to run themselves in the Supabase SQL editor — not executed automatically.

## Design overview

**Two kinds of events — keep them distinct:**
- *Data-sync events* (ephemeral, no persistence): `expense:created`, `expense:updated`, `expense:deleted`, `trip:updated`, `trip:deleted`. These just keep open views fresh.
- *Persisted notification event*: a single `notification:new` event, backed by a new `notifications` table, covering exactly the three types the user asked for: `invite_received`, `invite_responded`, `expense_owe`. The bell reads/subscribes to this; nothing else gets persisted (edits/deletes to expenses or trips are sync-only, not notification-worthy — otherwise the bell gets noisy).

**Rooms:** one room per user (`user:{userId}`), joined right after the socket handshake authenticates. No per-trip rooms. For any trip-scoped event, the backend looks up that trip's member list (the existing `get_trip_members` RPC, already used in `invite.controller.js`'s `listMembers`) and emits individually to each member's `user:{id}` room, **excluding the actor** who caused the change (they already have the result from their own HTTP response). This is simpler than per-trip subscribe/unsubscribe and works the same whether a client has the dashboard open (many trips) or one trip's detail page.

**Auth:** the existing auth is cookie-based (httpOnly `access_token`/`refresh_token`, verified via `supabase.auth.getUser`/`refreshSession` in `auth.middleware.js`). Socket.IO needs the same verification at handshake time, reading cookies off `socket.handshake.headers.cookie` instead of Express's `req.cookies`. The verify-or-refresh logic in `auth.middleware.js` should be extracted into a small shared, framework-agnostic helper that both the existing Express middleware and the new Socket.IO middleware call — avoids duplicating the refresh-fallback logic.

**Why RPCs, not raw inserts, for notifications:** the `notifications` table's RLS should only let a user SELECT/UPDATE their *own* rows. Writing a notification always means one user's action causing a row to be inserted for a *different* user (the trip creator, the other split participants) — that cross-user write has to go through a SECURITY DEFINER RPC, exactly like `accept_trip_invite` and `remove_trip_member` already do for other cross-user actions in this schema. Two new RPCs are needed:
- `create_notification(p_user_id, p_type, p_message, p_trip_id, p_related_id)` — inserts one row, bypassing RLS safely inside a controlled function.
- `get_user_id_by_email(p_email)` — resolves an invitee's email to their account id (or null if they don't have one yet), needed only for the live "invite received" push. This does add a narrow, server-side-only enumeration surface (any trip creator can now probe "does an account exist for this email" for *any* address, not just email addresses already implicated by the existing per-trip pending-invite 409 check) — worth being aware of, but it's only ever called internally right after an authorized `createInvite` call, never exposed as its own endpoint.

**Settlement/balances are not pushed over the socket.** They're already dedicated RPC-backed endpoints (`SettlementService.getSettlement`/`getMyBalances`). Duplicating that computation into socket payloads risks drift from the authoritative numbers. Instead, when a relevant `expense:*`/`trip:updated` event arrives for a trip currently in view, the frontend just re-invokes the existing settlement/balance HTTP calls to refresh those signals — a cheap refetch, not a full push.

## Backend changes (`voyage-ledger-service`)

**New `src/sockets/` module:**
- `io-instance.js` — a `setIO`/`getIO` singleton so controllers can reach the Socket.IO server instance without a circular import back into `server.js`.
- `socket-auth.middleware.js` — the `io.use(...)` handshake middleware described above.
- `index.js` — `initSockets(io)`: wires the auth middleware and the `connection` handler that does `socket.join(`user:${socket.data.user.id}`)`.
- `emit.util.js` — two small helpers: `notifyTripMembers(io, members, actorId, event, payload)` (loops the member list, skips the actor) and `notifyUser(io, userId, event, payload)` (single-target, used for notifications).

**`src/server.js`:** switch from `app.listen(PORT)` to `http.createServer(app)` + `new Server(httpServer, { cors: { origin: CORS_ORIGIN, credentials: true } })`, call `initSockets(io)` + `setIO(io)`, then `httpServer.listen(...)`.

**`src/controllers/expense.controller.js`:**
- `createExpense` — after the existing best-effort `expense_splits` insert: fetch trip members, emit `expense:created` to all members except the actor; for each split participant other than the payer, call `create_notification` (type `expense_owe`) and emit `notification:new` to them; re-fetch the trip row (its `spent` total changed) and emit `trip:updated` to all members except the actor so budget numbers stay live everywhere without the frontend re-deriving them.
- `updateExpense` / `deleteExpense` — same shape, minus the `expense_owe` notification: just `expense:updated`/`expense:deleted` + `trip:updated`, to all members except the actor.

**`src/controllers/trip.controller.js`:**
- `updateTrip` — emit `trip:updated` to all members except the actor.
- `deleteTrip` — capture the member list and trip name *before* the delete (the row won't exist to re-query after), emit `trip:deleted` (`{tripId, name}`) to all members except the actor once the delete succeeds.
- `createTrip` — no emit needed; only the creator is a member at creation time.

**`src/controllers/invite.controller.js`:**
- `createInvite` — after the invite row is created and the existing Resend email is sent, call `get_user_id_by_email`; if it resolves, call `create_notification` (type `invite_received`) and emit `notification:new` to that user. If it doesn't resolve, do nothing further (the email and the eventual "My Invites" page already cover that case).
- `acceptInvite` / `declineInvite` — neither currently knows the trip or its creator; add a lookup (`trip_invites` → `trips`, for `trip_id`/`name`/creator `user_id`) before or via the existing RPC's return value, then `create_notification` (type `invite_responded`) + `notification:new` to the creator.

## Frontend changes

**`voyage-lib`** (shared across both apps):
- Add `socket.io-client` as a dependency.
- New `SocketService`: connects once (`io(apiUrl, { withCredentials: true })`, idempotent `connect()`/`disconnect()`), exposes a generic `on<T>(event): Observable<T>`. Uses the `EnvironmentToken` that's already defined in this library but currently unused by anyone.
- New `NotificationService` (same `SharedHttpService` pattern as the other domain services): `listMine()`, `markRead(id)`, `markAllRead()`.
- New `Notification`/`NotificationType` model.
- Re-export all of the above from `lib/voyage-lib.ts`, matching how every other service/model is exposed today.

**`voyage-ledger`** (host shell):
- `app.config.ts` — provide `EnvironmentToken` (same `environment.apiUrl` value already used for `API_BASE_URL`) so `SocketService` has something to inject. Additive; doesn't touch the existing HTTP interceptor wiring.
- `layout.component.ts`/`.html` — connect the socket once (constructor/`ngOnInit`, since this component only renders on authenticated routes), disconnect in the existing `signOut()`. Add a new notification-bell component next to `<app-theme-toggle />`, reusing the existing user-menu dropdown pattern already in this file (relative/absolute panel + backdrop-click-outside) for visual/interaction consistency. On init it loads `listMine()` for the badge/list; it subscribes to `notification:new` to prepend live and bump the unread count.
- `dashboard.component.ts` — subscribe to `trip:updated`/`trip:deleted`, reusing the exact in-place-update pattern the existing `onStatusChange` handler already uses on the `trips` signal.
- `my-invites.component.ts` — subscribe to `notification:new`; on `type === 'invite_received'`, just call the existing `listMyInvites()` again rather than trying to reconstruct a full invite row from a bare notification payload.

**`voyage-expense`:**
- `expense-details.component.ts` — subscribe to `expense:created/updated/deleted` filtered to the currently open `tripId`, updating the `dailyExpenses` signal in place (bucketed by day, reusing whichever grouping logic `ExpenseService`/`getDailyExpenses` already applies on initial load — not reinventing it); subscribe to `trip:updated` (filtered) to refresh the `trip` signal; subscribe to `trip:deleted` (filtered) to navigate back with a snackbar if the open trip disappears out from under the viewer. On any of these, also re-invoke the existing `SettlementService.getSettlement` call to keep `settlement` current (see "not pushed over the socket" above).

All socket subscriptions use `takeUntilDestroyed()`, matching modern Angular signal-based cleanup conventions already implied by this codebase's style.

## SQL to hand the user (Supabase SQL editor — not run automatically)

A single script covering:
1. `notifications` table: `id`, `user_id` (FK to `auth.users`), `type` (`invite_received` | `invite_responded` | `expense_owe`), `message`, `trip_id` (FK to `trips`, nullable-safe on delete), `related_id` (the invite/expense id the notification is about), `read_at`, `created_at`. Index on `(user_id, created_at desc)` for the bell's list query.
2. RLS enabled, with SELECT and UPDATE (mark-read) policies scoped to `auth.uid() = user_id`. Deliberately **no INSERT policy** — all writes go through the RPC below.
3. `create_notification(...)` — SECURITY DEFINER RPC, the only way a row gets inserted.
4. `get_user_id_by_email(p_email)` — SECURITY DEFINER RPC, returns the matching `auth.users.id` or null.

This script gets written out in full as its own clearly-delimited deliverable (not mixed into the code changes) for the user to paste and run themselves.

## Verification (manual, end-to-end — no automated test harness exists for this repo today)

Two browser sessions logged in as two different members of the same trip:
1. **Expense create/update/delete** — add an expense as user A splitting to user B; confirm user B's open trip-detail view updates the expense list and budget numbers without reloading, and that B's bell shows a new "you owe" notification. Edit and delete the expense as A; confirm B's view updates live both times, with no new bell notification for the edit/delete.
2. **Trip update/delete** — rename or rebudget the trip as A; confirm B's dashboard card and (if open) trip-detail header update live. Delete the trip as A; confirm B is bumped out of the trip-detail view (if open) with a message, and the card disappears from B's dashboard.
3. **Invites** — A invites an existing user C (already has an account); confirm C gets a live bell notification and the pending invite when they check "My Invites" (should already be there, or appear live if that page is open). C accepts; confirm A gets a live "accepted" bell notification. Repeat with decline. Invite a brand-new email with no account; confirm no crash/error and no live push (only the existing email + future in-app visibility once they sign up).
4. Confirm a logged-out/second-tab reload still shows the full unread notification history via `listMine()` (i.e., persistence survives a fresh connection, not just the live session).

## Status

Planning complete, approved. Implementation not yet started.
