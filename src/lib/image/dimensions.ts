/** Reads dimensions before asking the browser to allocate decoded pixels. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 25 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const kind = text(12, 4);
    if (kind === 'VP8X' && bytes.length >= 30) return { width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16) };
    if (kind === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    return null;
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let swap = false;
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) break;
    if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = view.getUint16(offset);
    const end = offset + length;
    if (length < 2 || end > bytes.length) return null;
    if (marker === 0xe1 && length >= 16 && text(offset + 2, 6) === 'Exif\0\0') {
      const base = offset + 8;
      const little = text(base, 2) === 'II';
      if ((little || text(base, 2) === 'MM') && base + 8 <= end) {
        const directory = base + view.getUint32(base + 4, little);
        if (directory >= base && directory + 2 <= end) {
          const count = Math.min(view.getUint16(directory, little), 128);
          for (let i = 0, tag = directory + 2; i < count && tag + 12 <= end; i++, tag += 12) {
            if (view.getUint16(tag, little) === 0x112 && view.getUint16(tag + 2, little) === 3 && view.getUint32(tag + 4, little) === 1) {
              const orientation = view.getUint16(tag + 8, little);
              swap = orientation >= 5 && orientation <= 8;
            }
          }
        }
      }
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
      const width = view.getUint16(offset + 5);
      const height = view.getUint16(offset + 3);
      return swap ? { width: height, height: width } : { width, height };
    }
    offset = end;
  }
  return null;
}
