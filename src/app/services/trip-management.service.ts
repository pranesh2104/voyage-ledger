import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trip, TripDTO, TripService, SharedHttpService } from 'voyage-lib';

@Injectable({
  providedIn: 'root'
})
export class TripManagementService {
  private readonly httpService = inject(SharedHttpService);
  private readonly tripService = inject(TripService);

  createTrip(trip: Omit<Trip, 'id'>): Observable<Trip> {
    const dto = this.tripToDTO(trip as Trip);
    return this.httpService.post<{ data: TripDTO }>('/trips', dto).pipe(
      map(res => this.dtoToTrip(res.data))
    );
  }

  updateTrip(trip: Trip): Observable<Trip> {
    const dto = this.tripToDTO(trip);
    return this.httpService.put<{ data: TripDTO }>(`/trips/${trip.id}`, dto).pipe(
      map(res => this.dtoToTrip(res.data))
    );
  }

  deleteTrip(tripId: string): Observable<void> {
    return this.httpService.delete<{ data: null }>(`/trips/${tripId}`).pipe(
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
