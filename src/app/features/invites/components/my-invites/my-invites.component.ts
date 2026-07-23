import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DateFormatPipe, ErrorInterface, LoaderComponent, MyInvite, SnackbarService, TripInviteService } from 'voyage-lib';

@Component({
  selector: 'app-my-invites',
  standalone: true,
  imports: [LoaderComponent, DateFormatPipe],
  templateUrl: './my-invites.component.html',
})
export class MyInvitesComponent implements OnInit {
  private readonly inviteService = inject(TripInviteService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly router = inject(Router);

  readonly invites = signal<MyInvite[]>([]);
  readonly isLoading = signal(true);
  readonly respondingId = signal<string | null>(null);

  ngOnInit(): void {
    this.inviteService.listMyInvites().subscribe({
      next: (invites) => {
        this.invites.set(invites);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackbarService.error('Failed to load invitations.', { duration: 4000 });
      },
    });
  }

  accept(invite: MyInvite): void {
    this.respondingId.set(invite.id);
    this.inviteService.acceptInvite(invite.id).subscribe({
      next: () => {
        this.respondingId.set(null);
        this.invites.update((invites) => invites.filter((i) => i.id !== invite.id));
        this.snackbarService.success(`You've joined "${invite.tripName}".`, { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (error: { error: ErrorInterface }) => {
        this.respondingId.set(null);
        this.snackbarService.error(error?.error?.message || 'Failed to accept invitation.', { duration: 4000 });
      },
    });
  }

  decline(invite: MyInvite): void {
    this.respondingId.set(invite.id);
    this.inviteService.declineInvite(invite.id).subscribe({
      next: () => {
        this.respondingId.set(null);
        this.invites.update((invites) => invites.filter((i) => i.id !== invite.id));
        this.snackbarService.success('Invitation declined.', { duration: 3000 });
      },
      error: (error: { error: ErrorInterface }) => {
        this.respondingId.set(null);
        this.snackbarService.error(error?.error?.message || 'Failed to decline invitation.', { duration: 4000 });
      },
    });
  }
}
