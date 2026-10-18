import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <label key={o.id}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  format = v => (v > 0 ? `+${v}` : String(v))
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        <output htmlFor={id}>{format(value)}</output>
      </label>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        value={value}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** A modal built on <dialog>, so focus trapping and Escape come for free. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClick={e => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      {footer ? <div className="dialog-foot">{footer}</div> : null}
    </dialog>
  );
}

/** Four crop-mark corners: the Sylvi mark. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
