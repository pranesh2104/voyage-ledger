import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated by calling getCurrentUser
  return authService.getCurrentUser().pipe(
    map(() => {
      // If getCurrentUser succeeds, user is authenticated
      return true;
    }),
    catchError(() => {
      // If getCurrentUser fails, redirect to signin
      router.navigate(['/auth/signin'], {
        queryParams: { returnUrl: state.url }
      });
      return of(false);
    })
  );
};
