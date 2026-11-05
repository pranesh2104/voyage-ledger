import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, delay, dematerialize, materialize, of, throwError } from 'rxjs';
import { DEMO_LATENCY_MS } from './demo.constant';
import { DemoApiError, handleDemoRequest } from './demo-api';
import { DemoStore } from './demo-store.service';

/**
 * In demo mode, answers every API call (relative URLs, the ones `apiUrlInterceptor` would
 * send to the backend) from the in-browser demo data. Runs first, so nothing reaches the
 * real API, including requests made by the expense micro-frontend through the shell's
 * HttpClient. Outside demo mode it does nothing.
 */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(DemoStore);
  const state = store.state;
  if (!store.active() || !state || !req.url.startsWith('/')) return next(req);

  return defer(() => {
    if (req.method === 'POST' && req.url === '/auth/logout') {
      store.end();
      return of(new HttpResponse({ status: 200, url: req.url, body: { success: true, data: null } }));
    }

    try {
      const result = handleDemoRequest(state, { method: req.method, path: req.url, body: req.body });
      if (req.method !== 'GET') store.save();
      // A copy, so a component changing a response object can't change the stored data.
      const body = structuredClone({ success: true, data: result.data, ...(result.message && { message: result.message }) });
      return of(new HttpResponse({ status: result.status, url: req.url, body }));
    } catch (error) {
      const status = error instanceof DemoApiError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Something went wrong in the demo.';
      return throwError(() => new HttpErrorResponse({
        status,
        url: req.url,
        error: { success: false, message, statusCode: status },
      }));
    }
  }).pipe(
    // Delay errors too (a plain delay() lets them through at once), so every response takes the same time.
    materialize(),
    delay(DEMO_LATENCY_MS),
    dematerialize(),
  );
};
