import { Component, computed, DestroyRef, DOCUMENT, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideLink } from '@lucide/angular';
import { FormsModule } from '@angular/forms';
import {
  AvatarComponent,
  ButtonComponent,
  DialogComponent,
  ErrorInterface,
  LoaderComponent,
  SnackbarService,
  TripInvite,
  TripInviteService,
  TripMember,
} from 'voyage-lib';
import { AuthService } from '../../../auth/services/auth';
import { MembersDialogService } from '@core/services/members-dialog.service';
import { InviteLinkService } from '@core/services/invite-link.service';
import { DemoStore } from '@core/demo/demo-store.service';
import { InviteLink } from '@shared/models/invite-link.model';
import {
  COPIED_FEEDBACK_MS,
  INVITE_LINK_DEFAULT_EXPIRY_DAYS,
  INVITE_LINK_EXPIRY_OPTIONS,
  INVITE_LINK_MAX_USES_OPTIONS,
} from '../../constants/invite-link.constant';
import { copyWhenReady } from '../../utils/clipboard.util';

@Component({
  selector: 'app-members-dialog',
  standalone: true,
  imports: [FormsModule, DatePipe, LucideLink, DialogComponent, ButtonComponent, AvatarComponent, LoaderComponent],
  templateUrl: './members-dialog.component.html',
})
export class MembersDialogComponent {
  readonly dialogService = inject(MembersDialogService);
  private readonly authService = inject(AuthService);
  private readonly inviteService = inject(TripInviteService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly inviteLinkService = inject(InviteLinkService);
  private readonly demoStore = inject(DemoStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly members = signal<TripMember[]>([]);
  readonly invites = signal<TripInvite[]>([]);
  readonly isLoading = signal(false);
  readonly inviteEmail = signal('');
  readonly isSendingInvite = signal(false);

  readonly currentUserId = computed(() => this.authService.currentuser()?.id ?? null);
  readonly pendingInvites = computed(() => this.invites().filter((i) => i.status === 'pending'));

  // ── Invite link ──────────────────────────────────────────────────────────────
  readonly expiryOptions = INVITE_LINK_EXPIRY_OPTIONS;
  readonly maxUsesOptions = INVITE_LINK_MAX_USES_OPTIONS;

  readonly inviteLink = signal<InviteLink | null>(null);
  readonly isLinkBusy = signal(false);
  readonly linkExpiryDays = signal<number>(INVITE_LINK_DEFAULT_EXPIRY_DAYS);
  readonly linkMaxUses = signal<number | null>(null);
  readonly copied = signal(false);
  private copiedTimer?: ReturnType<typeof setTimeout>;

  /** Creator only, and not in the demo (a link is for sharing with real people). */
  readonly showInviteLink = computed(() => !!this.dialogService.trip()?.isCreator && !this.demoStore.active());

  /** Built from this site's own origin, so it also works on localhost and preview deploys. */
  readonly inviteUrl = computed(() => {
    const link = this.inviteLink();
    return link ? `${this.document.location.origin}/join/${link.token}` : '';
  });

  readonly linkUsage = computed(() => {
    const link = this.inviteLink();
    if (!link) return '';
    const joined = `${link.useCount} joined`;
    return link.maxUses === null ? joined : `${link.useCount} of ${link.maxUses} joined`;
  });

  /** Web Share API (mobile): opens the phone's share sheet, e.g. straight to WhatsApp. */
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  constructor() {
    effect(() => {
      const trip = this.dialogService.trip();
      if (trip) this.load(trip.id, !!trip.isCreator);
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

  private load(tripId: string, isCreator: boolean): void {
    this.members.set([]);
    this.invites.set([]);
    this.inviteLink.set(null);
    this.copied.set(false);
    this.isLoading.set(true);

    this.inviteService.listMembers(tripId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackbarService.error('Failed to load members.', { duration: 4000 });
      },
    });

    if (isCreator) {
      this.inviteService.listInvites(tripId).subscribe({
        next: (invites) => this.invites.set(invites),
        error: () => this.snackbarService.error('Failed to load invites.', { duration: 4000 }),
      });
    }

    if (this.showInviteLink()) {
      this.inviteLinkService.getForTrip(tripId).subscribe({
        next: (link) => this.inviteLink.set(link),
        error: () => this.snackbarService.error('Failed to load the invite link.', { duration: 4000 }),
      });
    }
  }

  /**
   * Creates the trip's invite link, or replaces it ("Reset"): the old link stops working.
   * The new link is copied to the clipboard automatically, ready to paste into a group chat.
   */
  createLink(): void {
    const trip = this.dialogService.trip();
    if (!trip || this.isLinkBusy()) return;

    const replacing = this.inviteLink()?.status === 'valid';
    this.isLinkBusy.set(true);
    this.copied.set(false);

    // The copy has to start now, while this click still counts as a user gesture (see copyWhenReady).
    let resolveUrl!: (url: string) => void;
    let rejectUrl!: (reason: unknown) => void;
    const url = new Promise<string>((resolve, reject) => {
      resolveUrl = resolve;
      rejectUrl = reject;
    });
    const copiedToClipboard = copyWhenReady(url);

    this.inviteLinkService
      .create(trip.id, { expiresInDays: this.linkExpiryDays(), maxUses: this.linkMaxUses() })
      .subscribe({
        next: async (link) => {
          this.isLinkBusy.set(false);
          this.inviteLink.set(link);
          resolveUrl(this.inviteUrl());

          const copied = await copiedToClipboard;
          if (copied) this.showCopied();
          const created = replacing ? 'New link created. The old one no longer works.' : 'Invite link created.';
          this.snackbarService.success(copied ? `${created} Copied to clipboard.` : created, { duration: 3000 });
        },
        error: (error: { error: ErrorInterface }) => {
          this.isLinkBusy.set(false);
          rejectUrl(error);
          this.snackbarService.error(error?.error?.message || 'Failed to create the invite link.', { duration: 4000 });
        },
      });
  }

  revokeLink(): void {
    const trip = this.dialogService.trip();
    if (!trip || this.isLinkBusy()) return;

    this.isLinkBusy.set(true);
    this.inviteLinkService.revoke(trip.id).subscribe({
      next: () => {
        this.isLinkBusy.set(false);
        this.inviteLink.set(null);
        this.snackbarService.success('Invite link turned off.', { duration: 3000 });
      },
      error: () => {
        this.isLinkBusy.set(false);
        this.snackbarService.error('Failed to turn off the invite link.', { duration: 4000 });
      },
    });
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteUrl());
      this.showCopied();
    } catch {
      // Clipboard can be blocked (permissions, non-HTTPS); the field is selectable as a fallback.
      this.snackbarService.error("Couldn't copy. Select the link and copy it manually.", { duration: 4000 });
    }
  }

  /** Shows "Copied" on the Copy button for a moment. */
  private showCopied(): void {
    this.copied.set(true);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
  }

  async shareLink(): Promise<void> {
    const trip = this.dialogService.trip();
    try {
      await navigator.share({
        title: trip ? `Join ${trip.name} on Voyage Ledger` : 'Join my trip on Voyage Ledger',
        url: this.inviteUrl(),
      });
    } catch {
      // Closing the share sheet rejects too; nothing to report.
    }
  }

  sendInvite(): void {
    const trip = this.dialogService.trip();
    const email = this.inviteEmail().trim();
    if (!trip || !email) return;

    this.isSendingInvite.set(true);
    this.inviteService.createInvite(trip.id, email).subscribe({
      next: (invite) => {
        this.isSendingInvite.set(false);
        this.inviteEmail.set('');
        this.invites.update((invites) => [invite, ...invites]);
        this.snackbarService.success('Invite sent.', { duration: 3000 });
      },
      error: (error: { error: ErrorInterface }) => {
        this.isSendingInvite.set(false);
        this.snackbarService.error(error?.error?.message || 'Failed to send invite.', { duration: 4000 });
      },
    });
  }

  revokeInvite(inviteId: string): void {
    const trip = this.dialogService.trip();
    if (!trip) return;

    this.inviteService.revokeInvite(trip.id, inviteId).subscribe({
      next: () => {
        this.invites.update((invites) => invites.map((i) => (i.id === inviteId ? { ...i, status: 'revoked' } : i)));
        this.snackbarService.success('Invite revoked.', { duration: 3000 });
      },
      error: () => this.snackbarService.error('Failed to revoke invite.', { duration: 4000 }),
    });
  }

  removeMember(userId: string): void {
    const trip = this.dialogService.trip();
    if (!trip) return;

    this.inviteService.removeMember(trip.id, userId).subscribe({
      next: () => {
        this.members.update((members) => members.filter((m) => m.userId !== userId));
        this.snackbarService.success('Member removed.', { duration: 3000 });
      },
      error: () => this.snackbarService.error('Failed to remove member.', { duration: 4000 }),
    });
  }

  close(): void {
    this.dialogService.close();
  }
}
