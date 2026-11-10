import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  RESPONSE_INIT,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  LucideCalendar,
  LucideClock,
  LucideCloudOff,
  LucideMapPin,
  LucideSearchX,
  LucideUsers,
} from '@lucide/angular';
import { ErrorInterface, SnackbarService, TripDurationPipe } from 'voyage-lib';
import { InviteLinkService } from '@core/services/invite-link.service';
import { SITE_ORIGIN } from '@core/services/title-strategy.service';
import { AuthService } from '../../../auth/services/auth';
import { JoinAuthState, JoinPageState } from '../../models/join-page.model';
import {
  formatPlace,
  formatTripDates,
  httpStatusFor,
  joinPageMeta,
  joinStateFromError,
  joinStateFromPreview,
  unusableTitle,
} from '../../utils/join-page.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * /join/:token, the page a shared invite link opens. Rendered on the server for every request
 * (RenderMode.Server in app.routes.server.ts), so that:
 *   - chat apps, which don't run JavaScript, get the trip details for the link preview;
 *   - the response has a real HTTP status (200 / 404 / 410 / 503).
 * The sign-in check and the "Join" action only happen in the browser.
 */
@Component({
  selector: 'app-join',
  imports: [
    RouterLink,
    TripDurationPipe,
    LucideCalendar,
    LucideClock,
    LucideCloudOff,
    LucideMapPin,
    LucideSearchX,
    LucideUsers,
  ],
  templateUrl: './join.html',
})
export class JoinPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inviteLinkService = inject(InviteLinkService);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** From the resolver. Writable, because joining can find out the link stopped working meanwhile. */
  private readonly resolvedState = toSignal(this.route.data.pipe(map((data) => data['join'] as JoinPageState)), {
    initialValue: this.route.snapshot.data['join'] as JoinPageState,
  });
  readonly state = linkedSignal(() => this.resolvedState());

  /** The state narrowed per kind, so the template can use `@if (validState(); as s)`. */
  readonly validState = computed(() => {
    const s = this.state();
    return s.kind === 'valid' ? s : null;
  });
  readonly unusableState = computed(() => {
    const s = this.state();
    return s.kind === 'unusable' ? s : null;
  });

  readonly authState = signal<JoinAuthState>('unknown');
  readonly isJoining = signal(false);
  readonly isRetrying = signal(false);

  readonly currentUserName = computed(() => {
    const user = this.authService.currentuser();
    return user ? user.display_name || user.username || user.email : null;
  });

  /** Sign-in / sign-up bring the visitor back here afterwards. */
  readonly returnUrl = computed(() => `/join/${this.state().token}`);

  readonly place = computed(() => {
    const s = this.state();
    return s.kind === 'valid' ? formatPlace(s.preview.destination, s.preview.country) : '';
  });

  readonly dates = computed(() => {
    const s = this.state();
    return s.kind === 'valid' ? formatTripDates(s.preview.startDate, s.preview.endDate) : '';
  });

  readonly expiresIn = computed(() => {
    const s = this.state();
    if (s.kind !== 'valid') return '';
    const days = Math.ceil((new Date(s.preview.expiresAt).getTime() - Date.now()) / DAY_MS);
    if (days <= 1) return 'within a day';
    return `in ${days} days`;
  });

  readonly unusableTitle = unusableTitle;

  constructor() {
    // Server only: RESPONSE_INIT is provided while rendering a request, and is null in the browser.
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) responseInit.status = httpStatusFor(this.state());

    // Runs during rendering on the server too, so the tags are in the HTML the bot receives.
    effect(() => this.applyMeta(this.state()));

    // Browser only: the server has no cookies, so it can't know who's signed in.
    // Only asked when there's a trip to join; an expired link doesn't need it.
    afterNextRender(() => {
      if (this.state().kind === 'valid') this.checkSignedIn();
    });
  }

  join(): void {
    const state = this.state();
    if (state.kind !== 'valid' || this.isJoining()) return;

    this.isJoining.set(true);
    this.inviteLinkService.accept(state.token).subscribe({
      next: ({ tripId, alreadyMember }) => {
        this.isJoining.set(false);
        this.snackbarService.success(
          alreadyMember ? "You're already in this trip." : `You've joined "${state.preview.tripName}".`,
          { duration: 3000 },
        );
        this.router.navigate(['/expenses', tripId]);
      },
      error: (error: HttpErrorResponse) => {
        this.isJoining.set(false);
        if (error.status === 404 || error.status === 410) {
          // The link was revoked, expired or filled up after the page loaded.
          this.state.set(joinStateFromError(state.token, error));
          return;
        }
        // 401 is handled by authInterceptor, which sends the visitor to sign-in and back here.
        if (error.status === 401) return;
        const message = (error.error as ErrorInterface | null)?.message;
        this.snackbarService.error(message || "Couldn't join the trip. Please try again.", { duration: 4000 });
      },
    });
  }

  retry(): void {
    const token = this.state().token;
    this.isRetrying.set(true);
    this.inviteLinkService.preview(token).subscribe({
      next: (preview) => {
        this.isRetrying.set(false);
        this.state.set(joinStateFromPreview(token, preview));
        if (this.authState() === 'unknown') this.checkSignedIn();
      },
      error: (error: unknown) => {
        this.isRetrying.set(false);
        this.state.set(joinStateFromError(token, error));
      },
    });
  }

  private checkSignedIn(): void {
    if (this.authService.currentuser()) {
      this.authState.set('signed_in');
      return;
    }
    // A 401 here is expected for visitors; authInterceptor doesn't redirect for /auth/user.
    const sub = this.authService.getCurrentUser().subscribe({
      next: (res) => {
        this.authService.setCurrentUser(res.data.user);
        this.authState.set('signed_in');
      },
      error: () => this.authState.set('signed_out'),
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /**
   * <title>, description and the Open Graph / Twitter tags that chat apps read for the
   * preview card. index.html has site-wide defaults; updateTag replaces them in place.
   * (The robots "noindex" tag comes from the route's `noindex` data, see CustomTitleStrategy.)
   */
  private applyMeta(state: JoinPageState): void {
    const { title, description } = joinPageMeta(state);
    const fullTitle = `${title} - Voyage Ledger`;
    const url = `${SITE_ORIGIN}/join/${state.token}`;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
  }
}
