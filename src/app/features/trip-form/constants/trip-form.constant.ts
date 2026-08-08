import { TripFormModel } from "../models/trip-form.model";

// Currency picker removed from UI; app is INR-only for now.
export const DEFAULT_CURRENCY = 'INR';

export const DEFAULT_MODEL: TripFormModel = {
    name: '', destination: '', country: '',
    startDate: '', endDate: '',
    budget: null, currency: DEFAULT_CURRENCY, status: 'planning',
};