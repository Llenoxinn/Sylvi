import { useId } from 'react';
import { accountsEnabled } from '../lib/cloud';
import { RECENT_WINDOWS, type Theme } from '../lib/storage/settings';
import type { Unit } from '../lib/units';
import { useStore } from '../state/store';
import { AccountForm } from './Account';
import { Dialog, Segmented } from './ui';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
];

const UNITS: { id: Unit; label: string }[] = [
  { id: 'in', label: 'Inches' },
  { id: 'mm', label: 'Millimetres' }
];

export function SettingsPanel() {
  const open = useStore(s => s.panel === 'settings');
  const settings = useStore(s => s.settings);
  const update = useStore(s => s.updateSettings);
  const shopId = useId();
  const recentId = useId();
  const close = () => useStore.getState().openPanel(null);

  return (
    <Dialog open={open} title="Settings" onClose={close}>
      <div className="field">
        <label className="field-label" htmlFor={shopId}>
          Shop name
        </label>
        <input
          id={shopId}
          className="input"
          value={settings.shopName}
          maxLength={60}
          placeholder="Shown in the top bar"
          onChange={e => update({ shopName: e.target.value })}
        />
      </div>

      <div className="field">
        <span className="field-label">Measure in</span>
        <Segmented label="Units" value={settings.unit} options={UNITS} onChange={unit => update({ unit })} />
      </div>

      <div className="field">
        <span className="field-label">Appearance</span>
        <Segmented label="Theme" value={settings.theme} options={THEMES} onChange={theme => update({ theme })} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={recentId}>
          Keep recent jobs for
        </label>
        <select id={recentId} className="select" value={settings.recentHours} onChange={e => update({ recentHours: Number(e.target.value) })}>
          {RECENT_WINDOWS.map(w => (
            <option key={w.hours} value={w.hours}>
              {w.label}
            </option>
          ))}
        </select>
        <p className="hint">After this, a job and its customer photos are deleted from this computer automatically.</p>
      </div>

      {accountsEnabled ? (
        <div className="field settings-account">
          <span className="field-label">Shop account</span>
          <AccountForm />
        </div>
      ) : null}
    </Dialog>
  );
}
