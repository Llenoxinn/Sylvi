import { MM_PER_INCH, type Unit } from '../lib/units';

const THICK = 20;

/** Inch or millimetre rulers along the top and left edge of the sheet, at true scale. */
export function Rulers({ widthMm, heightMm, scale, unit }: { widthMm: number; heightMm: number; scale: number; unit: Unit }) {
  return (
    <>
      <Ruler lengthMm={widthMm} scale={scale} unit={unit} axis="x" />
      <Ruler lengthMm={heightMm} scale={scale} unit={unit} axis="y" />
    </>
  );
}

function Ruler({ lengthMm, scale, unit, axis }: { lengthMm: number; scale: number; unit: Unit; axis: 'x' | 'y' }) {
  const ticks: { at: number; size: number; label?: string }[] = [];

  if (unit === 'in') {
    const step = MM_PER_INCH / (scale * MM_PER_INCH / 8 >= 5 ? 8 : 4);
    const count = Math.floor(lengthMm / step + 1e-6);
    const perInch = Math.round(MM_PER_INCH / step);
    for (let i = 0; i <= count; i++) {
      const whole = i % perInch === 0;
      const half = i % (perInch / 2) === 0;
      ticks.push({ at: i * step, size: whole ? 9 : half ? 6 : 3.5, label: whole && i > 0 ? String(i / perInch) : undefined });
    }
  } else {
    const step = scale >= 3 ? 1 : 5;
    for (let mm = 0; mm <= lengthMm + 1e-6; mm += step) {
      const cm = mm % 10 === 0;
      ticks.push({ at: mm, size: cm ? 9 : mm % 5 === 0 ? 6 : 3.5, label: cm && mm > 0 && (scale >= 2 || mm % 20 === 0) ? String(mm / 10) : undefined });
    }
  }

  const length = lengthMm * scale;
  const horizontal = axis === 'x';

  return (
    <svg
      className={`ruler ruler--${axis}`}
      width={horizontal ? length : THICK}
      height={horizontal ? THICK : length}
      aria-hidden="true"
    >
      {ticks.map((t, i) => {
        const p = Math.round(t.at * scale) + 0.5;
        return horizontal ? (
          <g key={i}>
            <line x1={p} x2={p} y1={THICK} y2={THICK - t.size} />
            {t.label ? (
              <text x={p - 3} y={THICK - 10} textAnchor="end">
                {t.label}
              </text>
            ) : null}
          </g>
        ) : (
          <g key={i}>
            <line y1={p} y2={p} x1={THICK} x2={THICK - t.size} />
            {t.label ? (
              <text x={THICK - 11} y={p - 3} textAnchor="end">
                {t.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <text className="ruler-unit" x={horizontal ? 0 : THICK - 11} y={horizontal ? THICK - 10 : 9} textAnchor={horizontal ? 'start' : 'end'}>
        {unit}
      </text>
    </svg>
  );
}
