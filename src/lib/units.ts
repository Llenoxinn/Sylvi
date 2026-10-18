// All physical measurements in Sylvi are stored in millimetres.
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const PRINT_DPI = 300;

export const inToMm = (inches: number) => inches * MM_PER_INCH;
export const mmToIn = (mm: number) => mm / MM_PER_INCH;
export const mmToPt = (mm: number) => (mm / MM_PER_INCH) * PT_PER_INCH;
export const mmToPx = (mm: number, dpi = PRINT_DPI) => (mm / MM_PER_INCH) * dpi;

export type Unit = 'in' | 'mm';

/** Formats a length for display, e.g. 50.8mm → "2 in" or "50.8 mm". */
export function formatLength(mm: number, unit: Unit): string {
  if (unit === 'mm') return `${trim(mm, 1)} mm`;
  return `${trim(mmToIn(mm), 2)} in`;
}

export function formatSize(wMm: number, hMm: number, unit: Unit): string {
  const f = (v: number) => (unit === 'mm' ? trim(v, 1) : trim(mmToIn(v), 2));
  return `${f(wMm)} × ${f(hMm)} ${unit}`;
}

function trim(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}
