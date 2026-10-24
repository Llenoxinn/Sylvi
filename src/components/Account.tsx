import { useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, LoaderCircle, LogOut, RefreshCw, TriangleAlert, UserRound } from 'lucide-react';
import { accountsEnabled, sendSignInLink, signInWithGoogle, signOut } from '../lib/cloud';
import { useStore } from '../state/store';
import { Dialog } from './ui';
import Stepper, { Step } from './reactbits/Stepper/Stepper';

/** Top-bar account button. Hidden when accounts aren't configured. */
export function AccountButton() {
  const account = useStore(s => s.account);
  const openPanel = useStore(s => s.openPanel);
  if (!accountsEnabled) return null;

  return (
    <button type="button" className="btn btn--sm account-btn" onClick={() => openPanel('settings')}>
      {account ? (
        <>
          <span className="avatar" aria-hidden="true">
            {account.email[0]?.toUpperCase()}
          </span>
          <span className="account-email">{account.email}</span>
        </>
      ) : (
        <>
          <UserRound size={15} />
          Sign in
        </>
      )}
    </button>
  );
}

/**
 * A sync failure in words a shop can act on. The raw message stays under
 * Technical details for whoever set up the shop database.
 */
function syncProblem(message: string): string {
  if (/does not exist|schema cache|relation|column/i.test(message))
    return 'The shop database needs an update before packages can sync. Your packages are safe on this computer and will sync once it’s updated.';
  if (/permission denied|not allowed|jwt|row-level security|policy/i.test(message))
    return 'This account can’t reach the shop database yet. Your packages are safe on this computer.';
  if (/fetch|network|offline|timed? ?out/i.test(message))
    return 'Sylvi couldn’t reach the internet. Your packages are safe on this computer and will sync when you’re back online.';
  return 'Sync didn’t finish. Your packages are safe on this computer. Try again in a moment.';
}

export function AccountForm() {
  const account = useStore(s => s.account);
  const syncing = useStore(s => s.syncing);
  const syncError = useStore(s => s.syncError);
  const busy = useStore(s => s.busy);
  const custom = useStore(s => s.customPackages.filter(p => !p.deletedAt).length);
  const [method, setMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const id = useId();

  if (account) {
    return (
      <div className="account-card">
        <span className="avatar" aria-hidden="true">
          {account.email[0]?.toUpperCase()}
        </span>
        <div className="account-text">
          <p>{account.email}</p>
          <p className="hint" aria-live="polite">
            {syncing ? (
              <>
                <LoaderCircle size={13} className="spin" /> Syncing packages…
              </>
            ) : syncError ? (
              <>
                <TriangleAlert size={13} /> Sync paused
              </>
            ) : (
              <>
                <CircleCheck size={13} /> {custom} custom package{custom === 1 ? '' : 's'} synced
              </>
            )}
          </p>
          {syncError ? (
            <div className="sync-problem">
              <p>{syncProblem(syncError)}</p>
              <div className="row">
                <button type="button" className="btn btn--sm" onClick={() => void useStore.getState().syncAccount()}>
                  <RefreshCw size={14} />
                  Retry sync
                </button>
              </div>
              <details className="sync-details">
                <summary>Technical details</summary>
                <code>{syncError}</code>
              </details>
            </div>
          ) : null}
        </div>
        <button type="button" className="btn btn--sm btn--ghost" disabled={busy !== null} onClick={() => void signOut().catch(() => useStore.getState().toast('Sign-out failed. You are still signed in. Try again.', 'error'))}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    );
  }

  if (state === 'sent') {
    return (
      <p className="hint">
        Check {email} for a sign-in link and open it on this computer. Your packages and settings will sync once you’re in.
      </p>
    );
  }

  const switchTo = (next: 'google' | 'email') => {
    setMethod(next);
    setState('idle');
  };

  const continueWithGoogle = async () => {
    // Google sends the shop back to a fresh page, and photos on the sheet live only in memory.
    if (useStore.getState().people.length && !confirm('Signing in reloads Sylvi, so the photos on the sheet will be cleared. Continue?')) return;
    setState('sending');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in couldn’t start.');
      setState('error');
    }
  };

  const errorHint =
    state === 'error' ? (
      <p id={`${id}-error`} className="hint hint--danger">
        {error} {method === 'email' ? 'Check the address and try again.' : 'Try again, or use email instead.'}
      </p>
    ) : null;

  if (method === 'google') {
    return (
      <div className="account-form">
        <p className="hint">Sign in to use your shop’s packages and settings across computers. Guest packages stay in this browser. Customer photos stay on each computer.</p>
        <button type="button" className="btn btn--block google-btn" disabled={state === 'sending'} onClick={() => void continueWithGoogle()}>
          {state === 'sending' ? <LoaderCircle size={16} className="spin" /> : <GoogleMark />}
          Continue with Google
        </button>
        {errorHint}
        <button type="button" className="btn btn--sm btn--ghost account-switch" onClick={() => switchTo('email')}>
          Use email instead
        </button>
      </div>
    );
  }

  return (
    <form
      className="account-form"
      onSubmit={async e => {
        e.preventDefault();
        setState('sending');
        try {
          await sendSignInLink(email.trim());
          setState('sent');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The link couldn’t be sent.');
          setState('error');
        }
      }}
    >
      <p className="hint">We’ll email you a link to sign in. No password needed.</p>
      <label className="visually-hidden" htmlFor={id}>
        Email address
      </label>
      <div className="row">
        <input
          id={id}
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder="shop@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-describedby={state === 'error' ? `${id}-error` : undefined}
        />
        <button type="submit" className="btn btn--primary" disabled={state === 'sending'}>
          {state === 'sending' ? <LoaderCircle size={15} className="spin" /> : null}
          Email me a link
        </button>
      </div>
      {errorHint}
      <button type="button" className="btn btn--sm btn--ghost account-switch" onClick={() => switchTo('google')}>
        Use Google instead
      </button>
    </form>
  );
}

