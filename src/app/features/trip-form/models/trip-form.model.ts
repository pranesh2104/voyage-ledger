import { Trip } from "voyage-lib";

export interface TripFormModel {
    name: string;
    destination: string;
    country: string;
    startDate: string;
    endDate: string;
    budget: number | null;
    currency: string;
    status: Trip['status'];
}
