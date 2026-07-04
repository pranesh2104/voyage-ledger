import { Component, computed, inject, signal } from '@angular/core';
import { DialogComponent, DialogFooterButton } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripFormComponent } from './trip-form.component';

@Component({
  selector: 'app-trip-form-dialog',
  standalone: true,
  imports: [TripFormComponent, DialogComponent],
  templateUrl: './trip-form-dialog.component.html',
})
export class TripFormDialogComponent {
  readonly dialogService = inject(TripDialogService);

  readonly canSubmit = signal(false);
  readonly isSubmitting = signal(false);

  readonly footerButtons = computed<DialogFooterButton[]>(() => [
    { key: 'cancel', label: 'Cancel', variant: 'ghost', disabled: this.isSubmitting() },
    {
      key: 'confirm',
      label: this.dialogService.tripId() ? 'Update Trip' : 'Create Trip',
      variant: 'primary',
      disabled: !this.canSubmit(),
      loading: this.isSubmitting(),
    },
  ]);

  onFooterAction(key: string, form: TripFormComponent): void {
    key === 'confirm' ? form.onSubmit() : this.dialogService.close();
  }
}
