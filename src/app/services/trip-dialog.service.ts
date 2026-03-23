import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TripDialogService {
  readonly isOpen    = signal(false);
  readonly tripId    = signal<string | null>(null);
  /** Increments each time a trip is successfully saved. Components can react with effect(). */
  readonly savedCount = signal(0);

  openCreate(): void {
    this.tripId.set(null);
    this.isOpen.set(true);
  }

  openEdit(id: string): void {
    this.tripId.set(id);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.tripId.set(null);
  }

  notifySaved(): void {
    this.savedCount.update((n) => n + 1);
    this.close();
  }
}
