import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiResponse } from 'voyage-lib';
import {
  AcceptInviteLinkResult,
  CreateInviteLinkOptions,
  InviteLink,
  InviteLinkPreview,
} from '@shared/models/invite-link.model';
import { PUBLIC_API } from '../tokens/public-api.token';

/**
 * Shareable invite links. Uses HttpClient directly (not voyage-lib's SharedHttpService)
 * because the public preview call needs an HttpContext. Paths stay relative, so
 * `apiUrlInterceptor` still adds the API base URL, on the server too.
 */
@Injectable({ providedIn: 'root' })
export class InviteLinkService {
  private readonly http = inject(HttpClient);

  // ── Creator ────────────────────────────────────────────────────────────────

  /** The trip's current link, or null if it has none. */
  getForTrip(tripId: string): Observable<InviteLink | null> {
    return this.http
      .get<ApiResponse<InviteLink | null>>(`/trips/${tripId}/invite-link`)
      .pipe(map((res) => res.data ?? null));
  }

  /** Replaces the trip's link with a new one; the old link stops working. */
  create(tripId: string, options: CreateInviteLinkOptions): Observable<InviteLink> {
    return this.http
      .post<ApiResponse<InviteLink>>(`/trips/${tripId}/invite-link`, options)
      .pipe(map((res) => res.data));
  }

  revoke(tripId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`/trips/${tripId}/invite-link`)
      .pipe(map(() => undefined));
  }

  // ── Anyone with the link ───────────────────────────────────────────────────

  /**
   * Public: works without signing in, so the SSR server can call it. Errors with
   * 404 (unknown link) or 410 (revoked / expired / used up, body.data: UnusableInviteLink).
   */
  preview(token: string): Observable<InviteLinkPreview> {
    return this.http
      .get<ApiResponse<InviteLinkPreview>>(`/invite-links/${encodeURIComponent(token)}`, {
        context: new HttpContext().set(PUBLIC_API, true),
      })
      .pipe(map((res) => res.data));
  }

  /** Joins the signed-in user to the trip. Same 404/410 errors as preview(). */
  accept(token: string): Observable<AcceptInviteLinkResult> {
    return this.http
      .post<ApiResponse<AcceptInviteLinkResult>>(`/invite-links/${encodeURIComponent(token)}/accept`, {})
      .pipe(map((res) => res.data));
  }
}
