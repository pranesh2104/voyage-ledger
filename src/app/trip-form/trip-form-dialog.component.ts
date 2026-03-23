import { Component, inject, signal } from '@angular/core';
import { DialogComponent } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripFormComponent } from './trip-form.component';

@Component({
  selector: 'app-trip-form-dialog',
  standalone: true,
  imports: [DialogComponent, TripFormComponent],
  templateUrl: './trip-form-dialog.component.html',
})
export class TripFormDialogComponent {
  readonly dialogService = inject(TripDialogService);

  /** Incremented to signal the form to submit. */
  readonly submitCount  = signal(0);
  readonly isFormValid  = signal(false);
  readonly isSubmitting = signal(false);

  triggerSubmit(): void {
    this.submitCount.update((n) => n + 1);
  }
}
