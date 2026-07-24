export interface TripStats {
  activeTrips: number;
  totalBudget: number;
  totalSpent: number;
}

export interface BurnRate {
  projected: number;
  onTrack: boolean;
}

export interface UnsettledPart {
  currency: string;
  amount: number;
}

export interface UnsettledSummary {
  tripCount: number;
  parts: UnsettledPart[];
}
