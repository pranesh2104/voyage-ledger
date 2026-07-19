import { Injectable, signal } from '@angular/core';
import { Trip } from 'voyage-lib';

@Injectable({ providedIn: 'root' })
export class MembersDialogService {
  readonly isOpen = signal(false);
  readonly trip = signal<Trip | null>(null);

  open(trip: Trip): void {
    this.trip.set(trip);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.trip.set(null);
  }
}
