import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { InviteLinkService } from '@core/services/invite-link.service';
import { JoinPageState } from '../models/join-page.model';
import { joinStateFromError, joinStateFromPreview } from '../utils/join-page.util';

/**
 * Longest wait for the API. On the server, the HTML response can't be sent until this
 * resolves, so a slow or sleeping API would otherwise hold the visitor (or the link-preview
 * bot, which gives up after a few seconds) on a blank screen.
 */
const PREVIEW_TIMEOUT_MS = 8000;

/**
 * Loads the invite before the page is created. The SSR server waits for resolvers, so the
 * very first HTML already contains the trip details and the right Open Graph tags.
 *
 * In the browser this runs again while hydrating, but the GET is answered from the HTTP
 * transfer cache (the response the server embedded in the page), so no second request is
 * made for a valid link. Error responses aren't cached, so a 404/410 is fetched again.
 */
export const joinPageResolver: ResolveFn<JoinPageState> = (route) => {
  const token = route.paramMap.get('token') ?? '';

  return inject(InviteLinkService)
    .preview(token)
    .pipe(
      timeout(PREVIEW_TIMEOUT_MS),
      map((preview) => joinStateFromPreview(token, preview)),
      catchError((error: unknown) => of(joinStateFromError(token, error))),
    );
};
