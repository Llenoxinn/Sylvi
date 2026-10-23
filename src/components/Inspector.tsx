import { useId } from 'react';
import { Crop, Download, LoaderCircle, Printer, RotateCcw, ScanFace, Trash2, TriangleAlert } from 'lucide-react';
import { EXPORT_FORMATS } from '../lib/export/formats';
import { CUT_STYLES } from '../lib/layout/guides';
import { CUSTOM_PAPER_ID, PAPERS, type Orientation } from '../lib/papers';
import { inToMm, mmToIn } from '../lib/units';
import { printDpi } from '../lib/person';
import { findPackage, useStore } from '../state/store';
import { useExport } from '../state/useExport';
import { useLayout } from '../state/useLayout';
import GlideSelect from './reactbits/GlideSelect/GlideSelect';
import { Segmented, Slider } from './ui';

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' }
];

export function Inspector() {
  return (
    <aside className="pane pane--inspector" aria-label="Sheet settings">
      <div className="inspector-scroll">
        <PhotoSection />
        <PaperSection />
        <CutSection />
      </div>
      <ExportSection />
    </aside>
  );
}

function PaperSection() {
  const paper = useStore(s => s.settings.paper);
  const unit = useStore(s => s.settings.unit);
  const update = useStore(s => s.updateSettings);
  const paperId = useId();
  const marginId = useId();

  const toDisplay = (mm: number) => (unit === 'in' ? Number(mmToIn(mm).toFixed(3)) : Number(mm.toFixed(1)));
  const fromDisplay = (v: number) => (unit === 'in' ? inToMm(v) : v);
  const setPaper = (patch: Partial<typeof paper>) => update({ paper: { ...paper, ...patch } });

  return (
    <section className="section" aria-labelledby={`${paperId}-title`}>
      <h3 id={`${paperId}-title`} className="section-title">
        Paper
      </h3>
      <div className="field">
        <label className="field-label" htmlFor={paperId}>
          Size
        </label>
        <select
          id={paperId}
          className="select"
          value={paper.paperId}
          onChange={e => {
            const next = PAPERS.find(p => p.id === e.target.value);
            setPaper({ paperId: e.target.value, ...(next ? { marginMm: next.marginMm } : {}) });
          }}
        >
          {PAPERS.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}  ({p.hint})
            </option>
          ))}
          <option value={CUSTOM_PAPER_ID}>Custom size</option>
        </select>
      </div>

      {paper.paperId === CUSTOM_PAPER_ID ? (
        <div className="row">
          <NumberField
            label="Width"
            unit={unit}
            value={toDisplay(paper.customWidthMm)}
            onChange={v => setPaper({ customWidthMm: Math.max(20, fromDisplay(v)) })}
          />
          <NumberField
            label="Height"
            unit={unit}
            value={toDisplay(paper.customHeightMm)}
            onChange={v => setPaper({ customHeightMm: Math.max(20, fromDisplay(v)) })}
          />
        </div>
      ) : null}

      <Segmented label="Orientation" value={paper.orientation} options={ORIENTATIONS} onChange={orientation => setPaper({ orientation })} />

      <div className="field">
        <label className="field-label" htmlFor={marginId}>
          Margin
        </label>
        <div className="input-unit">
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
        <p className="hint">
          {paper.marginMm === 0
            ? 'Borderless. Turn on borderless printing in your printer settings, or set a margin.'
            : 'Space your printer can’t print on. Check your printer’s manual if unsure.'}
        </p>
      </div>
    </section>
  );
}

function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="field" style={{ flex: 1 }}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-unit">
        <input id={id} className="input" type="number" inputMode="decimal" min={0} step="any" value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
        <span>{unit}</span>
      </div>
    </div>
  );
}

function CutSection() {
  const cutStyle = useStore(s => s.settings.cutStyle);
  const calibration = useStore(s => s.settings.calibration);
  const update = useStore(s => s.updateSettings);
  const style = CUT_STYLES.find(c => c.id === cutStyle)!;

  return (
    <section className="section" aria-label="Cut guides">
      <h3 className="section-title">Cut guides</h3>
      <Segmented
        label="Cut guide style"
        value={cutStyle}
        options={CUT_STYLES.map(c => ({ id: c.id, label: c.label }))}
        onChange={value => update({ cutStyle: value })}
      />
      <p className="hint">{style.hint}.</p>
      <label className="check">
        <input type="checkbox" checked={calibration} onChange={e => update({ calibration: e.target.checked })} />
        <span>Add a 1-inch check line when there’s room, to confirm the print size with a ruler</span>
      </label>
    </section>
  );
}

