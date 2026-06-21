import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentUser().pipe(
    map((response) => {
      authService.setCurrentUser(response.data.user);
      return true;
    }),
    catchError(() => {
      router.navigate(['/auth/signin'], {
        queryParams: { returnUrl: state.url }
      });
      return of(false);
    })
  );
};
