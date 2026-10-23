import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageDimensions } from './dimensions';
import { loadPhoto } from './load';

function png(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
afterEach(() => vi.unstubAllGlobals());

describe('safe image loading', () => {
  it('rejects excessive pixel counts before calling the decoder', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    await expect(loadPhoto(new Blob([png(12000, 9000)], { type: 'image/png' }))).rejects.toThrow('40 megapixels');
    expect(decode).not.toHaveBeenCalled();
  });

  it('requests a resized bitmap on the first and only decode', async () => {
    const bitmap = { width: 3200, height: 2400, close: vi.fn() };
    const decode = vi.fn(async () => bitmap);
    vi.stubGlobal('createImageBitmap', decode);
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['resized'])) }) });
    const photo = await loadPhoto(new Blob([png(6000, 4500)], { type: 'image/png' }));
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ resizeWidth: 3200, resizeHeight: 2400 }));
    expect(photo.width).toBe(3200);
  });

  it('rejects unsupported or damaged files before decoding', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    await expect(loadPhoto(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toThrow('supported JPG');
    await expect(loadPhoto(new Blob([png(0, 10)], { type: 'image/png' }))).rejects.toThrow('header');
    expect(decode).not.toHaveBeenCalled();
  });

  it('rejects files over the byte limit before reading their headers', async () => {
    const file = { size: 26 * 1024 * 1024, type: 'image/jpeg', slice: vi.fn() } as unknown as Blob;
    await expect(loadPhoto(file)).rejects.toThrow('25 MB');
    expect(file.slice).not.toHaveBeenCalled();
  });

  it('reads JPEG dimensions and applies EXIF rotation before resizing', () => {
    const bytes = new Uint8Array(49);
    bytes.set([0xff, 0xd8, 0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 8, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 0x112, true);
    view.setUint16(24, 3, true);
    view.setUint32(26, 1, true);
    view.setUint16(30, 6, true);
    bytes.set([0xff, 0xc0, 0, 9, 8], 38);
    view.setUint16(43, 3000);
    view.setUint16(45, 4000);
    expect(imageDimensions(bytes)).toEqual({ width: 3000, height: 4000 });
    for (let end = 0; end < bytes.length; end++) expect(() => imageDimensions(bytes.slice(0, end))).not.toThrow();
  });

  it.each(['VP8X', 'VP8 ', 'VP8L'])('reads %s WebP dimensions without decoding', kind => {
    const bytes = new Uint8Array(30);
    const write = (offset: number, text: string) => bytes.set(new TextEncoder().encode(text), offset);
    write(0, 'RIFF'); write(8, 'WEBP'); write(12, kind);
    const view = new DataView(bytes.buffer);
    if (kind === 'VP8X') { bytes[24] = 99; bytes[27] = 199; }
    if (kind === 'VP8 ') { bytes.set([0x9d, 1, 0x2a], 23); view.setUint16(26, 100, true); view.setUint16(28, 200, true); }
    if (kind === 'VP8L') { bytes[20] = 0x2f; view.setUint32(21, 99 | 199 << 14, true); }
    expect(imageDimensions(bytes)).toEqual({ width: 100, height: 200 });
  });
});
