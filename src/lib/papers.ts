import { inToMm } from './units';

export interface Paper {
  id: string;
  label: string;
  /** Short note shown under the label, e.g. the size in inches. */
  hint: string;
  widthMm: number;
  heightMm: number;
  /** Default printable margin. Photo paper is usually printed borderless. */
  marginMm: number;
}

export const PAPERS: Paper[] = [
  { id: '3r', label: '3R', hint: '3.5 × 5 in photo paper', widthMm: inToMm(3.5), heightMm: inToMm(5), marginMm: 0 },
  { id: '4r', label: '4R', hint: '4 × 6 in photo paper', widthMm: inToMm(4), heightMm: inToMm(6), marginMm: 0 },
  { id: '5r', label: '5R', hint: '5 × 7 in photo paper', widthMm: inToMm(5), heightMm: inToMm(7), marginMm: 0 },
  { id: 'a4', label: 'A4', hint: '210 × 297 mm', widthMm: 210, heightMm: 297, marginMm: 6.35 },
  { id: 'short', label: 'Short bond', hint: '8.5 × 11 in (Letter)', widthMm: inToMm(8.5), heightMm: inToMm(11), marginMm: 6.35 },
  { id: 'long', label: 'Long bond', hint: '8.5 × 13 in', widthMm: inToMm(8.5), heightMm: inToMm(13), marginMm: 6.35 }
];

export const CUSTOM_PAPER_ID = 'custom';

export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface PaperSetup {
  paperId: string;
  customWidthMm: number;
  customHeightMm: number;
  orientation: Orientation;
  marginMm: number;
}

export function resolvePaper(setup: PaperSetup): { widthMm: number; heightMm: number; label: string } {
  if (setup.paperId === CUSTOM_PAPER_ID) {
    return { widthMm: setup.customWidthMm, heightMm: setup.customHeightMm, label: 'Custom' };
  }
  const paper = PAPERS.find(p => p.id === setup.paperId) ?? PAPERS[1];
  return { widthMm: paper.widthMm, heightMm: paper.heightMm, label: paper.label };
}