/**
 * Asks a signed-in shop for its details. "Later" hides it until Sylvi is next
 * opened; it stops appearing once the shop has a name.
 */
export function ShopSetup() {
  const needed = useStore(s => s.account !== null && !s.syncing && s.panel === null && !s.settings.shopName.trim());
  const email = useStore(s => s.account?.email ?? '');
  const theme = useStore(s => s.settings.theme);
  const update = useStore(s => s.updateSettings);
  const [later, setLater] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const open = needed && !later;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // The name step focuses its field, so a worker can type straight away.
  useEffect(() => {
    if (open && step === 2) nameRef.current?.focus();
  }, [open, step]);

  const save = () => {
    if (name.trim()) update({ shopName: name.trim(), shopPhone: phone.trim(), shopCity: city.trim() });
  };
  // Enter moves on from a field, unless the shop still has no name.
  const advance = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (step === 2 && !name.trim()) return;
    if (step === 3) setStep(4);
    else setStep(step + 1);
  };

  return (
    <Dialog open={open} title="Set up your shop" onClose={() => setLater(true)}>
      <Stepper
        step={step}
        onStepChange={setStep}
        onFinalStepCompleted={save}
        linear
        frame={false}
        width="100%"
        theme={dark ? 'dark' : 'light'}
        accentColor={dark ? '#f06a9b' : '#c2185b'}
        backButtonText="Back"
        nextButtonText="Continue"
        completeButtonText="Save shop"
        nextButtonProps={{ disabled: step === 2 && !name.trim() }}
        className="shop-stepper"
        // The app's own surfaces and ink in place of the component's zinc palette.
        style={
          {
            '--stepper-tile': 'var(--surface)',
            '--stepper-tile-edge': 'var(--line)',
            '--stepper-tile-highlight': 'transparent',
            '--stepper-tile-shadow': 'var(--shadow-control)',
            '--stepper-well': 'var(--surface-2)',
            '--stepper-track': 'var(--line)',
            '--stepper-ink': 'var(--ink)',
            '--stepper-muted': 'var(--ink-2)',
            '--stepper-faint': 'var(--line-strong)',
            '--stepper-ring': 'var(--line-strong)',
            '--stepper-hover-fill': 'var(--surface-2)'
          } as React.CSSProperties
        }
      >
        <Step title="Welcome">
          <div className="account-form">
            <h3 className="shop-step-title">You’re signed in</h3>
            <p className="hint">
              {email ? `${email} is connected. ` : ''}Add your shop’s details once and they appear in the top bar on every computer you sign in on.
            </p>
          </div>
        </Step>
        <Step title="Shop">
          <div className="account-form">
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-name`}>
                Shop name
              </label>
              <input
                ref={nameRef}
                id={`${formId}-name`}
                className="input"
                required
                maxLength={60}
                autoComplete="organization"
                placeholder="e.g. JM Printing & Photocopy"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={advance}
              />
            </div>
          </div>
        </Step>
        <Step title="Contact">
          <div className="account-form">
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-phone`}>
                Mobile number <span>Optional</span>
              </label>
              <input
                id={`${formId}-phone`}
                className="input"
                type="tel"
                maxLength={20}
                autoComplete="tel"
                placeholder="0917 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={advance}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-city`}>
                City or town <span>Optional</span>
              </label>
              <input
                id={`${formId}-city`}
                className="input"
                maxLength={60}
                autoComplete="address-level2"
                placeholder="e.g. Quezon City"
                value={city}
                onChange={e => setCity(e.target.value)}
                onKeyDown={advance}
              />
            </div>
          </div>
        </Step>
        <Step title="Review">
          <div className="account-form">
            <dl className="shop-review">
              <dt>Shop</dt>
              <dd>{name.trim() || '—'}</dd>
              <dt>Mobile</dt>
              <dd>{phone.trim() || 'Not added'}</dd>
              <dt>City</dt>
              <dd>{city.trim() || 'Not added'}</dd>
            </dl>
            <p className="hint">You can change these anytime in Settings.</p>
          </div>
        </Step>
      </Stepper>
    </Dialog>
  );
}

/** Google's "G", in the colours its sign-in guidelines require. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
