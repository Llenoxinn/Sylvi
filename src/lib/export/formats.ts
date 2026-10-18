export type ExportFormat = 'pdf' | 'png' | 'jpg';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; tag: string }[] = [
  { id: 'pdf', label: 'PDF', tag: 'Best for printing' },
  { id: 'png', label: 'PNG', tag: 'Sharpest image' },
  { id: 'jpg', label: 'JPG', tag: 'Smallest file' }
];
