import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printPdf } from './export';

let frame: {
  style: { cssText: string };
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  contentWindow: { focus: ReturnType<typeof vi.fn>; print: ReturnType<typeof vi.fn> };
  remove: ReturnType<typeof vi.fn>;
};
let append: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  frame = { style: { cssText: '' }, src: '', onload: null, onerror: null, contentWindow: { focus: vi.fn(), print: vi.fn() }, remove: vi.fn() };
  append = vi.fn();
  vi.stubGlobal('document', { createElement: () => frame, body: { append } });
  vi.stubGlobal('window', { open: vi.fn(() => ({})) });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sheet');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('PDF printing', () => {
  it('handles a load during frame insertion and releases the PDF after printing', async () => {
    append.mockImplementation(() => frame.onload?.());
    await printPdf(new Uint8Array([1]));
    expect(frame.contentWindow.print).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(frame.remove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet');
  });

  it('rejects failed PDF loads and cleans up the frame', async () => {
    const pending = printPdf(new Uint8Array([1]));
    const rejected = expect(pending).rejects.toThrow('load');
    frame.onerror?.();
    await rejected;
    expect(frame.remove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet');
  });

  it('times out a PDF that never loads instead of leaving the app busy', async () => {
    const pending = printPdf(new Uint8Array([1]));
    const rejected = expect(pending).rejects.toThrow('load');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(frame.remove).toHaveBeenCalledOnce();
  });

  it('reports failure when embedded printing and the fallback window are blocked', async () => {
    frame.contentWindow.print.mockImplementation(() => { throw new Error('blocked'); });
    vi.mocked(window.open).mockReturnValue(null);
    const pending = printPdf(new Uint8Array([1]));
    const rejected = expect(pending).rejects.toThrow('blocked');
    frame.onload?.();
    await rejected;
    expect(frame.remove).toHaveBeenCalledOnce();
  });
});
