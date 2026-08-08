import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, required, maxLength, min, validate, submit, FormField } from '@angular/forms/signals';
import { firstValueFrom, Subscription } from 'rxjs';
import { TripService, SnackbarService, Trip } from 'voyage-lib';
import { TripManagementService } from '@core/services/trip-management.service';
import { DEFAULT_MODEL } from '../../constants/trip-form.constant';
import { TRIP_STATUS_OPTIONS } from '@shared/constants/trip.constant';
import { TripFormModel } from '../../models/trip-form.model';

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [FormField],
  templateUrl: './trip-form.component.html',
  styleUrls: ['./trip-form.component.scss']
})
export class TripFormComponent {
  tripId = input<string | null>(null);

  saved = output<void>();
  cancelled = output<void>();

  canSubmitChanged = output<boolean>();
  submittingChanged = output<boolean>();

  isLoadingTrip = signal(false);
  private tripSub?: Subscription;

  statusOptions = TRIP_STATUS_OPTIONS;

  private readonly tripService = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackbarService = inject(SnackbarService);

  protected readonly model = signal<TripFormModel>({ ...DEFAULT_MODEL });

  protected readonly tripForm = form(this.model, (p) => {
    required(p.name, { message: 'Trip name is required.' });
    maxLength(p.name, 100, { message: 'Must be less than 100 characters.' });

    required(p.destination, { message: 'Destination is required.' });
    maxLength(p.destination, 100, { message: 'Must be less than 100 characters.' });

    required(p.country, { message: 'Country is required.' });
    maxLength(p.country, 100, { message: 'Must be less than 100 characters.' });

    required(p.startDate, { message: 'Start date is required.' });
    required(p.endDate, { message: 'End date is required.' });
    validate(p.endDate, ({ value, valueOf }) => {
      const start = valueOf(p.startDate);
      const end = value();
      if (start && end && new Date(start) > new Date(end)) {
        return { kind: 'dateRange', message: 'End date must be after start date.' };
      }
      return undefined;
    });

    required(p.budget, { message: 'Budget is required.' });
    min(p.budget, 1, { message: 'Budget must be at least 1.' });

    required(p.status);
  });

  protected readonly hasDateRangeError = computed(() =>
    this.tripForm.endDate().touched() &&
    this.tripForm.endDate().errors().some((e) => e.kind === 'dateRange'));

  constructor() {
    // React to tripId changes (edit mode).
    effect(() => {
      const id = this.tripId();
      this.tripForm().reset(DEFAULT_MODEL);
      if (id) this.loadTrip(id);
    });

    effect(() => this.canSubmitChanged.emit(this.tripForm().valid() && this.tripForm().dirty()));

    effect(() => this.submittingChanged.emit(this.tripForm().submitting()));
  }

  get isEditMode(): boolean { return !!this.tripId(); }

  loadTrip(id: string): void {
    // Cancel any still-in-flight fetch so a stale response can't overwrite a newer one.
    this.tripSub?.unsubscribe();
    this.isLoadingTrip.set(true);

    this.tripSub = this.tripService.getTripById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trip) => {
          this.isLoadingTrip.set(false);
          if (trip) {
            this.model.set({
              name: trip.name,
              destination: trip.destination,
              country: trip.country,
              startDate: this.formatDateForInput(trip.startDate),
              endDate: this.formatDateForInput(trip.endDate),
              budget: trip.budget,
              currency: trip.currency,
              status: trip.status,
            });
          }
        },
        error: () => {
          this.isLoadingTrip.set(false);
          this.snackbarService.error('Failed to load trip details. Please try again.', { duration: 4000 });
        },
      });
  }

  formatDateForInput(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSubmit(event?: Event): void {
    event?.preventDefault();
    if (this.tripForm().submitting()) return;

    submit(this.tripForm, async () => {
      const v = this.tripForm().value();
      const tripData = {
        name: v.name,
        destination: v.destination,
        country: v.country,
        startDate: new Date(v.startDate),
        endDate: new Date(v.endDate),
        budget: v.budget ?? 0,
        currency: v.currency,
        status: v.status,
        spent: 0,
      };

      const id = this.tripId();

      try {
        if (this.isEditMode && id) {
          const existing = await firstValueFrom(this.tripService.getTripById(id));
          await firstValueFrom(this.tripManagementService.updateTrip({ ...tripData, id, spent: existing?.spent ?? 0 }));
          this.snackbarService.success('Trip updated successfully.', { duration: 3000 });
        } else {
          await firstValueFrom(this.tripManagementService.createTrip(tripData));
          this.snackbarService.success('Trip created successfully.', { duration: 3000 });
        }
        this.saved.emit();
      } catch {
        const message = this.isEditMode
          ? 'Failed to update trip. Please try again.'
          : 'Failed to create trip. Please try again.';
        this.snackbarService.error(message, { duration: 4000 });
      }
      return undefined;
    });
  }

  cancel(): void { this.cancelled.emit(); }
}
