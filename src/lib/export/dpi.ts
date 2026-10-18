/**
 * Canvas exports carry no resolution, so photo apps assume 72 or 96 DPI and
 * print them at the wrong size. These helpers stamp the real DPI into the file.
 */

/** Inserts (or replaces) a pHYs chunk right after IHDR. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const IHDR_END = 8 + 25; // signature + IHDR (length, type, 13 data bytes, crc)
  const ppm = Math.round(dpi / 0.0254);

  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Drop an existing pHYs chunk if the encoder wrote one.
  const parts: Uint8Array[] = [png.subarray(0, IHDR_END), chunk];
  let offset = IHDR_END;
  const src = new DataView(png.buffer, png.byteOffset, png.byteLength);
  while (offset < png.length) {
    const length = src.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (type !== 'pHYs') parts.push(png.subarray(offset, end));
    offset = end;
  }
  return concat(parts);
}

/** Sets the density fields of the JFIF APP0 header written by browsers. */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  const out = new Uint8Array(jpeg);
  const isJfif = out[2] === 0xff && out[3] === 0xe0 && String.fromCharCode(...out.subarray(6, 11)) === 'JFIF\0';
  if (!isJfif) return out;
  out[13] = 1; // units: dots per inch
  out[14] = dpi >> 8;
  out[15] = dpi & 0xff;
  out[16] = dpi >> 8;
  out[17] = dpi & 0xff;
  return out;
}

let table: Uint32Array | null = null;

export function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
