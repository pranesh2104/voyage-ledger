/**
 * Vercel Function that runs the Angular SSR server (src/server.ts, built to dist/).
 *
 * vercel.json rewrites only /join/* here; everything else is served as static files from the
 * CDN. A rewrite keeps the original URL in req.url, so Angular renders the page that was asked for.
 *
 * The server bundle has Express and Angular bundled in, so it needs no node_modules at runtime.
 * `functions.includeFiles` in vercel.json ships the dist folder with this function.
 */
export { reqHandler as default } from '../dist/voyage-ledger/server/server.mjs';
