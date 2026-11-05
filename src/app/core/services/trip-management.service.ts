import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trip, TripDTO, SharedHttpService, ApiResponse } from 'voyage-lib';

@Injectable({
  providedIn: 'root'
})
export class TripManagementService {
  private readonly httpService = inject(SharedHttpService);

  createTrip(trip: Omit<Trip, 'id'>): Observable<Trip> {
    const dto = this.tripToDTO(trip as Trip);
    return this.httpService.post<ApiResponse<TripDTO>>('/trips', dto).pipe(
      map(res => this.dtoToTrip(res.data))
    );
  }

  updateTrip(trip: Trip): Observable<Trip> {
    const dto = this.tripToDTO(trip);
    return this.httpService.put<ApiResponse<TripDTO>>(`/trips/${trip.id}`, dto).pipe(
      map(res => this.dtoToTrip(res.data))
    );
  }

  /**
   * Asks the backend to look up coordinates for trips that don't have them yet.
   * It handles a few trips per call; `remaining` says how many still need a lookup.
   */
  locateTrips(): Observable<{ trips: Trip[]; remaining: number }> {
    return this.httpService
      .post<ApiResponse<{ trips: TripDTO[]; remaining: number }>>('/trips/locate', {})
      .pipe(
        map(res => ({
          trips: (res?.data?.trips ?? []).map(dto => this.dtoToTrip(dto)),
          remaining: res?.data?.remaining ?? 0,
        }))
      );
  }

  deleteTrip(tripId: string): Observable<void> {
    return this.httpService.delete<ApiResponse<null>>(`/trips/${tripId}`).pipe(
      map(() => undefined)
    );
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
