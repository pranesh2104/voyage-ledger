import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripFormComponent } from './trip-form.component';

@Component({
  selector: 'app-trip-form-dialog',
  standalone: true,
  imports: [TripFormComponent],
  templateUrl: './trip-form-dialog.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TripFormDialogComponent {
  readonly dialogService = inject(TripDialogService);

  /** Incremented to signal the form to submit. */
  readonly submitCount = signal(0);
  readonly isFormValid = signal(false);
  readonly isSubmitting = signal(false);

  triggerSubmit(): void {
    this.submitCount.update((n) => n + 1);
  }
}
