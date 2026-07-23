import { Trip } from 'voyage-lib';

export interface TripStatusOption {
  value: Trip['status'];
  label: string;
}

export const TRIP_STATUS_OPTIONS: TripStatusOption[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];
