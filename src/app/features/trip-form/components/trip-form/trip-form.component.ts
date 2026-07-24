import { Component, DestroyRef, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge, Subscription, startWith } from 'rxjs';
import { TripService, SnackbarService } from 'voyage-lib';
import { TripManagementService } from '@core/services/trip-management.service';
import { DEFAULT_CURRENCY } from '../../constants/trip-form.constant';
import { TRIP_STATUS_OPTIONS } from '@shared/constants/trip.constant';

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './trip-form.component.html',
  styleUrls: ['./trip-form.component.scss']
})
export class TripFormComponent implements OnInit {
  // ── Inputs ────────────────────────────────────────────────────────────────
  tripId = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────
  saved = output<void>();
  cancelled = output<void>();
  /** Emits true only once the form is both valid AND has actual user changes. */
  canSubmitChanged = output<boolean>();
  submittingChanged = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────
  tripForm!: FormGroup;
  isSubmitting = false;
  isLoadingTrip = signal(false);
  private tripSub?: Subscription;

  statusOptions = TRIP_STATUS_OPTIONS

  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackbarService = inject(SnackbarService);

  constructor() {
    // React to tripId changes (edit mode).
    effect(() => {
      const id = this.tripId();
      if (this.tripForm) {
        this.tripForm.reset({
          name: '', destination: '', country: '',
          startDate: '', endDate: '',
          budget: '', currency: DEFAULT_CURRENCY, status: 'planning',
        });
        if (id) this.loadTrip();
      }
    });
  }

  get isEditMode(): boolean { return !!this.tripId(); }

  ngOnInit(): void {
    this.initForm();

    // Emit canSubmit immediately and on every subsequent value/status change.
    // Programmatic patchValue() (e.g. loading an existing trip) doesn't mark the form
    // dirty, so this stays false until the user actually changes something.
    merge(this.tripForm.valueChanges, this.tripForm.statusChanges)
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.canSubmitChanged.emit(this.tripForm.valid && this.tripForm.dirty));
  }

  initForm(): void {
    this.tripForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      destination: ['', [Validators.required, Validators.maxLength(100)]],
      country: ['', [Validators.required, Validators.maxLength(100)]],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      budget: ['', [Validators.required, Validators.min(1)]],
      currency: [DEFAULT_CURRENCY, Validators.required],
      status: ['planning', Validators.required],
    }, { validators: this.dateRangeValidator });
  }

  dateRangeValidator(form: FormGroup) {
    const start = form.get('startDate')?.value;
    const end = form.get('endDate')?.value;
    if (start && end) return new Date(start) <= new Date(end) ? null : { dateRange: true };
    return null;
  }

  loadTrip(): void {
    const id = this.tripId();
    if (!id) return;

    // Cancel any still-in-flight fetch so a stale response can't overwrite a newer one.
    this.tripSub?.unsubscribe();
    this.isLoadingTrip.set(true);

    this.tripSub = this.tripService.getTripById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trip) => {
          this.isLoadingTrip.set(false);
          if (trip) {
            this.tripForm.patchValue({
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

  onSubmit(): void {
    this.tripForm.markAllAsTouched();
    if (!this.tripForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.submittingChanged.emit(true);

    const v = this.tripForm.value;
    const tripData = {
      name: v.name,
      destination: v.destination,
      country: v.country,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate),
      budget: parseFloat(v.budget),
      currency: v.currency,
      status: v.status,
      spent: 0,
    };

    const finish = () => { this.isSubmitting = false; this.submittingChanged.emit(false); };

    const id = this.tripId();

    if (this.isEditMode && id) {
      this.tripService.getTripById(id).subscribe({
        next: (existing) => {
          this.tripManagementService.updateTrip({ ...tripData, id, spent: existing?.spent ?? 0 }).subscribe({
            next: () => { finish(); this.snackbarService.success('Trip updated successfully.', { duration: 3000 }); this.saved.emit(); },
            error: () => { this.snackbarService.error('Failed to update trip. Please try again.', { duration: 4000 }); finish(); },
          });
        },
      });
    } else {
      this.tripManagementService.createTrip(tripData).subscribe({
        next: () => { finish(); this.snackbarService.success('Trip created successfully.', { duration: 3000 }); this.saved.emit(); },
        error: () => { this.snackbarService.error('Failed to create trip. Please try again.', { duration: 4000 }); finish(); },
      });
    }
  }

  cancel(): void { this.cancelled.emit(); }

  get nameControl() { return this.tripForm.get('name'); }
  get destinationControl() { return this.tripForm.get('destination'); }
  get countryControl() { return this.tripForm.get('country'); }
  get startDateControl() { return this.tripForm.get('startDate'); }
  get endDateControl() { return this.tripForm.get('endDate'); }
  get budgetControl() { return this.tripForm.get('budget'); }
  get statusControl() { return this.tripForm.get('status'); }

  hasDateRangeError(): boolean {
    return !!(this.tripForm.hasError('dateRange') &&
      this.startDateControl?.touched && this.endDateControl?.touched);
  }
}
