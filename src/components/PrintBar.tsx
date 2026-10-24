import { useId } from 'react';
import { Download, LoaderCircle, Printer } from 'lucide-react';
import { EXPORT_FORMATS } from '../lib/export/formats';
import { CUT_STYLES } from '../lib/layout/guides';
import { CUSTOM_PAPER_ID, PAPERS, type Orientation } from '../lib/papers';
import { inToMm, mmToIn } from '../lib/units';
import { useStore } from '../state/store';
import { useExport } from '../state/useExport';
import { useLayout } from '../state/useLayout';
import GlideSelect from './reactbits/GlideSelect/GlideSelect';
import { Segmented } from './ui';

// One look for every dropdown in the bar; menus open upward, away from the bottom edge.
const GLIDE = {
  accentColor: 'var(--accent)',
  surfaceColor: 'var(--surface-2)',
  highlightColor: 'var(--surface-3)',
  textColor: 'var(--ink)',
  size: 'md',
  radius: 10,
  placement: 'top'
} as const;

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' }
];

/**
 * Everything about the printout, in one labeled strip under the sheet: the
 * paper on the left, the file and the two ways out on the right. It replaces
 * the inspector's paper, cut-guide and export sections and the icon dock.
 */
export function PrintBar() {
  const paper = useStore(s => s.settings.paper);
  const unit = useStore(s => s.settings.unit);
  const cutStyle = useStore(s => s.settings.cutStyle);
  const calibration = useStore(s => s.settings.calibration);
  const format = useStore(s => s.settings.exportFormat);
  const update = useStore(s => s.updateSettings);
  const busy = useStore(s => s.busy);
  const layout = useLayout();
  const { download, print, canExport } = useExport();
  const marginId = useId();

  const toDisplay = (mm: number) => (unit === 'in' ? Number(mmToIn(mm).toFixed(3)) : Number(mm.toFixed(1)));
  const fromDisplay = (v: number) => (unit === 'in' ? inToMm(v) : v);
  const setPaper = (patch: Partial<typeof paper>) => update({ paper: { ...paper, ...patch } });

  const sheets = layout.sheets.length;
  const label = format === 'pdf' ? 'Download PDF' : sheets > 1 ? `Download ${sheets} ${format.toUpperCase()}s (zip)` :`Download ${format.toUpperCase()}`;
  const borderless = paper.marginMm === 0;

  return (
    <footer className="printbar" aria-label="Print settings">
      <div className="pb-group" role="group" aria-label="Paper">
        <span className="pb-group-title" aria-hidden="true">Paper</span>
        <GlideSelect
          options={[...PAPERS.map(p => ({ value: p.id, label: p.label, tag: p.hint })), { value: CUSTOM_PAPER_ID, label: 'Custom', tag: 'Your own size' }]}
          value={paper.paperId}
          onChange={value => {
            const next = PAPERS.find(p => p.id === value);
            setPaper({ paperId: value, ...(next ? { marginMm: next.marginMm } : {}) });
          }}
          ariaLabel="Paper size"
          showTags
          {...GLIDE}
          menuWidth={260}
          align="left"
        />
        {paper.paperId === CUSTOM_PAPER_ID ? (
          <>
            <SizeField label="Width" unit={unit} value={toDisplay(paper.customWidthMm)} onChange={v => setPaper({ customWidthMm: Math.max(20, fromDisplay(v)) })} />
            <SizeField label="Height" unit={unit} value={toDisplay(paper.customHeightMm)} onChange={v => setPaper({ customHeightMm: Math.max(20, fromDisplay(v)) })} />
          </>
        ) : null}
        <Segmented label="Orientation" value={paper.orientation} options={ORIENTATIONS} onChange={orientation => setPaper({ orientation })} />
        <div className="pb-field">
          <label className="pb-label" htmlFor={marginId}>
            Margin
          </label>
          <div
            className="input-unit input-unit--sm"
            title={
              borderless
                ? 'Borderless. Turn on borderless printing in your printer settings, or set a margin.'
                : 'Space your printer can’t print on. Check your printer’s manual if unsure.'
            }
          >
            <input
              id={marginId}
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step={unit === 'in' ? 0.05 : 1}
              value={toDisplay(paper.marginMm)}
              onChange={e => setPaper({ marginMm: Math.max(0, fromDisplay(Number(e.target.value) || 0)) })}
            />
            <span>{unit}</span>
          </div>
          {borderless ? <span className="pb-note">Borderless</span> : null}
        </div>
      </div>

      <div className="pb-group" role="group" aria-label="Cut guides">
        <span className="pb-group-title" aria-hidden="true">Cuts</span>
        <GlideSelect
          options={CUT_STYLES.map(c => ({ value: c.id, label: c.label, tag: c.hint }))}
          value={cutStyle}
          onChange={value => update({ cutStyle: value as typeof cutStyle })}
          ariaLabel="Cut guide style"
          showTags
          {...GLIDE}
          menuWidth={330}
          align="left"
        />
        <label className="check pb-check" title="Adds a 1-inch line when there’s room, to confirm the print size with a ruler">
          <input type="checkbox" checked={calibration} onChange={e => update({ calibration: e.target.checked })} />
          <span>1-inch check</span>
        </label>
      </div>

      <div className="pb-group pb-group--output" role="group" aria-label="Output">
        <p className="pb-hint">Print at Actual size (100%)</p>
        <GlideSelect
          options={EXPORT_FORMATS.map(f => ({ value: f.id, label: f.label, tag: f.tag }))}
          value={format}
          onChange={value => update({ exportFormat: value as typeof format })}
          ariaLabel="File format"
          showTags
          {...GLIDE}
          menuWidth={210}
          align="right"
        />
        <button type="button" className="btn" onClick={print} disabled={!canExport || busy !== null}>
          {busy === 'print' ? <LoaderCircle size={16} className="spin" /> : <Printer size={16} />}
          {busy === 'print' ? 'Opening…' : 'Print'}
        </button>
        <button type="button" className="btn btn--primary" onClick={download} disabled={!canExport || busy !== null}>
          {busy === 'export' ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
          {busy === 'export' ? 'Preparing…' : label}
        </button>
      </div>
    </footer>
  );
}

function SizeField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="pb-field">
      <label className="pb-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-unit input-unit--sm">
        <input id={id} className="input" type="number" inputMode="decimal" min={0} step="any" value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
        <span>{unit}</span>
      </div>
    </div>
  );
}
