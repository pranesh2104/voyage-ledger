import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // /auth/user 401s come from authGuard's own login check (during route resolution,
      // where router.url still reflects the last *committed* route, not the pending one,
      // so it can't be trusted here) or from the landing page's silent session check
      // (which intentionally stays on the landing page for a logged-out visitor). Both
      // already handle their own redirect, so skip this interceptor's redirect here.
      if (error.status === 401 && !req.url.endsWith('/auth/user') && !router.url.startsWith('/auth/')) {
        router.navigate(['/auth/signin'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    })
  );
};