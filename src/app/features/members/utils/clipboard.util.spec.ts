import { copyWhenReady } from './clipboard.util';

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

describe('copyWhenReady', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubClipboard(clipboard: Partial<Clipboard>, withClipboardItem = true) {
    vi.stubGlobal('navigator', { clipboard });
    vi.stubGlobal('ClipboardItem', withClipboardItem ? FakeClipboardItem : undefined);
  }

  it('claims the clipboard immediately with a ClipboardItem, then fills it in', async () => {
    let written: Blob | undefined;
    const write = vi.fn(async (items: FakeClipboardItem[]) => {
      written = await items[0].items['text/plain'];
    });
    stubClipboard({ write: write as unknown as Clipboard['write'] });

    let resolve!: (v: string) => void;
    const copied = copyWhenReady(new Promise((r) => (resolve = r)));
    expect(write).toHaveBeenCalledOnce(); // before the text exists: that's what keeps Safari happy

    resolve('https://x/join/abc');
    expect(await copied).toBe(true);
    expect(written?.type).toBe('text/plain');
    expect(written?.size).toBe('https://x/join/abc'.length);
  });

  it('falls back to writeText when ClipboardItem is missing', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ writeText }, false);
    expect(await copyWhenReady(Promise.resolve('link'))).toBe(true);
    expect(writeText).toHaveBeenCalledWith('link');
  });

  it('falls back to writeText when the ClipboardItem write is rejected', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ write: vi.fn().mockRejectedValue(new Error('NotAllowed')), writeText });
    expect(await copyWhenReady(Promise.resolve('link'))).toBe(true);
    expect(writeText).toHaveBeenCalledWith('link');
  });

  it('returns false, without throwing, when the request fails', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ write: vi.fn().mockRejectedValue(new Error('aborted')), writeText });
    expect(await copyWhenReady(Promise.reject(new Error('500')))).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns false when the clipboard is blocked entirely', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowed')) }, false);
    expect(await copyWhenReady(Promise.resolve('link'))).toBe(false);
  });

  it('returns false when there is no clipboard API (old browser, non-HTTPS)', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyWhenReady(Promise.resolve('link'))).toBe(false);
  });
});
