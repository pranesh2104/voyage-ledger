import { Component, computed, effect, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-members-dialog',
  standalone: true,
  imports: [FormsModule, DialogComponent, ButtonComponent, AvatarComponent, LoaderComponent],
  templateUrl: './members-dialog.component.html',
})
export class MembersDialogComponent {
  readonly dialogService = inject(MembersDialogService);
  private readonly authService = inject(AuthService);
  private readonly inviteService = inject(TripInviteService);
  private readonly snackbarService = inject(SnackbarService);

  readonly members = signal<TripMember[]>([]);
  readonly invites = signal<TripInvite[]>([]);
  readonly isLoading = signal(false);
  readonly inviteEmail = signal('');
  readonly isSendingInvite = signal(false);

  readonly currentUserId = computed(() => this.authService.currentuser()?.id ?? null);
  readonly pendingInvites = computed(() => this.invites().filter((i) => i.status === 'pending'));

  constructor() {
    effect(() => {
      const trip = this.dialogService.trip();
      if (trip) this.load(trip.id, !!trip.isCreator);
    });
  }

  private load(tripId: string, isCreator: boolean): void {
    this.members.set([]);
    this.invites.set([]);
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
