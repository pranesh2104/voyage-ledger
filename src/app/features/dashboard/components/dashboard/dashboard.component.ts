import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AvatarComponent, ConfirmDialogComponent, CurrencyFormatPipe, DateFormatPipe, LoaderComponent, SettlementService, Trip, TripBalance, TripDurationPipe, TripInviteService, TripMember, TripService, TripStatusStylePipe, SnackbarService } from 'voyage-lib';
import { TripDialogService } from '@core/services/trip-dialog.service';
import { TripManagementService } from '@core/services/trip-management.service';
import { MembersDialogService } from '@core/services/members-dialog.service';
import { TRIP_STATUS_OPTIONS } from '@shared/models/trip-status.model';
import { MAX_VISIBLE_MEMBERS } from '../../constants/dashboard.constant';
import { BurnRate, TripStats, UnsettledSummary } from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LoaderComponent, ConfirmDialogComponent, AvatarComponent, DateFormatPipe, CurrencyFormatPipe, TripDurationPipe, TripStatusStylePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  trips = signal<Trip[]>([]);
  stats = computed<TripStats>(() => {
    const trips = this.trips();
    return {
      activeTrips: trips.filter(t => t.status === 'ongoing' || t.status === 'planning').length,
      totalBudget: trips.reduce((sum, t) => sum + t.budget, 0),
      totalSpent: trips.reduce((sum, t) => sum + t.spent, 0)
    };
  });

  isLoading = signal(true);

  searchTerm = signal('');
  statusFilter = signal<'all' | Trip['status']>('all');
  filteredTrips = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.trips().filter(trip => {
      const matchesStatus = status === 'all' || trip.status === status;
      const matchesTerm = !term
        || trip.name.toLowerCase().includes(term)
        || trip.destination.toLowerCase().includes(term)
        || trip.country.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  });

  deleteTargetId = signal<string | null>(null);
  deleteTargetTrip = computed(() => this.trips().find(t => t.id === this.deleteTargetId()));
  isDeleting = signal(false);

  updatingStatusId = signal<string | null>(null);
  statusOptions = TRIP_STATUS_OPTIONS;

  // Keyed by trip id so the template reads a memoized value instead of
  // re-running this calculation on every change-detection pass.
  burnRates = computed(() => {
    const map = new Map<string, BurnRate | null>();
    for (const trip of this.trips()) {
      map.set(trip.id, this.calculateBurnRate(trip));
    }
    return map;
  });

  balances = signal<TripBalance[]>([]);
  balanceByTrip = computed(() => new Map(this.balances().map(b => [b.tripId, b.net])));

  membersByTrip = signal<Map<string, TripMember[]>>(new Map());

  // Only the debtor side (what the user owes), grouped by currency since
  // trips can each use a different currency and can't be summed together.
  unsettledSummary = computed<UnsettledSummary>(() => {
    const trips = this.trips();
    const owedByCurrency = new Map<string, number>();
    let tripCount = 0;

    for (const balance of this.balances()) {
      if (balance.net >= -0.01) continue;
      const currency = trips.find(t => t.id === balance.tripId)?.currency ?? 'USD';
      owedByCurrency.set(currency, (owedByCurrency.get(currency) ?? 0) + -balance.net);
      tripCount++;
    }

    return {
      tripCount,
      parts: Array.from(owedByCurrency.entries()).map(([currency, amount]) => ({ currency, amount })),
    };
  });

  private readonly tripService = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly settlementService = inject(SettlementService);
  private readonly router = inject(Router);
  private readonly tripDialogService = inject(TripDialogService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly membersDialogService = inject(MembersDialogService);
  private readonly tripInviteService = inject(TripInviteService);

  constructor() {
    effect(() => {
      if (this.tripDialogService.savedCount() > 0) this.loadTrips();
    });
  }

  ngOnInit(): void {
    this.loadTrips();
    this.loadBalances();
  }

  loadTrips(): void {
    this.isLoading.set(true);
    this.tripService.getAllTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.isLoading.set(false);
        this.loadMembers(trips);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackbarService.error('Failed to load trips. Please refresh the page.', { duration: 5000 });
      },
    });
  }

  // Separate from loadTrips/isLoading — this is a secondary, non-blocking
  // signal, so a failure here shouldn't stop the dashboard from rendering.
  loadMembers(trips: Trip[]): void {
    for (const trip of trips) {
      this.tripInviteService.listMembers(trip.id).subscribe({
        next: (members) => this.membersByTrip.update(map => new Map(map).set(trip.id, members)),
        error: () => { /* non-critical: avatar stack just won't show for this trip */ },
      });
    }
  }

  // Separate from loadTrips/isLoading — this is a secondary, non-blocking
  // signal, so a failure here shouldn't stop the dashboard from rendering.
  loadBalances(): void {
    this.settlementService.getMyBalances().subscribe({
      next: (balances) => this.balances.set(balances),
      error: () => { /* non-critical: badge/per-trip balance just won't show */ },
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

  openMembers(trip: Trip): void {
    this.membersDialogService.open(trip);
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

  onStatusChange(trip: Trip, status: Trip['status']): void {
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
        this.snackbarService.error('Failed to update trip status. Please try again.', { duration: 4000 });
      },
    });
  }

  getVisibleMembers(trip: Trip): TripMember[] {
    return (this.membersByTrip().get(trip.id) ?? []).slice(0, MAX_VISIBLE_MEMBERS);
  }

  getExtraMemberCount(trip: Trip): number {
    const total = this.membersByTrip().get(trip.id)?.length ?? 0;
    return Math.max(0, total - MAX_VISIBLE_MEMBERS);
  }

  getBudgetPercentage(trip: Trip): number {
    return trip.budget > 0 ? Math.round((trip.spent / trip.budget) * 100) : 0;
  }

  private calculateBurnRate(trip: Trip): BurnRate | null {
    const daysTotal = (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86_400_000;
    const daysElapsed = (Date.now() - new Date(trip.startDate).getTime()) / 86_400_000;

    if (trip.budget <= 0 || daysTotal <= 0 || daysElapsed <= 0) return null;

    const clampedDaysElapsed = Math.min(daysElapsed, daysTotal);
    const projected = (trip.spent / clampedDaysElapsed) * daysTotal;
    const onTrack = trip.spent / trip.budget <= clampedDaysElapsed / daysTotal;

    return { projected, onTrack };
  }

  getRemainingAmount(trip: Trip): number {
    return trip.budget - trip.spent;
  }

  isOverdue(trip: Trip): boolean {
    return trip.status !== 'completed' && new Date(trip.endDate).getTime() < Date.now();
  }
}
