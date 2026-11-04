import { Component, inject, makeStateKey, PLATFORM_ID, signal, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterModule } from '@angular/router';
import { SnackbarComponent } from 'voyage-lib';
import { filter, take } from 'rxjs';

/** Set while prerendering, so the browser knows the page already has real content. */
const PRERENDERED = makeStateKey<boolean>('prerendered');

@Component({
  imports: [RouterModule, SnackbarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'shell';

  private router = inject(Router);
  private transferState = inject(TransferState);

  // Show the full-screen loader only for client-rendered pages.
  protected initialLoading = signal(!this.transferState.get(PRERENDERED, false));

  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this.transferState.set(PRERENDERED, true);
    }

    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        take(1),
      )
      .subscribe(() => this.initialLoading.set(false));
  }
}
