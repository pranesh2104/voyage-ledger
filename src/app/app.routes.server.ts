import { RenderMode, ServerRoute } from '@angular/ssr';
export const serverRoutes: ServerRoute[] = [
  // Landing page: content never changes per visitor, so build it once (SEO without a per-request cost).
  { path: '', renderMode: RenderMode.Prerender },

  // Invite link: content depends on the token and can change at any moment (revoked, expired,
  // full), and chat-app link previews need it in the HTML. So: render on every request.
  {
    path: 'join/:token',
    renderMode: RenderMode.Server,
    headers: {
      // Never cache: a revoked link must stop showing the trip immediately.
      'Cache-Control': 'no-store',
      // Private links: keep them out of search results (the page also has <meta name="robots">).
      'X-Robots-Tag': 'noindex',
    },
  },

  // Everything else is the signed-in app: rendered in the browser.
  { path: '**', renderMode: RenderMode.Client },
];
