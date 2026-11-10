/**
 * Copies text that isn't known yet, such as a link the API is about to return.
 * Resolves to true if the text reached the clipboard, false if it didn't (no error is thrown).
 *
 * Call it synchronously inside the click handler, before the request finishes.
 * Safari (macOS and iOS) only allows clipboard writes during a user gesture, and the HTTP
 * response arrives after the gesture has ended, so a plain `writeText` in the response
 * callback is rejected there. A `ClipboardItem` whose data is a promise claims the
 * clipboard during the click and fills it in when the promise resolves.
 *
 * Where `ClipboardItem` isn't available, or that write fails, it falls back to `writeText`
 * once the text is ready. Chrome only needs the page to be focused for that.
 */
export async function copyWhenReady(text: Promise<string>): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) return false;

  // If the request fails, `text` (and `blob` below) reject. That case is handled (the function
  // returns false), so keep the browser from also reporting them as unhandled rejections.
  text.catch(() => undefined);

  if (typeof ClipboardItem !== 'undefined' && typeof clipboard.write === 'function') {
    try {
      const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
      blob.catch(() => undefined);
      await clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    } catch {
      // Fall through to writeText. If `text` itself rejected, the await below returns false.
    }
  }

  try {
    await clipboard.writeText(await text);
    return true;
  } catch {
    return false;
  }
}
