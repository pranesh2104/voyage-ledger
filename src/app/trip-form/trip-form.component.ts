import { Component, DestroyRef, effect, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { TripService, CURRENCIES } from 'voyage-lib';
import { TripManagementService } from '../services/trip-management.service';

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './trip-form.component.html',
  styleUrls: ['./trip-form.component.scss']
})
export class TripFormComponent implements OnInit {
  // ── Inputs ────────────────────────────────────────────────────────────────
  tripId        = input<string | null>(null);
  /** Increment from the parent footer to trigger form submission. */
  submitTrigger = input<number>(0);

  // ── Outputs ───────────────────────────────────────────────────────────────
  saved             = output<void>();
  cancelled         = output<void>();
  validityChanged   = output<boolean>();
  submittingChanged = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────
  tripForm!: FormGroup;
  isSubmitting = false;
  currencies   = CURRENCIES;

  statusOptions = [
    { value: 'planning',  label: 'Planning'  },
    { value: 'ongoing',   label: 'Ongoing'   },
    { value: 'completed', label: 'Completed' },
  ];

  private readonly fb                  = inject(FormBuilder);
  private readonly tripService         = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly destroyRef          = inject(DestroyRef);

  constructor() {
    // Fire onSubmit whenever the parent increments submitTrigger.
    effect(() => {
      if (this.submitTrigger() > 0) this.onSubmit();
    });

    // React to tripId changes (edit mode).
    effect(() => {
      const id = this.tripId();
      if (this.tripForm) {
        this.tripForm.reset({
          name: '', destination: '', country: '',
          startDate: '', endDate: '',
          budget: '', currency: 'USD', status: 'planning',
        });
        if (id) this.loadTrip();
      }
    });
  }

  get isEditMode(): boolean { return !!this.tripId(); }

  ngOnInit(): void {
    this.initForm();

    // Emit validity immediately and on every subsequent change.
    this.tripForm.statusChanges
      .pipe(startWith(this.tripForm.status), takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.validityChanged.emit(status === 'VALID'));
  }

  initForm(): void {
    this.tripForm = this.fb.group({
      name:        ['', [Validators.required, Validators.maxLength(100)]],
      destination: ['', [Validators.required, Validators.maxLength(100)]],
      country:     ['', [Validators.required, Validators.maxLength(100)]],
      startDate:   ['', Validators.required],
      endDate:     ['', Validators.required],
      budget:      ['', [Validators.required, Validators.min(1)]],
      currency:    ['USD', Validators.required],
      status:      ['planning', Validators.required],
    }, { validators: this.dateRangeValidator });
  }

  dateRangeValidator(form: FormGroup) {
    const start = form.get('startDate')?.value;
    const end   = form.get('endDate')?.value;
    if (start && end) return new Date(start) <= new Date(end) ? null : { dateRange: true };
    return null;
  }

  loadTrip(): void {
    const id = this.tripId();
    if (!id) return;
    this.tripService.getTripById(id).subscribe({
      next: (trip) => {
        if (trip) {
          this.tripForm.patchValue({
            name:        trip.name,
            destination: trip.destination,
            country:     trip.country,
            startDate:   this.formatDateForInput(trip.startDate),
            endDate:     this.formatDateForInput(trip.endDate),
            budget:      trip.budget,
            currency:    trip.currency,
            status:      trip.status,
          });
        }
      },
    });
  }

  formatDateForInput(date: Date): string {
    const d     = new Date(date);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSubmit(): void {
    this.tripForm.markAllAsTouched();
    if (!this.tripForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.submittingChanged.emit(true);

    const v = this.tripForm.value;
    const tripData = {
      name:        v.name,
      destination: v.destination,
      country:     v.country,
      startDate:   new Date(v.startDate),
      endDate:     new Date(v.endDate),
      budget:      parseFloat(v.budget),
      currency:    v.currency,
      status:      v.status,
      spent:       0,
    };

    const finish = () => { this.isSubmitting = false; this.submittingChanged.emit(false); };

    const id = this.tripId();
    if (this.isEditMode && id) {
      this.tripService.getTripById(id).subscribe({
        next: (existing) => {
          this.tripManagementService.updateTrip({ ...tripData, id, spent: existing?.spent ?? 0 }).subscribe({
            next:  () => { finish(); this.saved.emit(); },
            error: (e) => { console.error(e); finish(); },
          });
        },
      });
    } else {
      this.tripManagementService.createTrip(tripData).subscribe({
        next:  () => { finish(); this.saved.emit(); },
        error: (e) => { console.error(e); finish(); },
      });
    }
  }

  cancel(): void { this.cancelled.emit(); }

  get nameControl()        { return this.tripForm.get('name'); }
  get destinationControl() { return this.tripForm.get('destination'); }
  get countryControl()     { return this.tripForm.get('country'); }
  get startDateControl()   { return this.tripForm.get('startDate'); }
  get endDateControl()     { return this.tripForm.get('endDate'); }
  get budgetControl()      { return this.tripForm.get('budget'); }
  get currencyControl()    { return this.tripForm.get('currency'); }
  get statusControl()      { return this.tripForm.get('status'); }

  hasDateRangeError(): boolean {
    return !!(this.tripForm.hasError('dateRange') &&
      this.startDateControl?.touched && this.endDateControl?.touched);
  }
}
