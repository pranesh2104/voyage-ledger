import { TripStatusOption } from "@shared/models/trip-status.model";

export const TRIP_STATUS = {
  ON_GOING: 'ongoing',
  PLANNING: 'planning',
  COMPLETED: 'completed'
} as const;

export const TRIP_STATUS_OPTIONS: TripStatusOption[] = [
  { value: TRIP_STATUS.PLANNING, label: 'Planning' },
  { value: TRIP_STATUS.ON_GOING, label: 'Ongoing' },
  { value: TRIP_STATUS.COMPLETED, label: 'Completed' },
];

