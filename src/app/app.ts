import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterModule } from '@angular/router';
import { SnackbarComponent } from 'voyage-lib';
import { filter, take } from 'rxjs';

@Component({
  imports: [RouterModule, SnackbarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'shell';

  private router = inject(Router);

  protected initialLoading = signal(true);

  constructor() {
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
