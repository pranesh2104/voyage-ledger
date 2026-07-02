import { Component, computed, effect, inject, OnInit, signal, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Trip, TripService, SnackbarService } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';
import type { LoaderComponent } from 'voyage-ui/ui';
import { RemoteOutletComponent } from '../shared/components/remote-outlet/remote-outlet.component';
import { RemoteUiService } from '../shared/services/remote-ui.service';

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
    this.remoteUi.load().then((m) => this.loaderComponent.set(m.LoaderComponent));
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
}
