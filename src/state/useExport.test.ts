// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as output from '../lib/export/export';
import { NO_ADJUST } from '../lib/image/adjust';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';
import { useStore } from './store';
import { useExport } from './useExport';

vi.mock('../lib/cloud', () => ({}));
vi.mock('../lib/export/export', () => ({
  exportFiles: vi.fn(), downloadFile: vi.fn(), exportBaseName: () => 'sheet',
  exportPdf: vi.fn(), printPdf: vi.fn(), renderSheetCanvas: vi.fn()
}));

let root: Root;
let actions: ReturnType<typeof useExport>;
const rememberJob = vi.fn();

function Capture() { actions = useExport(); return null; }

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  useStore.setState({
    people: [{ id: 'person', name: 'Customer', packageId: 'pkg-b', crops: {}, adjust: NO_ADJUST, face: null, faceStatus: 'none',
      photo: { bitmap: {} as ImageBitmap, blob: new Blob(['photo']), width: 320, height: 320 } }],
    settings: structuredClone(DEFAULT_SETTINGS), customPackages: [], toasts: [], busy: null, rememberJob
  });
  vi.mocked(output.exportFiles).mockResolvedValue({ name: 'sheet.pdf', blob: new Blob(['pdf']) });
  vi.mocked(output.renderSheetCanvas).mockReturnValue({ toBlob: (callback: BlobCallback) => callback(new Blob(['thumb'])) } as HTMLCanvasElement);
  rememberJob.mockResolvedValue(undefined);
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Capture)));
});

afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

describe('export status', () => {
  it('keeps a successful download successful when its recent-job preview fails', async () => {
    vi.mocked(output.renderSheetCanvas).mockImplementationOnce(() => { throw new Error('canvas unavailable'); });
    await act(async () => { await actions.download(); });
    expect(output.downloadFile).toHaveBeenCalledOnce();
    expect(useStore.getState().toasts.map(t => t.message)).toEqual([
      'Downloaded sheet.pdf', 'The file was created, but this job couldn’t be saved for reprinting.'
    ]);
    expect(useStore.getState().busy).toBe(null);
  });

  it('does not save a recent job with an empty preview when canvas encoding fails', async () => {
    vi.mocked(output.renderSheetCanvas).mockReturnValueOnce({ toBlob: (callback: BlobCallback) => callback(null) } as HTMLCanvasElement);
    await act(async () => { await actions.download(); });
    expect(rememberJob).not.toHaveBeenCalled();
    expect(useStore.getState().toasts.at(-1)?.message).toContain('couldn’t be saved for reprinting');
  });

  it('releases the busy state and reports a real export failure', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(output.exportFiles).mockRejectedValueOnce(new Error('export failed'));
      await act(async () => { await actions.download(); });
      expect(output.downloadFile).not.toHaveBeenCalled();
      expect(rememberJob).not.toHaveBeenCalled();
      expect(useStore.getState().busy).toBe(null);
      expect(useStore.getState().toasts.at(-1)?.message).toContain('file couldn’t be created');
    } finally { errorLog.mockRestore(); }
  });
});
