import { Component, computed, effect, inject, OnInit, signal, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Trip, TripService, SnackbarService } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';
import type { CurrencyFormatPipe, DateFormatPipe, LoaderComponent, TripDurationPipe } from 'voyage-ui';
import { RemoteOutletComponent } from '../shared/components/remote-outlet/remote-outlet.component';
import { RemoteUiService } from '../shared/services/remote-ui.service';

const STATUS_COLORS: Record<Trip['status'], { color: string; bg: string }> = {
  planning: { color: 'hsl(215 80% 40%)', bg: 'hsl(215 80% 40% / 0.1)' },
  ongoing: { color: 'hsl(150 55% 30%)', bg: 'hsl(150 55% 30% / 0.1)' },
  completed: { color: 'hsl(210 10% 40%)', bg: 'hsl(210 10% 40% / 0.1)' },
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RemoteOutletComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private readonly remoteUi = inject(RemoteUiService);
  readonly loaderComponent = signal<Type<LoaderComponent> | null>(null);
  readonly loaderInputs = { message: 'Loading dashboard...', fullPage: true };

  private dateFormatPipe: DateFormatPipe | null = null;
  private currencyFormatPipe: CurrencyFormatPipe | null = null;
  private tripDurationPipe: TripDurationPipe | null = null;

  trips = signal<Trip[]>([]);
  stats = computed(() => {
    const trips = this.trips();
    return {
      activeTrips: trips.filter(t => t.status === 'ongoing' || t.status === 'planning').length,
      totalBudget: trips.reduce((sum, t) => sum + t.budget, 0),
      totalSpent: trips.reduce((sum, t) => sum + t.spent, 0),
    };
  });

  isLoading = signal(true);

  private readonly tripService = inject(TripService);
  private readonly router = inject(Router);
  private readonly tripDialogService = inject(TripDialogService);
  private readonly snackbarService = inject(SnackbarService);

  constructor() {
    this.remoteUi.load().then((m) => {
      this.loaderComponent.set(m.LoaderComponent);
      this.dateFormatPipe = new m.DateFormatPipe();
      this.currencyFormatPipe = new m.CurrencyFormatPipe();
      this.tripDurationPipe = new m.TripDurationPipe();
    });
    effect(() => {
      if (this.tripDialogService.savedCount() > 0) this.loadTrips();
    });
  }

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading.set(true);
    this.tripService.getAllTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackbarService.error('Failed to load trips. Please refresh the page.', { duration: 5000 });
      },
    });
  }

  viewExpenses(tripId: string): void {
    this.router.navigate(['/expenses', tripId]);
  }

  editTrip(tripId: string): void {
    this.tripDialogService.openEdit(tripId);
  }

  createTrip(): void {
    this.tripDialogService.openCreate();
  }

  getBudgetPercentage(trip: Trip): number {
    return trip.budget > 0 ? Math.min(Math.round((trip.spent / trip.budget) * 100), 100) : 0;
  }

  getRemainingAmount(trip: Trip): number {
    return trip.budget - trip.spent;
  }

  formatDate(value: Date | string): string {
    return this.dateFormatPipe?.transform(value) ?? '';
  }

  formatCurrencyAmount(amount: number, currencyCode: string): string {
    return this.currencyFormatPipe?.transform(amount, currencyCode) ?? '';
  }

  getTripDuration(trip: Trip): string {
    return this.tripDurationPipe?.transform(trip.startDate, trip.endDate) ?? '';
  }

  getStatusColor(status: Trip['status']): string {
    return STATUS_COLORS[status].color;
  }

  getStatusBg(status: Trip['status']): string {
    return STATUS_COLORS[status].bg;
  }
}
