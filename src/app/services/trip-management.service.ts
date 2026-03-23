import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trip, TripDTO, TripService, SharedHttpService } from 'voyage-lib';

@Injectable({
  providedIn: 'root'
})
export class TripManagementService {
  private readonly httpService = inject(SharedHttpService);
  private readonly USE_MOCK_DATA = true;
  private readonly tripService = inject(TripService);

  constructor() { }

  createTrip(trip: Omit<Trip, 'id'>): Observable<Trip> {
    if (this.USE_MOCK_DATA) {
      const newTrip: Trip = { ...trip, id: Date.now().toString() };
      return of(newTrip);
    }
    const dto = this.tripToDTO(trip as Trip);
    return this.httpService.post<TripDTO>('/trips', dto).pipe(
      map(dto => this.dtoToTrip(dto))
    );
  }

  updateTrip(trip: Trip): Observable<Trip> {
    if (this.USE_MOCK_DATA) {
      return of(trip);
    }
    const dto = this.tripToDTO(trip);
    return this.httpService.put<TripDTO>(`/trips/${trip.id}`, dto).pipe(
      map(dto => this.dtoToTrip(dto))
    );
  }

  deleteTrip(tripId: string): Observable<void> {
    if (this.USE_MOCK_DATA) {
      return of(undefined);
    }
    return this.httpService.delete<void>(`/trips/${tripId}`);
  }

  private dtoToTrip(dto: TripDTO): Trip {
    return {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate)
    };
  }

  private tripToDTO(trip: Trip): TripDTO {
    return {
      ...trip,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString()
    };
  }
}
