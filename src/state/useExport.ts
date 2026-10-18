import { useCallback } from 'react';
import type { ExportJob } from '../lib/export/export';
import { describePackage } from '../lib/packages';
import type { RecentJob } from '../lib/storage/recent';
import { findPackage, useStore } from './store';
import { useLayout } from './useLayout';

/** Download and print actions for the current sheets. Both also save the job to Recent. */
export function useExport() {
  const layout = useLayout();

  const run = useCallback(
    async (kind: 'download' | 'print') => {
      const state = useStore.getState();
      const { people, settings, customPackages } = state;
      if (!people.length || state.busy) return;
      if (layout.unplaced.length) {
        state.toast('Some photos don’t fit this paper. Choose bigger paper or a smaller margin first.', 'error');
        return;
      }

      const job: ExportJob = { sheets: layout.sheets, people, cutStyle: settings.cutStyle, calibration: settings.calibration };
      state.setBusy(kind === 'download' ? 'export' : 'print');
      // Let the button show its busy state before the heavy work starts.
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      try {
        // pdf-lib and the zip encoder load on first export, keeping the first page load light.
        const { downloadFile, exportBaseName, exportFiles, exportPdf, printPdf, renderSheetCanvas } = await import('../lib/export/export');
        const base = exportBaseName(people);
        if (kind === 'download') {
          const file = await exportFiles(job, settings.exportFormat, base);
          downloadFile(file);
          state.toast(`Downloaded ${file.name}`, 'success');
        } else {
          await printPdf(await exportPdf(job));
          state.toast('In the print dialog, set the scale to Actual size (100%).', 'info');
        }
        await state.rememberJob(await recentFrom(job, customPackages, settings, renderSheetCanvas));
      } catch (error) {
        console.error(error);
        state.toast(kind === 'download' ? 'The file couldn’t be created. Try again, or try a different format.' : 'Printing couldn’t start. Download the PDF and print it instead.', 'error');
      } finally {
        useStore.getState().setBusy(null);
      }
    },
    [layout]
  );

  return {
    download: () => run('download'),
    print: () => run('print'),
    canExport: !layout.sample && layout.sheets.length > 0
  };
}

async function recentFrom(
  job: ExportJob,
  custom: ReturnType<typeof useStore.getState>['customPackages'],
  settings: ReturnType<typeof useStore.getState>['settings'],
  renderSheetCanvas: typeof import('../lib/export/export').renderSheetCanvas
): Promise<RecentJob> {
  const canvas = renderSheetCanvas(job.sheets[0], job, 40);
  const thumbnail = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b ?? new Blob()), 'image/jpeg', 0.8));
  const now = Date.now();
  const names = job.people.map(p => p.name);
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + settings.recentHours * 3_600_000,
    title: names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} others`,
    summary: job.people.map(p => `${findPackage(custom, p.packageId).name} (${describePackage(findPackage(custom, p.packageId))})`).join('; '),
    thumbnail,
    people: job.people.map(p => ({
      name: p.name,
      photo: p.photo.blob,
      face: p.face,
      crops: p.crops,
      adjust: p.adjust,
      packageId: p.packageId
    })),
    settings: {
      paper: settings.paper,
      cutStyle: settings.cutStyle,
      exportFormat: settings.exportFormat,
      calibration: settings.calibration
    }
  };
}
