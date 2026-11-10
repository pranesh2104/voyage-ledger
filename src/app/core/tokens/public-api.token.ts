import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a request to a public API endpoint, one that works without signing in.
 *
 * `authInterceptor` leaves such requests alone: no `withCredentials` and no redirect to
 * sign-in on 401. Leaving out `withCredentials` matters for SSR: Angular's HTTP transfer
 * cache skips requests that send credentials, so without this flag the browser would fetch
 * the data again during hydration instead of reusing what the server already fetched.
 *
 * Usage: `http.get(url, { context: new HttpContext().set(PUBLIC_API, true) })`
 */
export const PUBLIC_API = new HttpContextToken<boolean>(() => false);
