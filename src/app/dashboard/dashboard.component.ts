import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfirmDialogComponent, CurrencyFormatPipe, DateFormatPipe, LoaderComponent, Trip, TripDurationPipe, TripService, SnackbarService } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripManagementService } from '../services/trip-management.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LoaderComponent, ConfirmDialogComponent, DateFormatPipe, CurrencyFormatPipe, TripDurationPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  trips = signal<Trip[]>([]);
  stats = computed(() => {
    const trips = this.trips();
    return {
      activeTrips: trips.filter(t => t.status === 'ongoing' || t.status === 'planning').length,
      totalBudget: trips.reduce((sum, t) => sum + t.budget, 0),
      totalSpent: trips.reduce((sum, t) => sum + t.spent, 0)
    };
  });

  isLoading = signal(true);

  deleteTargetId = signal<string | null>(null);
  deleteTargetTrip = computed(() => this.trips().find(t => t.id === this.deleteTargetId()));
  isDeleting = signal(false);

  updatingStatusId = signal<string | null>(null);
  statusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
  ];

  private readonly tripService = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly router = inject(Router);
  private readonly tripDialogService = inject(TripDialogService);
  private readonly snackbarService = inject(SnackbarService);

  constructor() {
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

  deleteTrip(tripId: string): void {
    this.deleteTargetId.set(tripId);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.deleteTargetId.set(null);
  }

  confirmDelete(): void {
    const id = this.deleteTargetId();
    if (!id) return;

    this.isDeleting.set(true);
    this.tripManagementService.deleteTrip(id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.deleteTargetId.set(null);
        this.snackbarService.success('Trip deleted successfully.', { duration: 3000 });
        this.loadTrips();
      },
      error: () => {
        this.isDeleting.set(false);
        this.snackbarService.error('Failed to delete trip. Please try again later.', { duration: 4000 });
      },
    });
  }

  onStatusChange(trip: Trip, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as Trip['status'];
    if (status === trip.status) return;

    this.updatingStatusId.set(trip.id);
    this.tripManagementService.updateTrip({ ...trip, status }).subscribe({
      next: (updated) => {
        this.updatingStatusId.set(null);
        this.trips.update(trips => trips.map(t => t.id === updated.id ? updated : t));
        this.snackbarService.success('Trip status updated.', { duration: 3000 });
      },
      error: () => {
        this.updatingStatusId.set(null);
        (event.target as HTMLSelectElement).value = trip.status;
        this.snackbarService.error('Failed to update trip status. Please try again.', { duration: 4000 });
      },
    });
  }

  getBudgetPercentage(trip: Trip): number {
    return trip.budget > 0 ? Math.round((trip.spent / trip.budget) * 100) : 0;
  }

  getRemainingAmount(trip: Trip): number {
    return trip.budget - trip.spent;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ongoing': return '#228b22';
      case 'planning': return '#ff6347';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  }

  getStatusBg(status: string): string {
    switch (status) {
      case 'ongoing': return 'rgba(34, 139, 34, 0.12)';
      case 'planning': return 'rgba(255, 99, 71, 0.12)';
      case 'completed': return 'rgba(107, 114, 128, 0.12)';
      default: return 'rgba(107, 114, 128, 0.12)';
    }
  }
}
