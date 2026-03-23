import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Trip, TripService, formatCurrency, getCurrency } from 'voyage-lib';
import { TripDialogService } from '../services/trip-dialog.service';

interface OverviewStats {
  activeTrips: number;
  totalBudget: number;
  totalSpent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  trips: Trip[] = [];
  stats: OverviewStats = {
    activeTrips: 0,
    totalBudget: 0,
    totalSpent: 0
  };

  private readonly tripService = inject(TripService);
  private readonly router = inject(Router);
  private readonly tripDialogService = inject(TripDialogService);

  constructor() {
    effect(() => {
      if (this.tripDialogService.savedCount() > 0) this.loadTrips();
    });
  }

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.tripService.getAllTrips().subscribe(trips => {
      console.log({ trips });

      this.trips = trips;
      this.calculateStats();
    });
  }

  calculateStats(): void {
    this.stats = {
      activeTrips: this.trips.filter(t => t.status === 'ongoing' || t.status === 'planning').length,
      totalBudget: this.trips.reduce((sum, t) => sum + t.budget, 0),
      totalSpent: this.trips.reduce((sum, t) => sum + t.spent, 0)
    };
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

  formatCurrencyAmount(amount: number, currencyCode: string): string {
    return formatCurrency(amount, currencyCode);
  }

  getCurrencySymbol(currencyCode: string): string {
    const currency = getCurrency(currencyCode);
    return currency?.symbol || '$';
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

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getDurationDays(trip: Trip): number {
    const diffTime = Math.abs(trip.endDate.getTime() - trip.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