function PhotoSection() {
  const person = useStore(s => s.people.find(p => p.id === s.activeId) ?? null);
  const rename = useStore(s => s.renamePerson);
  const setAdjust = useStore(s => s.setAdjust);
  const resetAdjust = useStore(s => s.resetAdjust);
  const removePerson = useStore(s => s.removePerson);
  const openCropEditor = useStore(s => s.openCropEditor);
  const custom = useStore(s => s.customPackages);
  const nameId = useId();

  if (!person) {
    return (
      <section className="section" aria-label="Photo">
        <h3 className="section-title">Photo</h3>
        <p className="hint">Add a photo to adjust its crop, brightness and sharpness.</p>
      </section>
    );
  }

  const status = {
    looking: { icon: <LoaderCircle size={14} className="spin" />, text: 'Finding the face…' },
    found: { icon: <ScanFace size={14} />, text: 'Face found and cropped automatically.' },
    none: { icon: <ScanFace size={14} />, text: 'No face found, so the photo is centered. Adjust the crop to frame it.' },
    failed: { icon: <ScanFace size={14} />, text: 'Face detection isn’t available offline yet, so the photo is centered.' }
  }[person.faceStatus];
  const adjusted = person.adjust.brightness || person.adjust.contrast || person.adjust.sharpen;
  const dpi = printDpi(person, findPackage(custom, person.packageId, person.packageSnapshot).items.map(i => i.size));

  return (
    <section className="section" aria-label="Photo">
      <div className="field">
        <label className="field-label" htmlFor={nameId}>
          Customer name
        </label>
        <input id={nameId} className="input" value={person.name} maxLength={40} onChange={e => rename(person.id, e.target.value)} />
      </div>

      <p className={`face-status face-status--${person.faceStatus}`} aria-live="polite">
        {status.icon}
        {status.text}
      </p>

      {dpi < 200 ? (
        <p className="face-status face-status--none" role="note">
          <TriangleAlert size={14} />
          This photo is small ({person.photo.width} × {person.photo.height} px), so prints come out at about {dpi} DPI and may look soft. Ask
          the customer for a bigger photo if you can.
        </p>
      ) : null}

      <button type="button" className="btn btn--block" onClick={() => openCropEditor(person.id)}>
        <Crop size={16} />
        Adjust crop
      </button>

      <Slider label="Brightness" value={person.adjust.brightness} min={-100} max={100} onChange={v => setAdjust(person.id, { brightness: v })} />
      <Slider label="Contrast" value={person.adjust.contrast} min={-100} max={100} onChange={v => setAdjust(person.id, { contrast: v })} />
      <Slider label="Sharpness" value={person.adjust.sharpen} min={0} max={100} format={String} onChange={v => setAdjust(person.id, { sharpen: v })} />

      <div className="row row--split">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => resetAdjust(person.id)} disabled={!adjusted}>
          <RotateCcw size={14} />
          Reset adjustments
        </button>
        <button type="button" className="btn btn--sm btn--ghost btn--danger" onClick={() => removePerson(person.id)}>
          <Trash2 size={14} />
          Remove
        </button>
      </div>
    </section>
  );
}

function ExportSection() {
  const format = useStore(s => s.settings.exportFormat);
  const update = useStore(s => s.updateSettings);
  const busy = useStore(s => s.busy);
  const layout = useLayout();
  const { download, print, canExport } = useExport();
  const sheets = layout.sheets.length;
  const label = format === 'pdf' ? 'Download PDF' : sheets > 1 ? `Download ${sheets} ${format.toUpperCase()}s (zip)` : `Download ${format.toUpperCase()}`;

  return (
    <section className="export" aria-label="Export">
      <div className="export-format">
        <span className="field-label">File format</span>
        <GlideSelect
          options={EXPORT_FORMATS.map(f => ({ value: f.id, label: f.label, tag: f.tag }))}
          value={format}
          onChange={value => update({ exportFormat: value as typeof format })}
          ariaLabel="File format"
          showTags
          accentColor="var(--accent)"
          surfaceColor="var(--surface-2)"
          highlightColor="var(--surface-3)"
          textColor="var(--ink)"
          size="md"
          radius={10}
          menuWidth={210}
          placement="top"
          align="right"
        />
      </div>
      <button type="button" className="btn btn--primary btn--lg btn--block" onClick={download} disabled={!canExport || busy !== null}>
        {busy === 'export' ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}
        {busy === 'export' ? 'Preparing file…' : label}
      </button>
      <button type="button" className="btn btn--lg btn--block" onClick={print} disabled={!canExport || busy !== null}>
        {busy === 'print' ? <LoaderCircle size={18} className="spin" /> : <Printer size={18} />}
        {busy === 'print' ? 'Opening print dialog…' : 'Print'}
      </button>
      <p className="hint">Print at Actual size (100%). Fit to page shrinks the photos.</p>
    </section>
  );
}
