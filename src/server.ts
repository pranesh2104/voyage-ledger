import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

/**
 * The SSR server. For every request it either:
 *   1. serves a file from the browser build (JS, CSS, images, the prerendered landing page), or
 *   2. lets Angular handle it, following app.routes.server.ts:
 *        - RenderMode.Server  (/join/:token) -> renders the page now, for this request
 *        - RenderMode.Client  (the signed-in app) -> sends the empty client shell
 *        - RenderMode.Prerender (/) -> already a static file, so step 1 answered it
 */
const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Hashed bundles never change, so browsers may cache them for a year.
// `index: false` keeps "/" from being served as a plain file before Angular sees it.
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

// Started directly (`node dist/voyage-ledger/server/server.mjs`), not when a host
// imports `reqHandler` as a serverless function.
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Voyage Ledger SSR server listening on http://localhost:${port}`);
  });
}

/** Request handler used by the Angular CLI (dev server, build) and by serverless hosts. */
export const reqHandler = createNodeRequestHandler(app);
